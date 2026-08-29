import React, { useState } from 'react';
import { Loader2, ShieldCheck, PenLine } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';
import { submitSignature } from '@/utils/signatureFlow';

/**
 * Weekly sign-off modal — captures a drawn signature and persists a
 * Signature record. Supports both tiers:
 *   - tier='daily_worker' (staff self-sign, signerType='staff')
 *   - tier='weekly_official' (manager sign-off, signerType='manager')
 */
export default function WeeklySignOffModal({
  open,
  onClose,
  staffMember,
  weekStart,
  weeklyRecord,
  currentUser,
  tier = 'weekly_official',
  signerType = 'manager',
  title,
  description,
  confirmLabel = 'Sign off',
}) {
  const [dataUrl, setDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const isStaffTier = tier === 'daily_worker';
  const headerTitle = title || (isStaffTier ? 'Sign my weekly timesheet' : 'Official weekly sign-off');
  const headerDesc = description || (isStaffTier
    ? 'By signing below you confirm the timesheet for this week is accurate and complete. Your signature will appear on the official PDF and your manager will be notified to review and approve.'
    : 'By signing below you confirm the timesheet for this week is accurate and complete. This locks the week for payroll and your signature will appear on the official PDF.');
  const buttonLabel = confirmLabel || (isStaffTier ? 'Sign my week' : 'Sign off');
  const Icon = isStaffTier ? PenLine : ShieldCheck;
  const iconBg = isStaffTier ? 'bg-blue-100' : 'bg-emerald-100';
  const iconColor = isStaffTier ? 'text-blue-700' : 'text-emerald-700';
  const buttonBg = isStaffTier ? 'bg-blue-700 hover:bg-blue-800' : 'bg-emerald-700 hover:bg-emerald-800';

  const handleConfirm = async () => {
    if (!dataUrl) { setError('Please draw your signature first'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payloadSnapshot = weeklyRecord ? {
        weekly_total_minutes: weeklyRecord.weekly_total_minutes,
        weekly_standard_minutes: weeklyRecord.weekly_standard_minutes,
        weekly_overtime_minutes: weeklyRecord.weekly_overtime_minutes,
        weekly_meterage: weeklyRecord.weekly_meterage,
      } : {};
      await submitSignature({
        dataUrl,
        tier,
        signerType,
        context: {
          staff_id: staffMember?.id,
          staff_name: staffMember?.name,
          manager_id: currentUser?.id,
          manager_name: currentUser?.full_name,
          week_start: weekStart,
          notes: isStaffTier
            ? 'Staff self-declaration — weekly timesheet confirmed accurate'
            : 'Official weekly sign-off for payroll',
          payload_snapshot: payloadSnapshot,
        },
      });
      setDataUrl(null);
      onClose(true);
    } catch (e) {
      setError(e.message || 'Failed to record signature');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={() => !submitting && onClose(false)}>
      <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-md sm:rounded-2xl sm:shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{headerTitle}</h3>
              <p className="text-xs text-slate-500">{staffMember?.name} · Week of {weekStart}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">{headerDesc}</p>
          <SignaturePad onChange={setDataUrl} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => onClose(false)} disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={submitting || !dataUrl}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${buttonBg}`}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}