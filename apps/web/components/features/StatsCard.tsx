import type { JobStatus } from '@landed/shared-types';

interface StatsCardProps {
  label: string;
  value: number;
  status?: JobStatus;
  change?: number; // % change (not used in Phase 1.1 but typed)
}

const statusDots: Record<JobStatus, string> = {
  saved: 'bg-ink/40',
  applied: 'bg-blue-500',
  interview: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-400',
};

export function StatsCard({ label, value, status, change }: StatsCardProps) {
  return (
    <div className="bg-bg border border-line p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
          {label}
        </span>
        {status && (
          <span className={['w-2 h-2 rounded-full', statusDots[status]].join(' ')} />
        )}
      </div>
      <span className="text-3xl font-semibold text-ink tabular-nums">{value}</span>
    </div>
  );
}
