import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';

@Injectable()
export class ResellersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

    const created = await this.prisma.reseller.create({
      data: {
        telegramId: tg,
        username: dto.username,
        type: dto.type,
        maxClients: dto.maxClients,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
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
