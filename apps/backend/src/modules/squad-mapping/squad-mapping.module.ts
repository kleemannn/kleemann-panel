import { Global, Module } from '@nestjs/common';
import { SquadMappingService } from './squad-mapping.service';
import { SquadMappingController } from './squad-mapping.controller';

@Global()
@Module({
  controllers: [SquadMappingController],
  providers: [SquadMappingService],
  exports: [SquadMappingService],
})
export class SquadMappingModule {}
