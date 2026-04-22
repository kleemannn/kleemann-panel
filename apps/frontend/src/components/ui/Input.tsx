import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium mb-1">{label}</span>}
      <input
        ref={ref}
        className={clsx(
          'h-11 w-full rounded-xl bg-tg-secondary px-3 text-sm outline-none border border-transparent focus:border-tg-button',
          error && 'border-red-500',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="block text-xs text-red-500 mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-tg-hint mt-1">{hint}</span>
      ) : null}
    </label>
  );
});
