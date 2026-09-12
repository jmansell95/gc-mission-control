import React from 'react';
import {
  Receipt, HardHat, Calendar, FileSpreadsheet, Building2,
} from 'lucide-react';

/**
 * RateCardViewToggle — the top-level view switcher.
 * Redesigned with a clean pill-style toggle and sub-filter row.
 */
export default function RateCardViewToggle({
  activeView, setActiveView,
  activeSource, setActiveSource,
  internalCostItemCount,
  suppliersWithItems, draftSuppliersForYear, items,
  availableYears, activeYear, setActiveYear,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Top-level pill toggle */}
      <div className="flex gap-1.5 p-2.5 border-b border-slate-100">
        <button onClick={() => setActiveView('chargeable')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition flex-1 sm:flex-none justify-center ${activeView === 'chargeable' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          <Receipt className="w-4 h-4" /> Chargeable Rates
        </button>
        <button onClick={() => setActiveView('internal')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition flex-1 sm:flex-none justify-center ${activeView === 'internal' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          <HardHat className="w-4 h-4" /> Internal Costs
          {internalCostItemCount > 0 && <span className={`text-xs ${activeView === 'internal' ? 'text-white/70' : 'text-slate-400'}`}>({internalCostItemCount})</span>}
        </button>
      </div>
      {/* Sub-filter row — only within Chargeable Rates view */}
      {activeView === 'chargeable' && (
        <>
          {availableYears.length > 1 && (
            <div className="px-4 pt-2.5 pb-1 flex items-center gap-2 border-b border-slate-100">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Year:</span>
              <div className="flex gap-1">
                {availableYears.map(yr => (
                  <button key={yr} onClick={() => setActiveYear(yr)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${activeYear === yr ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveSource('standard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeSource === 'standard' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>
              <Receipt className="w-3.5 h-3.5" /> Standard Rates
            </button>
            <button onClick={() => setActiveSource('drilling')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeSource === 'drilling' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Drilling Rates 2026
            </button>
            {draftSuppliersForYear.map(s => (
              <button key={s.id} onClick={() => setActiveSource(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeSource === s.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}>
                <Building2 className="w-3.5 h-3.5" /> {s.name}
                <span className="text-xs text-slate-400">({items.filter(i => i.supplier_id === s.id).length})</span>
              </button>
            ))}
            {suppliersWithItems.length === 0 && draftSuppliersForYear.length === 0 && activeSource === 'standard' && (
              <span className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap self-center">No draft rate cards yet — use "Clone to Draft" to create next year's rates</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}