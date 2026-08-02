import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const baseInputClass = [
  'w-full bg-bg text-ink text-sm',
  'border border-line rounded-md',
  'px-3 py-2',
  'placeholder:text-ink-muted/50',
  'transition-colors duration-[120ms]',
  'focus:outline-none focus:border-ink/50 focus:ring-1 focus:ring-ink/10',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-ink-muted flex items-center">{prefix}</span>
        )}
        <input
          id={inputId}
          className={[
            baseInputClass,
            error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : '',
            prefix ? 'pl-9' : '',
            suffix ? 'pr-9' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-ink-muted flex items-center">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, id, className = '', ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={[
          baseInputClass,
          'resize-y min-h-[80px]',
          error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
