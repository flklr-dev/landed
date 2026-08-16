'use client';

import { useState, useEffect, useRef } from 'react';
import type { Metadata } from 'next';
import { useSearchParams } from 'next/navigation';
import { TopBar } from '@/components/features/TopBar';
import { KanbanColumn } from '@/components/features/KanbanColumn';
import { JobTable } from '@/components/features/JobTable';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { WelcomeModal } from '@/components/features/WelcomeModal';
import { EmptyBoardState } from '@/components/features/EmptyBoardState';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  fetchJobs,
  createJob,
  extractJobLive,
  updateJob,
  deleteJob,
} from '@/lib/api-client';
import { KANBAN_COLUMNS } from '@/lib/mock-data';
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
  ChevronDown,
  Building2,
  Calendar,
  FileText,
  CheckCircle2,
  Trash2,
  Table as TableIcon,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';

// ── Add Job Modal ─────────────────────────────────────────────────────────────

const SALARY_CURRENCIES = [
  { value: 'A$', aliases: ['AUD', 'A$'] },
  { value: 'C$', aliases: ['CAD', 'C$'] },
  { value: 'S$', aliases: ['SGD', 'S$'] },
  { value: '₱', aliases: ['PHP', '₱'] },
  { value: '$', aliases: ['USD', '$'] },
  { value: '€', aliases: ['EUR', '€'] },
  { value: '£', aliases: ['GBP', '£'] },
  { value: '¥', aliases: ['JPY', '¥'] },
] as const;

