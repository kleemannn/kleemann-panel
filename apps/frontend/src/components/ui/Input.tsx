import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <label className={clsx('block', wrapperClassName)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-tg-hint">{label}</span>
      )}
      <input
        ref={ref}
        className={clsx(
          'h-11 w-full rounded-xl bg-tg-secondary px-3.5 text-sm outline-none',
          'ring-1 ring-black/5 transition',
          'placeholder:text-tg-hint/70',
          'focus:ring-2 focus:ring-tg-button/80',
          error && 'ring-2 ring-red-500/70 focus:ring-red-500/80',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-tg-hint">{hint}</span>
      ) : null}
    </label>
  );
});
