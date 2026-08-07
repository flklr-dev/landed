'use client';

import { useState } from 'react';
import type { Metadata } from 'next';
import { TopBar } from '@/components/features/TopBar';
import { KanbanColumn } from '@/components/features/KanbanColumn';
import { JobTable } from '@/components/features/JobTable';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { KANBAN_COLUMNS, mockJobs as initialMockJobs } from '@/lib/mock-data';
import type { Job, JobStatus } from '@landed/shared-types';
import {
  Link2,
  PenLine,
  MapPin,
  Briefcase,
  DollarSign,
  ExternalLink,
  Clock,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';

// ── Add Job Modal ─────────────────────────────────────────────────────────────

function AddJobModal({
  open,
  onClose,
  onAddJob,
}: {
  open: boolean;
  onClose: () => void;
  onAddJob: (newJob: Job) => void;
}) {
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // Form states for manual entry
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [currency, setCurrency] = useState<string>('$');
  const [salary, setSalary] = useState('');
  const [jobType, setJobType] = useState<Job['jobType']>('full-time');
  const [experienceLevel, setExperienceLevel] = useState<string>('Senior');
  const [status, setStatus] = useState<JobStatus>('saved');
  const [skillsInput, setSkillsInput] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleExtract = () => {
    if (!url) return;
    setIsExtracting(true);
    setTimeout(() => {
      setIsExtracting(false);
      const domainMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)/);
      const extractedCompany = domainMatch
        ? domainMatch[1].split('.')[0].toUpperCase()
        : 'Tech Company';

      const newJob: Job = {
        id: `job-${Date.now()}`,
        userId: 'user-1',
        sourceUrl: url,
        extractionStatus: 'done',
        company: extractedCompany,
        title: 'Software Engineer',
        location: 'Remote',
        salaryRaw: '$120k–160k',
        remoteType: 'remote',
        jobType: 'full-time',
        experienceLevel: 'Senior',
        requiredSkills: ['TypeScript', 'React', 'Node.js'],
        status: 'saved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onAddJob(newJob);
      setUrl('');
      onClose();
    }, 1500);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !title) return;

    const parsedSkills = skillsInput
      ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
      : ['TypeScript', 'React'];

    // Format salary cleanly without duplicating currency symbols
    let formattedSalary: string | undefined = undefined;
    if (salary.trim()) {
      let cleaned = salary.trim();
      // Remove any leading currency symbols if user typed them manually
      cleaned = cleaned.replace(/^[\$₱€£¥A-Za-z]+\s*/, '');
      formattedSalary = `${currency}${cleaned}`;
    }

    const newJob: Job = {
      id: `job-${Date.now()}`,
      userId: 'user-1',
      sourceUrl: url || undefined,
      extractionStatus: 'idle',
      company,
      title,
      location: location || 'Remote',
      salaryRaw: formattedSalary,
      remoteType: 'remote',
      jobType: jobType || 'full-time',
      experienceLevel: experienceLevel || 'Senior',
      requiredSkills: parsedSkills,
      status: status || 'saved',
      appliedAt: status === 'applied' || status === 'interview' || status === 'offer' || status === 'rejected' ? new Date().toISOString() : undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddJob(newJob);
    setCompany('');
    setTitle('');
    setLocation('');
    setSalary('');
    setSkillsInput('');
    setNotes('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a Job" size="lg">
      {/* Mode tabs */}
      <div className="flex border border-line rounded-md overflow-hidden mb-4">
        {[
          { id: 'url' as const, label: 'Paste URL', icon: Link2 },
          { id: 'manual' as const, label: 'Manual Entry', icon: PenLine },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium',
              'transition-colors duration-[120ms]',
              mode === id
                ? 'bg-ink text-bg'
                : 'bg-bg text-ink-muted hover:text-ink hover:bg-ink/5',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <div className="space-y-3">
          <Input
            label="Job Posting URL"
            placeholder="https://jobs.lever.co/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            prefix={<Link2 size={14} />}
            hint="AI will extract company, title, skills, salary, job type, and location automatically."
          />
          <Button fullWidth loading={isExtracting} onClick={handleExtract}>
            {isExtracting ? 'Extracting details…' : 'Extract & Add Job'}
          </Button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleManualSubmit}>
          {/* Row 1: Company & Title */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company"
              placeholder="Vercel"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              prefix={<Briefcase size={14} />}
            />
            <Input
              label="Job Title"
              placeholder="Senior Engineer"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Row 2: Location, Job Type, Experience Level */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Location"
              placeholder="Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              prefix={<MapPin size={14} />}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-type-select" className="text-sm font-medium text-ink">Job Type</label>
              <select
                id="job-type-select"
                value={jobType}
                onChange={(e) => setJobType(e.target.value as Job['jobType'])}
                className="w-full bg-bg text-ink text-sm border border-line rounded-md px-3 py-2 h-[38px] focus:outline-none focus:border-ink/50"
              >
                <option value="full-time">Full-Time</option>
                <option value="contract">Contract</option>
                <option value="part-time">Part-Time</option>
                <option value="freelance">Freelance</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-level-select" className="text-sm font-medium text-ink">Level</label>
              <select
                id="job-level-select"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full bg-bg text-ink text-sm border border-line rounded-md px-3 py-2 h-[38px] focus:outline-none focus:border-ink/50"
              >
                <option value="Entry Level">Entry Level</option>
                <option value="Mid">Mid Level</option>
                <option value="Senior">Senior</option>
                <option value="Lead">Lead / Staff</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
          </div>

          {/* Row 3: Currency, Salary Amount, Status */}
          <div className="grid grid-cols-[90px_1fr_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="currency-select" className="text-sm font-medium text-ink">Currency</label>
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-bg text-ink text-sm border border-line rounded-md px-2 py-2 h-[38px] focus:outline-none focus:border-ink/50 font-mono"
              >
                <option value="$">USD ($)</option>
                <option value="₱">PHP (₱)</option>
                <option value="€">EUR (€)</option>
                <option value="£">GBP (£)</option>
                <option value="A$">AUD (A$)</option>
                <option value="C$">CAD (C$)</option>
                <option value="S$">SGD (S$)</option>
                <option value="¥">JPY (¥)</option>
              </select>
            </div>
            <Input
              label="Salary Amount"
              placeholder="120k–160k"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-status-select" className="text-sm font-medium text-ink">Status</label>
              <select
                id="job-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className="w-full bg-bg text-ink text-sm border border-line rounded-md px-3 py-2 h-[38px] focus:outline-none focus:border-ink/50 capitalize"
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Row 4: Skills & Posting URL */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Required Skills"
              placeholder="React, TypeScript, Node.js"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
            />
            <Input
              label="Job Posting URL"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              prefix={<Link2 size={14} />}
            />
          </div>

          {/* Row 5: Notes */}
          <Textarea
            label="Notes"
            placeholder="Any notes about this role…"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button type="submit" fullWidth className="mt-1">
            Add Job
          </Button>
        </form>
      )}
    </Modal>
  );
}

// ── Job Detail Modal ──────────────────────────────────────────────────────────

function JobDetailModal({ job, onClose }: { job: Job | null; onClose: () => void }) {
  if (!job) return null;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <Modal open={!!job} onClose={onClose} title={job.title} size="lg">
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant={job.status} label={job.status} dot />
          <span className="text-sm text-ink-muted">{job.company}</span>
          {job.location && (
            <span className="text-sm text-ink-muted flex items-center gap-1">
              <MapPin size={12} /> {job.remoteType === 'remote' ? 'Remote' : job.location}
            </span>
          )}
          {job.salaryRaw && <span className="text-sm text-ink-muted">{job.salaryRaw}</span>}
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
          <Clock size={11} />
          Added {formatDate(job.createdAt)}
          {job.appliedAt && ` · Applied ${formatDate(job.appliedAt)}`}
        </div>

        <div className="h-px bg-line" />

        {/* Skills */}
        {job.requiredSkills.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted mb-2">
              Required Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.requiredSkills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-2 py-1 bg-ink/6 text-ink-muted rounded-sm font-mono"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {job.notes && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted mb-2">
              Notes
            </p>
            <p className="text-sm text-ink leading-relaxed">{job.notes}</p>
          </div>
        )}

        {/* Description */}
        {job.description && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-ink-muted mb-2">
              About the role
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">{job.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {job.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink size={13} />
                View Posting
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Board Page ─────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const [jobs, setJobs] = useState<Job[]>(initialMockJobs);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleStatusChange = (jobId: string, newStatus: JobStatus) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus, updatedAt: new Date().toISOString() } : j))
    );
  };

  const handleDeleteJob = (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const handleAddJob = (newJob: Job) => {
    setJobs((prev) => [newJob, ...prev]);
  };

  return (
    <>
      <TopBar
        title="Applications Tracker"
        subtitle={`${jobs.length} total applications`}
        action={
          <div className="flex items-center gap-1 border border-line rounded-md p-0.5 bg-bg">
            <button
              onClick={() => setViewMode('kanban')}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors',
                viewMode === 'kanban'
                  ? 'bg-ink text-bg'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5',
              ].join(' ')}
              title="Kanban Board View"
            >
              <LayoutGrid size={13} />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm transition-colors',
                viewMode === 'table'
                  ? 'bg-ink text-bg'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/5',
              ].join(' ')}
              title="Tabular Table View"
            >
              <TableIcon size={13} />
              Table View
            </button>
          </div>
        }
        showAddButton
        onAddJob={() => setAddJobOpen(true)}
      />

      {/* Main View Area */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-auto">
          <div className="flex min-h-full gap-0 divide-x divide-line min-w-max items-start">
            {KANBAN_COLUMNS.map(({ id, label }) => (
              <KanbanColumn
                key={id}
                id={id}
                label={label}
                jobs={jobs.filter((j) => j.status === id)}
                onJobClick={setSelectedJob}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <JobTable
            jobs={jobs}
            onJobClick={setSelectedJob}
            onStatusChange={handleStatusChange}
            onDeleteJob={handleDeleteJob}
            onAddJob={() => setAddJobOpen(true)}
          />
        </div>
      )}

      <AddJobModal open={addJobOpen} onClose={() => setAddJobOpen(false)} onAddJob={handleAddJob} />
      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </>
  );
}
