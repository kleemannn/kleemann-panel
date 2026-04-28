import { Module } from '@nestjs/common';
import { HostsController } from './hosts.controller';
import { HostsService } from './hosts.service';
import { HostPoolService } from './host-pool.service';

@Module({
  controllers: [HostsController],
  providers: [HostsService, HostPoolService],
  exports: [HostsService, HostPoolService],
})
export class HostsModule {}
