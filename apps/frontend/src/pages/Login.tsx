import { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

interface Props {
  loginMutation: UseMutationResult<unknown, Error, void>;
}

export function Login({ loginMutation }: Props) {
  const inTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
  const error = loginMutation.error as Error | undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="brand-gradient mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-tg-buttonText shadow-lg">
        <Icon name="logo" size={40} strokeWidth={2.2} />
      </div>

      <h1 className="text-2xl font-semibold">Kleemann Panel</h1>
      <p className="mt-2 max-w-xs text-sm text-tg-hint">
        Reseller-панель для VPN/Proxy на базе Remnawave. Откройте приложение внутри Telegram.
      </p>

      {!inTelegram && (
        <p className="mt-5 max-w-xs rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-600">
          Telegram WebApp не обнаружен. Приложение должно быть открыто через Mini App в Telegram.
        </p>
      )}

      <Button
        size="lg"
        className="mt-6 min-w-[220px]"
        onClick={() => loginMutation.mutate()}
        disabled={loginMutation.isPending || !inTelegram}
      >
        {loginMutation.isPending ? 'Входим…' : 'Войти через Telegram'}
      </Button>

      {error && (
        <p className="mt-4 max-w-xs text-sm text-red-500">{error.message}</p>
      )}
    </div>
  );
}
