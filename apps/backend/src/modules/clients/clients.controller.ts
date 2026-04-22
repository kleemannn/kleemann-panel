import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ExtendClientDto } from './dto/extend-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('clients')
export class ClientsController {
  constructor(private svc: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUser,
    @Query('skip') skip = 0,
    @Query('take') take = 50,
    @Query('search') search?: string,
    @Query('status') status?: ClientStatus,
    @Query('expiringInDays') expiringInDays?: number,
  ) {
    return this.svc.list(user.sub, {
      skip: Number(skip),
      take: Number(take),
      search,
      status,
      expiringInDays: expiringInDays ? Number(expiringInDays) : undefined,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.getById(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateClientDto) {
    return this.svc.create(user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.svc.update(user.sub, id, dto);
  }

  @Post(':id/extend')
  extend(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ExtendClientDto) {
    return this.svc.extend(user.sub, id, dto);
  }

  @Post(':id/disable')
  disable(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.disable(user.sub, id);
  }

  @Post(':id/enable')
  enable(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.enable(user.sub, id);
  }

  @Post(':id/reset-traffic')
  reset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.resetTraffic(user.sub, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.sub, id);
  }

  @Get(':id/subscription')
  subscription(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.subscription(user.sub, id);
  }

  @Get(':id/usage')
  usage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.usage(user.sub, id, from, to);
  }
}