function splitSalaryRaw(raw: string): { currency?: string; amount: string } {
  const value = raw.trim();
  for (const option of SALARY_CURRENCIES) {
    for (const alias of option.aliases) {
      const match = value.match(new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'));
      if (match) {
        return { currency: option.value, amount: value.slice(match[0].length).trim() };
      }
    }
  }
  return { amount: value };
}

function inferRemoteType(location: string): Job['remoteType'] | '' {
  if (/\bhybrid\b/i.test(location)) return 'hybrid';
  if (/\bremote|work[\s-]?from[\s-]?home\b/i.test(location)) return 'remote';
  if (/\bon[\s-]?site|in[\s-]?office\b/i.test(location)) return 'onsite';
  return '';
}

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
  const [jobType, setJobType] = useState<Job['jobType'] | ''>('');
  const [remoteType, setRemoteType] = useState<Job['remoteType'] | ''>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [status, setStatus] = useState<JobStatus>('saved');
  const [skillsInput, setSkillsInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const formSessionRef = useRef(0);

  const toast = useToast();

  const resetForm = () => {
    setMode('url');
    setUrl('');
    setIsExtracting(false);
    setCompany('');
    setTitle('');
    setLocation('');
    setCurrency('$');
    setSalary('');
    setJobType('');
    setRemoteType('');
    setExperienceLevel('');
    setStatus('saved');
    setSkillsInput('');
    setNotes('');
  };

  useEffect(() => {
    if (!open) return;
    formSessionRef.current += 1;
    resetForm();
  }, [open]);

  const handleExtract = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error('URL Required', 'Please enter a valid job posting URL.');
      return;
    }

    const session = formSessionRef.current;
    setIsExtracting(true);
    try {
      const res = await extractJobLive(trimmedUrl);
      if (session !== formSessionRef.current) return;
      if (res.success && res.data) {
        const d = res.data;
        if (d.company) setCompany(d.company);
        if (d.title) setTitle(d.title);
        if (d.location) setLocation(d.location);
        else if (d.remoteType === 'remote') setLocation('Remote');
        if (d.remoteType) setRemoteType(d.remoteType);
        if (d.jobType) setJobType(d.jobType);
        if (d.experienceLevel) setExperienceLevel(d.experienceLevel);
        if (d.requiredSkills && d.requiredSkills.length > 0) {
          setSkillsInput(d.requiredSkills.join(', '));
        }
        if (d.salaryRaw) {
          const parsedSalary = splitSalaryRaw(d.salaryRaw);
          if (parsedSalary.currency) setCurrency(parsedSalary.currency);
          setSalary(parsedSalary.amount);
        }

        // Switch to manual mode so user can review and tweak extracted fields
        setMode('manual');
        toast.success('Details extracted');
      }
    } catch (err) {
      if (session !== formSessionRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Could not fetch job details automatically.';
      toast.error('Extraction Failed', errorMessage);
      setMode('manual');
    } finally {
      if (session === formSessionRef.current) setIsExtracting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCompany = company.trim();
    const trimmedTitle = title.trim();

    if (!trimmedCompany || !trimmedTitle) {
      toast.error('Validation Error', 'Company name and Job title are required.');
      return;
    }

    const parsedSkills = skillsInput
      ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    let formattedSalary: string | undefined = undefined;
    if (salary.trim()) {
      const parsedSalary = splitSalaryRaw(salary);
      formattedSalary = `${parsedSalary.currency || currency}${parsedSalary.amount}`;
    }

    try {
      const res = await createJob({
        company: trimmedCompany,
        title: trimmedTitle,
        location: location.trim() || undefined,
        salaryRaw: formattedSalary,
        remoteType: (remoteType || undefined) as Job['remoteType'] | undefined,
        jobType: (jobType || undefined) as Job['jobType'] | undefined,
        experienceLevel: experienceLevel.trim() || undefined,
        requiredSkills: parsedSkills,
        status: status || 'saved',
        notes: notes.trim() || undefined,
        sourceUrl: url.trim() || undefined,
      });

      onAddJob(res.job);
      toast.success('Application created!', `${trimmedTitle} at ${trimmedCompany} has been saved.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save job application.';
      toast.error('Could not save application', msg);
    }
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
            hint="We’ll pre-fill the details this job page publishes."
          />
          <Button fullWidth loading={isExtracting} onClick={handleExtract}>
            {isExtracting ? (
              'Extracting...'
            ) : (
              <span className="inline-flex items-center gap-2">
                <Sparkles size={14} className="text-signal" />
                Extract details
              </span>
            )}
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

          {/* Row 2: Location, Work Setup, Job Type, Experience Level */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              label="Location"
              placeholder="Remote"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setRemoteType(inferRemoteType(e.target.value));
              }}
              prefix={<MapPin size={14} />}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="remote-type-select" className="text-sm font-medium text-ink">Work Setup</label>
              <div className="relative">
                <select
                  id="remote-type-select"
                  value={remoteType}
                  onChange={(e) => setRemoteType(e.target.value as Job['remoteType'] | '')}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 appearance-none cursor-pointer"
                >
                  <option value="">— Select —</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-type-select" className="text-sm font-medium text-ink">Job Type</label>
              <div className="relative">
                <select
                  id="job-type-select"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as Job['jobType'] | '')}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 appearance-none cursor-pointer"
                >
                  <option value="">— Select Type —</option>
                  <option value="full-time">Full-Time</option>
                  <option value="contract">Contract</option>
                  <option value="part-time">Part-Time</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Internship</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-level-select" className="text-sm font-medium text-ink">Level</label>
              <div className="relative">
                <select
                  id="job-level-select"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 appearance-none cursor-pointer"
                >
                  <option value="">— Select Level —</option>
                  <option value="Intern">Intern</option>
                  <option value="Entry Level">Entry Level</option>
                  <option value="Mid">Mid Level</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead / Staff</option>
                  <option value="Executive">Executive</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 3: Currency, Salary Amount, Status */}
          <div className="grid grid-cols-[115px_1fr_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="currency-select" className="text-sm font-medium text-ink">Currency</label>
              <div className="relative">
                <select
                  id="currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-2 pr-7 py-2 h-[38px] focus:outline-none focus:border-ink/50 font-mono appearance-none cursor-pointer"
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
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
            <Input
              label="Salary Amount"
              placeholder="120k–160k"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-status-select" className="text-sm font-medium text-ink">Status</label>
              <div className="relative">
                <select
                  id="job-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 capitalize appearance-none cursor-pointer"
                >
                  <option value="saved">Saved</option>
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
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

function JobDetailModal({
  job,
  onClose,
  onStatusChange,
  onDeleteJob,
  onUpdateJob,
}: {
  job: Job | null;
  onClose: () => void;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void;
  onDeleteJob?: (jobId: string) => void;
  onUpdateJob?: (jobId: string, updatedData: Partial<Job>) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form states matching AddJobModal
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [currency, setCurrency] = useState('$');
  const [salary, setSalary] = useState('');
  const [jobType, setJobType] = useState<Job['jobType'] | ''>('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [status, setStatus] = useState<JobStatus>('saved');
  const [skillsInput, setSkillsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  useEffect(() => {
    if (job) {
      setCompany(job.company || '');
      setTitle(job.title || '');
      setLocation(job.location || '');
      
      // Parse salary raw (e.g. "$120k" or "₱100,000") into currency & amount
      const raw = job.salaryRaw || '';
      const matchedCurrency = ['₱', '€', '£', 'A$', 'C$', 'S$', '¥', '$'].find((c) => raw.includes(c)) || '$';
      setCurrency(matchedCurrency);
      setSalary(raw.replace(matchedCurrency, '').trim());

      setJobType(job.jobType || '');
      setExperienceLevel(job.experienceLevel || '');
      setStatus(job.status || 'saved');
      setSkillsInput(job.requiredSkills ? job.requiredSkills.join(', ') : '');
      setNotes(job.notes || '');
      setSourceUrl(job.sourceUrl || '');
      setIsEditing(false);
    }
  }, [job]);

  if (!job) return null;

  function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatJobType(type?: string): string {
    if (!type) return '';
    return type
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCompany = company.trim();
    const trimmedTitle = title.trim();

    if (!trimmedCompany || !trimmedTitle) return;

    const parsedSkills = skillsInput
      ? skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const formattedSalary = salary.trim()
      ? `${currency}${salary.trim()}`
      : undefined;

    setIsSaving(true);
    try {
      await onUpdateJob?.(job.id, {
        company: trimmedCompany,
        title: trimmedTitle,
        location: location.trim() || undefined,
        salaryRaw: formattedSalary,
        jobType: (jobType || undefined) as Job['jobType'] | undefined,
        experienceLevel: experienceLevel.trim() || undefined,
        status: status || 'saved',
        requiredSkills: parsedSkills,
        notes: notes.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={!!job} onClose={onClose} size="md">
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5 mb-1">
            <h2 className="text-base font-bold text-ink">Edit Application</h2>
            <Badge variant={status} label={status} dot />
          </div>

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
              <label htmlFor="edit-job-type-select" className="text-sm font-medium text-ink">Job Type</label>
              <div className="relative">
                <select
                  id="edit-job-type-select"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as Job['jobType'] | '')}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 appearance-none cursor-pointer"
                >
                  <option value="">— Select Type —</option>
                  <option value="full-time">Full-Time</option>
                  <option value="contract">Contract</option>
                  <option value="part-time">Part-Time</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Internship</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-job-level-select" className="text-sm font-medium text-ink">Level</label>
              <div className="relative">
                <select
                  id="edit-job-level-select"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 appearance-none cursor-pointer"
                >
                  <option value="">— Select Level —</option>
                  <option value="Intern">Intern</option>
                  <option value="Entry Level">Entry Level</option>
                  <option value="Mid">Mid Level</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead / Staff</option>
                  <option value="Executive">Executive</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 3: Currency, Salary Amount, Status */}
          <div className="grid grid-cols-[115px_1fr_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-currency-select" className="text-sm font-medium text-ink">Currency</label>
              <div className="relative">
                <select
                  id="edit-currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-2 pr-7 py-2 h-[38px] focus:outline-none focus:border-ink/50 font-mono appearance-none cursor-pointer"
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
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
            <Input
              label="Salary Amount"
              placeholder="120k–160k"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-job-status-select" className="text-sm font-medium text-ink">Status</label>
              <div className="relative">
                <select
                  id="edit-job-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                  className="w-full bg-bg text-ink text-sm border border-line rounded-md pl-3 pr-8 py-2 h-[38px] focus:outline-none focus:border-ink/50 capitalize appearance-none cursor-pointer"
                >
                  <option value="saved">Saved</option>
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 4: Skills & Posting URL */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Required Skills"
              placeholder="React, TypeScript, Next.js"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              hint="Comma separated."
            />
            <Input
              label="Job Posting URL"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              prefix={<Link2 size={14} />}
            />
          </div>

          {/* Row 5: Personal Notes */}
          <Textarea
            label="Personal Notes"
            placeholder="Recruiter contact, interview prep notes, referral source..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          {/* Save / Cancel Footer */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Company, Interactive Status Header & Close Button */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs font-semibold text-ink-muted uppercase tracking-wider truncate min-w-0" title={job.company}>
              {job.company}
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={job.status}
                  aria-label={`Change status for ${job.title}`}
                  onChange={(e) => onStatusChange?.(job.id, e.target.value as JobStatus)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                >
                  <option value="saved">Saved</option>
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
                <Badge variant={job.status} label={job.status} dot />
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors"
                aria-label="Close details modal"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Role Title */}
          <h2 className="text-xl font-bold text-ink leading-snug break-words">{job.title}</h2>

          {/* Clean 2x2 Metadata Grid with Icons */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono text-ink-muted">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin size={13} className="text-ink-muted shrink-0" />
              <span className="truncate">{job.location ? (job.remoteType === 'remote' ? 'Remote' : job.location) : 'Remote'}</span>
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <Briefcase size={13} className="text-ink-muted shrink-0" />
              <span className="truncate">
                {formatJobType(job.jobType) || job.experienceLevel ? (
                  `${formatJobType(job.jobType)}${job.jobType && job.experienceLevel ? ' ' : ''}${job.experienceLevel ? `(${job.experienceLevel})` : ''}`
                ) : (
                  'Type not specified'
                )}
              </span>
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <DollarSign size={13} className="text-ink-muted shrink-0" />
              <span className="truncate">{job.salaryRaw || 'Salary not specified'}</span>
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <Calendar size={13} className="text-ink-muted shrink-0" />
              <span className="truncate">Added {formatDate(job.createdAt)}</span>
            </span>
          </div>

          {/* Required Skills */}
          {job.requiredSkills.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted font-medium">
                Required Skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2 py-0.5 bg-ink/5 text-ink rounded-sm font-mono"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ink-muted font-medium">
                Notes
              </p>
              <p className="text-sm text-ink leading-relaxed">
                {job.notes}
              </p>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={() => {
                onDeleteJob?.(job.id);
              }}
              className="p-1.5 text-ink-muted hover:text-red-600 transition-colors rounded"
              title="Delete Application"
              aria-label="Delete application"
            >
              <Trash2 size={15} />
            </button>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                <PenLine size={13} />
                Edit Details
              </Button>

              {job.sourceUrl && (
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">
                    <ExternalLink size={13} />
                    View Posting
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Board Page ─────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [openedFromDetail, setOpenedFromDetail] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      setIsLoading(true);
      try {
        const res = await fetchJobs({ limit: 100 });
        setJobs(res.jobs || []);
      } catch (err) {
        console.warn('[Board] API load failed — user may be unauthenticated or API starting up:', err);
        setJobs([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadJobs();
  }, []);

  useEffect(() => {
    const isNew = searchParams.get('new') === 'true';
    if (isNew) {
      setWelcomeOpen(true);
    }
  }, [searchParams]);

  const statusDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleStatusChange = (jobId: string, newStatus: JobStatus) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob || targetJob.status === newStatus) return;

    // Optimistic UI update — instant visual feedback
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus, updatedAt: new Date().toISOString() } : j))
    );
    setSelectedJob((prev) => (prev && prev.id === jobId ? { ...prev, status: newStatus } : prev));

    // Clear previous pending update for this job if dragged rapidly
    if (statusDebounceTimers.current.has(jobId)) {
      clearTimeout(statusDebounceTimers.current.get(jobId)!);
    }

    // Debounced server update (400ms)
    const timer = setTimeout(async () => {
      statusDebounceTimers.current.delete(jobId);
      try {
        await updateJob(jobId, { status: newStatus });
        const statusLabels: Record<JobStatus, string> = {
          saved: 'Saved',
          applied: 'Applied',
          interview: 'Interview',
          offer: 'Offer',
          rejected: 'Rejected',
        };
        toast.success('Status updated', `Moved to ${statusLabels[newStatus] || newStatus}`);
      } catch (err) {
        console.error('Failed to update job status on server:', err);
        if (targetJob) {
          setJobs((prev) => prev.map((j) => (j.id === jobId ? targetJob : j)));
        }
        toast.error('Failed to update job status');
      }
    }, 400);

    statusDebounceTimers.current.set(jobId, timer);
  };

  const handleUpdateJob = async (jobId: string, updatedData: Partial<Job>) => {
    // Optimistic UI update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updatedData, updatedAt: new Date().toISOString() } : j))
    );
    setSelectedJob((prev) => (prev && prev.id === jobId ? { ...prev, ...updatedData } : prev));

    try {
      const res = await updateJob(jobId, updatedData);
      if (res.job) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? res.job : j)));
        setSelectedJob((prev) => (prev && prev.id === jobId ? res.job : prev));
      }
      toast.success('Application updated!', 'Your changes have been saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update job application.';
      toast.error('Could not update application', msg);
    }
  };

  const onRequestDeleteJob = (jobId: string) => {
    const target = jobs.find((j) => j.id === jobId);
    if (target) {
      if (selectedJob?.id === jobId) {
        setOpenedFromDetail(target);
        setSelectedJob(null); // Close detail modal while confirmation is open
      } else {
        setOpenedFromDetail(null);
      }
      setJobToDelete(target);
    }
  };

  const handleCancelDelete = () => {
    if (openedFromDetail && jobToDelete?.id === openedFromDetail.id) {
      setSelectedJob(openedFromDetail); // Re-open detail modal if user cancels
    }
    setJobToDelete(null);
    setOpenedFromDetail(null);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    const targetJob = jobToDelete;

    setIsDeleting(true);
    // Optimistic UI update
    setJobs((prev) => prev.filter((j) => j.id !== targetJob.id));
    setSelectedJob(null);
    setOpenedFromDetail(null);

    try {
      await deleteJob(targetJob.id);
      toast.success('Application deleted', `${targetJob.title} at ${targetJob.company} has been removed.`);
    } catch (err) {
      console.error('Failed to delete job on server:', err);
      // Rollback state if server fails
      setJobs((prev) => [targetJob, ...prev]);
      const msg = err instanceof Error ? err.message : 'Unable to delete application.';
      toast.error('Could not delete application', msg);
    } finally {
      setIsDeleting(false);
      setJobToDelete(null);
      setOpenedFromDetail(null);
    }
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

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-8 text-ink-muted">
          <Loader2 className="animate-spin text-ink shrink-0" size={24} />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyBoardState
          onAddJobUrl={() => setAddJobOpen(true)}
          onAddJobManual={() => setAddJobOpen(true)}
        />
      ) : viewMode === 'kanban' ? (
        <div className="flex-1 overflow-auto">
          <div className="flex min-h-full gap-0 divide-x divide-line min-w-max items-stretch">
            {KANBAN_COLUMNS.map(({ id, label }) => (
              <KanbanColumn
                key={id}
                id={id}
                label={label}
                jobs={jobs.filter((j) => j.status === id)}
                onJobClick={setSelectedJob}
                onDropJob={handleStatusChange}
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
            onDeleteJob={onRequestDeleteJob}
            onAddJob={() => setAddJobOpen(true)}
          />
        </div>
      )}

      <AddJobModal open={addJobOpen} onClose={() => setAddJobOpen(false)} onAddJob={handleAddJob} />
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
        onDeleteJob={onRequestDeleteJob}
        onUpdateJob={handleUpdateJob}
      />
      <ConfirmModal
        open={!!jobToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title="Delete Job Application"
        description={
          jobToDelete
            ? `Are you sure you want to delete your application for "${jobToDelete.title}" at ${jobToDelete.company}? This action cannot be undone.`
            : ''
        }
        confirmText="Delete Application"
        variant="danger"
      />
      <WelcomeModal
        userName={user?.name || 'there'}
        isOpen={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        onStartExtraction={() => setAddJobOpen(true)}
      />
    </>
  );
}
