'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — 3-Page Slider Onboarding Modal
// Aligned with DESIGN.md (Editorial & Console layering, Newsreader serif copy,
// JetBrains Mono step counters, and custom SVG graphic illustrations).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { ArrowRight, ChevronLeft, Sparkles, X, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WelcomeModalProps {
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onStartExtraction: () => void;
}

export function WelcomeModal({
  userName = 'there',
  isOpen,
  onClose,
  onStartExtraction,
}: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const totalSlides = 3;

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      onClose();
      onStartExtraction();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-bg border border-line rounded-xl p-6 sm:p-7 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Dismiss X button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors p-1 rounded-md hover:bg-ink/5 z-10"
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        {/* Top Header & Step Progress Bar */}
        <div className="space-y-4">
          <div className="relative flex items-center justify-between">
            {/* Step Counter in Mono */}
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-semibold">
              0{currentSlide + 1} / 0{totalSlides}
            </span>

            {/* Centered Step Progress Indicators */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide
                      ? 'w-6 bg-ink'
                      : 'w-1.5 bg-line hover:bg-ink/30'
                    }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Slide 01: Instant URL Extraction */}
          {currentSlide === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Graphic Illustration */}
              <div className="w-full h-44 rounded-lg border border-line bg-bg p-4 flex flex-col justify-center gap-3 relative overflow-hidden shadow-xs">
                {/* Input simulation */}
                <div className="flex items-center gap-2 p-2.5 rounded-md border border-line bg-bg text-xs font-mono text-ink-muted shadow-2xs">
                  <span className="text-amber-500 font-bold">URL</span>
                  <span className="text-ink truncate">https://greenhouse.io/stripe/senior-fullstack-engineer</span>
                </div>

                {/* Arrow indicator */}
                <div className="flex items-center justify-center -my-1 text-ink-muted">
                  <div className="h-4 w-px bg-line" />
                </div>

                {/* Extracted Card Output Simulation */}
                <div className="flex items-center justify-between p-3 rounded-md border border-line bg-bg shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">Senior Fullstack Engineer</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-line bg-ink/5 text-ink-muted">Stripe</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-muted font-mono">
                      <span>San Francisco, CA</span>
                      <span>·</span>
                      <span className="text-emerald-600 font-semibold">$180k–$240k</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-line text-ink-muted">React</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-line text-ink-muted">TypeScript</span>
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="space-y-1.5">
                <h2
                  className="text-xl font-bold text-ink tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Track your job search with speed
                </h2>
                <p
                  className="text-sm text-ink-muted leading-relaxed"
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
                >
                  Paste any job posting link from Lever, Greenhouse, or LinkedIn. AI auto-extracts company name, title, salary range, and required skills in seconds.
                </p>
              </div>
            </div>
          )}

          {/* Slide 02: Visual Pipeline Management */}
          {currentSlide === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Graphic Illustration */}
              <div className="w-full h-44 rounded-lg border border-line bg-bg p-3.5 flex items-stretch gap-2.5 relative overflow-hidden shadow-xs">
                {/* Column 1: Saved */}
                <div className="flex-1 rounded-md border border-line bg-ink/[0.02] p-2 space-y-1.5 flex flex-col justify-start">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-semibold text-ink-muted border-b border-line pb-1">
                    <span>SAVED</span>
                    <span className="w-4 h-4 rounded-full bg-ink/5 flex items-center justify-center text-[9px]">2</span>
                  </div>
                  <div className="p-1.5 rounded border border-line bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Frontend Lead</span>
                    <span className="text-[9px] font-mono text-ink-muted block">Linear · $190k</span>
                  </div>
                  <div className="p-1.5 rounded border border-line bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Staff Engineer</span>
                    <span className="text-[9px] font-mono text-ink-muted block">Vercel · $200k</span>
                  </div>
                </div>

                {/* Column 2: Applied */}
                <div className="flex-1 rounded-md border border-line bg-ink/[0.02] p-2 space-y-1.5 flex flex-col justify-start">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-semibold text-blue-600 border-b border-line pb-1">
                    <span>APPLIED</span>
                    <span className="w-4 h-4 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[9px]">2</span>
                  </div>
                  <div className="p-1.5 rounded border border-line bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Fullstack Eng</span>
                    <span className="text-[9px] font-mono text-ink-muted block">Stripe · $185k</span>
                  </div>
                  <div className="p-1.5 rounded border border-blue-500/30 bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Product Architect</span>
                    <span className="text-[9px] font-mono text-blue-600 block font-medium">APPLIED · 2D AGO</span>
                  </div>
                </div>

                {/* Column 3: Interview */}
                <div className="flex-1 rounded-md border border-line bg-ink/[0.02] p-2 space-y-1.5 flex flex-col justify-start">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-semibold text-amber-600 border-b border-line pb-1">
                    <span>INTERVIEW</span>
                    <span className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-[9px]">2</span>
                  </div>
                  <div className="p-1.5 rounded border border-line bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Systems Eng</span>
                    <span className="text-[9px] font-mono text-ink-muted block">OpenAI · $220k</span>
                  </div>
                  <div className="p-1.5 rounded border border-amber-500/30 bg-bg shadow-2xs space-y-0.5">
                    <span className="text-[11px] font-medium text-ink block truncate">Lead Developer</span>
                    <span className="text-[9px] font-mono text-amber-600 block font-medium">ROUND 2 · JUL 24</span>
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="space-y-1.5">
                <h2
                  className="text-xl font-bold text-ink tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Visualize every stage of your pipeline
                </h2>
                <p
                  className="text-sm text-ink-muted leading-relaxed"
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
                >
                  Organize applications across Saved, Applied, Interview, Offer, and Rejected. Drag and drop cards in Kanban view or switch to a dense tabular list.
                </p>
              </div>
            </div>
          )}

          {/* Slide 03: AI Resume Match Scoring (Light Theme) */}
          {currentSlide === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Graphic Illustration — Light Theme */}
              <div className="w-full h-44 rounded-lg border border-line bg-bg text-ink p-4 flex flex-col justify-between relative overflow-hidden shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">
                    AI MATCH SCORE
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 font-bold border border-emerald-500/20">
                    94% HIGH MATCH
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-ink-muted">Matched Skills:</span>
                    <div className="flex gap-1">
                      <span className="px-1.5 py-0.5 rounded border border-line bg-ink/5 text-ink text-[10px]">React</span>
                      <span className="px-1.5 py-0.5 rounded border border-line bg-ink/5 text-ink text-[10px]">TypeScript</span>
                      <span className="px-1.5 py-0.5 rounded border border-line bg-ink/5 text-ink text-[10px]">Node.js</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-ink-muted">Skill Gap:</span>
                    <span className="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 text-[10px]">GraphQL (Optional)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-line text-[10px] font-mono text-ink-muted flex items-center justify-between">
                  <span>RESUME: resume_2026.pdf</span>
                </div>
              </div>

              {/* Text */}
              <div className="space-y-1.5">
                <h2
                  className="text-xl font-bold text-ink tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Match your resume with AI precision
                </h2>
                <p
                  className="text-sm text-ink-muted leading-relaxed"
                  style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
                >
                  Upload your resume once. Get evidence-based alignment rankings, matched and related skills, and clear notes about requirements not shown on your resume.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-line">
          {/* Skip / Back Button */}
          <div>
            {currentSlide > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="gap-1 text-ink-muted -ml-2.5"
              >
                <ChevronLeft size={14} />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-ink-muted -ml-2.5"
              >
                Skip
              </Button>
            )}
          </div>

          {/* Next / Get Started Button */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5"
            >
              {currentSlide === totalSlides - 1 ? (
                <>
                  Get Started
                  <Check size={14} />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
