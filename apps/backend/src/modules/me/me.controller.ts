import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('me')
export class MeController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: JwtUser) {
    const r = await this.prisma.reseller.findUnique({ where: { id: user.sub } });
    if (!r) throw new NotFoundException();
    const clientsCount = await this.prisma.client.count({ where: { resellerId: r.id } });
    return {
      id: r.id,
      telegramId: r.telegramId.toString(),
      username: r.username,
      firstName: r.firstName,
      lastName: r.lastName,
      role: r.role,
      type: r.type,
      maxClients: r.maxClients,
      clientsCount,
      expiresAt: r.expiresAt,
      isActive: r.isActive,
    };
  }
}
