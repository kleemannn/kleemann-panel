import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { AuditService } from '../audit/audit.service';

/**
 * Owns time-based client transitions:
 *
 *  - Flips `ACTIVE` clients to `EXPIRED` once their `expiresAt` is in the
 *    past. Without this, the EXPIRED filter chip and stat counter would
 *    always be empty (nothing else mutates `status` on its own).
 *
 *  - Deletes clients (Remnawave + local row) once they've been EXPIRED for
 *    more than `CLIENT_AUTO_DELETE_DAYS` (default 7) — i.e. the reseller
 *    didn't extend in time.
 *
 * Both jobs are also exposed through `runOnce*` for ad-hoc admin triggers.
 */
@Injectable()
export class LifecycleService {
  private readonly log = new Logger(LifecycleService.name);
  private expiring = false;
  private purging = false;

  constructor(
    private prisma: PrismaService,
    private remna: RemnawaveService,
    private audit: AuditService,
    private cfg: ConfigService,
  ) {}

  // Every 15 minutes is plenty — clients pay attention to "истёк" within
  // the same hour, but cron doesn't need to be tighter than that.
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'lifecycle-expire' })
  async scheduledExpire(): Promise<void> {
    try {
      const r = await this.runExpire();
      if (r.flipped > 0) {
        this.log.log(`expire: flipped ${r.flipped} active client(s) to EXPIRED`);
      }
    } catch (e) {
      this.log.error(`scheduled expire failed: ${(e as Error).message}`);
    }
  }

  // Hourly is enough — the deletion threshold is days, not minutes.
  @Cron(CronExpression.EVERY_HOUR, { name: 'lifecycle-purge' })
  async scheduledPurge(): Promise<void> {
    try {
      const r = await this.runPurge();
      if (r.deleted > 0 || r.errors > 0) {
        this.log.log(`purge: deleted=${r.deleted} errors=${r.errors} retentionDays=${r.retentionDays}`);
      }
    } catch (e) {
      this.log.error(`scheduled purge failed: ${(e as Error).message}`);
    }
  }

  /**
   * Mark every ACTIVE client whose `expiresAt` is in the past as EXPIRED.
   * Idempotent — safe to call repeatedly.
   */
  async runExpire(): Promise<{ flipped: number }> {
    if (this.expiring) return { flipped: 0 };
    this.expiring = true;
    try {
      const now = new Date();
      // Pull IDs first so we can write audit rows for each transition.
      const due = await this.prisma.client.findMany({
        where: {
          status: ClientStatus.ACTIVE,
          expiresAt: { lt: now },
        },
        select: { id: true, resellerId: true, username: true, expiresAt: true },
      });
      if (due.length === 0) return { flipped: 0 };

      const ids = due.map((c) => c.id);
      const res = await this.prisma.client.updateMany({
        where: { id: { in: ids }, status: ClientStatus.ACTIVE },
        data: { status: ClientStatus.EXPIRED },
      });
      // Best-effort audit per client. Failures here mustn't undo the flip.
      await Promise.all(
        due.map((c) =>
          this.audit
            .log({
              actor: 'system:lifecycle',
              resellerId: c.resellerId,
              action: 'client.expired',
              targetId: c.id,
              payload: { username: c.username, expiresAt: c.expiresAt?.toISOString() ?? null },
            })
            .catch((e) =>
              this.log.warn(`audit failed for client.expired ${c.id}: ${(e as Error).message}`),
            ),
        ),
      );
      return { flipped: res.count };
    } finally {
      this.expiring = false;
    }
  }

  /**
   * Delete clients (Remnawave + local) that have been `EXPIRED` for longer
   * than `CLIENT_AUTO_DELETE_DAYS` (default 7).
   */
  async runPurge(): Promise<{ deleted: number; errors: number; retentionDays: number }> {
    const retentionDays = this.retentionDays();
    if (retentionDays <= 0) {
      // Disabled — caller can opt out by setting CLIENT_AUTO_DELETE_DAYS=0.
      return { deleted: 0, errors: 0, retentionDays };
    }
    if (this.purging) return { deleted: 0, errors: 0, retentionDays };
    this.purging = true;
    try {
      const cutoff = new Date(Date.now() - retentionDays * 864e5);
      const stale = await this.prisma.client.findMany({
        where: {
          status: ClientStatus.EXPIRED,
          expiresAt: { lt: cutoff },
        },
        select: {
          id: true,
          resellerId: true,
          username: true,
          remnawaveUuid: true,
          expiresAt: true,
        },
      });
      let deleted = 0;
      let errors = 0;
      let raced = 0;

      for (const c of stale) {
        try {
          // Re-verify status hasn't changed since `findMany` above —
          // a reseller's `extend()` call between our findMany and this
          // iteration would flip the row back to ACTIVE, and we MUST
          // NOT call `remna.deleteUser` on a client that was just
          // re-activated (Remnawave deletion is irreversible).
          const fresh = await this.prisma.client.findUnique({
            where: { id: c.id },
            select: { status: true, expiresAt: true },
          });
          if (
            !fresh ||
            fresh.status !== ClientStatus.EXPIRED ||
            !fresh.expiresAt ||
            fresh.expiresAt.getTime() >= cutoff.getTime()
          ) {
            raced++;
            continue;
          }

          // Try to delete on Remnawave first. 404 = already gone, treat as success.
          try {
            await this.remna.deleteUser(c.remnawaveUuid);
          } catch (e) {
            if (this.errorStatus(e) !== 404) throw e;
          }

          // Local delete is guarded by `status: EXPIRED` so a concurrent
          // `extend()` that completed between our re-check above and this
          // line is still safe — count will be 0 and we skip the audit
          // entry. The Remnawave user is already gone in that scenario,
          // but the local row stays consistent with whatever extend() set.
          const localDel = await this.prisma.client.deleteMany({
            where: { id: c.id, status: ClientStatus.EXPIRED },
          });
          if (localDel.count === 0) {
            this.log.warn(
              `purge: ${c.id} (${c.username}) was re-activated after Remnawave delete; local row left intact`,
            );
            errors++;
            continue;
          }

          await this.audit
            .log({
              actor: 'system:lifecycle',
              resellerId: c.resellerId,
              action: 'client.auto-deleted',
              targetId: c.id,
              payload: {
                username: c.username,
                remnawaveUuid: c.remnawaveUuid,
                expiresAt: c.expiresAt?.toISOString() ?? null,
                retentionDays,
              },
            })
            .catch((e) =>
              this.log.warn(
                `audit failed for client.auto-deleted ${c.id}: ${(e as Error).message}`,
              ),
            );
          deleted++;
          this.log.log(`purge: deleted ${c.username} (${c.id})`);
        } catch (e) {
          errors++;
          this.log.warn(`purge: failed to delete ${c.id}: ${(e as Error).message}`);
        }
      }
      if (raced > 0) {
        this.log.log(`purge: skipped ${raced} client(s) that were re-activated mid-purge`);
      }
      return { deleted, errors, retentionDays };
    } finally {
      this.purging = false;
    }
  }

  retentionDays(): number {
    const raw = this.cfg.get<string | number>('CLIENT_AUTO_DELETE_DAYS');
    if (raw === undefined || raw === null || raw === '') return 7;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 7;
    return Math.floor(n);
  }

  private errorStatus(e: unknown): number | undefined {
    if (e && typeof e === 'object') {
      const maybe = e as { status?: number; getStatus?: () => number };
      if (typeof maybe.status === 'number') return maybe.status;
      if (typeof maybe.getStatus === 'function') return maybe.getStatus();
    }
    return undefined;
  }
}
