import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export function Input({ label, error, prefix, suffix, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[var(--color-text-muted)] text-sm select-none pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          className={[
            'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]',
            'text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-muted)]',
            'px-3 py-2 transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-[var(--color-danger)]' : '',
            prefix ? 'pl-7' : '',
            suffix ? 'pr-7' : '',
            className,
          ].join(' ')}
        />
        {suffix && (
          <span className="absolute right-3 text-[var(--color-text-muted)] text-sm select-none pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <select
        {...props}
        id={selectId}
        className={[
          'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]',
          'text-[var(--color-text)] text-sm',
          'px-3 py-2 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          error ? 'border-[var(--color-danger)]' : '',
          className,
        ].join(' ')}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
