import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Search, Plus, Check, ShoppingCart, Loader2, Package, Wrench, Users,
  ChevronDown, ChevronRight, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { differenceInCalendarDays } from 'date-fns';
import { SharedFieldsBar, ItemRowFields, PriceDiscrepancyBadge } from './WizardFields';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  plant: { label: 'Plant & Equipment', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  materials: { label: 'Materials & Consumables', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  labour: { label: 'Labour', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

const CATEGORY_MAP = {
  purchased: 'purchased_equipment',
  hired: 'hired_equipment',
  client_supplied: 'client_supplied',
};

/**
 * MultiItemBasket — the entry screen for the Multiple Items path.
 * Two modes:
 *  - method='manual': repeating add-a-row form. Each row is a manual line item.
 *  - method='rate_cards': multi-select rate card catalogue with search, grouped
 *    by category, with per-item qty + dates inline (same as the legacy basket).
 *
 * Shared PO (Purchased) or Supplier (Hired) bar at the top applies to all rows.
 * Smart-upload rows are injected as pre-filled manual rows (and pre-ticked rate
 * card selections in the rate card path).
 *
 * Props:
 *  - jobId, job, source, method
 *  - rateCardItems, suppliers
 *  - jobStart, jobEnd
 *  - uploadRows: rows from smart quote upload (optional)
 *  - onClose
 */
export default function MultiItemBasket({
  jobId, job, source, method, rateCardItems = [], suppliers = [],
  jobStart = '', jobEnd = '', uploadRows = [], onClose,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isClient = source === 'client_supplied';
  const isHired = source === 'hired';
  const isRateCard = method === 'rate_cards';

  const [poNumber, setPoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [committing, setCommitting] = useState(false);

  // --- Manual mode state ---
  const [manualRows, setManualRows] = useState(() => {
    if (uploadRows.length > 0) {
      return uploadRows.map(r => ({
        temp_id: r.temp_id,
        description: r.description,
        qty: String(r.quantity || 1),
        unit_cost: String(r.unit_price || 0),
        unit_label: 'each',
        start_date: jobStart,
        end_date: jobEnd,
        supplied_by: '',
        matched_rate_card_item_id: r.matched_rate_card_item_id || '',
        rate_card_price: r.rate_card_price,
        price_differs: r.price_differs,
      }));
    }
    return [{ temp_id: 'm1', description: '', qty: '1', unit_cost: '', unit_label: 'each', start_date: jobStart, end_date: jobEnd, supplied_by: '' }];
  });

  // --- Rate card mode state ---
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => {
    if (isRateCard && uploadRows.length > 0) {
      const matched = new Set(uploadRows.filter(r => r.matched_rate_card_item_id).map(r => r.matched_rate_card_item_id));
      return matched;
    }
    return new Set();
  });
  const [itemStates, setItemStates] = useState(() => {
    if (isRateCard && uploadRows.length > 0) {
      const states = {};
      uploadRows.forEach(r => {
        if (r.matched_rate_card_item_id) {
          states[r.matched_rate_card_item_id] = {
            qty: String(r.quantity || 1),
            unit_cost: String(r.unit_price || ''),
            unit_label: 'each',
            start_date: jobStart,
            end_date: jobEnd,
            price_differs: r.price_differs,
            rate_card_price: r.rate_card_price,
          };
        }
      });
      return states;
    }
    return {};
  });
  const [collapsedCats, setCollapsedCats] = useState({});

  // --- Manual helpers ---
  const addManualRow = () => setManualRows(prev => [...prev, { temp_id: `m${prev.length + 1}_${Date.now()}`, description: '', qty: '1', unit_cost: '', unit_label: 'each', start_date: jobStart, end_date: jobEnd, supplied_by: '' }]);
  const updateManualRow = (id, field, value) => setManualRows(prev => prev.map(r => r.temp_id === id ? { ...r, [field]: value } : r));
  const removeManualRow = (id) => setManualRows(prev => prev.filter(r => r.temp_id !== id));

  // --- Rate card helpers ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateCardItems;
    return rateCardItems.filter(r => r.description?.toLowerCase().includes(q) || r.sor_ref?.toLowerCase().includes(q) || r.subcategory?.toLowerCase().includes(q));
  }, [rateCardItems, search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(r => { const cat = r.category || 'materials'; if (!groups[cat]) groups[cat] = []; groups[cat].push(r); });
    Object.keys(groups).forEach(cat => groups[cat].sort((a, b) => (a.subcategory || '').localeCompare(b.subcategory || '') || (a.description || '').localeCompare(b.description || '')));
    return groups;
  }, [filtered]);

  const toggleItem = (r) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id);
      else {
        next.add(r.id);
        setItemStates(prev => ({ ...prev, [r.id]: { qty: '1', unit_cost: String(r.price ?? ''), unit_label: r.unit || 'each', start_date: isHired ? jobStart : '', end_date: isHired ? jobEnd : '' } }));
      }
      return next;
    });
  };
  const updateItemState = (id, field, value) => setItemStates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  const removeItem = (id) => { setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); setItemStates(prev => { const n = { ...prev }; delete n[id]; return n; }); };

  // --- Totals ---
  const basketTotal = useMemo(() => {
    if (isClient) return 0;
    if (!isRateCard) {
      return manualRows.reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unit_cost) || 0), 0);
    }
    return (rateCardItems.filter(r => selectedIds.has(r.id))).reduce((sum, r) => {
      const st = itemStates[r.id] || {};
      const qty = Number(st.qty) || 0;
      const cost = Number(st.unit_cost) || 0;
      if (st.unit_label === 'day' && st.start_date && st.end_date) {
        const days = differenceInCalendarDays(new Date(st.end_date + 'T00:00:00'), new Date(st.start_date + 'T00:00:00')) + 1;
        return sum + (qty * cost * Math.max(days, 0));
      }
      return sum + (qty * cost);
    }, 0);
  }, [isClient, isRateCard, manualRows, rateCardItems, selectedIds, itemStates]);

  const itemCount = isRateCard ? selectedIds.size : manualRows.filter(r => r.description.trim()).length;

  const handleCommit = async () => {
    if (itemCount === 0) return;
    if (source === 'purchased' && !poNumber.trim()) { toast({ title: 'Shared PO number required', variant: 'destructive' }); return; }
    if (source === 'hired' && !supplierId) { toast({ title: 'Supplier required', variant: 'destructive' }); return; }
    setCommitting(true);
    try {
      let payloads = [];
      if (isRateCard) {
        payloads = rateCardItems.filter(r => selectedIds.has(r.id)).map(r => {
          const st = itemStates[r.id] || {};
          const qty = Number(st.qty) || 1;
          const cost = Number(st.unit_cost) || 0;
          const isDayRate = (st.unit_label || r.unit) === 'day';
          let effectiveQty = qty;
          if (isDayRate && st.start_date && st.end_date) {
            const days = differenceInCalendarDays(new Date(st.end_date + 'T00:00:00'), new Date(st.start_date + 'T00:00:00')) + 1;
            if (days > 0) effectiveQty = qty * days;
          }
          return {
            job_id: jobId,
            category: CATEGORY_MAP[source],
            rate_card_item_id: r.id,
            description: r.description,
            reference_number: r.sor_ref || '',
            po_number: source === 'purchased' ? poNumber : '',
            supplier_id: source === 'hired' ? supplierId : '',
            start_date: isHired ? (st.start_date || null) : null,
            end_date: isHired ? (st.end_date || null) : null,
            unit_cost: cost,
            quantity: effectiveQty,
            unit_label: st.unit_label || r.unit || 'each',
            vat_exempt: false,
            hire_status: 'active',
            current_location: 'yard',
            notes: '',
          };
        });
      } else {
        payloads = manualRows.filter(r => r.description.trim()).map(r => ({
          job_id: jobId,
          category: CATEGORY_MAP[source],
          description: r.description,
          rate_card_item_id: r.matched_rate_card_item_id || '',
          reference_number: '',
          po_number: source === 'purchased' ? poNumber : '',
          supplier_id: source === 'hired' ? supplierId : '',
          start_date: isHired ? (r.start_date || null) : null,
          end_date: isHired ? (r.end_date || null) : null,
          unit_cost: isClient ? 0 : (Number(r.unit_cost) || 0),
          quantity: Number(r.qty) || 1,
          unit_label: r.unit_label || 'each',
          vat_exempt: isClient,
          hire_status: 'active',
          current_location: isClient ? 'site' : 'yard',
          notes: isClient ? `Supplied by: ${r.supplied_by || '—'}` : '',
        }));
      }

      await base44.entities.JobCostItem.bulkCreate(payloads);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${payloads.length} item${payloads.length !== 1 ? 's' : ''}`, description: isClient ? 'Client supplied · no cost' : (poNumber ? `PO ${poNumber} · ${fmt(basketTotal)}` : fmt(basketTotal)) });
      onClose();
    } catch (err) {
      console.error('Basket commit failed:', err);
      toast({ title: 'Error', description: 'Could not add items. Please try again.', variant: 'destructive' });
    }
    setCommitting(false);
  };

  const toggleCat = (cat) => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SharedFieldsBar source={source} poNumber={poNumber} setPoNumber={setPoNumber} supplierId={supplierId} setSupplierId={setSupplierId} suppliers={suppliers} />

      {/* Rate card mode: search + catalogue */}
      {isRateCard && (
        <>
          <div className="px-5 py-3 border-b border-slate-200/80 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rate card…" className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" autoFocus />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No items match.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([cat, items]) => {
                  const meta = CATEGORY_META[cat] || CATEGORY_META.materials;
                  const Icon = meta.icon;
                  const isCollapsed = collapsedCats[cat];
                  return (
                    <div key={cat}>
                      <button type="button" onClick={() => toggleCat(cat)} className="w-full flex items-center gap-2 mb-2 group">
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <div className={`w-6 h-6 rounded-lg ${meta.bg} flex items-center justify-center`}><Icon className={`w-3.5 h-3.5 ${meta.color}`} /></div>
                        <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                        <span className="text-xs text-slate-400">({items.length})</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-1.5">
                          {items.map(r => {
                            const isSelected = selectedIds.has(r.id);
                            const st = itemStates[r.id] || {};
                            return (
                              <div key={r.id} className={`rounded-xl border transition ${isSelected ? 'border-[#2E5A1A]/40 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                <div className="flex items-start gap-2.5 p-2.5">
                                  <button type="button" onClick={() => toggleItem(r)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${isSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'bg-white border-slate-300 hover:border-slate-400'}`}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 leading-tight">{r.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs font-bold text-slate-700">{r.price != null ? fmt(r.price) : (r.price_text || 'POA')}</span>
                                      <span className="text-[10px] text-slate-400">/ {r.unit || 'each'}</span>
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-200/60 bg-slate-50/50 rounded-b-xl">
                                    <ItemRowFields source={source} state={st} onChange={(f, v) => updateItemState(r.id, f, v)} jobStart={jobStart} jobEnd={jobEnd} />
                                    {st.price_differs && st.rate_card_price != null && (
                                      <div className="mt-2">
                                        <PriceDiscrepancyBadge
                                          row={{ rate_card_price: st.rate_card_price, unit_price: Number(st.unit_cost) || 0 }}
                                          onAccept={() => updateItemState(r.id, 'unit_cost', String(st.rate_card_price))}
                                          onRectify={async () => {
                                            try {
                                              await base44.entities.RateCardItem.update(r.id, { price: Number(st.unit_cost) });
                                              toast({ title: 'Rate card updated', description: `${r.description} → ${fmt(Number(st.unit_cost))}` });
                                            } catch (e) { toast({ title: 'Update failed', variant: 'destructive' }); }
                                          }}
                                          onQuery={async () => {
                                            try {
                                              await base44.entities.RateCardItem.update(r.id, {
                                                price_query_pending: true,
                                                price_query_note: `Quote price ${fmt(Number(st.unit_cost))} differs from rate card ${fmt(st.rate_card_price)}`,
                                                price_query_quote_price: Number(st.unit_cost),
                                                price_query_raised_at: new Date().toISOString(),
                                              });
                                              toast({ title: 'Query raised', description: 'Flagged in the rate card manager.' });
                                            } catch (e) { toast({ title: 'Query failed', variant: 'destructive' }); }
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Manual mode: repeating rows */}
      {!isRateCard && (
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-2.5">
          {manualRows.map((row, idx) => (
            <div key={row.temp_id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 animate-slide-up">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-slate-400 mt-2">#{idx + 1}</span>
                <input
                  type="text"
                  value={row.description}
                  onChange={e => updateManualRow(row.temp_id, 'description', e.target.value)}
                  placeholder="Item description"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
                />
                {manualRows.length > 1 && (
                  <button onClick={() => removeManualRow(row.temp_id)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ItemRowFields source={source} state={row} onChange={(f, v) => updateManualRow(row.temp_id, f, v)} jobStart={jobStart} jobEnd={jobEnd} />
              {row.price_differs && row.rate_card_price != null && (
                <PriceDiscrepancyBadge
                  row={{ rate_card_price: row.rate_card_price, unit_price: Number(row.unit_cost) || 0 }}
                  onAccept={() => updateManualRow(row.temp_id, 'unit_cost', String(row.rate_card_price))}
                  onRectify={async () => {
                    try {
                      await base44.entities.RateCardItem.update(row.matched_rate_card_item_id, { price: Number(row.unit_cost) });
                      toast({ title: 'Rate card updated', description: `${row.description} → ${fmt(Number(row.unit_cost))}` });
                    } catch (e) { toast({ title: 'Update failed', variant: 'destructive' }); }
                  }}
                  onQuery={async () => {
                    try {
                      await base44.entities.RateCardItem.update(row.matched_rate_card_item_id, {
                        price_query_pending: true,
                        price_query_note: `Quote price ${fmt(Number(row.unit_cost))} differs from rate card ${fmt(row.rate_card_price)}`,
                        price_query_quote_price: Number(row.unit_cost),
                        price_query_raised_at: new Date().toISOString(),
                      });
                      toast({ title: 'Query raised', description: 'Flagged in the rate card manager.' });
                    } catch (e) { toast({ title: 'Query failed', variant: 'destructive' }); }
                  }}
                />
              )}
            </div>
          ))}
          <button type="button" onClick={addManualRow} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#2E5A1A]/40 hover:text-[#2E5A1A] text-sm font-semibold transition flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Add another row
          </button>
        </div>
      )}

      {/* Basket tray */}
      {itemCount > 0 && (
        <div className="border-t border-slate-200/80 bg-white px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-[#2E5A1A]" /></div>
              <div>
                <p className="text-sm font-bold text-slate-900">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
                <p className="text-[11px] text-slate-500">
                  {source === 'purchased' && poNumber ? `PO: ${poNumber} · ` : ''}
                  {source === 'hired' && supplierId ? `Supplier set · ` : ''}
                  {isClient ? 'Client supplied · no cost' : <>Est. total: <span className="font-bold text-slate-700">{fmt(basketTotal)}</span></>}
                </p>
              </div>
            </div>
            <button type="button" onClick={handleCommit} disabled={committing} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] active:scale-95 transition disabled:opacity-50 flex-shrink-0">
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {committing ? 'Adding…' : `Add ${itemCount} Item${itemCount !== 1 ? 's' : ''}`}
            </button>
          </div>
          {isRateCard && (
            <div className="flex flex-wrap gap-1.5">
              {rateCardItems.filter(r => selectedIds.has(r.id)).map(r => (
                <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                  <span className="truncate max-w-[120px]">{r.description}</span>
                  <button onClick={() => removeItem(r.id)} className="hover:text-red-500 transition"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}