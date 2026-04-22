import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get('history')
  myHistory(
    @CurrentUser() user: JwtUser,
    @Query('skip') skip = 0,
    @Query('take') take = 50,
  ) {
    return this.audit.listForReseller(user.sub, { skip: Number(skip), take: Number(take) });
  }

  @Get('admin/audit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  all(
    @Query('skip') skip = 0,
    @Query('take') take = 50,
    @Query('action') action?: string,
  ) {
    return this.audit.listAll({ skip: Number(skip), take: Number(take), action });
  }
}
