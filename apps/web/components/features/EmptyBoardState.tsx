'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Creative Board Empty State Component
// Renders when a user has 0 job applications. Uses custom dual-tone
// illustration, Newsreader serif copy, and primary action buttons.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import Image from 'next/image';
import { Plus, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyBoardStateProps {
  onAddJobUrl: () => void;
  onAddJobManual: () => void;
}

export function EmptyBoardState({ onAddJobUrl, onAddJobManual }: EmptyBoardStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10 px-8 mb-8 text-center animate-in fade-in duration-300">
      <div className="max-w-lg space-y-5 flex flex-col items-center">
        {/* Dual-Tone Minimalist Graphic Illustration */}
        <div className="relative flex items-center justify-center py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/empty-board.png"
            alt="No applications tracked"
            className="w-80 sm:w-[360px] h-auto max-h-72 object-contain"
          />
        </div>

        {/* Text Copy Aligned with DESIGN.md */}
        <div className="space-y-2">
          <h2
            className="text-xl font-bold text-ink tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            No job applications tracked yet
          </h2>
          <p
            className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
          >
            Paste a job posting URL to auto-extract company details with AI, or add your first application manually.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            size="sm"
            onClick={onAddJobUrl}
            className="gap-1.5"
          >
            <Link2 size={14} />
            Paste Job Link
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onAddJobManual}
            className="gap-1.5"
          >
            <Plus size={14} />
            Add Manually
          </Button>
        </div>
      </div>
    </div>
  );
}
