'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/lib/toast-context';
import { explainMatch } from '@/lib/api-client';
import type { JobWithMatch } from '@landed/shared-types';
import {
  Sparkles,
  Copy,
  Check,
  MapPin,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

interface InterviewPrepModalProps {
  jobWithMatch: JobWithMatch | null;
  isOpen: boolean;
  onClose: () => void;
  onExplanationUpdated?: (jobId: string, explanation: string) => void;
}

/**
 * Parses markdown bold syntax (**text**) into React strong nodes.
 */
function renderMarkdownText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/**
 * Splits raw explanation paragraphs into structured sections.
 */
function parseExplanationSections(text: string) {
  const rawParagraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  return rawParagraphs.map((paragraph) => {
    const trimmed = paragraph.trim();

    // Check for **Title:** body or **Title**: body or Title: body
    const match =
      trimmed.match(/^\*\*([^*]+)\*\*:\s*([\s\S]*)$/) ||
      trimmed.match(/^\*\*([^*:]+):\*\*\s*([\s\S]*)$/) ||
      trimmed.match(/^([A-Za-z\s&]+):\s*([\s\S]*)$/);

    if (match) {
      return {
        title: match[1].trim(),
        body: match[2].trim(),
      };
    }

    return {
      title: '',
      body: trimmed,
    };
  });
}

export function InterviewPrepModal({
  jobWithMatch,
  isOpen,
  onClose,
  onExplanationUpdated,
}: InterviewPrepModalProps) {
  const toast = useToast();
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !jobWithMatch) {
      setExplanation('');
      setIsLoading(false);
      return;
    }

    const existingExplanation = jobWithMatch.matchScore?.explanation;
    if (existingExplanation) {
      setExplanation(existingExplanation);
    } else {
      loadStrategy(false);
    }
  }, [isOpen, jobWithMatch?.id]);

  const loadStrategy = async (isRegenerating = false) => {
    if (!jobWithMatch) return;
    try {
      setIsLoading(true);
      const res = await explainMatch(jobWithMatch.id);
      setExplanation(res.explanation);
      onExplanationUpdated?.(jobWithMatch.id, res.explanation);

      if (isRegenerating) {
        toast.success('Strategy updated', 'Generated fresh interview preparation advice.');
      }
    } catch (err: any) {
      toast.error('Error generating strategy', err.message || 'Unable to generate interview prep advice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!explanation) return;
    try {
      // Clean up markdown bold asterisks for clean clipboard text
      const cleanText = explanation.replace(/\*\*/g, '');
      await navigator.clipboard.writeText(cleanText);
      setIsCopied(true);
      toast.success('Copied to clipboard', 'Interview strategy copied.');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Copy failed', 'Unable to access clipboard.');
    }
  };

  if (!jobWithMatch) return null;

  const { company, title, location, salaryRaw, remoteType, status, matchScore } = jobWithMatch;
  const score = matchScore?.score ?? 0;
  const sections = explanation ? parseExplanationSections(explanation) : [];

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* ── Header: Title & Context ───────────────────────────────────────── */}
        <div className="pb-3.5 border-b border-line space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-signal/15 text-signal flex items-center justify-center">
                <Sparkles size={15} />
              </div>
              <h2 className="text-base font-bold text-ink tracking-tight">
                AI Interview Strategy
              </h2>
            </div>

            <span className="font-mono text-xs font-bold text-signal px-2.5 py-0.5 rounded-full bg-signal/10 border border-signal/30">
              {score}% Match
            </span>
          </div>

          {/* Clean Role Context Line (No bulky outer box) */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-ink-muted">
                {company}
              </span>
              <Badge variant={status} label={status} dot />
            </div>

            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-semibold text-ink">{title}</h3>

              <div className="flex items-center gap-3 text-xs font-mono text-ink-muted">
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} className="text-ink-muted/70" />
                    {remoteType === 'remote' ? 'Remote' : location}
                  </span>
                )}
                {salaryRaw && (
                  <span className="font-medium text-ink">
                    {salaryRaw}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Body: Formatted Editorial Sections (No Nested Boxes) ──────────── */}
        {isLoading ? (
          <div className="py-10 space-y-4 text-center">
            <div className="w-9 h-9 rounded-full bg-signal/15 text-signal flex items-center justify-center mx-auto animate-pulse">
              <Sparkles size={18} className="animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-ink">
                Generating Personalized Strategy...
              </p>
              <p className="text-[11px] text-ink-muted font-mono max-w-sm mx-auto">
                Synthesizing candidate background against {company}&apos;s requirements.
              </p>
            </div>
            <div className="space-y-2 pt-2 max-w-md mx-auto animate-pulse">
              <div className="h-12 bg-bg/80 border border-line/60 rounded-md" />
              <div className="h-12 bg-bg/80 border border-line/60 rounded-md" />
            </div>
          </div>
        ) : sections.length > 0 ? (
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            {sections.map((sec, idx) => {
              const lowerTitle = sec.title.toLowerCase();
              const isStrength = lowerTitle.includes('strength');
              const isGap = lowerTitle.includes('gap') || lowerTitle.includes('missing');
              const isTalkingPoint = lowerTitle.includes('talking point') || lowerTitle.includes('hook');

              let Icon = Sparkles;
              let iconColor = 'text-signal';
              let badgeColor = 'text-signal bg-signal/10 border-signal/20';

              if (isStrength) {
                Icon = CheckCircle2;
                iconColor = 'text-emerald-700';
                badgeColor = 'text-emerald-800 bg-emerald-500/10 border-emerald-500/20';
              } else if (isGap) {
                Icon = AlertCircle;
                iconColor = 'text-amber-700';
                badgeColor = 'text-amber-900 bg-amber-500/10 border-amber-500/20';
              } else if (isTalkingPoint) {
                Icon = Lightbulb;
                iconColor = 'text-signal';
                badgeColor = 'text-ink bg-signal/15 border-signal/30';
              }

              return (
                <div
                  key={idx}
                  className={`space-y-1.5 ${idx > 0 ? 'pt-3.5 border-t border-line/60' : ''}`}
                >
                  {sec.title ? (
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={`${iconColor} shrink-0`} />
                      <h4 className="text-xs font-mono font-bold uppercase tracking-[0.05em] text-ink">
                        {sec.title}
                      </h4>
                    </div>
                  ) : null}

                  <p className="text-xs sm:text-sm text-ink leading-relaxed font-sans pl-5">
                    {renderMarkdownText(sec.body)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-line rounded-lg text-center space-y-3 bg-bg/40">
            <div className="w-8 h-8 rounded-full bg-signal/15 text-signal flex items-center justify-center mx-auto">
              <Sparkles size={16} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-ink">No Strategy Generated Yet</p>
              <p className="text-[11px] text-ink-muted max-w-sm mx-auto">
                Generate talking points and gap positioning tailored for this application.
              </p>
            </div>
            <Button
              size="sm"
              loading={isLoading}
              onClick={() => loadStrategy(true)}
              className="bg-signal text-ink font-semibold text-xs font-mono shadow-xs hover:bg-signal/90"
            >
              <Sparkles size={12} />
              Generate Advice
            </Button>
          </div>
        )}

        {/* ── Footer Actions ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-line">
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoading || !explanation}
            onClick={handleCopy}
            className="text-xs font-mono border-line text-ink hover:bg-bg"
          >
            {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {isCopied ? 'Copied' : 'Copy Strategy'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs font-mono text-ink-muted hover:text-ink"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
