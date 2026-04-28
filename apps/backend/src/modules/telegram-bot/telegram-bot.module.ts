import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { HostsModule } from '../hosts/hosts.module';

@Module({
  imports: [HostsModule],
  providers: [TelegramBotService],
})
export class TelegramBotModule {}
