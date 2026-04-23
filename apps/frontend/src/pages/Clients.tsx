import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClientRow, ClientRowModel } from '@/components/ClientRow';

type Status = '' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';

const STATUSES: { value: Status; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'EXPIRED', label: 'Истёкшие' },
  { value: 'DISABLED', label: 'Отключённые' },
];

export function Clients() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');

  const q = useQuery({
    queryKey: ['clients', { search, status }],
    queryFn: async () =>
      (
        await api.get<{ items: ClientRowModel[]; total: number }>('/clients', {
          params: { search: search || undefined, status: status || undefined, take: 100 },
        })
      ).data,
  });

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Клиенты"
        subtitle={q.data ? `${q.data.total} всего` : undefined}
        action={
          <Link to="/clients/new">
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
          placeholder="Поиск по username или заметке"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
        {STATUSES.map((s) => (
          <button
            key={s.value || 'all'}
            onClick={() => setStatus(s.value)}
            className={clsx(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ring-1',
              status === s.value
                ? 'bg-tg-button text-tg-buttonText ring-tg-button'
                : 'bg-tg-secondary text-tg-hint ring-black/5 hover:text-tg-text',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Card>
          <p className="text-sm text-tg-hint">Загрузка…</p>
        </Card>
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-2">
          {q.data.items.map((c) => (
            <ClientRow key={c.id} c={c} />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name="users" />
          </span>
          <p className="text-sm text-tg-hint">Ничего не найдено</p>
        </Card>
      )}
    </div>
  );
}
