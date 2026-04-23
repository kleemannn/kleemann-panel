import { ReactNode } from 'react';
import clsx from 'clsx';
import { Icon, IconName } from './ui/Icon';

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

const toneCls: Record<Tone, { iconBg: string; iconText: string }> = {
  neutral: { iconBg: 'bg-tg-hint/10', iconText: 'text-tg-hint' },
  accent: { iconBg: 'bg-tg-button/10', iconText: 'text-tg-button' },
  success: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600' },
  warn: { iconBg: 'bg-amber-500/10', iconText: 'text-amber-600' },
  danger: { iconBg: 'bg-red-500/10', iconText: 'text-red-600' },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: Tone;
}) {
  const t = toneCls[tone];
  return (
    <div className="rounded-2xl bg-tg-secondary p-4 ring-1 ring-black/5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-tg-hint">
          {label}
        </span>
        {icon && (
          <span
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-full',
              t.iconBg,
              t.iconText,
            )}
          >
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums leading-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-tg-hint">{hint}</div>}
    </div>
  );
}
