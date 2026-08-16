'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Toast Notification Component
// Sleek, modern toast alerts styled with design system tokens.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 max-w-md w-full pointer-events-none px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'pointer-events-auto w-full flex items-start gap-3 px-3.5 py-2.5 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2',
            toast.type === 'success'
              ? 'bg-bg/95 border-emerald-500/30 text-ink shadow-emerald-500/5'
              : toast.type === 'error'
              ? 'bg-bg/95 border-red-500/30 text-ink shadow-red-500/5'
              : 'bg-bg/95 border-line text-ink shadow-black/5',
          ].join(' ')}
        >
          {/* Icon */}
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' && (
              <CheckCircle2 size={16} className="text-emerald-500" />
            )}
            {toast.type === 'error' && (
              <AlertCircle size={16} className="text-red-500" />
            )}
            {toast.type === 'info' && (
              <Info size={16} className="text-ink-muted" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 text-xs min-w-0">
            <span className="font-semibold text-ink text-xs block leading-snug">{toast.title}</span>
            {toast.message && (
              <p className="text-ink-muted text-xs mt-0.5 leading-relaxed break-words">{toast.message}</p>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-ink-muted hover:text-ink transition-colors p-1 rounded hover:bg-ink/5 shrink-0 -mr-1"
            aria-label="Dismiss alert"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
