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
      {label && <span className="block text-sm font-medium mb-1">{label}</span>}
      <select
        ref={ref}
        className={clsx(
          'h-11 w-full rounded-xl bg-tg-secondary px-3 text-sm outline-none border border-transparent focus:border-tg-button',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
});
