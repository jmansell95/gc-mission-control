import React, { useState, useEffect } from 'react';
import { Calendar, CalendarClock, ShieldCheck, PoundSterling, RefreshCw, Loader2, X } from 'lucide-react';
import { defaultCertificationDue, defaultFinalPaymentNotice } from '@/utils/afpDates';

/**
 * AFPDatesEditor — inline editor for the four AFP dates on an existing AFP.
 * Used inside the AFP Builder header. Shows all four dates, auto-calculates
 * certification due (+5d) and final payment notice (+30d) from the period end
 * date, but every field is editable. 'Regenerate' saves the dates then
 * re-populates the AFP line items from field data.
 */
export default function AFPDatesEditor({ afp, onSave, onRegenerate, onClose, saving, regenerating }) {
  const [form, setForm] = useState({
    period_start_date: afp.period_start_date || '',
    period_end_date: afp.period_end_date || '',
    certification_due_date: afp.certification_due_date || '',
    final_payment_notice_date: afp.final_payment_notice_date || '',
  });
  const [autoCert, setAutoCert] = useState(true);
  const [autoFinal, setAutoFinal] = useState(true);

  // Track whether the stored values match the auto-calculated defaults.
  // If they do, we keep auto-updating them when period_end changes. If the
  // user has manually edited them, we stop auto-updating until they re-sync.
  useEffect(() => {
    if (afp.period_end_date) {
      const autoC = defaultCertificationDue(afp.period_end_date);
      const autoF = defaultFinalPaymentNotice(afp.period_end_date);
      setAutoCert(!afp.certification_due_date || afp.certification_due_date === autoC);
      setAutoFinal(!afp.final_payment_notice_date || afp.final_payment_notice_date === autoF);
    }
  }, [afp.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'period_end_date' && value) {
        if (autoCert) next.certification_due_date = defaultCertificationDue(value);
        if (autoFinal) next.final_payment_notice_date = defaultFinalPaymentNotice(value);
      }
      return next;
    });
  };

  const handleSave = () => onSave(form);
  const handleRegenerate = () => onRegenerate(form);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AFP {afp.afp_number} Dates</h3>
              <p className="text-[11px] text-white/70">Edit dates then regenerate from field data</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <DateField
            icon={Calendar}
            label="Period Start Date"
            hint="When this AFP period begins."
            value={form.period_start_date}
            onChange={v => setField('period_start_date', v)}
            required
          />
          <DateField
            icon={CalendarClock}
            label="Period End Date (Submission Deadline)"
            hint="We must send the AFP by this date to stay legally protected."
            value={form.period_end_date}
            onChange={v => setField('period_end_date', v)}
            required
            accent
          />
          <DateField
            icon={ShieldCheck}
            label="Certification Due Date"
            hint="When the client certifies what they'll pay. Auto = Period End + 5 days."
            value={form.certification_due_date}
            onChange={v => { setField('certification_due_date', v); setAutoCert(false); }}
            auto={autoCert}
            onResyncAuto={() => { setAutoCert(true); setField('certification_due_date', defaultCertificationDue(form.period_end_date)); }}
          />
          <DateField
            icon={PoundSterling}
            label="Final Date for Payment"
            hint="Last date the client can pay. Auto = Period End + 30 days. Accounts issues a default invoice after this."
            value={form.final_payment_notice_date}
            onChange={v => { setField('final_payment_notice_date', v); setAutoFinal(false); }}
            auto={autoFinal}
            onResyncAuto={() => { setAutoFinal(true); setField('final_payment_notice_date', defaultFinalPaymentNotice(form.period_end_date)); }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.period_start_date || !form.period_end_date}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold transition active:scale-95 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Save Dates
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || !form.period_start_date || !form.period_end_date}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

function DateField({ icon: Icon, label, hint, value, onChange, required, accent, auto, onResyncAuto }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
        {auto && (
          <button onClick={onResyncAuto} className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold">
            AUTO
          </button>
        )}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 ${accent ? 'border-primary/30 bg-primary/5' : 'border-slate-200'} ${auto ? 'bg-blue-50/40' : ''}`}
      />
      <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
    </div>
  );
}