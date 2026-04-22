import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, ResellerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyTelegramInitData, TelegramUser } from './telegram.verify';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  async loginWithTelegram(initData: string) {
    const botToken = this.cfg.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const tgUser = verifyTelegramInitData(initData, botToken);
    if (!tgUser) throw new UnauthorizedException('Invalid Telegram initData');

    const reseller = await this.findOrProvision(tgUser);
    if (!reseller.isActive) throw new UnauthorizedException('Reseller is disabled');
    if (reseller.expiresAt && reseller.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reseller account expired');
    }

    const accessToken = await this.jwt.signAsync(
      { sub: reseller.id, telegramId: reseller.telegramId.toString(), role: reseller.role },
      { expiresIn: this.cfg.get('JWT_ACCESS_TTL') ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: reseller.id, typ: 'refresh' },
      { expiresIn: this.cfg.get('JWT_REFRESH_TTL') ?? '7d' },
    );

    return {
      accessToken,
      refreshToken,
      me: this.publicReseller(reseller),
    };
  }

  async refresh(token: string) {
    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Invalid token type');

    const reseller = await this.prisma.reseller.findUnique({ where: { id: payload.sub } });
    if (!reseller || !reseller.isActive) throw new UnauthorizedException('Reseller disabled');

    const accessToken = await this.jwt.signAsync(
      { sub: reseller.id, telegramId: reseller.telegramId.toString(), role: reseller.role },
      { expiresIn: this.cfg.get('JWT_ACCESS_TTL') ?? '15m' },
    );
    return { accessToken };
  }

  private async findOrProvision(tgUser: TelegramUser) {
    const telegramId = BigInt(tgUser.id);
    const adminIds = (this.cfg.get<string>('ADMIN_TELEGRAM_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAdmin = adminIds.includes(String(tgUser.id));

    const existing = await this.prisma.reseller.findUnique({ where: { telegramId } });
    if (existing) {
      // Refresh display info + ensure admin role if configured.
      const patch: Record<string, unknown> = {
        username: tgUser.username ?? existing.username,
        firstName: tgUser.first_name ?? existing.firstName,
        lastName: tgUser.last_name ?? existing.lastName,
      };
      if (isAdmin && existing.role !== Role.ADMIN) patch.role = Role.ADMIN;
      return this.prisma.reseller.update({ where: { id: existing.id }, data: patch });
    }

    if (!isAdmin) {
      // Non-admin users can only log in if admin has pre-created them.
      throw new UnauthorizedException(
        'You are not registered as a reseller. Contact the administrator.',
      );
    }

    return this.prisma.reseller.create({
      data: {
        telegramId,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        role: Role.ADMIN,
        type: ResellerType.PREMIUM,
        maxClients: 100_000,
      },
    });
  }

  publicReseller<T extends { telegramId: bigint }>(r: T) {
    return { ...r, telegramId: r.telegramId.toString() };
  }
}
