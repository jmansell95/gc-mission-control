import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, Search, Loader2, AlertTriangle, Plus, MapPin, PoundSterling } from 'lucide-react';
import ConsumableUsageModal from '@/components/assetcommand/ConsumableUsageModal';

/**
 * ConsumablesView — stock-level card grid for the Asset Hub consumables tab.
 * Shows each ConsumableStockItem with a colour-coded stock badge (green / amber
 * / red), storage location, unit cost, and a quick "Use Stock" button that
 * opens the ConsumableUsageModal to log usage against a job or repair.
 */
export default function ConsumablesView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showUsage, setShowUsage] = useState(false);

  const { data: consumables = [], isLoading } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.filter({ is_active: true }),
  });

  const filtered = useMemo(() => {
    if (!search) return consumables;
    const q = search.toLowerCase();
    return consumables.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.sku || '').toLowerCase().includes(q) ||
      (c.barcode || '').toLowerCase().includes(q)
    );
  }, [consumables, search]);

  const stockBadge = (item) => {
    const stock = Number(item.current_stock) || 0;
    const min = Number(item.minimum_stock) || 0;
    if (stock <= 0) return { label: 'Out of stock', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' };
    if (min > 0 && stock <= min) return { label: 'Low stock', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'In stock', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  };

  const stats = useMemo(() => {
    const low = consumables.filter(c => {
      const stock = Number(c.current_stock) || 0;
      const min = Number(c.minimum_stock) || 0;
      return min > 0 && stock <= min;
    }).length;
    const out = consumables.filter(c => (Number(c.current_stock) || 0) <= 0).length;
    const totalValue = consumables.reduce((sum, c) => sum + (Number(c.unit_cost) || 0) * (Number(c.current_stock) || 0), 0);
    return { total: consumables.length, low, out, totalValue };
  }, [consumables]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center"><Package className="w-4 h-4 text-blue-700" /></div>
          <div><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.total}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Total Items</p></div>
        </div>
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-700" /></div>
          <div><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.low}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Low Stock</p></div>
        </div>
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-rose-700" /></div>
          <div><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.out}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Out of Stock</p></div>
        </div>
        <div className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center"><PoundSterling className="w-4 h-4 text-emerald-700" /></div>
          <div><p className="text-lg font-bold text-slate-900 tabular-nums">£{stats.totalValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Stock Value</p></div>
        </div>
      </div>

      {/* Search + Use button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search consumables by name, SKU or barcode…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={() => setShowUsage(true)}
          className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition active:scale-95 flex items-center gap-2 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Use Stock
        </button>
      </div>

      {/* Consumable cards */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No consumables found</p>
          <p className="text-xs text-slate-400 mt-1">Add consumable items from Settings → Consumable Stock.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => {
            const badge = stockBadge(item);
            const stock = Number(item.current_stock) || 0;
            const min = Number(item.minimum_stock) || 0;
            const unitCost = Number(item.unit_cost) || 0;
            return (
              <div key={item.id} className="hub-glass rounded-2xl p-4 relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${badge.dot}`} />
                <div className="flex items-start justify-between gap-2 mb-2 mt-1">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                    {item.sku && <p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.sku}</p>}
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                  {item.storage_location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.storage_location}</span>
                  )}
                  <span className="inline-flex items-center gap-1"><PoundSterling className="w-3 h-3" /> {unitCost.toFixed(2)}/{item.unit || 'each'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{stock}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.unit || 'each'}{min > 0 ? ` · min ${min}` : ''}</p>
                  </div>
                  <button
                    onClick={() => setShowUsage(true)}
                    disabled={stock <= 0}
                    className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" /> Use
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Usage modal */}
      {showUsage && (
        <ConsumableUsageModal
          onClose={() => setShowUsage(false)}
          onUsed={() => queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] })}
        />
      )}
    </div>
  );
}