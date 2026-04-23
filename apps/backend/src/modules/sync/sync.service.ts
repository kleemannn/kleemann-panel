import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { AuditService } from '../audit/audit.service';

/**
 * Periodically reconciles local Client rows against Remnawave.
 *
 * If a client's `remnawaveUuid` is no longer present in the panel
 * (admin deleted the user directly from Remnawave), the local row is
 * removed so the bot UI stays in sync.
 *
 * Runs every 5 minutes; also exposed via `runOnce()` for ad-hoc use
 * (e.g. from an admin UI button).
 */
@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private remna: RemnawaveService,
    private audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'remnawave-reconcile' })
  async scheduled(): Promise<void> {
    try {
      await this.runOnce();
    } catch (e) {
      this.log.error(`Scheduled sync failed: ${(e as Error).message}`);
    }
  }

  /** Deletes local clients whose remote user no longer exists. */
  async runOnce(): Promise<{ checked: number; deleted: number; errors: number }> {
    if (this.running) return { checked: 0, deleted: 0, errors: 0 };
    this.running = true;

    let checked = 0;
    let deleted = 0;
    let errors = 0;

    try {
      // Pull the full Remnawave user list page by page — cheaper than one
      // GET-per-client once the panel has more than a handful of users.
      const remoteUuids = new Set<string>();
      const PAGE = 500;
      let start = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { users, total } = await this.remna.listUsers({ size: PAGE, start });
        if (users.length === 0) break;
        for (const u of users) remoteUuids.add(u.uuid);
        start += users.length;
        if (start >= total) break;
      }

      const locals = await this.prisma.client.findMany({
        select: { id: true, remnawaveUuid: true, username: true, resellerId: true },
      });
      checked = locals.length;

      for (const c of locals) {
        if (remoteUuids.has(c.remnawaveUuid)) continue;

        // Double-check: the list endpoint might paginate oddly or briefly
        // skip a user. Only delete locally if the direct GET also 404s.
        const stillExists = await this.remna
          .getUserByUuid(c.remnawaveUuid)
          .then(() => true)
          .catch((e) => {
            const status = this.errorStatus(e);
            return status !== 404;
          });
        if (stillExists) continue;

        try {
          await this.prisma.client.delete({ where: { id: c.id } });
          await this.audit.log({
            actor: 'system:sync',
            resellerId: c.resellerId,
            action: 'client.remote-removed',
            targetId: c.id,
            payload: { username: c.username, remnawaveUuid: c.remnawaveUuid },
          });
          deleted++;
          this.log.log(`reconcile: deleted local client ${c.username} (${c.id})`);
        } catch (e) {
          errors++;
          this.log.warn(`reconcile: failed to delete ${c.id}: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }

    if (deleted || errors) {
      this.log.log(`reconcile: checked=${checked} deleted=${deleted} errors=${errors}`);
    }
    return { checked, deleted, errors };
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
