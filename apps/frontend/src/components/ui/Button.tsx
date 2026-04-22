import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    'bg-tg-button text-tg-buttonText hover:opacity-90 active:opacity-80 disabled:opacity-40',
  secondary:
    'bg-tg-secondary text-tg-text border border-black/5 hover:opacity-90 disabled:opacity-40',
  danger:
    'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40',
  ghost:
    'bg-transparent text-tg-text hover:bg-tg-secondary disabled:opacity-40',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', full, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        'h-11 rounded-xl px-4 font-medium text-sm transition',
        full && 'w-full',
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
});
