import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Check, X, Loader2 } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';

const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary transition";

/**
 * AddRateForm — inline "Add rate" row at the bottom of each subcategory group.
 * Redesigned with a clean collapsed state and a focused expand form.
 */
export default function AddRateForm({ category, subcategory, source, supplierId, onAdded, viewMode = 'chargeable' }) {
  const { activeDivisionId } = useDivision();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', price: '', cost_price: '', unit: 'day', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.RateCardItem.create({
        category,
        division_id: activeDivisionId,
        subcategory: subcategory || null,
        description: form.description.trim(),
        price: form.price === '' ? null : Number(form.price),
        cost_price: form.cost_price === '' ? null : Number(form.cost_price),
        unit: form.unit || null,
        notes: form.notes || null,
        rate_card_source: source,
        supplier_id: supplierId || null,
      });
      setForm({ description: '', price: '', cost_price: '', unit: 'day', notes: '' });
      setOpen(false);
      onAdded();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition border border-dashed border-slate-200 mx-4 my-1" style={{ width: 'calc(100% - 2rem)' }}>
        <Plus className="w-3.5 h-3.5" /> Add rate
      </button>
    );
  }

  return (
    <div className="p-3 bg-slate-50 border-b border-slate-100">
      <div className="space-y-2">
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} autoFocus />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {viewMode === 'chargeable' ? (
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Charge Out £" className={inputCls} />
          ) : (
            <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} placeholder="Internal Cost £" className={inputCls} />
          )}
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Unit (day, hour, m)" className={inputCls} />
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
          </button>
          <button onClick={() => setOpen(false)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300 transition">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}