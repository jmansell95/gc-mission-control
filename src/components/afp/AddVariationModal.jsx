import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GitBranch, X, Loader2, Plus } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * AddVariationModal — creates a new variation summary line on the fly when the
 * client instructs extra work. Creates a single AFPLineItem with
 * sheet_name='variations', vo_ref, description, unit, qty, rate, amount.
 * The breakdown tab for this ref is created empty and can be filled in later.
 */
export default function AddVariationModal({ afp, job, existingRefs = [], onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    vo_ref: '',
    description: '',
    unit: 'nr',
    qty: 1,
    rate: 0,
    vo_date: afp?.period_end_date || new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const amount = (Number(form.qty) || 0) * (Number(form.rate) || 0);

  // Suggest next VO ref based on existing refs
  const suggestedRef = React.useMemo(() => {
    const nums = existingRefs
      .map(r => {
        const m = String(r).match(/VO[-_]?\d+/i);
        return m ? parseInt(m[0].replace(/\D/g, '')) : 0;
      })
      .filter(n => n > 0);
    const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `VO-${String(next).padStart(2, '0')}`;
  }, [existingRefs]);

  const handleSave = async () => {
    if (!form.vo_ref || !form.description) {
      setError('Ref and description are required');
      return;
    }
    // Check for duplicate ref
    if (existingRefs.some(r => r.toUpperCase() === form.vo_ref.toUpperCase())) {
      setError(`Ref ${form.vo_ref} already exists`);
      return;
    }
    setSaving(true);
    try {
      await base44.entities.AFPLineItem.create({
        afp_id: afp.id,
        job_id: job.id,
        sheet_name: 'variations',
        category: 'other',
        item_ref: form.vo_ref,
        item: form.description,
        unit: form.unit,
        qty: Number(form.qty) || 0,
        rate: Number(form.rate) || 0,
        amount,
        unit_price: Number(form.rate) || 0,
        vo_ref: form.vo_ref,
        vo_date: form.vo_date,
        is_variation_breakdown: false,
        applied_in_period: amount,
        source: 'manual',
        source_date: form.vo_date,
        is_manual: true,
        dispute_status: 'none',
        original_amount: amount,
        agreed_amount: amount,
        sort_order: 999,
      });
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', afp.id] });
      onCreated && onCreated(form.vo_ref);
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create variation');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up sm:animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Add Variation</h3>
              <p className="text-xs text-slate-400">Create a new variation summary line for this AFP</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}
          {/* Ref + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Variation Ref</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={form.vo_ref}
                  onChange={e => setForm(p => ({ ...p, vo_ref: e.target.value.toUpperCase() }))}
                  placeholder={suggestedRef}
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:border-violet-400"
                />
                <button
                  onClick={() => setForm(p => ({ ...p, vo_ref: suggestedRef }))}
                  className="px-2.5 py-2.5 bg-violet-50 text-violet-600 rounded-lg text-xs font-bold hover:bg-violet-100 transition"
                  title="Use suggested ref"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Date Instructed</label>
              <input
                type="date"
                value={form.vo_date}
                onChange={e => setForm(p => ({ ...p, vo_date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Additional borehole BH-04 — rotary core to 25m"
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>
          {/* Unit / Qty / Rate */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="nr"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Qty</label>
              <input
                type="number"
                value={form.qty}
                onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1 block">Rate (£)</label>
              <input
                type="number"
                value={form.rate}
                onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
          {/* Amount preview */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-violet-50 rounded-lg">
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Variation Total</span>
            <span className="text-lg font-extrabold text-violet-700 tabular-nums">{fmt(amount)}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            The breakdown tab for this ref will be created empty — you can fill in the component lines later.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.vo_ref || !form.description}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold transition active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
            Create Variation
          </button>
        </div>
      </div>
    </div>
  );
}