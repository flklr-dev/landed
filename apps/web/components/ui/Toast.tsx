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
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3',
            toast.type === 'success'
              ? 'bg-bg/95 border-emerald-500/30 text-ink shadow-emerald-500/5'
              : toast.type === 'error'
              ? 'bg-bg/95 border-red-500/30 text-ink shadow-red-500/5'
              : 'bg-bg/95 border-line text-ink shadow-black/5',
          ].join(' ')}
        >
          {/* Icon */}
          {toast.type === 'success' && (
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info size={18} className="text-ink-muted shrink-0 mt-0.5" />
          )}

          {/* Content */}
          <div className="flex-1 text-xs leading-relaxed">
            <span className="font-semibold text-ink block">{toast.title}</span>
            {toast.message && (
              <span className="text-ink-muted block mt-0.5">{toast.message}</span>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-ink-muted hover:text-ink transition-colors p-0.5 rounded-sm hover:bg-ink/5"
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
