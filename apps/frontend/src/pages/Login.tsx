import { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';

interface Props {
  loginMutation: UseMutationResult<unknown, Error, void>;
}

export function Login({ loginMutation }: Props) {
  const inTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
  const error = loginMutation.error as Error | undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-3xl font-semibold mb-2">Kleemann Panel</div>
      <p className="text-tg-hint mb-6 max-w-xs">
        Reseller-панель для VPN/Proxy на базе Remnawave. Откройте приложение внутри Telegram.
      </p>

      {!inTelegram && (
        <p className="text-sm text-red-500 mb-4">
          Telegram WebApp не обнаружен. Приложение должно быть открыто через Mini App в Telegram.
        </p>
      )}

      <Button
        onClick={() => loginMutation.mutate()}
        disabled={loginMutation.isPending || !inTelegram}
      >
        {loginMutation.isPending ? 'Входим…' : 'Войти через Telegram'}
      </Button>

      {error && (
        <p className="mt-4 text-sm text-red-500 max-w-xs">{error.message}</p>
      )}
    </div>
  );
}
