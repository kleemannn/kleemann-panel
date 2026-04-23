import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientStatus, Prisma, ResellerType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { SquadMappingService } from '../squad-mapping/squad-mapping.service';
import { AuditService } from '../audit/audit.service';

const GB = 1024 ** 3;
const BACKUP_VERSION = 1;

interface ResellerDump {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  tag: string | null;
  role: Role;
  type: ResellerType;
  maxClients: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface ClientDump {
  resellerTelegramId: string;
  username: string;
  note: string | null;
  expiresAt: string | null;
  trafficLimitGb: number | null;
  status: ClientStatus;
  telegramId: string | null;
}

interface SquadMappingDump {
  type: ResellerType;
  squadUuid: string;
  label: string | null;
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  resellers: ResellerDump[];
  clients: ClientDump[];
  squadMappings: SquadMappingDump[];
}

export interface ImportReport {
  resellers: { created: number; updated: number; errors: { telegramId: string; error: string }[] };
  clients: {
    created: number;
    skippedExisting: number;
    skippedUnknownReseller: number;
    errors: { username: string; error: string }[];
  };
  squadMappings: { applied: number };
}

@Injectable()
export class BackupService {
  private readonly log = new Logger(BackupService.name);

  constructor(
    private prisma: PrismaService,
    private remna: RemnawaveService,
    private squads: SquadMappingService,
    private audit: AuditService,
  ) {}

  async export(adminId: string): Promise<BackupFile> {
    const [resellers, clients, squadMappings] = await Promise.all([
      this.prisma.reseller.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.client.findMany({ orderBy: { createdAt: 'asc' }, include: { reseller: true } }),
      this.prisma.squadMapping.findMany(),
    ]);

    const dump: BackupFile = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      resellers: resellers.map((r) => ({
        telegramId: r.telegramId.toString(),
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        tag: r.tag,
        role: r.role,
        type: r.type,
        maxClients: r.maxClients,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        isActive: r.isActive,
      })),
      clients: clients.map((c) => ({
        resellerTelegramId: c.reseller.telegramId.toString(),
        username: c.username,
        note: c.note,
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        trafficLimitGb: c.trafficLimitGb,
        status: c.status,
        telegramId: c.telegramId ? c.telegramId.toString() : null,
      })),
      squadMappings: squadMappings.map((s) => ({
        type: s.type,
        squadUuid: s.squadUuid,
        label: s.label,
      })),
    };

    await this.audit.log({
      actor: `admin:${adminId}`,
      action: 'backup.export',
      payload: {
        resellers: dump.resellers.length,
        clients: dump.clients.length,
        squadMappings: dump.squadMappings.length,
      },
    });

    return dump;
  }

