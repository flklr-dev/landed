'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Landed — Reusable Confirmation Modal Component
// Sleek, design-system-aligned confirmation dialog for destructive actions.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-4">
        {/* Header Icon + Title */}
        <div className="flex items-start gap-3">
          <div
            className={[
              'p-2.5 rounded-full shrink-0 mt-0.5',
              variant === 'danger'
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
            ].join(' ')}
          >
            {variant === 'danger' ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div>
            <h3 className="text-base font-bold text-ink leading-snug">{title}</h3>
            <p className="text-xs text-ink-muted leading-relaxed mt-1">{description}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={async () => {
              await onConfirm();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
