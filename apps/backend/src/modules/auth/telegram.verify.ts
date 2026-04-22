import { createHmac } from 'node:crypto';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Verify Telegram Mini App initData signature.
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param initData Raw initData string from Telegram.WebApp.initData
 * @param botToken Bot token from @BotFather
 * @param maxAgeSec Max acceptable age of auth_date (default 1 day)
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86_400,
): TelegramUser | null {
  if (!initData) return null;
  const url = new URLSearchParams(initData);
  const hash = url.get('hash');
  if (!hash) return null;
  url.delete('hash');

  const dataCheckString = [...url.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (calc !== hash) return null;

  const authDate = Number(url.get('auth_date') ?? 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > maxAgeSec) return null;

  const userRaw = url.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}
