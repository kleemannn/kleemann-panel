import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-tg-button text-tg-buttonText shadow-sm hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none',
  secondary:
    'bg-tg-secondary text-tg-text ring-1 ring-black/5 hover:bg-black/[0.03] disabled:opacity-40',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:opacity-40',
  ghost:
    'bg-transparent text-tg-text hover:bg-black/[0.04] disabled:opacity-40',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', full, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tg-button/60',
        sizes[size],
        full && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
});
