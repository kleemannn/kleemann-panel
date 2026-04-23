import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { BackupService } from './backup.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/backup')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class BackupController {
  constructor(private svc: BackupService) {}

  @Get('export')
  @Header('Content-Type', 'application/json')
  async export(@CurrentUser() user: JwtUser, @Res({ passthrough: false }) res: Response) {
    const dump = await this.svc.export(user.sub);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="kleemann-backup-${ts}.json"`);
    res.send(JSON.stringify(dump, null, 2));
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    return this.svc.import(user.sub, body);
  }
}
