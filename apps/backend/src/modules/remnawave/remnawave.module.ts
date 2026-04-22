import { Global, Module } from '@nestjs/common';
import { RemnawaveService } from './remnawave.service';

@Global()
@Module({
  providers: [RemnawaveService],
  exports: [RemnawaveService],
})
export class RemnawaveModule {}