  async import(adminId: string, data: unknown): Promise<ImportReport> {
    const file = this.validate(data);

    const report: ImportReport = {
      resellers: { created: 0, updated: 0, errors: [] },
      clients: { created: 0, skippedExisting: 0, skippedUnknownReseller: 0, errors: [] },
      squadMappings: { applied: 0 },
    };

    // Squad mappings first — clients need them for provisioning.
    for (const sm of file.squadMappings) {
      await this.squads.upsert(sm.type, sm.squadUuid, sm.label ?? undefined);
      report.squadMappings.applied++;
    }

    // Resellers
    const resellerIdByTelegramId = new Map<string, string>();
    for (const r of file.resellers) {
      try {
        const tg = BigInt(r.telegramId);
        const existing = await this.prisma.reseller.findUnique({ where: { telegramId: tg } });
        if (existing) {
          const updated = await this.prisma.reseller.update({
            where: { id: existing.id },
            data: {
              username: r.username,
              firstName: r.firstName,
              lastName: r.lastName,
              tag: r.tag,
              type: r.type,
              maxClients: r.maxClients,
              expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
              isActive: r.isActive,
              // role intentionally not overwritten — don't accidentally demote current admin
            },
          });
          resellerIdByTelegramId.set(r.telegramId, updated.id);
          report.resellers.updated++;
        } else {
          const created = await this.prisma.reseller.create({
            data: {
              telegramId: tg,
              username: r.username,
              firstName: r.firstName,
              lastName: r.lastName,
              tag: r.tag,
              role: r.role,
              type: r.type,
              maxClients: r.maxClients,
              expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
              isActive: r.isActive,
            },
          });
          resellerIdByTelegramId.set(r.telegramId, created.id);
          report.resellers.created++;
        }
      } catch (e) {
        report.resellers.errors.push({
          telegramId: r.telegramId,
          error: (e as Error).message,
        });
      }
    }

    // Clients — one-by-one, because each creates a remote user in Remnawave.
    for (const c of file.clients) {
      const resellerId = resellerIdByTelegramId.get(c.resellerTelegramId);
      if (!resellerId) {
        report.clients.skippedUnknownReseller++;
        continue;
      }

      const existing = await this.prisma.client.findUnique({ where: { username: c.username } });
      if (existing) {
        report.clients.skippedExisting++;
        continue;
      }

      try {
        const reseller = await this.prisma.reseller.findUniqueOrThrow({
          where: { id: resellerId },
        });

        // Clamp expiration to the future; expired clients still get recreated
        // with a 1-day grace window so Remnawave accepts them.
        const requestedExpire = c.expiresAt ? new Date(c.expiresAt) : null;
        const now = new Date();
        const expireAt =
          requestedExpire && requestedExpire.getTime() > now.getTime()
            ? requestedExpire
            : new Date(now.getTime() + 864e5);

        const squadUuid = await this.squads.getSquadUuidForType(reseller.type);

        const remna = await this.remna.createUser({
          username: c.username,
          expireAt: expireAt.toISOString(),
          trafficLimitBytes: c.trafficLimitGb ? c.trafficLimitGb * GB : 0,
          trafficLimitStrategy: 'MONTH',
          activeInternalSquads: [squadUuid],
          description: `reseller:${resellerId}${c.note ? ` | ${c.note}` : ''}`,
          telegramId: c.telegramId ? Number(c.telegramId) : undefined,
          hwidDeviceLimit: 1,
          tag: reseller.tag ?? undefined,
        });

        try {
          await this.prisma.client.create({
            data: {
              resellerId,
              remnawaveUuid: remna.uuid,
              shortUuid: remna.shortUuid ?? null,
              username: remna.username,
              telegramId: c.telegramId ? BigInt(c.telegramId) : null,
              note: c.note,
              subscriptionUrl: remna.subscriptionUrl ?? null,
              expiresAt: expireAt,
              trafficLimitGb: c.trafficLimitGb,
              squadUuid,
              status: ClientStatus.ACTIVE,
            },
          });
        } catch (localErr) {
          try {
            await this.remna.deleteUser(remna.uuid);
          } catch {
            /* best-effort compensation */
          }
          throw localErr;
        }

        // If dump says the client was disabled, honour that.
        if (c.status === ClientStatus.DISABLED) {
          try {
            await this.remna.disableUser(remna.uuid);
            await this.prisma.client.update({
              where: { remnawaveUuid: remna.uuid },
              data: { status: ClientStatus.DISABLED },
            });
          } catch (disableErr) {
            this.log.warn(
              `import: created ${c.username} but failed to disable: ${(disableErr as Error).message}`,
            );
          }
        }

        report.clients.created++;
      } catch (e) {
        report.clients.errors.push({
          username: c.username,
          error: this.errorMessage(e),
        });
      }
    }

    await this.audit.log({
      actor: `admin:${adminId}`,
      action: 'backup.import',
      payload: report as unknown as Prisma.InputJsonValue,
    });

    return report;
  }

  private validate(data: unknown): BackupFile {
    if (!data || typeof data !== 'object') throw new BadRequestException('Backup must be a JSON object');
    const obj = data as Record<string, unknown>;
    if (typeof obj.version !== 'number') throw new BadRequestException('Backup "version" missing');
    if (obj.version !== BACKUP_VERSION) {
      throw new BadRequestException(
        `Unsupported backup version ${obj.version} (expected ${BACKUP_VERSION})`,
      );
    }
    if (!Array.isArray(obj.resellers)) throw new BadRequestException('"resellers" must be an array');
    if (!Array.isArray(obj.clients)) throw new BadRequestException('"clients" must be an array');
    if (!Array.isArray(obj.squadMappings))
      throw new BadRequestException('"squadMappings" must be an array');
    return obj as unknown as BackupFile;
  }

  private errorMessage(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
      const resp = (e as { response?: { message?: string } }).response;
      if (resp?.message) return resp.message;
    }
    if (e instanceof Error) return e.message;
    return String(e);
  }
}
