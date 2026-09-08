import React from 'react';
import { Hash, Truck, UserCheck, Calendar, Upload, Loader2, FileText } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * SharedFieldsBar — the top-of-form bar that renders source-specific shared
 * fields (PO number for Purchased, supplier for Hired) in both the single-item
 * form and the multi-item basket. Keeping this in one place ensures both
 * layouts ask for exactly the same data.
 *
 * Props:
 *  - source: 'purchased' | 'hired' | 'client_supplied'
 *  - poNumber, setPoNumber
 *  - supplierId, setSupplierId
 *  - suppliers: [{ id, name }]
 *  - jobStart, jobEnd
 */
export function SharedFieldsBar({ source, poNumber, setPoNumber, supplierId, setSupplierId, suppliers }) {
  if (source === 'purchased') {
    return (
      <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/50 flex-shrink-0">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <Hash className="w-3 h-3" /> Shared PO Number <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={poNumber}
          onChange={e => setPoNumber(e.target.value)}
          placeholder="e.g. PO-2026-001 (applies to all items)"
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30 focus:border-[#2E5A1A]"
        />
      </div>
    );
  }
  if (source === 'hired') {
    return (
      <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/50 flex-shrink-0">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Supplier <span className="text-rose-500">*</span></label>
        <select
          value={supplierId}
          onChange={e => setSupplierId(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
        >
          <option value="">— Select supplier —</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    );
  }
  return null;
}

/**
 * ItemRowFields — the per-item editable fields, varying by source.
 * Renders compactly inline. Used by both the single-item form (one instance)
 * and the multi-item basket (one per row).
 *
 * Props:
 *  - source: 'purchased' | 'hired' | 'client_supplied'
 *  - state: { qty, unit_cost, start_date, end_date, supplied_by, unit_label }
 *  - onChange: (field, value) => void
 *  - jobStart, jobEnd
 */
export function ItemRowFields({ source, state = {}, onChange, jobStart, jobEnd }) {
  const isClient = source === 'client_supplied';
  const isHired = source === 'hired';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Qty</label>
        <input
          type="number"
          min="1"
          step="any"
          value={state.qty ?? '1'}
          onChange={e => onChange('qty', e.target.value)}
          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
        />
      </div>
      {!isClient && (
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Unit Cost (£)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={state.unit_cost ?? ''}
            onChange={e => onChange('unit_cost', e.target.value)}
            placeholder="0.00"
            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
          />
        </div>
      )}
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Unit</label>
        <input
          type="text"
          value={state.unit_label ?? 'each'}
          onChange={e => onChange('unit_label', e.target.value)}
          placeholder="each / day / m"
          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
        />
      </div>
      {isHired && (
        <>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">From</label>
            <input
              type="date"
              value={state.start_date ?? jobStart ?? ''}
              onChange={e => onChange('start_date', e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">To</label>
            <input
              type="date"
              value={state.end_date ?? jobEnd ?? ''}
              onChange={e => onChange('end_date', e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
            />
          </div>
        </>
      )}
      {isClient && (
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Supplied By</label>
          <input
            type="text"
            value={state.supplied_by ?? ''}
            onChange={e => onChange('supplied_by', e.target.value)}
            placeholder="Name of client / company who supplied it"
            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
          />
        </div>
      )}
    </div>
  );
}

/**
 * PriceDiscrepancyBadge — amber badge shown on smart-upload rows where the
 * extracted quote price differs from the matched rate card price.
 * Offers three actions: accept rate, rectify rate, query.
 *
 * Props:
 *  - row: { rate_card_price, unit_price }
 *  - onAccept, onRectify, onQuery
 */
export function PriceDiscrepancyBadge({ row, onAccept, onRectify, onQuery }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold hover:bg-amber-100 transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Price differs · Rate {fmt(row.rate_card_price)} · Quote {fmt(row.unit_price)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 animate-pop-in">
            <button onClick={() => { onAccept(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Accept rate card price</button>
            <button onClick={() => { onRectify(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Rectify rate to quote price</button>
            <button onClick={() => { onQuery(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Query with supplier</button>
          </div>
        </>
      )}
    </div>
  );
}