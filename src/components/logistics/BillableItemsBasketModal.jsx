import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Search, Plus, Check, ShoppingCart, Loader2, Package, Wrench, Users,
  ChevronDown, ChevronRight, PoundSterling, Calendar, Hash,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { differenceInCalendarDays } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  plant: { label: 'Plant & Equipment', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  materials: { label: 'Materials & Consumables', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  labour: { label: 'Labour', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

/**
 * BillableItemsBasketModal — multi-select rate card catalogue picker.
 *
 * Replaces the one-item-at-a-time EquipmentForm flow with a basket approach:
 * browse/search the full rate card, tick multiple items, set qty + dates per
 * item, enter one shared PO number, then commit all as separate JobCostItem
 * records in a single bulkCreate call.
 *
 * The PO number becomes the grouping key — the user can reopen the same PO
 * later to add more lines.
 */
export default function BillableItemsBasketModal({
  jobId,
  job,
  rateCardItems = [],
  suppliers = [],
  defaultDates = null,
  onClose,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [itemStates, setItemStates] = useState({});
  const [poNumber, setPoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [committing, setCommitting] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState({});

  const jobStart = defaultDates?.start || job?.start_date || '';
  const jobEnd = defaultDates?.end || job?.end_date || '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateCardItems;
    return rateCardItems.filter(r =>
      r.description?.toLowerCase().includes(q) ||
      r.sor_ref?.toLowerCase().includes(q) ||
      r.subcategory?.toLowerCase().includes(q)
    );
  }, [rateCardItems, search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(r => {
      const cat = r.category || 'materials';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    // Sort items within each group by subcategory then description
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) =>
        (a.subcategory || '').localeCompare(b.subcategory || '') ||
        (a.description || '').localeCompare(b.description || '')
      );
    });
    return groups;
  }, [filtered]);

  const toggleItem = (rateItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(rateItem.id)) {
        next.delete(rateItem.id);
      } else {
        next.add(rateItem.id);
        // Pre-fill item state from rate card defaults
        setItemStates(prev => ({
          ...prev,
          [rateItem.id]: {
            qty: '1',
            start_date: rateItem.unit === 'day' ? jobStart : '',
            end_date: rateItem.unit === 'day' ? jobEnd : '',
            unit_label: rateItem.unit || 'each',
            unit_cost: String(rateItem.price ?? ''),
          },
        }));
      }
      return next;
    });
  };

  const updateItemState = (id, field, value) => {
    setItemStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const removeItem = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setItemStates(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const selectedItems = useMemo(() =>
    rateCardItems.filter(r => selectedIds.has(r.id)),
    [rateCardItems, selectedIds]
  );

  const basketTotal = useMemo(() => {
    return selectedItems.reduce((sum, r) => {
      const state = itemStates[r.id];
      if (!state) return sum;
      const qty = Number(state.qty) || 0;
      const cost = Number(state.unit_cost) || 0;
      if (state.unit_label === 'day' && state.start_date && state.end_date) {
        const days = differenceInCalendarDays(
          new Date(state.end_date + 'T00:00:00'),
          new Date(state.start_date + 'T00:00:00')
        ) + 1;
        return sum + (qty * cost * Math.max(days, 0));
      }
      return sum + (qty * cost);
    }, 0);
  }, [selectedItems, itemStates]);

  const handleCommit = async () => {
    if (selectedItems.length === 0) return;
    setCommitting(true);
    try {
      const payloads = selectedItems.map(r => {
        const state = itemStates[r.id] || {};
        const qty = Number(state.qty) || 1;
        const cost = Number(state.unit_cost) || 0;
        const isDayRate = (state.unit_label || r.unit) === 'day';
        let effectiveQty = qty;
        if (isDayRate && state.start_date && state.end_date) {
          const days = differenceInCalendarDays(
            new Date(state.end_date + 'T00:00:00'),
            new Date(state.start_date + 'T00:00:00')
          ) + 1;
          if (days > 0) effectiveQty = qty * days;
        }
        return {
          job_id: jobId,
          category: r.category === 'labour' ? 'labour' : (r.category === 'plant' ? 'hired_equipment' : 'hired_equipment'),
          supplier_id: supplierId || '',
          rate_card_item_id: r.id,
          description: r.description,
          reference_number: r.sor_ref || '',
          po_number: poNumber || '',
          start_date: state.start_date || null,
          end_date: state.end_date || null,
          unit_cost: cost,
          quantity: effectiveQty,
          unit_label: state.unit_label || r.unit || 'each',
          men: r.men ? Number(r.men) : null,
          vat_exempt: false,
          hire_status: 'active',
          current_location: 'yard',
          notes: r.notes || '',
        };
      });

      await base44.entities.JobCostItem.bulkCreate(payloads);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({
        title: `Added ${payloads.length} item${payloads.length !== 1 ? 's' : ''}`,
        description: poNumber ? `PO ${poNumber} · ${fmt(basketTotal)}` : fmt(basketTotal),
      });
      onClose();
    } catch (err) {
      console.error('Basket commit failed:', err);
      toast({ title: 'Error', description: 'Could not add items. Please try again.', variant: 'destructive' });
    }
    setCommitting(false);
  };

  const toggleCat = (cat) => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 backdrop-blur-md p-3 sm:p-4">
      <div className="hub-glass rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">Add Billable Items</h2>
            <p className="text-xs text-slate-500">Multi-select from the rate card catalogue · one PO for all items</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Shared PO + supplier bar */}
        <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/50 flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Hash className="w-3 h-3" /> Shared PO Number
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={e => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2026-001 (applies to all items)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30 focus:border-[#2E5A1A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Supplier (optional)</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
              >
                <option value="">— No supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-200/80 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rate card by description, SOR ref or section…"
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
              autoFocus
            />
          </div>
        </div>

        {/* Catalogue list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {rateCardItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No rate card items available. Import a rate card in Settings first.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No items match "{search}".</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([cat, items]) => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.materials;
                const Icon = meta.icon;
                const isCollapsed = collapsedCats[cat];
                return (
                  <div key={cat}>
                    <button
                      type="button"
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center gap-2 mb-2 group"
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                      <div className={`w-6 h-6 rounded-lg ${meta.bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{meta.label}</span>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1.5">
                        {items.map(r => {
                          const isSelected = selectedIds.has(r.id);
                          const state = itemStates[r.id] || {};
                          const subLabel = [r.sor_ref, r.subcategory].filter(Boolean).join(' · ');
                          return (
                            <div
                              key={r.id}
                              className={`rounded-xl border transition ${isSelected ? 'border-[#2E5A1A]/40 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                              <div className="flex items-start gap-2.5 p-2.5">
                                <button
                                  type="button"
                                  onClick={() => toggleItem(r)}
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${isSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 leading-tight">{r.description}</p>
                                  {subLabel && <p className="text-[11px] text-slate-400 mt-0.5">{subLabel}</p>}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-bold text-slate-700">
                                      {r.price != null ? fmt(r.price) : (r.price_text || 'POA')}
                                    </span>
                                    <span className="text-[10px] text-slate-400">/ {r.unit || 'each'}</span>
                                    {r.men && <span className="text-[10px] text-slate-400">· {r.men} men</span>}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-200/60 bg-slate-50/50 rounded-b-xl">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Qty</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={state.qty || '1'}
                                        onChange={e => updateItemState(r.id, 'qty', e.target.value)}
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">From</label>
                                      <input
                                        type="date"
                                        value={state.start_date || ''}
                                        onChange={e => updateItemState(r.id, 'start_date', e.target.value)}
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">To</label>
                                      <input
                                        type="date"
                                        value={state.end_date || ''}
                                        onChange={e => updateItemState(r.id, 'end_date', e.target.value)}
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5A1A]/30"
                                      />
                                    </div>
                                  </div>
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

        {/* Basket tray */}
        {selectedItems.length > 0 && (
          <div className="border-t border-slate-200/80 bg-white px-5 py-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-[#2E5A1A]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} in basket</p>
                  <p className="text-[11px] text-slate-500">
                    {poNumber ? `PO: ${poNumber}` : 'No PO set'} · Est. total: <span className="font-bold text-slate-700">{fmt(basketTotal)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] active:scale-95 transition disabled:opacity-50 flex-shrink-0"
              >
                {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {committing ? 'Adding…' : `Add ${selectedItems.length} Item${selectedItems.length !== 1 ? 's' : ''}`}
              </button>
            </div>
            {/* Selected items chips */}
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map(r => (
                <span key={r.id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                  <span className="truncate max-w-[120px]">{r.description}</span>
                  <button onClick={() => removeItem(r.id)} className="hover:text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}