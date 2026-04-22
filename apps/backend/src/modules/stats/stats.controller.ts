import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StatsService } from './stats.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    if (user.role === Role.ADMIN) {
      return this.stats.summaryForAdmin();
    }
    return this.stats.summaryForReseller(user.sub);
  }

  @Get('admin/summary')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  adminSummary() {
    return this.stats.summaryForAdmin();
  }
}
