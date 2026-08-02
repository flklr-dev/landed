import type { JobStatus } from '@landed/shared-types';

type BadgeVariant = JobStatus | 'default' | 'premium' | 'free';

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  saved: 'bg-ink/6 text-ink-muted border-line',
  applied: 'bg-blue-50 text-blue-700 border-blue-200',
  interview: 'bg-amber-50 text-amber-700 border-amber-200',
  offer: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  default: 'bg-ink/6 text-ink-muted border-line',
  premium: 'bg-signal/10 text-signal border-signal/20',
  free: 'bg-ink/6 text-ink-muted border-line',
};

const dotColors: Record<BadgeVariant, string> = {
  saved: 'bg-ink-muted',
  applied: 'bg-blue-500',
  interview: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
  default: 'bg-ink-muted',
  premium: 'bg-signal',
  free: 'bg-ink-muted',
};

export function Badge({ variant = 'default', label, dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        // DESIGN.md: mono, uppercase, letter-spaced for status pills
        'inline-flex items-center gap-1.5',
        'font-mono text-[10px] font-medium tracking-widest uppercase',
        'px-2 py-0.5 rounded-sm border',
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && <span className={['w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant]].join(' ')} />}
      {label}
    </span>
  );
}
