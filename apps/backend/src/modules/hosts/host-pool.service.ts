import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { HostIpPool, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HostsService, BulkReplaceResult } from './hosts.service';

export interface PoolView {
  id: string;
  tag: string;
  addresses: string[];
  currentIdx: number;
  port: number | null;
  note: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RotateResult extends BulkReplaceResult {
  fromAddress: string;
  toAddress: string;
  newIdx: number;
  pool: PoolView;
}

@Injectable()
export class HostPoolService {
  private readonly log = new Logger(HostPoolService.name);

  constructor(
    private prisma: PrismaService,
    private hosts: HostsService,
  ) {}

  private view(p: HostIpPool): PoolView {
    return {
      id: p.id,
      tag: p.tag,
      addresses: this.parseAddresses(p.addresses),
      currentIdx: p.currentIdx,
      port: p.port,
      note: p.note,
      updatedAt: p.updatedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    };
  }

  private parseAddresses(raw: Prisma.JsonValue): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string');
  }

  async list(): Promise<PoolView[]> {
    const rows = await this.prisma.hostIpPool.findMany({ orderBy: { tag: 'asc' } });
    return rows.map((r) => this.view(r));
  }

  async getByTag(tag: string): Promise<PoolView | null> {
    const row = await this.prisma.hostIpPool.findUnique({ where: { tag } });
    return row ? this.view(row) : null;
  }

  async upsert(input: {
    tag: string;
    addresses: string[];
    currentIdx?: number;
    port?: number | null;
    note?: string | null;
  }): Promise<PoolView> {
    const cleaned = input.addresses.map((a) => a.trim()).filter(Boolean);
    const idx =
      input.currentIdx !== undefined
        ? Math.max(0, Math.min(cleaned.length - 1, input.currentIdx))
        : 0;
    if (cleaned.length && idx >= cleaned.length) {
      throw new BadRequestException('currentIdx out of range');
    }

    const row = await this.prisma.hostIpPool.upsert({
      where: { tag: input.tag },
      update: {
        addresses: cleaned,
        currentIdx: cleaned.length ? idx : 0,
        port: input.port ?? null,
        note: input.note ?? null,
      },
      create: {
        tag: input.tag,
        addresses: cleaned,
        currentIdx: cleaned.length ? idx : 0,
        port: input.port ?? null,
        note: input.note ?? null,
      },
    });
    return this.view(row);
  }

  async remove(tag: string): Promise<void> {
    await this.prisma.hostIpPool.deleteMany({ where: { tag } });
  }

  /**
   * Rotate to the next address in the pool (or `toIdx` if explicitly provided)
   * and push the new address to every Remnawave host that shares this tag.
   * Triggered by the admin Mini App, Telegram bot command and (later) external
   * monitoring webhooks.
   */
  async rotate(
    actorId: string,
    tag: string,
    options: { toIdx?: number; note?: string } = {},
  ): Promise<RotateResult> {
    const row = await this.prisma.hostIpPool.findUnique({ where: { tag } });
    if (!row) throw new NotFoundException(`No IP pool configured for tag "${tag}"`);
    const addresses = this.parseAddresses(row.addresses);
    if (addresses.length < 2) {
      throw new BadRequestException(
        `Pool for tag "${tag}" needs at least 2 addresses to rotate`,
      );
    }

    const fromIdx = Math.max(0, Math.min(addresses.length - 1, row.currentIdx));
    const fromAddress = addresses[fromIdx];

    let nextIdx: number;
    if (options.toIdx !== undefined) {
      if (options.toIdx < 0 || options.toIdx >= addresses.length) {
        throw new BadRequestException('toIdx out of range');
      }
      if (options.toIdx === fromIdx) {
        throw new BadRequestException('toIdx points at the currently active address');
      }
      nextIdx = options.toIdx;
    } else {
      nextIdx = (fromIdx + 1) % addresses.length;
      if (nextIdx === fromIdx) {
        throw new BadRequestException('Pool only has one usable address');
      }
    }

    const toAddress = addresses[nextIdx];

    // Push new address to every host in Remnawave that wears this tag.
    const replace = await this.hosts.bulkReplaceAddressByTag(
      actorId,
      tag,
      toAddress,
      row.port ?? undefined,
      options.note ??
        (actorId.startsWith('bot:')
          ? `auto-rotate via Telegram (${fromAddress} → ${toAddress})`
          : `pool-rotate ${fromAddress} → ${toAddress}`),
    );

    const updated = await this.prisma.hostIpPool.update({
      where: { tag },
      data: { currentIdx: nextIdx },
    });

    return {
      ...replace,
      fromAddress,
      toAddress,
      newIdx: nextIdx,
      pool: this.view(updated),
    };
  }
}
