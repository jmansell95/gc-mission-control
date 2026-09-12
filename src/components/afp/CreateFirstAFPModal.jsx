import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, CalendarClock, ShieldCheck, PoundSterling, Loader2, FileText, Info,
} from 'lucide-react';
import { defaultCertificationDue, defaultFinalPaymentNotice, todayStr } from '@/utils/afpDates';

/**
 * CreateFirstAFPModal — billing team creates the first (or next) AFP for a job.
 *
 * Four dates:
 *   period_start_date       — when the AFP period begins
 *   period_end_date         — the submission deadline (must send by this date)
 *   certification_due_date   — auto = period_end + 5 days (editable)
 *   final_payment_notice_date — auto = period_end + 30 days (editable)
 *
 * On creation, the AFP immediately auto-populates with live field data.
 */
export default function CreateFirstAFPModal({ job, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    period_start_date: job.start_date || todayStr(),
    period_end_date: '',
    certification_due_date: '',
    final_payment_notice_date: '',
  });
  const [autoCert, setAutoCert] = useState(true);
  const [autoFinal, setAutoFinal] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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

  const handleCreate = async () => {
    if (!form.period_start_date) { setError('Period start date is required'); return; }
    if (!form.period_end_date) { setError('Period end date (submission deadline) is required'); return; }
    setCreating(true);
    setError('');
    try {
      const existing = await base44.entities.AFP.filter({ job_id: job.id });
      const nextNumber = existing.length + 1;

      const afp = await base44.entities.AFP.create({
        job_id: job.id,
        job_name: job.name,
        job_reference: job.job_reference || '',
        division_id: job.division_id || '',
        afp_number: nextNumber,
        period_start_date: form.period_start_date,
        period_end_date: form.period_end_date,
        certification_due_date: form.certification_due_date || defaultCertificationDue(form.period_end_date),
        final_payment_notice_date: form.final_payment_notice_date || defaultFinalPaymentNotice(form.period_end_date),
        status: 'draft',
        client_name: job.client_name || '',
        client_po: job.job_reference || '',
        gc_job_number: job.job_reference || '',
        contract_value: job.budget_amount || 0,
        total_claimed: 0,
        original_total: 0,
        disputed_total: 0,
        agreed_total: 0,
        dispute_status: 'none',
      });

      try {
        await base44.functions.invoke('populateAFPFromFieldData', { afp_id: afp.id });
      } catch (e) {
        console.error('Auto-populate failed:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['afp', job.id] });
      queryClient.invalidateQueries({ queryKey: ['afp-portfolio'] });
      onCreated(afp.id);
    } catch (e) {
      setError(e.message || 'Failed to create AFP');
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create AFP</h3>
              <p className="text-[11px] text-white/70">{job.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              The AFP will auto-populate with live field data from the period start date. Certification and final payment dates auto-fill from the period end date but can be edited.
            </p>
          </div>

          <DateField
            icon={Calendar}
            label="Period Start Date"
            hint="When this AFP period begins — usually the job start date."
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

          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={creating || !form.period_start_date || !form.period_end_date}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {creating ? 'Creating…' : 'Create & Populate'}
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