import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { RemnawaveModule } from '../remnawave/remnawave.module';

@Module({
  imports: [RemnawaveModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
