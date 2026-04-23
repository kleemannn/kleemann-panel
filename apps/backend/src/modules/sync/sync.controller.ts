import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SyncService } from './sync.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/sync')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class SyncController {
  constructor(private svc: SyncService) {}

  @Post('remnawave')
  @HttpCode(HttpStatus.OK)
  run() {
    return this.svc.runOnce();
  }
}
