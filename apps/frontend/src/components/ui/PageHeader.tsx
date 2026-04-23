import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from './Icon';

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = back ?? location.pathname !== '/';
  return (
    <header className={clsx('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tg-hint hover:bg-black/5"
            aria-label="Назад"
          >
            <Icon name="chevronRight" className="rotate-180" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-sm text-tg-hint">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
