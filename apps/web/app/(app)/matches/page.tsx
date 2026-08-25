'use client';

import { useState, useEffect, useRef } from 'react';
import { TopBar } from '@/components/features/TopBar';
import { MatchCard } from '@/components/features/MatchCard';
import { InterviewPrepModal } from '@/components/features/InterviewPrepModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/lib/toast-context';
import {
  fetchMatches,
  fetchUserResume,
  uploadResume,
  deleteResume,
} from '@/lib/api-client';
import type { JobWithMatch, Resume } from '@landed/shared-types';
import {
  Upload,
  Sparkles,
  FileText,
  Trash2,
  Briefcase,
  ChevronRight,
  Target,
  FileCheck,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';

// ── Best Matches Page ─────────────────────────────────────────────────────────

export default function MatchesPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [matches, setMatches] = useState<JobWithMatch[]>([]);
  const [resume, setResume] = useState<Resume | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [prepJob, setPrepJob] = useState<JobWithMatch | null>(null);
  const [filterTier, setFilterTier] = useState<'all' | 'strong' | 'good' | 'moderate' | 'reach'>('all');
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [matchesRes, resumeRes] = await Promise.all([
        fetchMatches(),
        fetchUserResume(),
      ]);

      const isResumeActive = Boolean(matchesRes.hasResume || resumeRes.hasResume);
      setHasResume(isResumeActive);
      setResume(resumeRes.resume);
      setMatches(isResumeActive ? (matchesRes.matches || []) : []);
    } catch (err: any) {
      toast.error(
        'Error loading matches',
        err.message || 'Unable to fetch resume and match rankings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const res = await uploadResume(file);
      setResume(res.resume);
      setHasResume(true);
      toast.success(
        'Resume uploaded & analyzed',
        `Extracted ${res.resume.parsedSkills.length} candidate skills. Rankings updated!`
      );
      await loadData(true);
    } catch (err: any) {
      toast.error('Upload failed', err.message || 'Could not parse resume file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextUpload = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 20) {
      toast.error(
        'Text too short',
        'Please paste at least 20 characters of resume content.'
      );
      return;
    }

    try {
      setIsUploading(true);
      const res = await uploadResume({
        text: pastedText,
        fileName: 'Pasted Resume.txt',
      });
      setResume(res.resume);
      setHasResume(true);
      setPastedText('');
      setPasteMode(false);
      toast.success(
        'Resume parsed & analyzed',
        `Extracted ${res.resume.parsedSkills.length} candidate skills. Match scores calculated.`
      );
      await loadData(true);
    } catch (err: any) {
      toast.error('Processing failed', err.message || 'Could not parse resume text');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteResume();
      setResume(null);
      setHasResume(false);
      setMatches([]);
      setDeleteModalOpen(false);
      toast.success(
        'Resume removed',
        'Resume and calculated match scores have been cleared.'
      );
      await loadData(true);
    } catch (err: any) {
      toast.error('Error deleting resume', err.message || 'Could not delete resume');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExplanationUpdated = (jobId: string, explanation: string) => {
    setMatches((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        return {
          ...job,
          matchScore: job.matchScore
            ? { ...job.matchScore, explanation }
            : ({ score: 0, matchedSkills: [], missingSkills: [], explanation } as any),
        };
      })
    );
  };

  const filteredMatches = matches.filter((job) => {
    const score = job.matchScore?.score ?? 0;
    if (filterTier === 'strong') return score >= 85;
    if (filterTier === 'good') return score >= 70 && score < 85;
    if (filterTier === 'moderate') return score >= 50 && score < 70;
    if (filterTier === 'reach') return score < 50;
    return true;
  });

  const avgScore =
    matches.length > 0 && hasResume
      ? Math.round(
          matches.reduce((sum, j) => sum + (j.matchScore?.score ?? 0), 0) /
            matches.length
        )
      : 0;

  return (
    <>
      <TopBar
        title="Best Matches"
        subtitle="Top 10 active applications ranked by candidate resume fit & skill overlap"
      />

      <div className="flex-1 overflow-y-auto bg-bg">
        <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* STATE A: NO RESUME UPLOADED YET                                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {!hasResume && !isLoading ? (
            <div className="space-y-6 animate-fade-in">
              {/* Hero Dropzone Card */}
              <div className="bg-white border border-line rounded-xl p-8 md:p-10 text-center space-y-6 shadow-xs">
                <div className="w-14 h-14 bg-signal/15 rounded-2xl flex items-center justify-center mx-auto text-signal shadow-xs">
                  <Upload size={26} />
                </div>

                <div className="max-w-md mx-auto space-y-2">
                  <h2 className="text-xl font-bold text-ink tracking-tight">
                    Upload Your Resume to Unlock Match Rankings
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Upload your resume (PDF, DOCX, or paste text) to rank tracked applications by resume evidence, related skills, role alignment, and experience.
                  </p>
                </div>

                {pasteMode ? (
                  <div className="max-w-lg mx-auto space-y-3 text-left">
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your resume text, work experience, and skills list here..."
                      rows={7}
                      className="w-full bg-bg border border-line rounded-lg p-3 text-xs text-ink font-mono placeholder:text-ink-muted/40 focus:outline-none focus:border-signal"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPasteMode(false);
                          setPastedText('');
                        }}
                        className="text-xs text-ink-muted hover:text-ink"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={isUploading}
                        onClick={handleTextUpload}
                        className="bg-signal text-ink font-semibold text-xs font-mono shadow-xs hover:bg-signal/90"
                      >
                        <Sparkles size={12} />
                        Parse & Rank Jobs
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <Button
                      size="md"
                      loading={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-signal text-ink font-semibold text-xs font-mono shadow-xs hover:bg-signal/90 px-5"
                    >
                      <Upload size={14} />
                      Upload Resume (PDF / DOCX)
                    </Button>
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => setPasteMode(true)}
                      className="text-xs font-mono border-line text-ink hover:bg-bg px-4"
                    >
                      Paste Text
                    </Button>
                  </div>
                )}
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-line rounded-lg p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Target size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                    Fit Ranking
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Instantly sort every application from highest fit (85%+) to reach roles based on requirements.
                  </p>
                </div>

                <div className="bg-white border border-line rounded-lg p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FileCheck size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                    Skill Gap Analysis
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    See exactly which tech stack requirements you cover and what specific skills are missing.
                  </p>
                </div>

                <div className="bg-white border border-line rounded-lg p-5 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-signal/15 text-signal flex items-center justify-center">
                    <Lightbulb size={16} />
                  </div>
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                    Targeted Applications
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Prioritize applications where you have the strongest overlap to maximize response rates.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* STATE B: RESUME IS ACTIVE & JOBS ARE RANKED                       */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {hasResume && resume ? (
            <div className="space-y-6 animate-fade-in">
              {/* Active Resume Status Card */}
              <div className="bg-white border border-line rounded-xl p-5 md:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-signal/15 rounded-xl flex items-center justify-center shrink-0 text-signal">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-ink">
                          {resume.fileName || 'Candidate Resume'}
                        </h3>
                        <Badge variant="applied" label="Active" dot />
                      </div>
                      <p className="text-xs font-mono text-ink-muted mt-0.5">
                        {resume.yearsOfExperience ? `${resume.yearsOfExperience} yrs experience · ` : ''}
                        Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUploading}
                      loading={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-mono border-line text-ink hover:bg-bg"
                    >
                      <Upload size={12} />
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteModalOpen(true)}
                      className="text-xs font-mono text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Remove resume"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                {/* 3 Metrics Row */}
                <div className="grid grid-cols-3 gap-3 border-t border-line pt-3.5">
                  <div className="bg-bg/60 border border-line/60 rounded-lg p-3">
                    <p className="text-[9px] font-mono text-ink-muted/70 uppercase tracking-wider font-bold">
                      Skills Extracted
                    </p>
                    <p className="text-lg font-mono font-bold text-ink mt-0.5">
                      {resume.parsedSkills.length}
                    </p>
                  </div>
                  <div className="bg-bg/60 border border-line/60 rounded-lg p-3">
                    <p className="text-[9px] font-mono text-ink-muted/70 uppercase tracking-wider font-bold">
                      Avg Alignment
                    </p>
                    <p className="text-lg font-mono font-bold text-signal mt-0.5">
                      {avgScore}%
                    </p>
                  </div>
                  <div className="bg-bg/60 border border-line/60 rounded-lg p-3">
                    <p className="text-[9px] font-mono text-ink-muted/70 uppercase tracking-wider font-bold">
                      Top Active Matches
                    </p>
                    <p className="text-lg font-mono font-bold text-ink mt-0.5">
                      {matches.length}
                    </p>
                  </div>
                </div>

                {/* Extracted Skills Chips */}
                {resume.parsedSkills.length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[9px] font-mono text-ink-muted/60 uppercase tracking-wider font-bold">
                      Candidate Skills on File
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {resume.parsedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-mono px-2 py-0.5 bg-bg text-ink-muted border border-line/80 rounded font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter Tabs */}
              {matches.length > 0 && (
                <div className="flex items-center justify-between gap-4 flex-wrap border-b border-line pb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold">
                    Top Active Applications ({filteredMatches.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'all', label: `All (${matches.length})` },
                      { id: 'strong', label: 'Strong (85%+)' },
                      { id: 'good', label: 'Good (70–84%)' },
                      { id: 'moderate', label: 'Moderate (50–69%)' },
                      { id: 'reach', label: 'Reach (<50%)' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterTier(tab.id as any)}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          filterTier === tab.id
                            ? 'bg-ink text-white font-semibold shadow-xs'
                            : 'bg-white text-ink-muted border border-line/70 hover:text-ink hover:border-line'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranked Jobs List */}
              {matches.length === 0 ? (
                <div className="text-center py-12 border border-line rounded-xl p-8 space-y-3 bg-white">
                  <div className="w-12 h-12 rounded-xl bg-bg border border-line flex items-center justify-center mx-auto text-ink-muted">
                    <Briefcase size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-ink">No Active Applications Tracked Yet</h4>
                  <p className="text-xs text-ink-muted max-w-sm mx-auto">
                    Add active job postings (Saved, Applied, or Interviewing) to your board to see resume-alignment scores and evidence breakdowns.
                  </p>
                  <Link href="/board">
                    <Button size="sm" className="bg-signal text-ink font-semibold text-xs font-mono mt-2">
                      Go to Job Board
                      <ChevronRight size={13} />
                    </Button>
                  </Link>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="text-center py-10 border border-line rounded-xl p-6 space-y-2 bg-white">
                  <p className="text-xs text-ink-muted font-mono">
                    No applications found matching the &quot;{filterTier}&quot; filter.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFilterTier('all')}
                    className="text-xs font-mono text-signal"
                  >
                    Show All Applications
                  </Button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredMatches.map((job, i) => (
                    <MatchCard
                      key={job.id}
                      jobWithMatch={job}
                      rank={i + 1}
                      onOpenPrep={(selected) => setPrepJob(selected)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="space-y-4 py-4 animate-pulse">
              <div className="bg-white border border-line rounded-xl h-36" />
              <div className="bg-white border border-line rounded-lg h-28" />
              <div className="bg-white border border-line rounded-lg h-28" />
            </div>
          )}

        </div>
      </div>

      {/* AI Interview Prep & Strategy Modal */}
      <InterviewPrepModal
        jobWithMatch={prepJob}
        isOpen={!!prepJob}
        onClose={() => setPrepJob(null)}
        onExplanationUpdated={handleExplanationUpdated}
      />

      {/* Proper Resume Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove Active Resume?"
        description="This will permanently remove your uploaded resume, parsed skills on file, and clear all calculated resume-alignment rankings."
        confirmText="Remove Resume"
        cancelText="Keep Resume"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
