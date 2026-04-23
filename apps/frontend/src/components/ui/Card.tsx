import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-2xl bg-tg-secondary p-4 ring-1 ring-black/5 shadow-sm',
        className,
      )}
      {...rest}
    />
  );
}
