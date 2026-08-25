'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  showPasswordToggle?: boolean;
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
  type,
  className = '',
  showPasswordToggle,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const isPasswordField = type === 'password';
  const [showPassword, setShowPassword] = useState(false);

  const effectiveType = isPasswordField ? (showPassword ? 'text' : 'password') : type;
  const isToggleActive = showPasswordToggle ?? isPasswordField;

  const renderSuffix = () => {
    if (suffix) return suffix;
    if (isToggleActive && isPasswordField) {
      return (
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="text-ink-muted hover:text-ink transition-colors p-0.5 rounded focus:outline-none"
          title={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      );
    }
    return null;
  };

  const finalSuffix = renderSuffix();

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
          type={effectiveType}
          className={[
            baseInputClass,
            error ? 'border-red-500 text-ink focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : '',
            prefix ? 'pl-9' : '',
            finalSuffix ? 'pr-9' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {finalSuffix && (
          <span className="absolute right-3 text-ink-muted flex items-center">{finalSuffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
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
          error ? 'border-red-500 text-ink focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
