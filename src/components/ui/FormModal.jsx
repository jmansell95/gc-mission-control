import React from 'react';
import Modal from '@/components/ui/modal';

/**
 * FormModal — shared wrapper for standardised edit/create popups across the site.
 *
 * Wraps the base Modal component with a consistent gradient icon header,
 * grouped body sections, and a pinned Cancel/Save footer.
 *
 * Props:
 *   open, onClose — standard modal controls
 *   icon — lucide-react icon component
 *   title — popup heading
 *   description — subheading
 *   size — 'lg' | 'xl' | '2xl' (default 'xl')
 *   saveLabel — footer save button text (default 'Save')
 *   onSave — save handler (called when Save is clicked)
 *   saving — boolean to show spinner and disable buttons
 *   canSave — boolean to enable/disable the Save button (default true)
 *   children — form body content
 *   footer — optional custom footer (overrides the default Cancel/Save)
 */
export default function FormModal({
  open,
  onClose,
  icon: Icon,
  title,
  description,
  size = 'xl',
  saveLabel = 'Save',
  onSave,
  saving = false,
  canSave = true,
  children,
  footer,
  ...rest
}) {
  const defaultFooter = (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
      >
        {saving ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : null}
        {saving ? 'Saving...' : saveLabel}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={size}
      footer={footer || defaultFooter}
      {...rest}
    >
      {/* Gradient icon header — matches SettingsSectionHeader pattern */}
      {Icon && (title || description) && (
        <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </Modal>
  );
}