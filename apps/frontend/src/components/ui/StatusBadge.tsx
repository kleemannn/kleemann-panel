import clsx from 'clsx';

export type ClientStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED' | 'LIMITED';

const LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Активен',
  EXPIRED: 'Истёк',
  DISABLED: 'Отключён',
  LIMITED: 'Ограничен',
};

const STYLE: Record<ClientStatus, { dot: string; text: string; bg: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  EXPIRED: { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-500/10' },
  DISABLED: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-500/10' },
  LIMITED: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-500/10' },
};

export function StatusBadge({
  status,
  size = 'sm',
  className,
}: {
  status: ClientStatus;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const s = STYLE[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        s.bg,
        s.text,
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
      {LABEL[status]}
    </span>
  );
}
