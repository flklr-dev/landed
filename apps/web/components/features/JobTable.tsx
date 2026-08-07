'use client';

import { useState, useEffect } from 'react';
import type { Job, JobStatus } from '@landed/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Search,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface JobTableProps {
  jobs: Job[];
  onJobClick?: (job: Job) => void;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void;
  onDeleteJob?: (jobId: string) => void;
  onAddJob?: () => void;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatJobType(type?: string): string {
  if (!type) return '—';
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function JobTable({
  jobs,
  onJobClick,
  onStatusChange,
  onDeleteJob,
  onAddJob,
}: JobTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.company.toLowerCase().includes(search.toLowerCase()) ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      (job.jobType && job.jobType.toLowerCase().includes(search.toLowerCase())) ||
      job.requiredSkills.some((s) => s.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredJobs.length);
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Controls & Search bar */}
      <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-bg">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Input
              placeholder="Search company, role, type, or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<Search size={14} />}
              className="h-9"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={statusFilter}
              aria-label="Filter by status"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 pr-8 bg-bg text-ink text-xs font-mono uppercase tracking-wider border border-line rounded-md focus:outline-none focus:border-ink/50 cursor-pointer appearance-none"
            >
              <option value="all">All Statuses ({jobs.length})</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({jobs.filter((j) => j.status === opt.value).length})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-ink-muted pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-ink-muted">
            {filteredJobs.length > 0
              ? `Showing ${startIndex + 1}–${endIndex} of ${filteredJobs.length} jobs`
              : '0 jobs'}
          </span>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-bg border-b border-line sticky top-0 z-10">
            <tr className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
              <th className="py-3 px-4 font-medium w-[320px]">Company & Role</th>
              <th className="py-3 px-4 font-medium w-36">Type & Level</th>
              <th className="py-3 px-4 font-medium w-28">Status</th>
              <th className="py-3 px-4 font-medium w-[130px]">Location</th>
              <th className="py-3 px-4 font-medium w-36">Salary</th>
              <th className="py-3 px-4 font-medium">Skills</th>
              <th className="py-3 px-4 font-medium w-28">Applied Date</th>
              <th className="py-3 px-4 font-medium text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm">
            {paginatedJobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-ink-muted font-mono text-xs">
                  No applications found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedJobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => onJobClick?.(job)}
                  className="hover:bg-ink/3 transition-colors cursor-pointer group"
                >
                  {/* Company & Role — max-width 320px with ellipsis */}
                  <td className="py-3 px-4 max-w-[320px]">
                    <div className="min-w-0">
                      <div
                        className="font-semibold text-ink leading-snug truncate"
                        title={job.title}
                      >
                        {job.title}
                      </div>
                      <div
                        className="text-xs text-ink-muted font-medium truncate"
                        title={job.company}
                      >
                        {job.company}
                      </div>
                    </div>
                  </td>

                  {/* Type & Level Column — clean mono text (matches Kanban info) */}
                  <td className="py-3 px-4 text-xs font-mono text-ink-muted w-36 whitespace-nowrap">
                    <div>{formatJobType(job.jobType)}</div>
                    {job.experienceLevel && (
                      <div className="text-[10px] text-ink-muted/70">{job.experienceLevel}</div>
                    )}
                  </td>

                  {/* Status Dropdown */}
                  <td className="py-3 px-4 w-28" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <select
                        value={job.status}
                        aria-label={`Change status for ${job.title} at ${job.company}`}
                        onChange={(e) =>
                          onStatusChange?.(job.id, e.target.value as JobStatus)
                        }
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      <Badge variant={job.status} label={job.status} dot />
                    </div>
                  </td>

                  {/* Location — reduced width (130px), wraps naturally if long */}
                  <td className="py-3 px-4 text-xs text-ink-muted font-mono max-w-[130px] leading-tight break-words">
                    {job.location ? (job.remoteType === 'remote' ? 'Remote' : job.location) : '—'}
                  </td>

                  {/* Salary — clean mono text without duplicate $ icon */}
                  <td className="py-3 px-4 text-xs font-mono text-ink-muted w-36 whitespace-nowrap">
                    {job.salaryRaw || '—'}
                  </td>

                  {/* Skills */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
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
                      {job.requiredSkills.length === 0 && (
                        <span className="text-xs text-ink-muted/40 font-mono">—</span>
                      )}
                    </div>
                  </td>

                  {/* Applied Date — clean mono text without clock icon */}
                  <td className="py-3 px-4 text-xs font-mono text-ink-muted w-28 whitespace-nowrap">
                    {formatDate(job.appliedAt ?? job.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-ink-muted hover:text-ink transition-colors rounded-sm"
                          title="Open job link"
                          aria-label="Open job posting URL"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => onDeleteJob?.(job.id)}
                        className="p-1 text-ink-muted hover:text-red-600 transition-colors rounded-sm"
                        title="Delete application"
                        aria-label="Delete job"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer — grouped on the left with clean spacing */}
      <div className="p-3 border-t border-line bg-bg flex flex-wrap items-center justify-start gap-6 text-xs font-mono">
        {/* Rows per page selector */}
        <div className="flex items-center gap-2 text-ink-muted">
          <span>Show</span>
          <div className="relative">
            <select
              value={pageSize}
              aria-label="Rows per page"
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-7 px-2 pr-6 bg-bg text-ink text-xs font-mono border border-line rounded-md focus:outline-none focus:border-ink/50 cursor-pointer appearance-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-2 text-ink-muted pointer-events-none" />
          </div>
          <span>per page</span>
        </div>

        {/* Subtle vertical divider */}
        <div className="h-4 w-px bg-line hidden sm:block" />

        {/* Page controls */}
        <div className="flex items-center gap-4">
          <span className="text-ink-muted">
            Page <strong className="text-ink font-semibold">{safePage}</strong> of{' '}
            <strong className="text-ink font-semibold">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={safePage === 1}
              className="p-1.5 border border-line rounded-md text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/5 transition-colors"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={[
                  'w-7 h-7 flex items-center justify-center rounded-md font-mono text-xs transition-colors',
                  pageNum === safePage
                    ? 'bg-ink text-bg font-semibold'
                    : 'text-ink-muted hover:text-ink hover:bg-ink/5 border border-line/60',
                ].join(' ')}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={safePage === totalPages}
              className="p-1.5 border border-line rounded-md text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/5 transition-colors"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
