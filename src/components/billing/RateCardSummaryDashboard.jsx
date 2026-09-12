import React, { useMemo } from 'react';
import {
  Receipt, TrendingUp, AlertTriangle, FileQuestion, PoundSterling,
  Download, Users, Wrench, Package, Loader2,
} from 'lucide-react';

const fmt = (n) => n != null && !isNaN(n) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

/**
 * Modern summary dashboard for the Master Price List.
 * Shows KPI tiles (total rates, avg margin, POA count, missing costs, total card value)
 * plus category breakdown and CSV export.
 *
 * Props:
 *  - items: all RateCardItem[] for the active rate card
 *  - cardLabel: display name of the active rate card
 *  - isOurCard, isInternalCosts: flags for styling
 */
export default function RateCardSummaryDashboard({ items, cardLabel, isOurCard, isInternalCosts }) {
  const stats = useMemo(() => {
    const withPrice = items.filter(i => i.price != null && i.price > 0);
    const withCost = items.filter(i => i.cost_price != null && i.cost_price > 0);
    const poa = items.filter(i => i.price == null || isNaN(Number(i.price)));
    const missingCost = items.filter(i => (i.cost_price == null || i.cost_price === '') && i.price != null);
    const zeroMargin = withPrice.filter(i => i.cost_price != null && i.cost_price >= i.price);
    const margins = withPrice
      .filter(i => i.cost_price != null && i.cost_price > 0)
      .map(i => ((i.price - i.cost_price) / i.price) * 100);
    const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
    const totalCardValue = withPrice.reduce((s, i) => s + (i.price || 0), 0);
    const totalCostValue = withCost.reduce((s, i) => s + (i.cost_price || 0), 0);

    const byCategory = {
      labour: items.filter(i => i.category === 'labour').length,
      plant: items.filter(i => i.category === 'plant').length,
      materials: items.filter(i => i.category === 'materials').length,
    };

    return {
      total: items.length,
      poa: poa.length,
      missingCost: missingCost.length,
      zeroMargin: zeroMargin.length,
      avgMargin,
      withMargin: margins.length,
      totalCardValue,
      totalCostValue,
      byCategory,
    };
  }, [items]);

  const exportCSV = () => {
    const headers = ['Category', 'Subcategory', 'Description', 'Unit', 'Men', 'Charge Out (£)', 'Internal Cost (£)', 'Margin (%)', 'Price Text', 'Notes', 'Effective Date', 'Expiry Date', 'Active'];
    const rows = items.map(i => {
      const margin = i.price != null && i.cost_price != null && i.cost_price > 0 && i.price > 0
        ? (((i.price - i.cost_price) / i.price) * 100).toFixed(1)
        : '';
      return [
        i.category || '',
        i.subcategory || '',
        `"${(i.description || '').replace(/"/g, '""')}"`,
        i.unit || '',
        i.men ?? '',
        i.price ?? '',
        i.cost_price ?? '',
        margin,
        i.price_text || '',
        `"${(i.notes || '').replace(/"/g, '""')}"`,
        i.effective_date || '',
        i.expiry_date || '',
        i.is_active !== false ? 'Yes' : 'No',
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cardLabel.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const accentColor = isInternalCosts ? 'amber' : isOurCard ? 'emerald' : 'blue';

  return (
    <div className="space-y-3">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="hub-glass rounded-xl p-3 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">Total Rates</p>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.total}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{stats.byCategory.labour}</span>
            <span className="flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5" />{stats.byCategory.plant}</span>
            <span className="flex items-center gap-0.5"><Package className="w-2.5 h-2.5" />{stats.byCategory.materials}</span>
          </div>
        </div>

        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">Avg Margin</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${stats.avgMargin == null ? 'text-slate-300' : stats.avgMargin >= 20 ? 'text-emerald-600' : stats.avgMargin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {stats.avgMargin != null ? `${stats.avgMargin.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.withMargin} items</p>
        </div>

        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileQuestion className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">POA Items</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${stats.poa > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{stats.poa}</p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.poa === 0 ? 'All priced' : 'Need pricing'}</p>
        </div>

        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">Missing Cost</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${stats.missingCost > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{stats.missingCost}</p>
          <p className="text-[10px] text-slate-400 mt-1">No margin data</p>
        </div>

        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <PoundSterling className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">Card Value</p>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{fmt(stats.totalCardValue)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Cost: {fmt(stats.totalCostValue)}</p>
        </div>

        <div className="hub-glass rounded-xl p-3 flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <Download className="w-3.5 h-3.5 text-[#2E5A1A]" />
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide truncate">Export</p>
          </div>
          <button onClick={exportCSV} disabled={items.length === 0}
            className="mt-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* At-risk banner */}
      {stats.zeroMargin > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            <strong>{stats.zeroMargin}</strong> item{stats.zeroMargin !== 1 ? 's' : ''} have zero or negative margin — internal cost is ≥ charge-out price. Review and adjust pricing.
          </p>
        </div>
      )}
    </div>
  );
}