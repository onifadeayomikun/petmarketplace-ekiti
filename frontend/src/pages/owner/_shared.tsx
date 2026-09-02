// Shared helpers for the Animal Owner pages.
// Lives inside src/pages/owner so it does not touch the scaffold.
import { motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Dog, Cat, Bird, Rabbit, PawPrint } from 'lucide-react';
import type { AnimalSpecies } from '@/types';

/** Animated page wrapper with a consistent header. */
export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="container-app py-6 sm:py-8"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.div>
  );
}

/** Accessible modal dialog rendered in a portal. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-lift sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink-muted hover:bg-brand-50 hover:text-brand-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </motion.div>
    </div>,
    document.body
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  loading,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-md" disabled={loading}>
            Cancel
          </button>
          <button onClick={onConfirm} className={`${danger ? 'btn-danger' : 'btn-primary'} btn-md`} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  );
}

/** Inline error block with retry. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-danger">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

export const TOWNS = ['Ikerre', 'Ado-Ekiti', 'Igede', 'Ise', 'Emure', 'Ikole', 'Other'];
export const SPECIES: AnimalSpecies[] = ['DOG', 'CAT', 'POULTRY', 'GOAT', 'SHEEP', 'CATTLE', 'RABBIT', 'OTHER'];
export const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'] as const;

/** A lucide icon for an animal species. */
export function SpeciesIcon({ species, className = 'h-5 w-5' }: { species?: AnimalSpecies | string | null; className?: string }) {
  switch (species) {
    case 'DOG':
      return <Dog className={className} />;
    case 'CAT':
      return <Cat className={className} />;
    case 'POULTRY':
      return <Bird className={className} />;
    case 'RABBIT':
      return <Rabbit className={className} />;
    default:
      return <PawPrint className={className} />;
  }
}

/** Friendly title-case for an enum value. */
export function pretty(v?: string | null) {
  if (!v) return '';
  return v.charAt(0) + v.slice(1).toLowerCase();
}

/** Compute an animal's display age. */
export function animalAge(a: { age_years?: number | null; date_of_birth?: string | null }) {
  if (a.age_years != null) return `${a.age_years} yr${a.age_years === 1 ? '' : 's'}`;
  if (a.date_of_birth) {
    const years = Math.max(0, Math.floor((Date.now() - new Date(a.date_of_birth).getTime()) / 31557600000));
    return `${years} yr${years === 1 ? '' : 's'}`;
  }
  return 'Age unknown';
}
