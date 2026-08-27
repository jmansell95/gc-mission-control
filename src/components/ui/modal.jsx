import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import useBackIntercept from '@/hooks/useBackIntercept';

/**
 * Modal — shared full-screen modal shell used by custom popups across the site.
 *
 * Guarantees:
 *   • The backdrop covers the ENTIRE screen (fixed inset-0, dark, blurred)
 *   • The popup fits the screen (scrollable, padded, capped height)
 *   • Consistent z-index (z-50, or z-[60] for nested modals via the `nested` prop)
 *   • Body scroll is locked while open
 *   • ESC key closes
 *
 * Usage:
 *   <Modal open={isOpen} onClose={close} title="Edit Job" size="lg">
 *     ...content...
 *   </Modal>
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: optional heading
 *   description: optional subheading
 *   size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' (max-width)
 *   nested: true for modals opened from inside another modal (z-[60])
 *   closeOnBackdrop: boolean (default true) — click backdrop to close
 *   hideCloseButton: boolean
 *   footer: optional React node pinned to the bottom
 *   className: extra classes on the panel
 *   children: modal content
 */
const SIZES = {
  sm: 'sm:max-w-xl',
  md: 'sm:max-w-2xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
  '3xl': 'sm:max-w-6xl',
  full: 'sm:max-w-[calc(100vw-2rem)]',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'xl',
  nested = false,
  closeOnBackdrop = true,
  hideCloseButton = false,
  footer,
  className,
  children,
}) {
  useBackIntercept(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const z = nested ? 'z-[60]' : 'z-50';

  return (
    <div
      className={cn('fixed inset-0', z, 'flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-4 overflow-y-auto overscroll-contain')}
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={cn(
          'relative w-full bg-background rounded-2xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.25),0_4px_16px_-8px_rgba(15,23,42,0.15),0_0_0_1px_rgba(255,255,255,0.5)]',
          'border border-slate-200/80',
          'max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden',
          'animate-pop-in',
          SIZES[size] || SIZES.lg,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <div className="min-w-0">
              {title && <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900 truncate">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>}
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="shrink-0 rounded-xl p-2 bg-slate-100/80 text-slate-500 backdrop-blur-sm transition-all hover:scale-110 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}