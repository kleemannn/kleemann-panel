import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ResellersService } from './resellers.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/resellers')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class ResellersController {
  constructor(private svc: ResellersService) {}

  @Get()
  list(@Query('skip') skip = 0, @Query('take') take = 50, @Query('search') search?: string) {
    return this.svc.list({ skip: Number(skip), take: Number(take), search });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateResellerDto) {
    return this.svc.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateResellerDto,
  ) {
    return this.svc.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.svc.remove(user.sub, id);
  }
}
