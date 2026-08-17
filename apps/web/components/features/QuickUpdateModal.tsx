'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Quick Update Command Modal (AI-Powered)
// Global natural-language command bar for rapid status updates, notes, & intake.
// Shortcut: ⌘K / Ctrl+K
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { quickUpdateJob, createJob } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';
import type {
  Job,
  JobStatus,
  QuickUpdateResult,
  QuickUpdateProposedChanges,
} from '@landed/shared-types';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Building2,
  MapPin,
  CornerDownLeft,
  Plus,
  Loader2,
  X,
} from 'lucide-react';

interface QuickUpdateModalProps {
  open: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: Job) => void;
  onJobCreated?: (newJob: Job) => void;
}

const EXAMPLE_PHRASES = [
  'Got rejected from Cloudstaff',
  'Interview with Discernis next Tuesday',
  'Applied to Stripe for Frontend role',
  'Offer received from Figma for 160k',
  'Add note for Anthropic: technical round went well',
];

export function QuickUpdateModal({
  open,
  onClose,
  onJobUpdated,
  onJobCreated,
}: QuickUpdateModalProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuickUpdateResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Reset state on open and focus input
  useEffect(() => {
    if (open) {
      setText('');
      setResult(null);
      setIsLoading(false);
      setIsCreating(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Handle Enter key and number selection (1-9) for disambiguation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (result?.action === 'disambiguate' && result.candidates && result.candidates.length > 0) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= result.candidates.length) {
          e.preventDefault();
          const target = result.candidates[num - 1];
          if (target) handleSelectCandidate(target);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, result]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await quickUpdateJob({ text: trimmed });
      setResult(res);

      if (res.action === 'updated' && res.job) {
        onJobUpdated(res.job);
        toast.success(
          'Application Updated',
          `${res.job.title} at ${res.job.company} moved to ${res.job.status}.`
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process quick update.';
      toast.error('Quick Update Notice', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCandidate = async (candidate: Job) => {
    if (!result?.proposedChanges || isLoading) return;

    setIsLoading(true);
    try {
      const res = await quickUpdateJob({
        confirmedJobId: candidate.id,
        proposedChanges: result.proposedChanges,
      });

      if (res.action === 'updated' && res.job) {
        onJobUpdated(res.job);
        toast.success(
          'Application Updated',
          `${res.job.title} at ${res.job.company} moved to ${res.job.status}.`
        );
        setResult(res);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update selected job.';
      toast.error('Update Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewJob = async (proposed: QuickUpdateProposedChanges) => {
    setIsCreating(true);
    try {
      const res = await createJob({
        company: proposed.company || 'Company',
        title: proposed.title || 'Job Position',
        status: proposed.status || 'saved',
        notes: proposed.notes,
        location: proposed.location || 'Remote',
        salaryRaw: proposed.salaryRaw,
        requiredSkills: [],
      });

      if (res.job) {
        onJobCreated?.(res.job);
        toast.success(
          'Application Created',
          `Tracked ${res.job.title} at ${res.job.company} (${res.job.status}).`
        );
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create application.';
      toast.error('Creation Failed', msg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-signal/10 flex items-center justify-center text-signal">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">AI Quick Update</h2>
              <p className="text-xs text-ink-muted">
                Type natural status changes, notes, or new roles.
              </p>
            </div>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-ink-muted bg-ink/5 border border-line rounded">
            ESC to close
          </kbd>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={text}
              disabled={isLoading}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Got rejected from Cloudstaff, Interview with Vercel next Tuesday..."
              className="w-full bg-bg text-ink text-sm border border-line rounded-lg pl-3.5 pr-24 py-3 focus:outline-none focus:border-ink/50 shadow-inner placeholder:text-ink-muted/60"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              <Button
                type="submit"
                size="sm"
                disabled={!text.trim() || isLoading}
                loading={isLoading}
              >
                {isLoading ? (
                  'Resolving...'
                ) : (
                  <span className="flex items-center gap-1">
                    Update <CornerDownLeft size={12} className="opacity-70" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Example prompts (shown when idle and no result) */}
        {!result && !isLoading && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
              Quick Examples
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => {
                    setText(phrase);
                    inputRef.current?.focus();
                  }}
                  className="text-xs px-2.5 py-1 bg-ink/5 hover:bg-ink/10 text-ink-muted hover:text-ink rounded-md transition-colors text-left font-mono"
                >
                  "{phrase}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-ink-muted animate-in fade-in duration-200">
            <Loader2 size={24} className="animate-spin text-signal" />
            <p className="text-xs font-mono">Parsing update and matching role...</p>
          </div>
        )}

        {/* Result Area */}
        {result && !isLoading && (
          <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Case 1: Updated Successfully */}
            {result.action === 'updated' && result.job && (
              <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{result.message}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-muted font-mono">
                    <span className="font-bold text-ink">{result.job.company}</span>
                    <span>•</span>
                    <span className="truncate">{result.job.title}</span>
                    <span>•</span>
                    <Badge variant={result.job.status} label={result.job.status} dot />
                  </div>
                </div>
              </div>
            )}

            {/* Case 2: Disambiguation Required */}
            {result.action === 'disambiguate' && result.candidates && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                  <HelpCircle size={15} />
                  <span>{result.message}</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {result.candidates.map((cand, idx) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleSelectCandidate(cand)}
                      className="w-full text-left p-3 rounded-lg border border-line bg-bg hover:border-ink/40 hover:bg-ink/5 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-ink/10 text-ink text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate group-hover:text-signal transition-colors">
                            {cand.title}
                          </p>
                          <p className="text-xs text-ink-muted font-mono flex items-center gap-1.5">
                            <span>{cand.company}</span>
                            {cand.location && <span>• {cand.location}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge variant={cand.status} label={cand.status} dot />
                        <ArrowRight
                          size={14}
                          className="text-ink-muted group-hover:translate-x-0.5 transition-transform"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Case 3: Not Found -> Offer to Create Job */}
            {result.action === 'not_found' && result.proposedChanges && (
              <div className="p-4 rounded-lg border border-line bg-ink/5 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={17} className="text-ink-muted shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-ink">{result.message}</p>
                  </div>
                </div>

                {result.proposedChanges.company && (
                  <div className="flex items-center justify-between pt-1 border-t border-line/60">
                    <div className="text-xs font-mono text-ink">
                      <span className="font-bold">{result.proposedChanges.company}</span>
                      {result.proposedChanges.title && ` — ${result.proposedChanges.title}`}
                      {result.proposedChanges.status && (
                        <span className="ml-2">
                          <Badge
                            variant={result.proposedChanges.status}
                            label={result.proposedChanges.status}
                            dot
                          />
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      loading={isCreating}
                      onClick={() => handleCreateNewJob(result.proposedChanges!)}
                    >
                      <Plus size={13} />
                      Track Role
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
