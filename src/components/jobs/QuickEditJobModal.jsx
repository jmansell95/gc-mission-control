import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, MapPin, Calendar, Clock, FileText, Save, Loader2, CheckCircle2,
  Briefcase, PoundSterling, Receipt, Percent, Users, Ruler, FileCheck2, Building2,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

const REVENUE_METHODS = [
  { val: 'none', label: 'Markup', icon: Percent, desc: 'Cost + margin' },
  { val: 'meterage_rate', label: 'Meterage', icon: Ruler, desc: '£/metre' },
  { val: 'day_rate', label: 'Day Rate', icon: Users, desc: 'Crew × days' },
  { val: 'unit_rate', label: 'Unit Rate', icon: FileCheck2, desc: '£/unit' },
  { val: 'flat_fee', label: 'Flat Fee', icon: PoundSterling, desc: 'Fixed fee' },
];

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white";

/**
 * QuickEditJobModal — polished inline editor for the most commonly edited job
 * fields: location, dates, status, notes, client, budget, and revenue method.
 * Grouped into Details, Schedule & Status, and Billing sections. Responsive:
 * bottom-sheet on mobile, centered modal on desktop.
 */
export default function QuickEditJobModal({ open, onClose, job }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    location: '', start_date: '', end_date: '', status: 'planning', notes: '',
    client_id: '', budget_amount: '', revenue_method: 'none',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), enabled: open });

  useEffect(() => {
    if (open && job) {
      setForm({
        location: job.location || '',
        start_date: job.start_date || '',
        end_date: job.end_date || '',
        status: job.status || 'planning',
        notes: job.notes || '',
        client_id: job.client_id || '',
        budget_amount: job.budget_amount != null ? String(job.budget_amount) : '',
        revenue_method: job.revenue_method || 'none',
      });
      setSaved(false);
    }
  }, [open, job?.id]);

  if (!job) return null;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const dirty = form.location !== (job.location || '') ||
                form.start_date !== (job.start_date || '') ||
                form.end_date !== (job.end_date || '') ||
                form.status !== (job.status || 'planning') ||
                form.notes !== (job.notes || '') ||
                form.client_id !== (job.client_id || '') ||
                form.budget_amount !== (job.budget_amount != null ? String(job.budget_amount) : '') ||
                form.revenue_method !== (job.revenue_method || 'none');

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        location: form.location,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        notes: form.notes,
        client_id: form.client_id || null,
        revenue_method: form.revenue_method,
      };
      if (form.budget_amount === '' || form.budget_amount == null) payload.budget_amount = null;
      else payload.budget_amount = parseFloat(form.budget_amount);

      await base44.entities.Job.update(job.id, payload);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e) {
      console.error('Quick edit failed:', e);
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center overflow-y-auto overscroll-contain p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[94dvh] sm:max-h-[90dvh] flex flex-col"
          >
            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-tight truncate">Quick Edit</h2>
                  <p className="text-emerald-100 text-xs truncate">{job.name}</p>
                </div>
              </div>
              <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Section: Details */}
              <Section title="Details" icon={MapPin}>
                <Field label="Site Location" icon={MapPin}>
                  <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Site address or location" className={inputCls} />
                </Field>
                <Field label="Client" icon={Building2}>
                  <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Notes" icon={FileText}>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Job notes, access arrangements, special requirements…" className={`${inputCls} resize-none`} />
                </Field>
              </Section>

              {/* Section: Schedule & Status */}
              <Section title="Schedule & Status" icon={Calendar}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Start Date" icon={Calendar}>
                    <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="End Date" icon={Clock}>
                    <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s.value} type="button" onClick={() => set('status', s.value)}
                        className={`px-2 py-2 rounded-lg border text-xs font-semibold transition ${
                          form.status === s.value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Section: Billing */}
              <Section title="Billing" icon={Receipt} last>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Revenue Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {REVENUE_METHODS.map(m => {
                      const Icon = m.icon;
                      const selected = form.revenue_method === m.val;
                      return (
                        <button key={m.val} type="button" onClick={() => set('revenue_method', m.val)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition ${
                            selected ? 'bg-primary/5 border-primary ring-1 ring-primary/20' : 'bg-white border-slate-200 hover:border-primary/40'
                          }`}>
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${selected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold leading-tight ${selected ? 'text-primary' : 'text-slate-700'}`}>{m.label}</p>
                            <p className="text-[9px] text-slate-400 leading-tight">{m.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Budget (GBP)" icon={PoundSterling}>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input type="number" min="0" step="0.01" value={form.budget_amount} onChange={e => set('budget_amount', e.target.value)} placeholder="0.00" className={`${inputCls} pl-9`} />
                  </div>
                </Field>
              </Section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0 bg-white safe-area-bottom">
              <button onClick={onClose} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !dirty}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, icon: Icon, last, children }) {
  return (
    <div className={`px-5 py-4 ${!last ? 'border-b border-slate-100' : ''}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />} {label}
      </label>
      {children}
    </div>
  );
}