import type { Job, JobStatus } from '@landed/shared-types';
import { JobCard } from './JobCard';

interface KanbanColumnProps {
  id: JobStatus;
  label: string;
  jobs: Job[];
  onJobClick?: (job: Job) => void;
}

const columnAccents: Record<JobStatus, string> = {
  saved: 'bg-ink-muted',
  applied: 'bg-blue-500',
  interview: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-400',
};

export function KanbanColumn({ id, label, jobs, onJobClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-64 shrink-0 min-h-full">
      {/* Column header — sticky to the top of the board container as page scrolls */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line bg-bg sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <span className={['w-2 h-2 rounded-full shrink-0', columnAccents[id]].join(' ')} />
        <span className="text-xs font-mono font-medium uppercase tracking-wider text-ink">
          {label}
        </span>
        <span className="ml-auto text-xs font-mono text-ink-muted bg-ink/5 px-1.5 py-0.5 rounded-sm min-w-[20px] text-center">
          {jobs.length}
        </span>
      </div>

      {/* Cards container — natural height, no internal scrollbar */}
      <div className="flex-1 flex flex-col gap-2 p-2 min-h-[200px]">
        {jobs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[120px] border border-dashed border-line rounded-none">
            <p className="text-xs text-ink-muted/60 font-mono text-center">No jobs yet</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={() => onJobClick?.(job)} />
          ))
        )}
      </div>
    </div>
  );
}
