import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { daysUntil, formatDate, formatGb } from '@/lib/format';
import { StatusBadge, ClientStatus } from '@/components/ui/StatusBadge';
import { Icon } from '@/components/ui/Icon';

export interface ClientRowModel {
  id: string;
  username: string;
  status: ClientStatus;
  expiresAt?: string | null;
  trafficLimitGb?: number | null;
  note?: string | null;
}

function initials(name: string): string {
  const parts = name.replace(/[_.-]+/g, ' ').split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? name[0] ?? '?';
  const second = parts[1]?.[0];
  return (second ? first + second : first).toUpperCase();
}

export function ClientRow({ c }: { c: ClientRowModel }) {
  const d = daysUntil(c.expiresAt ?? null);
  const deadlineText =
    d === null
      ? null
      : d < 0
        ? `${-d} дн. назад`
        : d === 0
          ? 'сегодня'
          : `через ${d} дн.`;
  const deadlineTone =
    d === null
      ? 'text-tg-hint'
      : d < 0
        ? 'text-red-500'
        : d <= 7
          ? 'text-amber-600'
          : 'text-tg-hint';

  return (
    <Link
      to={`/clients/${c.id}`}
      className="group flex items-center gap-3 rounded-2xl bg-tg-secondary px-3 py-3 ring-1 ring-black/5 shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button/10 text-sm font-semibold text-tg-button">
        {initials(c.username)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{c.username}</span>
          <StatusBadge status={c.status} size="xs" />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-tg-hint">
          <span className="truncate">
            {formatDate(c.expiresAt ?? null)} · {formatGb(c.trafficLimitGb ?? null)}
          </span>
        </div>
        {c.note && (
          <div className="mt-0.5 truncate text-xs text-tg-hint/80">{c.note}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {deadlineText && (
          <span className={clsx('text-xs font-medium tabular-nums', deadlineTone)}>
            {deadlineText}
          </span>
        )}
        <Icon name="chevronRight" size={16} className="text-tg-hint" />
      </div>
    </Link>
  );
}
