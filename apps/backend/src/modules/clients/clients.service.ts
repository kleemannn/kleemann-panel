import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private cfg: ConfigService,
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

    const rawSubscriptionUrl =
      remna.subscriptionUrl && remna.subscriptionUrl.length > 0
        ? remna.subscriptionUrl
        : c.subscriptionUrl ?? null;

    if (remna.subscriptionUrl && remna.subscriptionUrl !== c.subscriptionUrl) {
      await this.prisma.client.update({
        where: { id },
        data: { subscriptionUrl: remna.subscriptionUrl },
      });
    }

    // Two subscription variants are exposed to the UI:
    //   1. `plain`  — the raw Remnawave subscription URL (what the panel gives us).
    //   2. `google` — a cover-domain rewrite into Happ's
    //        https://{COVER}/sub/{shortUuid}#?resolve-address={COVER}&host={BACKEND}&providerid={providerId}
    //      form. Only available when HAPP_COVER_HOST + HAPP_BACKEND_HOST env
    //      vars are set; otherwise `google.*` fields are null.
    const reseller = await this.prisma.reseller.findUnique({
      where: { id: resellerId },
      select: { providerId: true },
    });
    const shortUuid =
      (remna.shortUuid as string | undefined | null) ??
      c.shortUuid ??
      this.extractShortUuid(rawSubscriptionUrl);
    const googleUrl = this.buildHappCoverUrl(shortUuid, reseller?.providerId ?? null);

    const plain = await this.buildSubscriptionVariant(c, rawSubscriptionUrl, 'plain');
    const google = googleUrl
      ? await this.buildSubscriptionVariant(c, googleUrl, 'google')
      : { url: null, happCryptoLink: null, happError: 'no-subscription-url' as const };

    // Remnawave user object may not include `onlineAt` (older panel versions
    // or users imported without activity). Derive a fallback from HWID device
    // `updatedAt` — each heartbeat/connection bumps it.
    let onlineAt: string | null = (remna.onlineAt as string | null | undefined) ?? null;
    try {
      const devicesList = await this.remna.listUserHwidDevices(c.remnawaveUuid);
      const latest = devicesList.devices
        .map((d) => d.updatedAt)
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .sort()
        .pop();
      if (latest && (!onlineAt || new Date(latest).getTime() > new Date(onlineAt).getTime())) {
        onlineAt = latest;
      }
    } catch (e) {
      this.log.warn(
        `online-fallback: failed to list HWID devices for ${c.username}: ${(e as Error).message}`,
      );
    }

    if (!remna.onlineAt) {
      // Help diagnose which field the panel actually populates for this user.
      const onlineKeys = Object.keys(remna).filter((k) =>
        /online|seen|connected|activity/i.test(k),
      );
      this.log.debug(
        `online-fields for ${c.username}: ${onlineKeys
          .map((k) => `${k}=${JSON.stringify((remna as Record<string, unknown>)[k])}`)
          .join(', ') || '<none>'}`,
      );
    }

    return {
      // Back-compat: older clients still read these top-level fields.
      // They mirror the `plain` variant (direct Remnawave URL).
      subscriptionUrl: plain.url,
      happCryptoLink: plain.happCryptoLink,
      happError: plain.happError,
      // Two explicit variants — UI renders both as separate cards.
      plain,
      google,
      onlineAt,
      firstConnectedAt: remna.firstConnectedAt ?? null,
      lastTrafficResetAt: remna.lastTrafficResetAt ?? null,
    };
  }

  /**
   * Build a `{ url, happCryptoLink, happError }` triple for a given raw URL.
   * Runs the Remnawave happ-encrypt endpoint so the UI has a ready-to-share
   * `happ://crypt4/...` link. Logs failures with the variant label for easier
   * diagnosis when only one of the two variants is broken.
   */
  private async buildSubscriptionVariant(
    c: { username: string; remnawaveUuid: string },
    url: string | null,
    variant: 'plain' | 'google',
  ): Promise<{ url: string | null; happCryptoLink: string | null; happError: string | null }> {
    if (!url) {
      this.log.warn(
        `happ(${variant}): client ${c.username} (${c.remnawaveUuid}) has no subscriptionUrl`,
      );
      return { url: null, happCryptoLink: null, happError: 'no-subscription-url' };
    }
    try {
      const encrypted = await this.remna.encryptHappCryptoLink(url);
      const happCryptoLink = encrypted.startsWith('happ://')
        ? encrypted
        : `happ://crypt4/${encrypted}`;
      return { url, happCryptoLink, happError: null };
    } catch (e) {
      this.log.warn(
        `happ(${variant}): encrypt failed for ${c.username}: ${(e as Error).message}`,
      );
      return { url, happCryptoLink: null, happError: 'encrypt-failed' };
    }
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
        await this.audit
          .log({
            actor: 'system:sync',
            action: 'client.remote-removed',
            targetId: localId,
            payload: { remnawaveUuid: uuid },
          })
          .catch((auditErr) =>
            this.log.warn(
              `remote-cleanup: audit log failed for ${localId}: ${(auditErr as Error).message}`,
            ),
          );
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

  /**
   * Rewrite Remnawave subscription URL into Happ's cover-domain form:
   *   https://{COVER}/sub/{shortUuid}#?resolve-address={COVER}&host={BACKEND}&providerid={providerId}
   *
   * Returns `null` when either env var is missing or we couldn't determine
   * the shortUuid (falls back to the raw Remnawave URL in that case).
   */
  private buildHappCoverUrl(
    shortUuid: string | null | undefined,
    providerId: string | null,
  ): string | null {
    const cover = this.cfg.get<string>('HAPP_COVER_HOST');
    const backend = this.cfg.get<string>('HAPP_BACKEND_HOST');
    // Google variant is only produced when the reseller has a Provider ID set.
    // Without it there's nothing to distinguish the cover URL, so fall back to
    // the plain subscription URL only.
    if (!cover || !backend || !shortUuid || !providerId) return null;

    const params = new URLSearchParams();
    params.set('resolve-address', cover);
    params.set('host', backend);
    params.set('providerid', providerId);

    return `https://${cover}/sub/${shortUuid}#?${params.toString()}`;
  }

  /**
   * Best-effort extraction of Remnawave `shortUuid` from a subscription URL
   * like `https://sub.example.com/sub/<shortUuid>` or `.../api/sub/<shortUuid>`.
   * Returns null when the URL is absent or doesn't match the expected shape.
   */
  private extractShortUuid(url: string | null): string | null {
    if (!url) return null;
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const subIdx = parts.lastIndexOf('sub');
      if (subIdx >= 0 && parts[subIdx + 1]) return parts[subIdx + 1];
      return parts[parts.length - 1] ?? null;
    } catch {
      return null;
    }
  }
}
