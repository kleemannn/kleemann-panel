import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResellerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SquadMappingService {
  constructor(
    private prisma: PrismaService,
    private cfg: ConfigService,
  ) {}

  async getSquadUuidForType(type: ResellerType): Promise<string> {
    const row = await this.prisma.squadMapping.findUnique({ where: { type } });
    if (row?.squadUuid) return row.squadUuid;
    const fromEnv =
      type === ResellerType.STANDARD
        ? this.cfg.get<string>('SQUAD_STANDARD_UUID')
        : this.cfg.get<string>('SQUAD_PREMIUM_UUID');
    if (!fromEnv) {
      throw new NotFoundException(
        `No squad mapping configured for type ${type}. Set it in Admin UI or SQUAD_${type}_UUID env var.`,
      );
    }
    return fromEnv;
  }

  list() {
    return this.prisma.squadMapping.findMany({ orderBy: { type: 'asc' } });
  }

  async upsert(type: ResellerType, squadUuid: string, label?: string) {
    return this.prisma.squadMapping.upsert({
      where: { type },
      update: { squadUuid, label },
      create: { type, squadUuid, label },
    });
  }
}
