'use client';

import { useState } from 'react';
import { TopBar } from '@/components/features/TopBar';
import { MatchCard } from '@/components/features/MatchCard';
import { MatchScoreBadge } from '@/components/features/MatchScoreBadge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { mockJobsWithMatches, mockResume } from '@/lib/mock-data';
import type { JobWithMatch } from '@landed/shared-types';
import {
  Upload,
  Sparkles,
  RefreshCw,
  Check,
  X,
  MapPin,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

// ── Match Detail Modal ────────────────────────────────────────────────────────

function MatchDetailModal({
  jobWithMatch,
  onClose,
}: {
  jobWithMatch: JobWithMatch | null;
  onClose: () => void;
}) {
  const [explanationLoading, setExplanationLoading] = useState(false);

  if (!jobWithMatch) return null;
  const { matchScore, company, title, location, salaryRaw, remoteType, requiredSkills, sourceUrl } =
    jobWithMatch;
  const score = matchScore?.score ?? 0;

  const handleGenerateExplanation = () => {
    setExplanationLoading(true);
    setTimeout(() => setExplanationLoading(false), 1500);
  };

  return (
    <Modal open={!!jobWithMatch} onClose={onClose} size="lg">
      {/* Console-layer panel inside the modal */}
      <div className="bg-panel -m-5 p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-5">
          <MatchScoreBadge score={score} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-panel-fg/50 uppercase tracking-widest mb-1">
              {company}
            </p>
            <h2 className="text-lg font-semibold text-panel-fg leading-snug">{title}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {location && (
                <span className="flex items-center gap-1 text-xs font-mono text-panel-fg/50">
                  <MapPin size={10} />
                  {remoteType === 'remote' ? 'Remote' : location}
                </span>
              )}
              {salaryRaw && (
                <span className="flex items-center gap-1 text-xs font-mono text-panel-fg/50">
                  <DollarSign size={10} />
                  {salaryRaw}
                </span>
              )}
              <Badge variant={jobWithMatch.status} label={jobWithMatch.status} dot />
            </div>
          </div>
        </div>

        <div className="h-px bg-panel-fg/10" />

        {/* Skills breakdown */}
        {matchScore && (
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-panel-fg/40">
              Skill Breakdown
            </p>

            {matchScore.matchedSkills.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-green-400/70 uppercase tracking-wider mb-1.5">
                  Matched ({matchScore.matchedSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchScore.matchedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-sm"
                    >
                      <Check size={10} />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {matchScore.missingSkills.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-red-400/70 uppercase tracking-wider mb-1.5">
                  Missing ({matchScore.missingSkills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchScore.missingSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 bg-red-500/8 text-red-400/70 border border-red-500/15 rounded-sm"
                    >
                      <X size={10} />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-panel-fg/10" />

        {/* Explanation */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-panel-fg/40">
            AI Explanation
          </p>
          {matchScore?.explanation ? (
            <p className="text-sm text-panel-fg/70 leading-relaxed font-mono">
              {matchScore.explanation}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-panel-fg/40 font-mono italic">
                Detailed explanation not yet generated.
              </p>
              <Button
                size="sm"
                variant="secondary"
                loading={explanationLoading}
                onClick={handleGenerateExplanation}
                className="border-panel-fg/20 text-panel-fg hover:bg-panel-fg/5"
              >
                <Sparkles size={13} />
                Generate Explanation
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="bg-signal text-panel hover:bg-signal/90 border-transparent"
              >
                <ExternalLink size={13} />
                View Posting
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-auto text-panel-fg/50 hover:text-panel-fg hover:bg-panel-fg/5"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Best Matches Page ─────────────────────────────────────────────────────────

export default function MatchesPage() {
  const [selectedJob, setSelectedJob] = useState<JobWithMatch | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);

  const avgScore =
    mockJobsWithMatches.length > 0
      ? Math.round(
          mockJobsWithMatches.reduce((sum, j) => sum + (j.matchScore?.score ?? 0), 0) /
            mockJobsWithMatches.length,
        )
      : 0;

  const handleRecompute = () => {
    setIsRecomputing(true);
    setTimeout(() => setIsRecomputing(false), 1500);
  };

  return (
    <>
      <TopBar
        title="Best Matches"
        subtitle="Ranked by resume fit score"
        action={
          <Button variant="ghost" size="sm" loading={isRecomputing} onClick={handleRecompute}>
            <RefreshCw size={13} />
            Recompute
          </Button>
        }
      />

      {/* Full console (dark panel) layout */}
      <div className="flex-1 overflow-y-auto bg-panel">
        <div className="max-w-3xl mx-auto p-6 space-y-5">

          {/* Resume context bar */}
          <div className="border border-panel-fg/10 p-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-signal/15 rounded-sm flex items-center justify-center">
                <Upload size={14} className="text-signal" />
              </div>
              <div>
                <p className="text-xs font-mono text-panel-fg/60 uppercase tracking-widest">
                  Resume
                </p>
                <p className="text-sm font-medium text-panel-fg">{mockResume.fileName}</p>
              </div>
            </div>

            <div className="h-8 w-px bg-panel-fg/10 hidden sm:block" />

            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest">
                  Skills Detected
                </p>
                <p className="text-sm font-mono font-semibold text-panel-fg">
                  {mockResume.parsedSkills.length}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest">
                  Avg Match
                </p>
                <p className="text-sm font-mono font-semibold text-signal">{avgScore}%</p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest">
                  Jobs Ranked
                </p>
                <p className="text-sm font-mono font-semibold text-panel-fg">
                  {mockJobsWithMatches.length}
                </p>
              </div>
            </div>

            <div className="ml-auto">
              <Button
                size="sm"
                className="bg-panel-fg/10 text-panel-fg/70 hover:bg-panel-fg/15 border-panel-fg/15 border"
              >
                <Upload size={13} />
                Update Resume
              </Button>
            </div>
          </div>

          {/* Skills on resume */}
          <div>
            <p className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest mb-2">
              Your Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {mockResume.parsedSkills.map((skill) => (
                <span
                  key={skill}
                  className="text-[10px] font-mono px-2 py-0.5 bg-panel-fg/8 text-panel-fg/60 border border-panel-fg/10 rounded-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Ranked list */}
          <div>
            <p className="text-[9px] font-mono text-panel-fg/30 uppercase tracking-widest mb-3">
              Ranked by Fit Score — {mockJobsWithMatches.length} jobs
            </p>
            <div className="space-y-2">
              {mockJobsWithMatches.map((job, i) => (
                <MatchCard
                  key={job.id}
                  jobWithMatch={job}
                  rank={i + 1}
                  onViewDetails={() => setSelectedJob(job)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      <MatchDetailModal jobWithMatch={selectedJob} onClose={() => setSelectedJob(null)} />
    </>
  );
}
