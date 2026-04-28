import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RemnawaveService, RemnaHost } from '../remnawave/remnawave.service';

const UNTAGGED = '__UNTAGGED__';

export interface HostGroup {
  tag: string | null; // null = without tag
  hosts: HostSummary[];
}

export interface HostSummary {
  uuid: string;
  remark?: string | null;
  address: string;
  port: number;
  tag: string | null;
  isDisabled: boolean;
}

export interface BulkReplaceResult {
  affected: number;
  failed: number;
  hostsAffected: Array<{ uuid: string; remark?: string | null }>;
  hostsFailed: Array<{ uuid: string; remark?: string | null; error: string }>;
  changeId: string;
}

@Injectable()
export class HostsService {
  private readonly log = new Logger(HostsService.name);

  constructor(
    private prisma: PrismaService,
    private remna: RemnawaveService,
    private audit: AuditService,
  ) {}

  private toSummary(h: RemnaHost): HostSummary {
    return {
      uuid: h.uuid,
      remark: (h.remark as string | null | undefined) ?? null,
      address: h.address,
      port: h.port,
      tag: (h.tag as string | null | undefined) ?? null,
      isDisabled: Boolean(h.isDisabled),
    };
  }

  async listGrouped(): Promise<{ groups: HostGroup[]; total: number }> {
    const hosts = await this.remna.listHosts();
    const map = new Map<string, HostSummary[]>();
    for (const raw of hosts) {
      const h = this.toSummary(raw);
      const key = h.tag ?? UNTAGGED;
      const arr = map.get(key) ?? [];
      arr.push(h);
      map.set(key, arr);
    }
    const groups: HostGroup[] = [];
    const tagged = [...map.entries()]
      .filter(([k]) => k !== UNTAGGED)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [tag, items] of tagged) {
      groups.push({ tag, hosts: items.sort(byRemark) });
    }
    if (map.has(UNTAGGED)) {
      groups.push({ tag: null, hosts: (map.get(UNTAGGED) ?? []).sort(byRemark) });
    }
    return { groups, total: hosts.length };
  }

  async listTags(): Promise<string[]> {
    try {
      const tags = await this.remna.listHostTags();
      if (tags.length) return tags.sort();
    } catch (e) {
      this.log.warn(`listHostTags failed, falling back to listHosts: ${(e as Error).message}`);
    }
    const hosts = await this.remna.listHosts();
    const tags = new Set<string>();
    for (const h of hosts) if (h.tag) tags.add(h.tag);
    return [...tags].sort();
  }

  /**
   * Replace address (and optionally port) on all hosts that match the given tag.
   * Pass `__UNTAGGED__` to target hosts that have no tag at all.
   */
  async bulkReplaceAddressByTag(
    adminId: string,
    tag: string,
    newAddress: string,
    newPort: number | undefined,
    note: string | undefined,
  ): Promise<BulkReplaceResult> {
    const trimmed = newAddress.trim();
    if (!trimmed) throw new BadRequestException('newAddress must not be empty');

    const hosts = await this.remna.listHosts();
    const matching = hosts.filter((h) =>
      tag === UNTAGGED ? !h.tag : h.tag === tag,
    );
    if (!matching.length) {
      throw new NotFoundException(`No hosts found for tag "${tag}"`);
    }

    // Capture a representative previous value for the audit row. All hosts in
    // the group are expected to share the same backend IP; we still record the
    // first one and per-host outcomes go to the audit payload.
    const sample = matching[0];
    const previousAddress = sample.address;
    const previousPort = sample.port;

    const hostsAffected: BulkReplaceResult['hostsAffected'] = [];
    const hostsFailed: BulkReplaceResult['hostsFailed'] = [];

    for (const h of matching) {
      try {
        await this.remna.updateHost(h.uuid, {
          address: trimmed,
          ...(newPort !== undefined ? { port: newPort } : {}),
        });
        hostsAffected.push({ uuid: h.uuid, remark: (h.remark as string) ?? null });
      } catch (e) {
        const msg = (e as Error).message;
        this.log.error(`updateHost ${h.uuid} failed: ${msg}`);
        hostsFailed.push({ uuid: h.uuid, remark: (h.remark as string) ?? null, error: msg });
      }
    }

    const change = await this.prisma.hostIpChange.create({
      data: {
        tag: tag === UNTAGGED ? null : tag,
        hostUuid: null,
        previousAddress,
        newAddress: trimmed,
        previousPort,
        newPort: newPort ?? null,
        hostsAffected: hostsAffected.length,
        hostsFailed: hostsFailed.length,
        performedBy: `admin:${adminId}`,
        note: note ?? null,
      },
    });

    await this.audit.log({
      actor: `admin:${adminId}`,
      action: 'hosts.bulk_replace_address',
      targetId: change.id,
      payload: {
        tag: tag === UNTAGGED ? null : tag,
        previousAddress,
        newAddress: trimmed,
        previousPort,
        newPort: newPort ?? null,
        hostsAffected,
        hostsFailed,
        note: note ?? null,
      },
    });

    return {
      affected: hostsAffected.length,
      failed: hostsFailed.length,
      hostsAffected,
      hostsFailed,
      changeId: change.id,
    };
  }

  /**
   * Replace address on a single Remnawave host by uuid.
   */
  async replaceAddressForHost(
    adminId: string,
    uuid: string,
    newAddress: string,
    newPort: number | undefined,
    note: string | undefined,
  ): Promise<BulkReplaceResult> {
    const trimmed = newAddress.trim();
    if (!trimmed) throw new BadRequestException('newAddress must not be empty');

    const hosts = await this.remna.listHosts();
    const target = hosts.find((h) => h.uuid === uuid);
    if (!target) throw new NotFoundException('Host not found in Remnawave');

    const previousAddress = target.address;
    const previousPort = target.port;

    const hostsAffected: BulkReplaceResult['hostsAffected'] = [];
    const hostsFailed: BulkReplaceResult['hostsFailed'] = [];
    try {
      await this.remna.updateHost(uuid, {
        address: trimmed,
        ...(newPort !== undefined ? { port: newPort } : {}),
      });
      hostsAffected.push({ uuid, remark: (target.remark as string) ?? null });
    } catch (e) {
      const msg = (e as Error).message;
      hostsFailed.push({ uuid, remark: (target.remark as string) ?? null, error: msg });
    }

    const change = await this.prisma.hostIpChange.create({
      data: {
        tag: (target.tag as string | null | undefined) ?? null,
        hostUuid: uuid,
        previousAddress,
        newAddress: trimmed,
        previousPort,
        newPort: newPort ?? null,
        hostsAffected: hostsAffected.length,
        hostsFailed: hostsFailed.length,
        performedBy: `admin:${adminId}`,
        note: note ?? null,
      },
    });

    await this.audit.log({
      actor: `admin:${adminId}`,
      action: 'hosts.replace_address',
      targetId: change.id,
      payload: {
        hostUuid: uuid,
        tag: (target.tag as string | null | undefined) ?? null,
        previousAddress,
        newAddress: trimmed,
        previousPort,
        newPort: newPort ?? null,
        hostsAffected,
        hostsFailed,
        note: note ?? null,
      },
    });

    return {
      affected: hostsAffected.length,
      failed: hostsFailed.length,
      hostsAffected,
      hostsFailed,
      changeId: change.id,
    };
  }

  async listHistory(params: { skip?: number; take?: number } = {}) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.hostIpChange.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.hostIpChange.count(),
    ]);
    return { items, total };
  }
}

function byRemark(a: HostSummary, b: HostSummary) {
  return (a.remark ?? '').localeCompare(b.remark ?? '');
}
