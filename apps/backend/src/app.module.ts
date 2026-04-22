import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ResellersModule } from './modules/resellers/resellers.module';
import { SquadMappingModule } from './modules/squad-mapping/squad-mapping.module';
import { StatsModule } from './modules/stats/stats.module';
import { AuditModule } from './modules/audit/audit.module';
import { MeModule } from './modules/me/me.module';
import { RemnawaveModule } from './modules/remnawave/remnawave.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RemnawaveModule,
    AuthModule,
    MeModule,
    ClientsModule,
    ResellersModule,
    SquadMappingModule,
    StatsModule,
    AuditModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
