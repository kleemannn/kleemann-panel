import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ResellersModule } from './modules/resellers/resellers.module';
import { SquadMappingModule } from './modules/squad-mapping/squad-mapping.module';
import { StatsModule } from './modules/stats/stats.module';
import { AuditModule } from './modules/audit/audit.module';
import { BackupModule } from './modules/backup/backup.module';
import { SyncModule } from './modules/sync/sync.module';
import { HostsModule } from './modules/hosts/hosts.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';
import { MeModule } from './modules/me/me.module';
import { RemnawaveModule } from './modules/remnawave/remnawave.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RemnawaveModule,
    AuthModule,
    MeModule,
    ClientsModule,
    ResellersModule,
    SquadMappingModule,
    StatsModule,
    AuditModule,
    BackupModule,
    SyncModule,
    HostsModule,
    TelegramBotModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
