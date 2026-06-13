import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LifecycleService } from './lifecycle.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/lifecycle')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class LifecycleController {
  constructor(private svc: LifecycleService) {}

  /** How long an EXPIRED client lives before auto-deletion (days). */
  @Get('config')
  config() {
    return { retentionDays: this.svc.retentionDays() };
  }

  /** Force a re-check: flip ACTIVE → EXPIRED for everything past expiresAt. */
  @Post('expire')
  @HttpCode(HttpStatus.OK)
  expire() {
    return this.svc.runExpire();
  }

  /** Force a purge of clients EXPIRED for more than retentionDays. */
  @Post('purge')
  @HttpCode(HttpStatus.OK)
  purge() {
    return this.svc.runPurge();
  }
}
