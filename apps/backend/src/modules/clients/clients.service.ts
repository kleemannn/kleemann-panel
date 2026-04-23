import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { SquadMappingService } from '../squad-mapping/squad-mapping.service';
import { AuditService } from '../audit/audit.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ExtendClientDto } from './dto/extend-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const GB = 1024 ** 3;

@Injectable()
export class ClientsService {
  private readonly log = new Logger(ClientsService.name);

  constructor(
    private prisma: PrismaService,
    private remna: RemnawaveService,
    private squads: SquadMappingService,
    private audit: AuditService,
  ) {}

  private serialize<T extends { telegramId?: bigint | null }>(c: T) {
    return { ...c, telegramId: c.telegramId ? c.telegramId.toString() : null };
  }

  async list(
    resellerId: string,
    params: {
      skip?: number;
      take?: number;
      search?: string;
      status?: ClientStatus;
      expiringInDays?: number;
    } = {},
  ) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const where: Prisma.ClientWhereInput = { resellerId };
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { note: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.expiringInDays && params.expiringInDays > 0) {
      const now = new Date();
      const cutoff = new Date(now.getTime() + params.expiringInDays * 864e5);
      where.expiresAt = { gte: now, lte: cutoff };
      where.status = ClientStatus.ACTIVE;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { items: items.map((c) => this.serialize(c)), total };
  }

