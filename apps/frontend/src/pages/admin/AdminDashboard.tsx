import { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, IconName } from '@/components/ui/Icon';
import { tgHapticSuccess, tgHapticError } from '@/lib/telegram';

interface AdminSummary {
  resellers: number;
  activeResellers: number;
  clients: number;
  activeClients: number;
}

interface ImportResult {
  imported: number;
  skippedNoTag: number;
  skippedExisting: number;
  skippedUnknownTag: number;
}

export function AdminDashboard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: async () => (await api.get<AdminSummary>('/stats/admin/summary')).data,
  });
  const s = q.data;

  const importMut = useMutation({
    mutationFn: async () =>
      (await api.post<ImportResult>('/admin/resellers/import-clients')).data,
    onSuccess: (r) => {
      tgHapticSuccess();
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['admin', 'summary'] });
      const msg =
        `Импортировано: ${r.imported}\n` +
        `Уже было: ${r.skippedExisting}\n` +
        `Без тега: ${r.skippedNoTag}\n` +
        `Неизвестный тег: ${r.skippedUnknownTag}`;
      window.Telegram?.WebApp?.showAlert?.(msg) ?? alert(msg);
    },
    onError: () => tgHapticError(),
  });

  return (
    <div className="space-y-5 p-4">
      <section className="brand-gradient rounded-3xl p-5 text-tg-buttonText shadow-sm">
        <div className="text-xs uppercase tracking-wide text-white/70">Панель администратора</div>
        <div className="mt-0.5 text-2xl font-semibold">Kleemann Panel</div>
        <p className="mt-1 text-sm text-white/80">
          Управление реселлерами, клиентами и squad-маппингом.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Реселлеров"
          value={s?.resellers ?? '—'}
          hint={`активных ${s?.activeResellers ?? '—'}`}
          icon="store"
          tone="accent"
        />
        <StatCard
          label="Клиентов"
          value={s?.clients ?? '—'}
          hint={`активных ${s?.activeClients ?? '—'}`}
          icon="users"
          tone="success"
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">
          Реселлеры
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard to="/admin/resellers" icon="store" title="Список" subtitle="Все реселлеры" />
          <ActionCard
            to="/admin/resellers/new"
            icon="plus"
            title="Новый"
            subtitle="Добавить реселлера"
            primary
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">Клиенты</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard to="/clients" icon="users" title="Список" subtitle="Все клиенты" />
          <ActionCard
            to="/clients/new"
            icon="plus"
            title="Новый"
            subtitle="Создать клиента"
            primary
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-tg-hint">Настройки</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard to="/admin/squads" icon="puzzle" title="Squads" subtitle="Маппинг squad'ов" />
          <ActionCard to="/admin/audit" icon="clipboard" title="Audit" subtitle="Журнал действий" />
          <ActionCard
            to="/admin/backup"
            icon="download"
            title="Backup"
            subtitle="Экспорт и восстановление"
          />
          <ActionCard
            to="/admin/hosts"
            icon="shield"
            title="Хосты"
            subtitle="Замена IP при блокировках"
          />
        </div>
      </section>

      <Card className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-tg-button">
          <Icon name="download" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Импорт из Remnawave</div>
          <div className="text-xs text-tg-hint">Подтянуть существующих пользователей по тегам.</div>
        </div>
        <Button
          size="sm"
          onClick={() => importMut.mutate()}
          disabled={importMut.isPending}
        >
          {importMut.isPending ? '…' : 'Запустить'}
        </Button>
      </Card>
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  subtitle,
  primary,
}: {
  to: string;
  icon: IconName;
  title: string;
  subtitle: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-black/5 shadow-sm transition active:scale-[0.99]',
        primary
          ? 'brand-gradient text-tg-buttonText'
          : 'bg-tg-secondary text-tg-text',
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          primary ? 'bg-white/15' : 'bg-tg-button/10 text-tg-button',
        )}
      >
        <Icon name={icon} />
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className={clsx('text-xs', primary ? 'text-white/80' : 'text-tg-hint')}>
          {subtitle}
        </div>
      </div>
    </Link>
  );
}
