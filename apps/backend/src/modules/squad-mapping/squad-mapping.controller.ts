import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SquadMappingService } from './squad-mapping.service';
import { RemnawaveService } from '../remnawave/remnawave.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpsertSquadDto } from './dto/upsert-squad.dto';

@Controller('admin/squads')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class SquadMappingController {
  constructor(
    private svc: SquadMappingService,
    private remna: RemnawaveService,
  ) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get('remnawave')
  async listRemnawaveSquads() {
    return this.remna.listInternalSquads();
  }

  @Put()
  upsert(@Body() dto: UpsertSquadDto) {
    return this.svc.upsert(dto.type, dto.squadUuid, dto.label);
  }
}
