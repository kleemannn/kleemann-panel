import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { HostPoolService } from '../hosts/host-pool.service';

/**
 * Long-polling Telegram bot that exposes admin shortcuts so an operator can
 * react from the Telegram chat without opening the Mini App.
 *
 * Currently supported:
 *   /rotate            list configured tags
 *   /rotate <TAG>      rotate the active IP for hosts that share <TAG>
 *
 * Authorisation: the bot only answers to chat IDs listed in
 * `ADMIN_TELEGRAM_IDS` (same env var that auto-promotes admins on first login).
 *
 * The whole bot is no-op when `TELEGRAM_BOT_TOKEN` is missing — the panel keeps
 * working as a Mini App.
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private readonly adminIds: Set<string>;

  constructor(
    private cfg: ConfigService,
    private pools: HostPoolService,
  ) {
    const raw = this.cfg.get<string>('ADMIN_TELEGRAM_IDS') ?? '';
    this.adminIds = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  async onModuleInit(): Promise<void> {
    const token = this.cfg.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token === '123456:PLACEHOLDER') {
      this.log.warn('TELEGRAM_BOT_TOKEN not configured — bot disabled');
      return;
    }
    if (this.adminIds.size === 0) {
      this.log.warn(
        'ADMIN_TELEGRAM_IDS is empty — bot will start but reject every command',
      );
    }
    const bot = new Bot(token);
    this.bot = bot;

    bot.command('rotate', (ctx) => this.handleRotate(ctx));
    bot.command('start', (ctx) =>
      ctx.reply(
        'Kleemann admin bot.\n\nДоступные команды:\n/rotate — список тегов с пулами\n/rotate <TAG> — ротировать на следующий IP',
      ),
    );

    bot.catch((err) => {
      this.log.error(`bot error: ${err.error}`);
    });

    // Fire-and-forget: grammy's start() resolves only when the bot stops.
    bot.start({ drop_pending_updates: true }).catch((err) => {
      this.log.error(`bot polling crashed: ${err}`);
    });
    this.log.log(`Telegram bot started, ${this.adminIds.size} admin(s) authorised`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch (e) {
        this.log.warn(`bot stop failed: ${(e as Error).message}`);
      }
      this.bot = null;
    }
  }

  private isAdmin(ctx: Context): boolean {
    const id = ctx.from?.id;
    if (!id) return false;
    return this.adminIds.has(String(id));
  }

  private async handleRotate(ctx: Context): Promise<void> {
    if (!this.isAdmin(ctx)) {
      await ctx.reply('⛔ Команда доступна только администратору.');
      return;
    }
    const text = ctx.match?.toString().trim() ?? '';
    if (!text) {
      const pools = await this.pools.list();
      if (!pools.length) {
        await ctx.reply(
          'Нет настроенных пулов IP.\nЗайди в Mini App → Хосты → Пулы и добавь хотя бы один.',
        );
        return;
      }
      const lines = pools.map((p) => {
        const cur = p.addresses[p.currentIdx] ?? '—';
        return `• <code>${escapeHtml(p.tag)}</code> — ${escapeHtml(cur)} (${p.addresses.length} в пуле)`;
      });
      await ctx.reply(
        'Пулы IP:\n' +
          lines.join('\n') +
          '\n\nКоманда: <code>/rotate &lt;TAG&gt;</code>',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const tag = text.split(/\s+/)[0].toUpperCase();
    if (!/^[A-Z0-9_:]{1,32}$/.test(tag)) {
      await ctx.reply(
        '❗ Тег должен состоять из A-Z, 0-9, `_`, `:` и быть не длиннее 32 символов.',
      );
      return;
    }

    try {
      const r = await this.pools.rotate(`bot:tg:${ctx.from!.id}`, tag);
      await ctx.reply(
        `🔁 <b>${escapeHtml(tag)}</b>\n${escapeHtml(r.fromAddress)} → <b>${escapeHtml(r.toAddress)}</b>\n` +
          `Хостов обновлено: ${r.affected}` +
          (r.failed > 0 ? `, ошибок: ${r.failed}` : ''),
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      await ctx.reply(`❌ ${msg}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;',
  );
}
