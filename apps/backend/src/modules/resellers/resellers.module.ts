import { Module } from '@nestjs/common';
import { ResellersService } from './resellers.service';
import { ResellersController } from './resellers.controller';
import { RemnawaveModule } from '../remnawave/remnawave.module';

@Module({
  imports: [RemnawaveModule],
  controllers: [ResellersController],
  providers: [ResellersService],
  exports: [ResellersService],
})
export class ResellersModule {}
