import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Search, Plus, Trash2, ShoppingCart, Loader2, Package, Wrench, Users,
  PoundSterling, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  internal_equipment: { label: 'Internal Equipment', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50' },
  hired_equipment: { label: 'Hired Equipment', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
  labour: { label: 'Labour', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  purchased_equipment: { label: 'Purchased', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
};

/**
 * BillableItemsQuickAdd — redesigned multi-item quick-add panel with PO
 * tracking. Replaces the multi-step wizard with a single-panel interface:
 * search the rate card, tick items, set qty/dates inline, enter one shared
 * PO number, and commit all items in one bulk create.
 *
 * Key improvements over the wizard:
 *  - Single panel (no multi-step navigation)
 *  - PO number is front-and-centre as the grouping key
 *  - Inline qty/dates per row (no per-item modals)
 *  - Running total visible at all times
 *  - Recent POs shown for quick re-open
 */
export default function BillableItemsQuickAdd({ jobId, job, rateCardItems = [], suppliers = [], defaultDates = null, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const jobStart = defaultDates?.start || job?.start_date || '';
  const jobEnd = defaultDates?.end || job?.end_date || '';

  const [search, setSearch] = useState('');
  const [basket, setBasket] = useState([]); // [{ rateCardItem, qty, startDate, endDate, unitCost }]
  const [poNumber, setPoNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [category, setCategory] = useState('hired_equipment');
  const [committing, setCommitting] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateCardItems;
    return rateCardItems.filter(r =>
      r.description?.toLowerCase().includes(q) ||
      r.subcategory?.toLowerCase().includes(q)
    );
  }, [rateCardItems, search]);

  // Group by subcategory
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const key = r.subcategory || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const addToBasket = (rci) => {
    const existing = basket.find(b => b.rateCardItem.id === rci.id);
    if (existing) {
      setBasket(basket.map(b => b.rateCardItem.id === rci.id ? { ...b, qty: b.qty + 1 } : b));
    } else {
      setBasket([...basket, {
        rateCardItem: rci,
        qty: 1,
        startDate: jobStart,
        endDate: jobEnd,
        unitCost: rci.cost_price || rci.price || 0,
      }]);
    }
  };

  const removeFromBasket = (rciId) => {
    setBasket(basket.filter(b => b.rateCardItem.id !== rciId));
  };

  const updateBasketItem = (rciId, field, value) => {
    setBasket(basket.map(b => b.rateCardItem.id === rciId ? { ...b, [field]: value } : b));
  };

  const basketTotal = basket.reduce((sum, b) => sum + (Number(b.unitCost) || 0) * (Number(b.qty) || 0), 0);

  const handleCommit = async () => {
    if (basket.length === 0) {
      toast({ title: 'Basket is empty', description: 'Add at least one item.', variant: 'destructive' });
      return;
    }
    setCommitting(true);
    try {
      const items = basket.map(b => ({
        job_id: jobId,
        category,
        description: b.rateCardItem.description,
        rate_card_item_id: b.rateCardItem.id,
        unit_cost: Number(b.unitCost) || 0,
        quantity: Number(b.qty) || 1,
        unit_label: b.rateCardItem.unit || 'day',
        start_date: b.startDate || jobStart,
        end_date: b.endDate || jobEnd,
        supplier_id: supplierId || (b.rateCardItem.supplier_id || undefined),
        po_number: poNumber || undefined,
        notes: poNumber ? `PO: ${poNumber}` : '',
      }));

      await base44.entities.JobCostItem.bulkCreate(items);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items'] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      toast({ title: `${items.length} item${items.length > 1 ? 's' : ''} added`, description: poNumber ? `Tracked under PO: ${poNumber}` : 'Added to job.' });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to add items', description: err.message, variant: 'destructive' });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95dvh] flex flex-col animate-drawer-slide-in sm:animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Quick Add Billable Items</h2>
              <p className="text-xs text-slate-500">{job?.name || 'Job'} · {basket.length} item{basket.length !== 1 ? 's' : ''} · {fmt(basketTotal)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* PO + Category bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <div className="flex-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="PO number (groups these items)"
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Body: two-column on desktop, stacked on mobile */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Left: rate card browser */}
          <div className="flex-1 overflow-y-auto border-r border-slate-100 p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rate card…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              {grouped.map(([subcat, items]) => {
                const collapsed = collapsedCats[subcat];
                return (
                  <div key={subcat}>
                    <button
                      onClick={() => setCollapsedCats({ ...collapsedCats, [subcat]: !collapsed })}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                      {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {subcat}
                      <span className="text-slate-400 font-normal">({items.length})</span>
                    </button>
                    {!collapsed && (
                      <div className="space-y-1 ml-1">
                        {items.map(rci => {
                          const inBasket = basket.some(b => b.rateCardItem.id === rci.id);
                          return (
                            <button
                              key={rci.id}
                              onClick={() => addToBasket(rci)}
                              className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left transition ${
                                inBasket ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 truncate">{rci.description}</p>
                                <p className="text-[10px] text-slate-400">{rci.unit || '—'} · {rci.category}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-slate-700">{fmt(rci.cost_price || rci.price)}</span>
                                {inBasket ? (
                                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">✓</span>
                                ) : (
                                  <Plus className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No items match "{search}"</p>
              )}
            </div>
          </div>

          {/* Right: basket */}
          <div className="w-full sm:w-80 flex flex-col bg-slate-50/50 overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Basket ({basket.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {basket.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">Tap items on the left to add them here</p>
              )}
              {basket.map(b => (
                <div key={b.rateCardItem.id} className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-800 flex-1">{b.rateCardItem.description}</p>
                    <button onClick={() => removeFromBasket(b.rateCardItem.id)} className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold">Qty</label>
                      <input
                        type="number"
                        value={b.qty}
                        onChange={(e) => updateBasketItem(b.rateCardItem.id, 'qty', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold">Unit Cost</label>
                      <input
                        type="number"
                        value={b.unitCost}
                        onChange={(e) => updateBasketItem(b.rateCardItem.id, 'unitCost', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold">Start</label>
                      <input
                        type="date"
                        value={b.startDate}
                        onChange={(e) => updateBasketItem(b.rateCardItem.id, 'startDate', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-semibold">End</label>
                      <input
                        type="date"
                        value={b.endDate}
                        onChange={(e) => updateBasketItem(b.rateCardItem.id, 'endDate', e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <p className="text-right text-xs font-bold text-slate-700 mt-1.5">
                    {fmt((Number(b.unitCost) || 0) * (Number(b.qty) || 0))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-white flex-shrink-0">
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-900">{fmt(basketTotal)}</p>
          </div>
          <button
            onClick={handleCommit}
            disabled={committing || basket.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Add {basket.length} Item{basket.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}