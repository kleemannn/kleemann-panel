import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/auth';
import { formatDate, daysUntil } from '@/lib/format';
import { ClientRow, ClientRowModel } from '@/components/ClientRow';

interface Summary {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  maxClients: number;
  quotaRemaining: number;
  type: 'STANDARD' | 'PREMIUM';
  resellerExpiresAt?: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0];
  return (b ? a + b : a).toUpperCase();
}

export function Dashboard() {
  const me = useAuthStore((s) => s.me);
  const summary = useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: async () => (await api.get<Summary>('/stats/summary')).data,
  });

  const expiring = useQuery({
    queryKey: ['clients', 'expiring'],
    queryFn: async () =>
      (
        await api.get<{ items: ClientRowModel[] }>('/clients', {
          params: { expiringInDays: 7, take: 5 },
        })
      ).data,
  });

  const s = summary.data;
  const daysLeft = daysUntil(me?.expiresAt ?? null);
  const displayName = me?.firstName ?? me?.username ?? 'реселлер';

  return (
    <div className="space-y-5 p-4">
      <section className="brand-gradient relative overflow-hidden rounded-3xl p-5 text-tg-buttonText shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold backdrop-blur">
            {initials(displayName)}
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-white/70">Привет</div>
            <div className="truncate text-xl font-semibold">{displayName}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur">
            {me?.type}
          </span>
          {me?.expiresAt && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur">
              до {formatDate(me.expiresAt)}
              {daysLeft !== null && daysLeft < 14 && (
                <span className={daysLeft < 7 ? 'ml-1 text-red-200' : 'ml-1 text-white/90'}>
                  · {daysLeft < 0 ? `${-daysLeft}д назад` : `через ${daysLeft}д`}
                </span>
              )}
            </span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Всего" value={s?.total ?? '—'} hint={`Лимит ${s?.maxClients ?? '—'}`} icon="users" tone="accent" />
        <StatCard label="Активные" value={s?.active ?? '—'} icon="shield" tone="success" />
        <StatCard label="Истекают ≤7д" value={s?.expiringSoon ?? '—'} icon="clock" tone="warn" />
        <StatCard label="Остаток квоты" value={s?.quotaRemaining ?? '—'} icon="spark" tone="neutral" />
      </div>

      <Link to="/clients/new" className="block">
        <Button full size="lg">
          <Icon name="plus" /> Создать клиента
        </Button>
      </Link>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
            Скоро истекают
          </h2>
          <Link to="/clients" className="flex items-center gap-1 text-xs font-medium text-tg-link">
            все <Icon name="arrowRight" size={14} />
          </Link>
        </div>
        {expiring.isLoading ? (
          <Card>
            <p className="text-sm text-tg-hint">Загрузка…</p>
          </Card>
        ) : expiring.data && expiring.data.items.length === 0 ? (
          <Card>
            <p className="text-sm text-tg-hint">Нет клиентов с приближающимся окончанием.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {expiring.data?.items.map((c) => (
              <ClientRow key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
