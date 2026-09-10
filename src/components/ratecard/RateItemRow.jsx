import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Pencil, Check, X, Copy, Trash2, Loader2, Users, PoundSterling,
  AlertTriangle, Calendar,
} from 'lucide-react';

// Safe formatter — guards against null/undefined/NaN (unlike the old version
// that used `n || 0` and showed £0.00 for non-numeric prices).
export const fmt = (n) => {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] transition";

/**
 * RateItemRow — a single rate card line item.
 * Redesigned with clean visual hierarchy:
 *  - Desktop: aligned columns (description | unit | cost | charge | margin | edit)
 *  - Mobile: stacked card with labelled amounts
 *  - Edit mode: clean 2-column form with grouped actions
 */
export default function RateItemRow({ item, onUpdate, viewMode = 'chargeable' }) {
  const showCost = viewMode === 'internal';
  const showCharge = viewMode === 'chargeable';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    description: item.description || '',
    price: item.price ?? '',
    price_text: item.price_text ?? '',
    cost_price: item.cost_price ?? '',
    unit: item.unit ?? '',
    men: item.men ?? '',
    notes: item.notes ?? '',
    effective_date: item.effective_date ?? '',
    expiry_date: item.expiry_date ?? '',
    is_active: item.is_active !== false,
  });

  // Calculated daily charge-out: if the item has men (e.g. 2-man crew), daily rate = price × men
  const hasNumericPrice = item.price != null && !isNaN(Number(item.price)) && Number(item.price) > 0;
  const hasCost = item.cost_price != null && !isNaN(Number(item.cost_price));
  const dailyCharge = hasNumericPrice && item.men && item.men > 0 ? Number(item.price) * item.men : null;
  const marginPct = hasNumericPrice && hasCost && Number(item.cost_price) > 0
    ? ((Number(item.price) - Number(item.cost_price)) / Number(item.price)) * 100
    : null;
  const isPOA = item.price == null || isNaN(Number(item.price));

  const resetForm = () => setForm({
    description: item.description || '',
    price: item.price ?? '',
    price_text: item.price_text ?? '',
    cost_price: item.cost_price ?? '',
    unit: item.unit ?? '',
    men: item.men ?? '',
    notes: item.notes ?? '',
    effective_date: item.effective_date ?? '',
    expiry_date: item.expiry_date ?? '',
    is_active: item.is_active !== false,
  });

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.RateCardItem.update(item.id, {
        description: form.description,
        price: form.price === '' ? null : Number(form.price),
        price_text: form.price_text || null,
        cost_price: form.cost_price === '' ? null : Number(form.cost_price),
        unit: form.unit || null,
        men: form.men === '' ? null : Number(form.men),
        notes: form.notes || null,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        is_active: form.is_active,
      });
      onUpdate();
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm(`Delete "${item.description}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await base44.entities.RateCardItem.delete(item.id);
      onUpdate();
    } catch (e) { console.error(e); }
    setDeleting(false);
  };

  const duplicate = async () => {
    try {
      await base44.entities.RateCardItem.create({
        category: item.category,
        division_id: item.division_id,
        subcategory: item.subcategory || null,
        description: `${item.description} (copy)`,
        price: item.price ?? null,
        price_text: item.price_text || null,
        cost_price: item.cost_price ?? null,
        unit: item.unit || null,
        men: item.men ?? null,
        notes: item.notes || null,
        rate_card_source: item.rate_card_source || 'our_company',
        supplier_id: item.supplier_id || null,
        is_active: true,
      });
      onUpdate();
      setEditing(false);
    } catch (e) { console.error(e); }
  };

  // ── Edit mode ──
  if (editing) {
    return (
      <div className="p-3 bg-slate-50 border-b border-slate-100">
        <div className="space-y-2.5">
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputCls} autoFocus />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-emerald-700 font-semibold block mb-0.5">Charge Out (£)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="text-[10px] text-amber-700 font-semibold block mb-0.5">Internal Cost (£)</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Price text</label>
              <input value={form.price_text} onChange={e => setForm({ ...form, price_text: e.target.value })} className={inputCls} placeholder="POA" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Unit</label>
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="day" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Men</label>
              <input type="number" value={form.men} onChange={e => setForm({ ...form, men: e.target.value })} className={inputCls} placeholder="—" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="—" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Effective from</label>
              <input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Expires on</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded border-slate-300" />
            Active (available for new jobs)
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={duplicate} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button onClick={del} disabled={deleting} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
            </button>
            <button onClick={() => { setEditing(false); resetForm(); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-300 transition">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── View mode ──
  const priceDisplay = isPOA ? (item.price_text || 'POA') : fmt(item.price);
  const costDisplay = hasCost ? fmt(item.cost_price) : '—';

  return (
    <div className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition group">
      {/* Desktop layout — aligned columns */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-2.5">
        {/* Description + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-slate-800 truncate">{item.description}</p>
            {item.is_active === false && (
              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold border border-slate-200">INACTIVE</span>
            )}
            {isPOA && (
              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold border border-amber-300">POA</span>
            )}
            {item.men != null && item.men > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] border border-[#2E5A1A]/20">
                <Users className="w-2.5 h-2.5" /> {item.men}m
              </span>
            )}
            {(item.effective_date || item.expiry_date) && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title={`Effective: ${item.effective_date || 'always'} → ${item.expiry_date || 'no expiry'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {item.effective_date ? item.effective_date.slice(2) : ''}{item.expiry_date ? `→${item.expiry_date.slice(2)}` : ''}
              </span>
            )}
          </div>
          {item.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.notes}</p>}
          {dailyCharge != null && (
            <p className="text-[11px] text-[#2E5A1A] font-semibold mt-0.5 inline-flex items-center gap-1">
              <PoundSterling className="w-3 h-3" /> {fmt(dailyCharge)}/day
              <span className="text-slate-400 font-normal">({fmt(item.price)} × {item.men})</span>
            </p>
          )}
        </div>
        {/* Unit */}
        <span className="text-xs text-slate-400 w-12 text-right flex-shrink-0">{item.unit || '—'}</span>
        {/* Internal cost — only in Internal Costs view */}
        {showCost && (
          <div className="text-right w-24 flex-shrink-0">
            <span className={`text-sm font-semibold tabular-nums block ${hasCost ? 'text-amber-700' : 'text-slate-300'}`}>{costDisplay}</span>
          </div>
        )}
        {/* Charge out — only in Chargeable Rates view */}
        {showCharge && (
          <div className="text-right w-24 flex-shrink-0">
            <span className={`text-sm font-semibold tabular-nums block ${isPOA ? 'text-amber-600 italic' : 'text-slate-900'}`}>{priceDisplay}</span>
          </div>
        )}
        {/* Margin — only in Chargeable Rates view */}
        {showCharge && (
          <div className="text-right w-16 flex-shrink-0">
            {marginPct != null ? (
              <span className={`text-xs font-bold tabular-nums ${marginPct >= 20 ? 'text-emerald-600' : marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                {marginPct.toFixed(0)}%
              </span>
            ) : (
              <span className="text-xs text-slate-300">—</span>
            )}
          </div>
        )}
        {/* Edit button */}
        <button onClick={() => { resetForm(); setEditing(true); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-[#2E5A1A] transition flex-shrink-0">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mobile layout — stacked card */}
      <div className="sm:hidden px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{item.description}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {item.is_active === false && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">INACTIVE</span>}
              {isPOA && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">POA</span>}
              {item.men != null && item.men > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A]">{item.men} men</span>}
              {item.unit && <span className="text-[10px] text-slate-400">/{item.unit}</span>}
            </div>
            {dailyCharge != null && (
              <p className="text-[11px] text-[#2E5A1A] font-semibold mt-1">{fmt(dailyCharge)}/day ({fmt(item.price)} × {item.men})</p>
            )}
          </div>
          <button onClick={() => { resetForm(); setEditing(true); }} className="p-1.5 text-slate-400 hover:text-[#2E5A1A] transition flex-shrink-0">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-4 mt-2 pl-1">
          {showCost && (
            <div>
              <span className="text-[9px] text-amber-600 uppercase font-semibold block">Cost</span>
              <span className={`text-sm font-semibold tabular-nums ${hasCost ? 'text-amber-700' : 'text-slate-300'}`}>{costDisplay}</span>
            </div>
          )}
          {showCharge && (
            <div>
              <span className="text-[9px] text-emerald-600 uppercase font-semibold block">Charge</span>
              <span className={`text-sm font-semibold tabular-nums ${isPOA ? 'text-amber-600 italic' : 'text-slate-900'}`}>{priceDisplay}</span>
            </div>
          )}
          {showCharge && marginPct != null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${marginPct >= 20 ? 'bg-emerald-50 text-emerald-700' : marginPct >= 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
              {marginPct.toFixed(0)}% margin
            </span>
          )}
        </div>
      </div>
    </div>
  );
}