  async getById(resellerId: string, id: string) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c || c.resellerId !== resellerId) throw new NotFoundException('Client not found');
    return this.serialize(c);
  }

  async create(resellerId: string, dto: CreateClientDto) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller) throw new NotFoundException('Reseller not found');
    if (!reseller.isActive) throw new ForbiddenException('Reseller is disabled');

    const isAdmin = reseller.role === 'ADMIN';

    if (!isAdmin) {
      if (reseller.expiresAt && reseller.expiresAt.getTime() < Date.now()) {
        throw new ForbiddenException('Reseller account expired');
      }
      const used = await this.prisma.client.count({ where: { resellerId } });
      if (used >= reseller.maxClients) {
        throw new ForbiddenException(
          `Client quota exceeded (${used}/${reseller.maxClients}). Contact admin to increase.`,
        );
      }
    }

    // Clamp client expiration to reseller expiration (resellers only; admins are uncapped)
    let expireAt: Date;
    if (dto.expiresAt) {
      expireAt = new Date(dto.expiresAt);
      if (Number.isNaN(expireAt.getTime()) || expireAt.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be a future date');
      }
    } else if (dto.durationDays) {
      expireAt = new Date(Date.now() + dto.durationDays * 864e5);
    } else {
      throw new BadRequestException('Either durationDays or expiresAt is required');
    }
    if (!isAdmin && reseller.expiresAt && expireAt > reseller.expiresAt) {
      expireAt = reseller.expiresAt;
    }

    const squadUuid = await this.squads.getSquadUuidForType(reseller.type);

    const remna = await this.remna.createUser({
      username: dto.username,
      expireAt: expireAt.toISOString(),
      trafficLimitBytes: dto.trafficLimitGb ? dto.trafficLimitGb * GB : 0,
      trafficLimitStrategy: 'MONTH',
      activeInternalSquads: [squadUuid],
      description: `reseller:${resellerId}${dto.note ? ` | ${dto.note}` : ''}`,
      telegramId: dto.clientTelegramId ? Number(dto.clientTelegramId) : undefined,
      hwidDeviceLimit: dto.hwidDeviceLimit ?? 1,
      tag: reseller.tag ?? undefined,
    });

    let client;
    try {
      client = await this.prisma.client.create({
        data: {
          resellerId,
          remnawaveUuid: remna.uuid,
          shortUuid: remna.shortUuid,
          username: remna.username,
          telegramId: dto.clientTelegramId ? BigInt(dto.clientTelegramId) : null,
          note: dto.note,
          subscriptionUrl: remna.subscriptionUrl ?? null,
          expiresAt: expireAt,
          trafficLimitGb: dto.trafficLimitGb ?? null,
          squadUuid,
          status: ClientStatus.ACTIVE,
        },
      });
    } catch (e) {
      // Compensate: remote user was created but local insert failed
      try {
        await this.remna.deleteUser(remna.uuid);
      } catch {
        /* best-effort cleanup */
      }
      throw e;
    }

    await this.audit.log({
      actor: `reseller:${resellerId}`,
      resellerId,
      action: 'client.create',
      targetId: client.id,
      payload: {
        username: client.username,
        durationDays: dto.durationDays ?? null,
        expiresAt: expireAt.toISOString(),
        trafficLimitGb: dto.trafficLimitGb ?? null,
        squadUuid,
      },
    });

    return this.serialize(client);
  }

  async extend(resellerId: string, id: string, dto: ExtendClientDto) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c || c.resellerId !== resellerId) throw new NotFoundException('Client not found');

    const reseller = await this.prisma.reseller.findUniqueOrThrow({ where: { id: resellerId } });
    if (!reseller.isActive) throw new ForbiddenException('Reseller is disabled');
    const isAdmin = reseller.role === 'ADMIN';

    let newExpire: Date;
    if (dto.expiresAt) {
      newExpire = new Date(dto.expiresAt);
      if (Number.isNaN(newExpire.getTime()) || newExpire.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be a future date');
      }
    } else if (dto.durationDays) {
      const base = c.expiresAt && c.expiresAt > new Date() ? c.expiresAt : new Date();
      newExpire = new Date(base.getTime() + dto.durationDays * 864e5);
    } else {
      throw new BadRequestException('Either durationDays or expiresAt is required');
    }
    if (!isAdmin && reseller.expiresAt && newExpire > reseller.expiresAt) {
      newExpire = reseller.expiresAt;
    }

    await this.remna.updateUser(c.remnawaveUuid, {
      expireAt: newExpire.toISOString(),
    });

    const updated = await this.prisma.client.update({
      where: { id },
      data: { expiresAt: newExpire, status: ClientStatus.ACTIVE },
    });

    await this.audit.log({
      actor: `reseller:${resellerId}`,
      resellerId,
      action: 'client.extend',
      targetId: id,
      payload: {
        durationDays: dto.durationDays ?? null,
        requestedExpiresAt: dto.expiresAt ?? null,
        newExpiresAt: newExpire.toISOString(),
      },
    });

    return this.serialize(updated);
  }

  async update(resellerId: string, id: string, dto: UpdateClientDto) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c || c.resellerId !== resellerId) throw new NotFoundException('Client not found');

    const remnaPatch: Record<string, unknown> = {};
    if (dto.note !== undefined) {
      remnaPatch.description = `reseller:${resellerId}${dto.note ? ` | ${dto.note}` : ''}`;
    }
    if (dto.trafficLimitGb !== undefined) {
      remnaPatch.trafficLimitBytes = dto.trafficLimitGb ? dto.trafficLimitGb * GB : 0;
    }
    if (Object.keys(remnaPatch).length > 0) {
      await this.remna.updateUser(c.remnawaveUuid, remnaPatch);
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        note: dto.note ?? c.note,
        trafficLimitGb: dto.trafficLimitGb === undefined ? c.trafficLimitGb : dto.trafficLimitGb ?? null,
      },
    });

    await this.audit.log({
      actor: `reseller:${resellerId}`,
      resellerId,
      action: 'client.update',
      targetId: id,
      payload: dto as unknown as Prisma.InputJsonValue,
    });

    return this.serialize(updated);
  }

  async disable(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    await this.remna.disableUser(c.remnawaveUuid);
    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.DISABLED },
    });
    await this.audit.log({ actor: `reseller:${resellerId}`, resellerId, action: 'client.disable', targetId: id });
    return this.serialize(updated);
  }

  async enable(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    await this.remna.enableUser(c.remnawaveUuid);
    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.ACTIVE },
    });
    await this.audit.log({ actor: `reseller:${resellerId}`, resellerId, action: 'client.enable', targetId: id });
    return this.serialize(updated);
  }

  async resetTraffic(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    await this.remna.resetTraffic(c.remnawaveUuid);
    await this.audit.log({ actor: `reseller:${resellerId}`, resellerId, action: 'client.reset-traffic', targetId: id });
    return { ok: true };
  }

  async remove(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    await this.remna.deleteUser(c.remnawaveUuid);
    await this.prisma.client.delete({ where: { id } });
    await this.audit.log({ actor: `reseller:${resellerId}`, resellerId, action: 'client.delete', targetId: id });
    return { ok: true };
  }

  async subscription(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    // Re-fetch from panel to always return fresh data (url + online/traffic stats).
    // If the panel 404s the user was removed there — clean up locally too.
    const remna = await this.fetchRemoteOrCleanup(c.id, c.remnawaveUuid);

    const subscriptionUrl =
      remna.subscriptionUrl && remna.subscriptionUrl.length > 0
        ? remna.subscriptionUrl
        : c.subscriptionUrl ?? null;

    if (remna.subscriptionUrl && remna.subscriptionUrl !== c.subscriptionUrl) {
      await this.prisma.client.update({
        where: { id },
        data: { subscriptionUrl: remna.subscriptionUrl },
      });
    }

    // Happ Crypto Link:
    // The panel's encrypt endpoint returns a fully-formed `happ://crypt4/...`
    // already. Failures are logged so the UI can differentiate between
    // "missing subscription url" vs "encrypt endpoint unreachable".
    let happCryptoLink: string | null = null;
    let happError: string | null = null;
    if (!subscriptionUrl) {
      happError = 'no-subscription-url';
      this.log.warn(
        `happ: client ${c.username} (${c.remnawaveUuid}) has no subscriptionUrl from Remnawave`,
      );
    } else {
      try {
        const encrypted = await this.remna.encryptHappCryptoLink(subscriptionUrl);
        happCryptoLink = encrypted.startsWith('happ://')
          ? encrypted
          : `happ://crypt4/${encrypted}`;
      } catch (e) {
        happError = 'encrypt-failed';
        this.log.warn(
          `happ: encrypt failed for ${c.username}: ${(e as Error).message}`,
        );
      }
    }

    return {
      subscriptionUrl,
      happCryptoLink,
      happError,
      onlineAt: remna.onlineAt ?? null,
      firstConnectedAt: remna.firstConnectedAt ?? null,
      lastTrafficResetAt: remna.lastTrafficResetAt ?? null,
    };
  }

  async listDevices(resellerId: string, id: string) {
    const c = await this.ownClient(resellerId, id);
    return this.remna.listUserHwidDevices(c.remnawaveUuid);
  }

  async deleteDevice(resellerId: string, id: string, hwid: string) {
    const c = await this.ownClient(resellerId, id);
    const result = await this.remna.deleteUserHwidDevice(c.remnawaveUuid, hwid);
    await this.audit.log({
      actor: `reseller:${resellerId}`,
      resellerId,
      action: 'client.device.delete',
      targetId: id,
      payload: { hwid },
    });
    return result;
  }

  async usage(resellerId: string, id: string, from?: string, to?: string) {
    const c = await this.ownClient(resellerId, id);
    const end = to ?? new Date().toISOString();
    const start = from ?? new Date(Date.now() - 30 * 864e5).toISOString();
    try {
      return await this.remna.userUsage(c.remnawaveUuid, start, end);
    } catch {
      return null;
    }
  }

  private async ownClient(resellerId: string, id: string) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c || c.resellerId !== resellerId) throw new NotFoundException('Client not found');
    return c;
  }

  /**
   * Fetch a remote Remnawave user. If the panel returns 404 (the admin
   * removed the user directly in Remnawave), delete the local row and
   * translate the error into a 404 so the UI treats the client as gone.
   */
  private async fetchRemoteOrCleanup(localId: string, uuid: string) {
    try {
      return await this.remna.getUserByUuid(uuid);
    } catch (e) {
      const status = this.remoteErrorStatus(e);
      if (status === 404) {
        await this.prisma.client.delete({ where: { id: localId } }).catch(() => undefined);
        await this.audit.log({
          actor: 'system:sync',
          action: 'client.remote-removed',
          targetId: localId,
          payload: { remnawaveUuid: uuid },
        });
        throw new NotFoundException('Client was removed from Remnawave panel');
      }
      throw e;
    }
  }

  private remoteErrorStatus(e: unknown): number | undefined {
    if (e && typeof e === 'object') {
      const maybe = e as { status?: number; getStatus?: () => number };
      if (typeof maybe.status === 'number') return maybe.status;
      if (typeof maybe.getStatus === 'function') return maybe.getStatus();
    }
    return undefined;
  }
}
