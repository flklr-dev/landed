import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  padding = 'md',
  hoverable = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'bg-bg border border-line',
        // DESIGN.md: zero border-radius on structural elements
        'rounded-none',
        hoverable
          ? 'transition-all duration-[120ms] hover:border-ink/30 hover:shadow-sm cursor-pointer'
          : '',
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['flex items-center justify-between gap-3 pb-3 border-b border-line', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['py-3', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}
