import { SelectHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, className, children, ...rest },
  ref,
) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-tg-hint">{label}</span>
      )}
      <select
        ref={ref}
        className={clsx(
          'h-11 w-full rounded-xl bg-tg-secondary px-3.5 text-sm outline-none',
          'ring-1 ring-black/5 transition',
          'focus:ring-2 focus:ring-tg-button/80',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
});
