import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { daysUntil, formatDate, formatGb } from '@/lib/format';

export interface ClientRowModel {
  id: string;
  username: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';
  expiresAt?: string | null;
  trafficLimitGb?: number | null;
  note?: string | null;
}

const badgeClass = {
  ACTIVE: 'bg-green-500/15 text-green-600',
  EXPIRED: 'bg-red-500/15 text-red-600',
  DISABLED: 'bg-gray-500/15 text-gray-500',
  LIMITED: 'bg-yellow-500/15 text-yellow-700',
};

export function ClientRow({ c }: { c: ClientRowModel }) {
  const d = daysUntil(c.expiresAt ?? null);
  return (
    <Link
      to={`/clients/${c.id}`}
      className="flex items-center justify-between gap-3 rounded-xl bg-tg-secondary px-3 py-3 active:opacity-80"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{c.username}</span>
          <span className={clsx('rounded px-1.5 py-0.5 text-[10px] uppercase', badgeClass[c.status])}>
            {c.status}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-tg-hint">
          {formatDate(c.expiresAt ?? null)} · {formatGb(c.trafficLimitGb ?? null)}
          {c.note ? ` · ${c.note}` : ''}
        </div>
      </div>
      {d !== null && (
        <span
          className={clsx(
            'shrink-0 text-xs tabular-nums',
            d < 0 ? 'text-red-500' : d <= 7 ? 'text-yellow-600' : 'text-tg-hint',
          )}
        >
          {d < 0 ? `${-d}д назад` : `через ${d}д`}
        </span>
      )}
    </Link>
  );
}
