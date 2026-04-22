import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  actor: string;                 // "admin:<id>" | "reseller:<id>"
  resellerId?: string | null;
  action: string;
  targetId?: string | null;
  payload?: Prisma.InputJsonValue;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        actor: input.actor,
        resellerId: input.resellerId ?? null,
        action: input.action,
        targetId: input.targetId ?? null,
        payload: input.payload ?? undefined,
        ip: input.ip ?? null,
      },
    });
  }

  async listForReseller(resellerId: string, params: { skip?: number; take?: number } = {}) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { resellerId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where: { resellerId } }),
    ]);
    return { items, total };
  }

  async listAll(params: { skip?: number; take?: number; action?: string } = {}) {
    const take = Math.min(params.take ?? 50, 200);
    const skip = params.skip ?? 0;
    const where = params.action ? { action: params.action } : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
