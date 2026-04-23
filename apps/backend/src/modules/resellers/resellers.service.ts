import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ClientStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';

@Injectable()
export class ResellersService {
  private readonly log = new Logger(ResellersService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private remna: RemnawaveService,
  ) {}

  private serialize<T extends { telegramId: bigint }>(r: T) {
    return { ...r, telegramId: r.telegramId.toString() };
  }

  async list(params: { skip?: number; take?: number; search?: string } = {}) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const where: Prisma.ResellerWhereInput | undefined = params.search
      ? {
          OR: [
            { username: { contains: params.search, mode: 'insensitive' } },
            { firstName: { contains: params.search, mode: 'insensitive' } },
            { lastName: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reseller.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { _count: { select: { clients: true } } },
      }),
      this.prisma.reseller.count({ where }),
    ]);
    return {
      items: items.map((r) => ({ ...this.serialize(r), clientsCount: r._count.clients })),
      total,
    };
  }

  async getById(id: string) {
    const r = await this.prisma.reseller.findUnique({
      where: { id },
      include: { _count: { select: { clients: true } } },
    });
    if (!r) throw new NotFoundException('Reseller not found');
    return { ...this.serialize(r), clientsCount: r._count.clients };
  }

  async create(adminId: string, dto: CreateResellerDto) {
    const tg = BigInt(dto.telegramId);
    const existing = await this.prisma.reseller.findUnique({ where: { telegramId: tg } });
    if (existing) throw new BadRequestException('Reseller with this Telegram ID already exists');

    if (dto.tag) {
      const tagClash = await this.prisma.reseller.findUnique({ where: { tag: dto.tag } });
      if (tagClash) throw new BadRequestException('Tag is already used by another reseller');
    }

    const created = await this.prisma.reseller.create({
      data: {
        telegramId: tg,
        username: dto.username,
        type: dto.type,
        maxClients: dto.maxClients,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        tag: dto.tag ?? null,
        providerId: dto.providerId?.trim() || null,
        role: Role.RESELLER,
      },
    });

    await this.audit.log({
      actor: `admin:${adminId}`,
      resellerId: created.id,
      action: 'reseller.create',
      targetId: created.id,
      payload: {
        telegramId: dto.telegramId,
        type: dto.type,
        maxClients: dto.maxClients,
        expiresAt: dto.expiresAt ?? null,
      },
    });

    return this.serialize(created);
  }

  async update(adminId: string, id: string, dto: UpdateResellerDto) {
    const r = await this.prisma.reseller.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reseller not found');

    const data: Prisma.ResellerUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.maxClients !== undefined) data.maxClients = dto.maxClients;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt === null || dto.expiresAt === '' ? null : new Date(dto.expiresAt);
    }
    if (dto.tag !== undefined) {
      const normalized = dto.tag === null || dto.tag === '' ? null : dto.tag;
      if (normalized && normalized !== r.tag) {
        const tagClash = await this.prisma.reseller.findUnique({ where: { tag: normalized } });
        if (tagClash && tagClash.id !== id) {
          throw new BadRequestException('Tag is already used by another reseller');
        }
      }
      data.tag = normalized;
    }
    if (dto.providerId !== undefined) {
      const normalized = dto.providerId === null ? null : dto.providerId.trim();
      data.providerId = normalized ? normalized : null;
    }

    const updated = await this.prisma.reseller.update({ where: { id }, data });

    await this.audit.log({
      actor: `admin:${adminId}`,
      resellerId: id,
      action: 'reseller.update',
      targetId: id,
      payload: dto as unknown as Prisma.InputJsonValue,
    });

    return this.serialize(updated);
  }

  /**
   * Fetch every user from Remnawave (paginated), and for each user whose `tag`
   * matches a local Reseller's `tag`, upsert a Client row pointing at that
   * reseller. Users without a matching tag are skipped. Already-tracked
   * clients (same remnawaveUuid) are left alone.
   */
  async importFromRemnawave(adminId: string) {
    const tagIndex = new Map<string, { id: string; type: 'STANDARD' | 'PREMIUM' }>();
    const resellers = await this.prisma.reseller.findMany({
      where: { tag: { not: null } },
      select: { id: true, tag: true, type: true },
    });
    for (const r of resellers) if (r.tag) tagIndex.set(r.tag, { id: r.id, type: r.type });

    const existingByUuid = new Set(
      (await this.prisma.client.findMany({ select: { remnawaveUuid: true } })).map(
        (c) => c.remnawaveUuid,
      ),
    );

    const PAGE = 200;
    let start = 0;
    let imported = 0;
    let skippedNoTag = 0;
    let skippedExisting = 0;
    let skippedUnknownTag = 0;

    // Paginate through users endpoint until we've seen them all.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { users, total } = await this.remna.listUsers({ size: PAGE, start });
      if (users.length === 0) break;

      for (const u of users) {
        if (existingByUuid.has(u.uuid)) {
          skippedExisting++;
          continue;
        }
        if (!u.tag) {
          skippedNoTag++;
          continue;
        }
        const match = tagIndex.get(u.tag);
        if (!match) {
          skippedUnknownTag++;
          continue;
        }

        const squadUuid = this.firstSquadUuid(u.activeInternalSquads) ?? '';
        try {
          await this.prisma.client.create({
            data: {
              resellerId: match.id,
              remnawaveUuid: u.uuid,
              shortUuid: u.shortUuid ?? null,
              username: u.username,
              telegramId: u.telegramId ? BigInt(u.telegramId) : null,
              note: null,
              subscriptionUrl: u.subscriptionUrl ?? null,
              expiresAt: u.expireAt ? new Date(u.expireAt) : null,
              trafficLimitGb: u.trafficLimitBytes
                ? Math.max(1, Math.round(u.trafficLimitBytes / 1024 ** 3))
                : null,
              squadUuid,
              status: this.mapRemnaStatus(u.status),
            },
          });
          existingByUuid.add(u.uuid);
          imported++;
        } catch (e) {
          // Probably a unique-username collision with another reseller's client.
          this.log.warn(`import: skip user ${u.username} (${u.uuid}): ${(e as Error).message}`);
        }
      }

      start += users.length;
      if (start >= total) break;
    }

    await this.audit.log({
      actor: `admin:${adminId}`,
      action: 'clients.import',
      payload: { imported, skippedNoTag, skippedExisting, skippedUnknownTag },
    });

    return { imported, skippedNoTag, skippedExisting, skippedUnknownTag };
  }

  private firstSquadUuid(
    squads: { uuid: string }[] | string[] | undefined,
  ): string | null {
    if (!squads || squads.length === 0) return null;
    const first = squads[0] as unknown;
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'uuid' in (first as Record<string, unknown>)) {
      return (first as { uuid: string }).uuid;
    }
    return null;
  }

  private mapRemnaStatus(s: string | undefined): ClientStatus {
    switch ((s ?? '').toUpperCase()) {
      case 'DISABLED':
        return ClientStatus.DISABLED;
      case 'EXPIRED':
        return ClientStatus.EXPIRED;
      case 'LIMITED':
        return ClientStatus.LIMITED;
      default:
        return ClientStatus.ACTIVE;
    }
  }

  async remove(adminId: string, id: string) {
    const r = await this.prisma.reseller.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reseller not found');
    await this.prisma.reseller.delete({ where: { id } });
    await this.audit.log({
      actor: `admin:${adminId}`,
      resellerId: null,
      action: 'reseller.delete',
      targetId: id,
    });
    return { ok: true };
  }
}
