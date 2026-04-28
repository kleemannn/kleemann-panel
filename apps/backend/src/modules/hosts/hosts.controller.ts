import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { HostsService } from './hosts.service';
import {
  BulkReplaceAddressDto,
  ReplaceAddressDto,
} from './dto/bulk-replace-address.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/hosts')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class HostsController {
  constructor(private svc: HostsService) {}

  @Get()
  list() {
    return this.svc.listGrouped();
  }

  @Get('tags')
  tags() {
    return this.svc.listTags();
  }

  @Get('history')
  history(@Query('skip') skip = 0, @Query('take') take = 50) {
    return this.svc.listHistory({ skip: Number(skip), take: Number(take) });
  }

  @Post('bulk-replace-address')
  bulkReplace(@CurrentUser() user: JwtUser, @Body() dto: BulkReplaceAddressDto) {
    return this.svc.bulkReplaceAddressByTag(
      user.sub,
      dto.tag,
      dto.newAddress,
      dto.newPort,
      dto.note,
    );
  }

  @Post(':uuid/replace-address')
  replaceOne(
    @CurrentUser() user: JwtUser,
    @Param('uuid') uuid: string,
    @Body() dto: ReplaceAddressDto,
  ) {
    return this.svc.replaceAddressForHost(
      user.sub,
      uuid,
      dto.newAddress,
      dto.newPort,
      dto.note,
    );
  }
}
