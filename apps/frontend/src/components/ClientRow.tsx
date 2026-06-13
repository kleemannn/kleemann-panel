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
  /** Owning reseller — only joined into the response for ADMIN viewers. */
  reseller?: { id: string; username?: string | null; tag?: string | null } | null;
}

function initials(name: string): string {
  const parts = name.replace(/[_.-]+/g, ' ').split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? name[0] ?? '?';
  const second = parts[1]?.[0];
  return (second ? first + second : first).toUpperCase();
}

// Default if backend hasn't sent us its config yet — purely cosmetic countdown.
const DEFAULT_RETENTION_DAYS = 7;

export function ClientRow({
  c,
  retentionDays = DEFAULT_RETENTION_DAYS,
  resellerId,
}: {
  c: ClientRowModel;
  retentionDays?: number;
  resellerId?: string;
}) {
  const d = daysUntil(c.expiresAt ?? null);
  // For expired clients we replace "истёк X дн назад" with the more
  // actionable "удалится через Y дн" so the reseller sees the deadline
  // for renewing before auto-purge kicks in.
  const willPurge =
    c.status === 'EXPIRED' && d !== null && retentionDays > 0 ? retentionDays + d : null;
  const deadlineText =
    willPurge !== null
      ? willPurge <= 0
        ? 'удалится скоро'
        : `удалится через ${willPurge} дн.`
      : d === null
        ? null
        : d < 0
          ? `${-d} дн. назад`
          : d === 0
            ? 'сегодня'
            : `через ${d} дн.`;
  const deadlineTone =
    willPurge !== null
      ? 'text-red-500'
      : d === null
        ? 'text-tg-hint'
        : d < 0
          ? 'text-red-500'
          : d <= 7
            ? 'text-amber-600'
            : 'text-tg-hint';

  return (
    <Link
      to={resellerId ? `/clients/${c.id}?resellerId=${resellerId}` : `/clients/${c.id}`}
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
        {c.reseller && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-tg-hint">
            <Icon name="store" size={11} />
            <span className="truncate">
              {c.reseller.username ? `@${c.reseller.username}` : c.reseller.id.slice(0, 8)}
            </span>
            {c.reseller.tag && (
              <span className="rounded-full bg-tg-button/10 px-1.5 py-px font-mono text-[10px] text-tg-button">
                {c.reseller.tag}
              </span>
            )}
          </div>
        )}
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
