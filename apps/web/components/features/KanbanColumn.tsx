'use client';

import { useState } from 'react';
import type { Job, JobStatus } from '@landed/shared-types';
import { JobCard } from './JobCard';

interface KanbanColumnProps {
  id: JobStatus;
  label: string;
  jobs: Job[];
  onJobClick?: (job: Job) => void;
  onDropJob?: (jobId: string, targetStatus: JobStatus) => void;
}

const columnAccents: Record<JobStatus, string> = {
  saved: 'bg-ink-muted',
  applied: 'bg-blue-500',
  interview: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-400',
};

export function KanbanColumn({ id, label, jobs, onJobClick, onDropJob }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const jobId = e.dataTransfer.getData('text/plain');
        if (jobId && onDropJob) {
          onDropJob(jobId, id);
        }
      }}
      className={[
        'flex flex-col w-64 shrink-0 min-h-full transition-colors duration-150',
        isDragOver ? 'bg-ink/[0.03] ring-2 ring-inset ring-ink/20' : '',
      ].join(' ')}
    >
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

      {/* Cards container — fills full height */}
      <div className="flex-1 flex flex-col gap-2 p-2 min-h-[120px] min-w-0 overflow-hidden">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onClick={() => onJobClick?.(job)} />
        ))}
      </div>
    </div>
  );
}
