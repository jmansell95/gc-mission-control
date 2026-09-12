import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Plus, Loader2, Search, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ItemRowFields, PriceDiscrepancyBadge } from './WizardFields';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_MAP = {
  purchased: 'purchased_equipment',
  hired: 'hired_equipment',
  client_supplied: 'client_supplied',
};

/**
 * SingleItemForm — the entry screen for the Single Item path.
 * Shows a single-item form with only the fields relevant to the chosen source.
 * When method is 'rate_cards', includes a search/pick step for one rate card item
 * before the form. When smart-upload rows are passed in, the first row
 * pre-fills the form.
 *
 * Props:
 *  - jobId, job, source, method
 *  - rateCardItems, suppliers
 *  - jobStart, jobEnd
 *  - prefillRow: optional row from smart upload to pre-fill
 *  - onClose
 */
export default function SingleItemForm({
  jobId, job, source, method, rateCardItems = [], suppliers = [],
  jobStart = '', jobEnd = '', prefillRow = null, onClose,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [pickedRate, setPickedRate] = useState(null);
  const [committing, setCommitting] = useState(false);

  const [desc, setDesc] = useState(prefillRow?.description || '');
  const [state, setState] = useState({
    qty: String(prefillRow?.quantity || 1),
    unit_cost: prefillRow ? String(prefillRow.unit_price || '') : '',
    unit_label: 'each',
    start_date: jobStart,
    end_date: jobEnd,
    supplied_by: '',
    po_number: '',
  });

  const isClient = source === 'client_supplied';
  const isHired = source === 'hired';
  const isRateCard = method === 'rate_cards';

  const filtered = (rateCardItems || []).filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.description?.toLowerCase().includes(q) || r.sor_ref?.toLowerCase().includes(q) || r.subcategory?.toLowerCase().includes(q);
  });

  const pickRate = (r) => {
    setPickedRate(r);
    setDesc(r.description);
    setState(s => ({
      ...s,
      unit_cost: String(r.price ?? ''),
      unit_label: r.unit || 'each',
    }));
  };

  const onChange = (field, value) => setState(s => ({ ...s, [field]: value }));

  const lineTotal = (() => {
    const qty = Number(state.qty) || 0;
    const cost = isClient ? 0 : (Number(state.unit_cost) || 0);
    return qty * cost;
  })();

  const handleCommit = async () => {
    if (!desc.trim()) { toast({ title: 'Description required', variant: 'destructive' }); return; }
    if (source === 'purchased' && !state.po_number.trim()) { toast({ title: 'PO number required', variant: 'destructive' }); return; }
    if (source === 'hired' && !state.supplier_id) { toast({ title: 'Supplier required', variant: 'destructive' }); return; }
    setCommitting(true);
    try {
      const payload = {
        job_id: jobId,
        category: CATEGORY_MAP[source],
        description: desc,
        rate_card_item_id: pickedRate?.id || '',
        reference_number: pickedRate?.sor_ref || '',
        po_number: source === 'purchased' ? state.po_number : '',
        supplier_id: source === 'hired' ? state.supplier_id : '',
        start_date: isHired ? (state.start_date || null) : null,
        end_date: isHired ? (state.end_date || null) : null,
        unit_cost: isClient ? 0 : (Number(state.unit_cost) || 0),
        quantity: Number(state.qty) || 1,
        unit_label: state.unit_label || 'each',
        vat_exempt: isClient,
        hire_status: 'active',
        current_location: isClient ? 'site' : 'yard',
        notes: isClient ? `Supplied by: ${state.supplied_by || '—'}` : '',
      };
      await base44.entities.JobCostItem.create(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: 'Item added', description: `${desc} · ${isClient ? 'Client supplied' : fmt(lineTotal)}` });
      onClose();
    } catch (err) {
      console.error('Single item commit failed:', err);
      toast({ title: 'Error', description: 'Could not add item. Please try again.', variant: 'destructive' });
    }
    setCommitting(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Rate card picker (when method is rate_cards and not yet picked) */}
      {isRateCard && !pickedRate && (
        <>
          <div className="px-5 py-3 border-b border-slate-200/80 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rate card…"
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-1.5">
            {filtered.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRate(r)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5 p-2.5 transition"
              >
                <p className="text-sm font-semibold text-slate-900">{r.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-slate-700">{r.price != null ? fmt(r.price) : (r.price_text || 'POA')}</span>
                  <span className="text-[10px] text-slate-400">/ {r.unit || 'each'}</span>
                  {r.sor_ref && <span className="text-[10px] text-slate-400">· {r.sor_ref}</span>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center py-6 text-slate-400 text-sm">No items match.</p>}
          </div>
        </>
      )}

      {/* Item form (manual always, or rate card after pick) */}
      {(pickedRate || !isRateCard) && (
        <>
          {isRateCard && pickedRate && (
            <div className="px-5 py-2 border-b border-slate-200/80 bg-emerald-50/50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> {pickedRate.description}</span>
              <button onClick={() => { setPickedRate(null); setDesc(''); }} className="text-xs text-slate-500 hover:text-slate-700">Change</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={isRateCard && !!pickedRate}
                placeholder="Item description"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
              />
            </div>
            {source === 'purchased' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">PO Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={state.po_number}
                  onChange={e => onChange('po_number', e.target.value)}
                  placeholder="PO-2026-001"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
            {source === 'hired' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Supplier <span className="text-rose-500">*</span></label>
                <select
                  value={state.supplier_id || ''}
                  onChange={e => onChange('supplier_id', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Select supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <ItemRowFields source={source} state={state} onChange={onChange} jobStart={jobStart} jobEnd={jobEnd} />
            {prefillRow?.price_differs && prefillRow?.rate_card_price != null && (
              <PriceDiscrepancyBadge
                row={prefillRow}
                onAccept={() => onChange('unit_cost', String(prefillRow.rate_card_price))}
                onRectify={async () => {
                  try {
                    await base44.entities.RateCardItem.update(prefillRow.matched_rate_card_item_id, { price: prefillRow.unit_price });
                    toast({ title: 'Rate card updated', description: `${prefillRow.description} → ${fmt(prefillRow.unit_price)}` });
                    onChange('unit_cost', String(prefillRow.unit_price));
                  } catch (e) { toast({ title: 'Update failed', variant: 'destructive' }); }
                }}
                onQuery={async () => {
                  try {
                    await base44.entities.RateCardItem.update(prefillRow.matched_rate_card_item_id, {
                      price_query_pending: true,
                      price_query_note: `Quote price ${fmt(prefillRow.unit_price)} differs from rate card ${fmt(prefillRow.rate_card_price)}`,
                      price_query_quote_price: prefillRow.unit_price,
                      price_query_raised_at: new Date().toISOString(),
                    });
                    toast({ title: 'Query raised', description: 'Flagged in the rate card manager for follow-up.' });
                  } catch (e) { toast({ title: 'Query failed', variant: 'destructive' }); }
                }}
              />
            )}
          </div>
          <div className="border-t border-slate-200/80 bg-white px-5 py-3 flex items-center justify-between flex-shrink-0">
            <div className="text-sm">
              <span className="text-slate-500">Line total: </span>
              <span className="font-bold text-slate-900">{isClient ? 'No cost' : fmt(lineTotal)}</span>
            </div>
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 active:scale-95 transition disabled:opacity-50"
            >
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {committing ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}