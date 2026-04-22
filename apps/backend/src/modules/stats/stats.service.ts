import { Injectable } from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async summaryForReseller(resellerId: string) {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 864e5);

    const [total, active, expired, expiringSoon, reseller] = await this.prisma.$transaction([
      this.prisma.client.count({ where: { resellerId } }),
      this.prisma.client.count({ where: { resellerId, status: ClientStatus.ACTIVE } }),
      this.prisma.client.count({ where: { resellerId, status: ClientStatus.EXPIRED } }),
      this.prisma.client.count({
        where: {
          resellerId,
          status: ClientStatus.ACTIVE,
          expiresAt: { gte: now, lte: in7 },
        },
      }),
      this.prisma.reseller.findUnique({ where: { id: resellerId } }),
    ]);

    const quotaRemaining = reseller ? Math.max(reseller.maxClients - total, 0) : 0;

    return {
      total,
      active,
      expired,
      expiringSoon,
      maxClients: reseller?.maxClients ?? 0,
      quotaRemaining,
      type: reseller?.type,
      resellerExpiresAt: reseller?.expiresAt,
    };
  }

  async summaryForAdmin() {
    const [resellers, activeResellers, clients, activeClients] = await this.prisma.$transaction([
      this.prisma.reseller.count(),
      this.prisma.reseller.count({ where: { isActive: true } }),
      this.prisma.client.count(),
      this.prisma.client.count({ where: { status: ClientStatus.ACTIVE } }),
    ]);
    return { resellers, activeResellers, clients, activeClients };
  }
}
