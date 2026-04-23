import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/format';

interface Reseller {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  tag?: string | null;
  providerId?: string | null;
  type: 'STANDARD' | 'PREMIUM';
  maxClients: number;
  clientsCount: number;
  expiresAt?: string | null;
  isActive: boolean;
}

function initials(r: Reseller): string {
  const base = r.username || r.firstName || r.telegramId;
  const s = base.replace(/[^A-Za-zА-Яа-я0-9]/g, '').trim();
  return (s[0] ?? '?').toUpperCase() + (s[1] ?? '').toUpperCase();
}

export function Resellers() {
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'resellers', search],
    queryFn: async () =>
      (
        await api.get<{ items: Reseller[] }>('/admin/resellers', {
          params: { search: search || undefined, take: 200 },
        })
      ).data,
  });

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Реселлеры"
        subtitle={q.data ? `${q.data.items.length} всего` : undefined}
        action={
          <Link to="/admin/resellers/new">
            <Button size="sm">
              <Icon name="plus" size={16} /> Новый
            </Button>
          </Link>
        }
      />

      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tg-hint"
        />
        <Input
          placeholder="Поиск по username или Telegram ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {q.isLoading ? (
        <Card>
          <p className="text-sm text-tg-hint">Загрузка…</p>
        </Card>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((r) => {
            const name = r.username ? `@${r.username}` : r.firstName ?? `tg:${r.telegramId}`;
            const pct =
              r.maxClients > 0 ? Math.min(100, Math.round((r.clientsCount / r.maxClients) * 100)) : 0;
            return (
              <Link
                key={r.id}
                to={`/admin/resellers/${r.id}`}
                className="block rounded-2xl bg-tg-secondary p-3 ring-1 ring-black/5 shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-sm font-semibold text-tg-button">
                    {initials(r)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{name}</span>
                      {r.tag && (
                        <span className="rounded-full bg-tg-button/10 px-2 py-0.5 font-mono text-[10px] text-tg-button">
                          {r.tag}
                        </span>
                      )}
                      <span
                        className={clsx(
                          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
                          r.isActive
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-red-500/10 text-red-600',
                        )}
                      >
                        {r.isActive ? 'активен' : 'выключен'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-tg-hint">
                      {r.type} · до {formatDate(r.expiresAt ?? null)}
                      {r.providerId ? ` · ID: ${r.providerId}` : ''}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            pct >= 90
                              ? 'bg-red-500'
                              : pct >= 70
                                ? 'bg-amber-500'
                                : 'bg-tg-button',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-tg-hint">
                        {r.clientsCount}/{r.maxClients}
                      </span>
                    </div>
                  </div>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-tg-hint" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name="store" />
          </span>
          <p className="text-sm text-tg-hint">Реселлеров ещё нет</p>
        </Card>
      )}
    </div>
  );
}
