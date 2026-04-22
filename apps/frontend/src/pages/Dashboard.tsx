import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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

export function Dashboard() {
  const me = useAuthStore((s) => s.me);
  const summary = useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: async () => (await api.get<Summary>('/stats/summary')).data,
  });

  const expiring = useQuery({
    queryKey: ['clients', 'expiring'],
    queryFn: async () => (await api.get<{ items: ClientRowModel[] }>('/clients', {
      params: { expiringInDays: 7, take: 5 },
    })).data,
  });

  const s = summary.data;
  const daysLeft = daysUntil(me?.expiresAt ?? null);

  return (
    <div className="p-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Привет, {me?.firstName ?? me?.username ?? 'реселлер'}</h1>
        <p className="text-sm text-tg-hint">
          Тариф: <span className="font-medium">{me?.type}</span>
          {me?.expiresAt && (
            <>
              {' · '}
              срок:{' '}
              <span className={daysLeft !== null && daysLeft < 7 ? 'text-red-500' : ''}>
                {formatDate(me.expiresAt)}
              </span>
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Всего" value={s?.total ?? '—'} hint={`Лимит ${s?.maxClients ?? '—'}`} />
        <StatCard label="Активные" value={s?.active ?? '—'} />
        <StatCard label="Истекают ≤7д" value={s?.expiringSoon ?? '—'} />
        <StatCard label="Остаток квоты" value={s?.quotaRemaining ?? '—'} />
      </div>

      <Link to="/clients/new">
        <Button full>➕ Создать клиента</Button>
      </Link>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-tg-hint uppercase tracking-wide">
            Скоро истекают
          </h2>
          <Link to="/clients" className="text-xs text-tg-link">
            все →
          </Link>
        </div>
        {expiring.data && expiring.data.items.length === 0 ? (
          <Card>
            <p className="text-sm text-tg-hint">Нет клиентов с приближающимся окончанием.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {expiring.data?.items.map((c) => <ClientRow key={c.id} c={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}
