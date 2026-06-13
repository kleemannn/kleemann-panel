import { Module } from '@nestjs/common';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { RemnawaveModule } from '../remnawave/remnawave.module';

@Module({
  imports: [RemnawaveModule],
  controllers: [LifecycleController],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
