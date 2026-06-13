import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClientRow, ClientRowModel } from '@/components/ClientRow';
import { useAuthStore } from '@/store/auth';
import { useRetentionDays } from '@/lib/lifecycle';

type Status = '' | 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';

const STATUSES: { value: Status; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'EXPIRED', label: 'Истёкшие' },
  { value: 'DISABLED', label: 'Отключённые' },
];

interface Reseller {
  id: string;
  username?: string | null;
  firstName?: string | null;
  telegramId: string;
  tag?: string | null;
  clientsCount: number;
  isActive: boolean;
}

export function Clients() {
  const isAdmin = useAuthStore((s) => s.me?.role) === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();

  // Persist selected reseller in the URL so navigating back to /clients
  // (e.g. after deleting a client) doesn't reset to the picker.
  const resellerId = searchParams.get('resellerId');

  // Fetch the reseller object when we have an ID in the URL.
  const resellerQ = useQuery({
    queryKey: ['admin', 'reseller', resellerId],
    queryFn: async () =>
      (await api.get<Reseller & { providerId?: string | null }>(`/admin/resellers/${resellerId}`)).data,
    enabled: isAdmin && !!resellerId,
  });

  const pickedReseller: Reseller | null = resellerQ.data
    ? {
        id: resellerQ.data.id,
        username: resellerQ.data.username,
        firstName: resellerQ.data.firstName,
        telegramId: resellerQ.data.telegramId,
        tag: resellerQ.data.tag,
        clientsCount: 0,
        isActive: resellerQ.data.isActive ?? true,
      }
    : null;

  if (isAdmin && !resellerId) {
    return (
      <AdminResellerPicker
        onPick={(r) => setSearchParams({ resellerId: r.id })}
      />
    );
  }

  return (
    <ClientList
      isAdmin={isAdmin}
      reseller={pickedReseller}
      onBack={isAdmin ? () => setSearchParams({}) : undefined}
    />
  );
}

function AdminResellerPicker({ onPick }: { onPick: (r: Reseller) => void }) {
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'resellers', 'picker', search],
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
        title="Клиенты"
        subtitle="Выберите реселлера"
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
          placeholder="Поиск реселлера"
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
            const name = r.username
              ? `@${r.username}`
              : r.firstName ?? `tg:${r.telegramId}`;
            return (
              <button
                key={r.id}
                onClick={() => onPick(r)}
                className="flex w-full items-center gap-3 rounded-2xl bg-tg-secondary px-3 py-3 text-left ring-1 ring-black/5 shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
                  <Icon name="store" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{name}</span>
                    {r.tag && (
                      <span className="rounded-full bg-tg-button/10 px-2 py-0.5 font-mono text-[10px] text-tg-button">
                        {r.tag}
                      </span>
                    )}
                    {!r.isActive && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
                        выключен
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-tg-hint">
                    {r.clientsCount} клиент{plural(r.clientsCount)}
                  </div>
                </div>
                <Icon name="chevronRight" size={16} className="text-tg-hint" />
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name="store" />
          </span>
          <p className="text-sm text-tg-hint">Нет реселлеров</p>
        </Card>
      )}
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return '';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'а';
  return 'ов';
}

function ClientList({
  isAdmin,
  reseller,
  onBack,
}: {
  isAdmin: boolean;
  reseller: Reseller | null;
  onBack?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');
  const retentionDays = useRetentionDays();

  const q = useQuery({
    queryKey: ['clients', { search, status, resellerId: reseller?.id ?? null }],
    queryFn: async () =>
      (
        await api.get<{ items: ClientRowModel[]; total: number }>('/clients', {
          params: {
            search: search || undefined,
            status: status || undefined,
            resellerId: reseller?.id || undefined,
            take: 100,
          },
        })
      ).data,
  });

  const headerTitle = reseller
    ? reseller.username
      ? `@${reseller.username}`
      : reseller.firstName ?? `tg:${reseller.telegramId}`
    : 'Клиенты';

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={headerTitle}
        subtitle={
          reseller
            ? q.data
              ? `${q.data.total} клиент${plural(q.data.total)}`
              : undefined
            : q.data
              ? `${q.data.total} всего`
              : undefined
        }
        action={
          <div className="flex items-center gap-2">
            {onBack && (
              <Button size="sm" variant="ghost" onClick={onBack}>
                <Icon name="chevronRight" size={16} className="rotate-180" /> Реселлеры
              </Button>
            )}
            <Link to="/clients/new">
              <Button size="sm">
                <Icon name="plus" size={16} /> Новый
              </Button>
            </Link>
          </div>
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
            // When viewing one reseller's clients, hide the inline reseller
            // line on each row — it would just repeat the page header.
            <ClientRow
              key={c.id}
              c={isAdmin && reseller ? { ...c, reseller: null } : c}
              retentionDays={retentionDays}
              resellerId={reseller?.id}
            />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg-hint/10 text-tg-hint">
            <Icon name={status === 'EXPIRED' ? 'alert' : 'users'} />
          </span>
          <p className="text-sm text-tg-hint">
            {status === 'EXPIRED'
              ? retentionDays > 0
                ? `Нет истёкших клиентов. Они появятся здесь автоматически после окончания подписки и удалятся через ${retentionDays} дн., если не продлить.`
                : 'Нет истёкших клиентов. Они появятся здесь автоматически после окончания подписки.'
              : status === 'DISABLED'
                ? 'Нет отключённых клиентов.'
                : 'Ничего не найдено'}
          </p>
        </Card>
      )}
    </div>
  );
}
