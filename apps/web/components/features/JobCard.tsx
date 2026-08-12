import { useState, useRef } from 'react';
import type { Job } from '@landed/shared-types';
import { Badge } from '@/components/ui/Badge';
import { MapPin, ExternalLink, Clock, Loader2, Building2, Briefcase } from 'lucide-react';

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  onDragStart?: (job: Job, e: React.DragEvent<HTMLDivElement>) => void;
}

function formatRelativeDate(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatJobType(type?: string): string {
  if (!type) return '';
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function JobCard({ job, onClick, onDragStart }: JobCardProps) {
  const isExtracting = job.extractionStatus === 'pending';
  const [isDragging, setIsDragging] = useState(false);
  const dragOccurredRef = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        dragOccurredRef.current = true;
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', job.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(job, e);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        setTimeout(() => {
          dragOccurredRef.current = false;
        }, 50);
      }}
      onClick={(e) => {
        if (dragOccurredRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.();
      }}
      className={[
        'bg-bg border border-line p-3 rounded-none',
        'transition-all duration-[120ms]',
        'hover:border-ink/25 hover:shadow-sm',
        'cursor-grab active:cursor-grabbing group select-none',
        isDragging ? 'opacity-40 border-dashed border-ink/40 scale-[0.98]' : 'animate-fade-in',
      ].join(' ')}
    >
      {/* Company + external link */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 size={13} className="text-ink-muted/80 shrink-0" />
          <span className="text-xs text-ink-muted font-semibold truncate">{job.company}</span>
        </div>

        {job.sourceUrl && (
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted hover:text-ink shrink-0"
            aria-label="Open job posting"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Title */}
      {isExtracting ? (
        <div className="flex items-center gap-2 mb-3">
          <Loader2 size={12} className="text-ink-muted animate-spin shrink-0" />
          <span className="text-xs text-ink-muted italic">Extracting details…</span>
        </div>
      ) : (
        <h3 className="text-sm font-semibold text-ink leading-snug mb-2 line-clamp-2">
          {job.title}
        </h3>
      )}

      {/* Job Type & Experience Pills */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {job.jobType && (
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-ink/7 text-ink border border-line rounded-sm font-medium">
            {formatJobType(job.jobType)}
          </span>
        )}
        {job.experienceLevel && (
          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-ink/4 text-ink-muted border border-line/60 rounded-sm">
            {job.experienceLevel}
          </span>
        )}
      </div>

      {/* Skills */}
      {job.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.requiredSkills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-1.5 py-0.5 bg-ink/5 text-ink-muted rounded-sm font-mono"
            >
              {skill}
            </span>
          ))}
          {job.requiredSkills.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 text-ink-muted font-mono">
              +{job.requiredSkills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: meta */}
      <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-2">
        <div className="flex items-center gap-1 text-ink-muted">
          {job.location && (
            <>
              <MapPin size={10} />
              <span className="text-[10px] font-mono truncate">
                {job.remoteType === 'remote' ? 'Remote' : job.location}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-ink-muted shrink-0">
          <Clock size={10} />
          <span className="text-[10px] font-mono">
            {formatRelativeDate(job.appliedAt ?? job.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
