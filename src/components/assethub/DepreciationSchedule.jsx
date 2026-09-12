import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { TrendingDown, Calendar, PoundSterling, Filter, RefreshCw, Loader2, Settings2 } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import { METHOD_META } from '../../../base44/shared/depreciation';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

const METHOD_BADGE = {
  straight_line: 'bg-slate-100 text-slate-600',
  reducing_balance: 'bg-violet-100 text-violet-700',
  units_of_production: 'bg-blue-100 text-blue-700',
};

/**
 * Depreciation schedule table — shows every asset with an acquisition cost
 * and depreciation years, calculating annual depreciation, accumulated
 * depreciation to date, and current book value. Highlights assets due for
 * replacement (book value near salvage or replacement date within 90 days).
 */
export default function DepreciationSchedule() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [methodFilter, setMethodFilter] = useState('all');
  const [recalculating, setRecalculating] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-depreciation'],
    queryFn: () => base44.entities.SiteAsset.list('-acquisition_date', 500),
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await base44.functions.invoke('recalculateDepreciation', {});
      const d = res.data || res;
      toast({ title: `✓ Recalculated ${d.assets_processed || 0} assets` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

  const { rows, totals, dueForReplacement } = useMemo(() => {
    const now = new Date();
    const rows = [];
    let totalAcquisition = 0;
    let totalBookValue = 0;
    let dueCount = 0;

    assets.forEach(a => {
      if (!a.acquisition_cost || !a.acquisition_date) return;
      // Use stored calculated values (from recalculateDepreciation) when available,
      // fall back to straight-line for legacy assets not yet recalculated.
      const method = a.depreciation_method || 'straight_line';
      const annualDep = a.annual_depreciation || ((a.acquisition_cost - (a.salvage_value || 0)) / (a.depreciation_years || 1));
      const accumulatedDep = a.accumulated_depreciation != null
        ? a.accumulated_depreciation
        : Math.min(annualDep * ((now - new Date(a.acquisition_date)) / (365.25 * 86400000)), a.acquisition_cost - (a.salvage_value || 0));
      const bookValue = a.current_book_value != null
        ? a.current_book_value
        : Math.max(a.acquisition_cost - accumulatedDep, a.salvage_value || 0);
      const remainingYears = a.depreciation_years ? Math.max(a.depreciation_years - ((now - new Date(a.acquisition_date)) / (365.25 * 86400000)), 0) : 0;

      totalAcquisition += a.acquisition_cost;
      totalBookValue += bookValue;

      const replacementDate = a.replacement_date ? new Date(a.replacement_date) : null;
      const daysToReplacement = replacementDate ? Math.floor((replacementDate - now) / 86400000) : null;
      const isDue = (bookValue <= (a.salvage_value || 0) + 1) || (daysToReplacement !== null && daysToReplacement <= 90 && daysToReplacement >= -365);

      if (isDue) dueCount++;

      rows.push({
        id: a.id,
        name: a.name,
        type: a.asset_type,
        method,
        acquisitionCost: a.acquisition_cost,
        acquisitionDate: a.acquisition_date,
        depreciationYears: a.depreciation_years,
        annualDep,
        accumulatedDep,
        bookValue,
        remainingYears: Math.round(remainingYears * 10) / 10,
        salvageValue: a.salvage_value || 0,
        replacementDate: a.replacement_date,
        daysToReplacement,
        isDue,
      });
    });

    rows.sort((a, b) => a.bookValue - b.bookValue);

    return { rows, totals: { totalAcquisition, totalBookValue, totalDepreciated: totalAcquisition - totalBookValue }, dueForReplacement: dueCount };
  }, [assets]);

  const filteredRows = useMemo(() => {
    if (methodFilter === 'all') return rows;
    return rows.filter(r => r.method === methodFilter);
  }, [rows, methodFilter]);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <TrendingDown className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">No assets with depreciation data yet.</p>
        <p className="text-xs text-slate-400 mt-1">Set acquisition cost and useful life on assets to see their depreciation schedule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">Acquisition Value</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{gbp(totals.totalAcquisition)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-500">Depreciated</span>
          </div>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{gbp(totals.totalDepreciated)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-500">Current Book Value</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{gbp(totals.totalBookValue)}</p>
        </div>
      </div>

      {dueForReplacement > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{dueForReplacement}</span> asset{dueForReplacement !== 1 ? 's' : ''} due for replacement (book value near salvage or replacement date within 90 days).
          </p>
        </div>
      )}

      {/* Method filter + recalculate */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {[
            { id: 'all', label: 'All Methods' },
            { id: 'straight_line', label: 'Straight-Line' },
            { id: 'reducing_balance', label: 'Reducing Balance' },
            { id: 'units_of_production', label: 'Units of Production' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setMethodFilter(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${methodFilter === opt.id ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/admin', { state: { section: 'settings', settingsTab: 'depreciation-profiles' } })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
            <Settings2 className="w-3.5 h-3.5" /> Configure Profiles
          </button>
          <button onClick={handleRecalculate} disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Recalculate All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-4 py-2.5">Asset</th>
                <th className="px-4 py-2.5 text-center">Method</th>
                <th className="px-4 py-2.5 text-right">Acquired</th>
                <th className="px-4 py-2.5 text-right">Cost</th>
                <th className="px-4 py-2.5 text-right">Annual Dep</th>
                <th className="px-4 py-2.5 text-right">Accumulated</th>
                <th className="px-4 py-2.5 text-right">Book Value</th>
                <th className="px-4 py-2.5 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.map(r => (
                <tr key={r.id} className={`hover:bg-slate-50 transition ${r.isDue ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{r.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{r.type?.replace(/_/g, ' ')}</p>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${METHOD_BADGE[r.method] || 'bg-slate-100 text-slate-600'}`} title={METHOD_META[r.method]?.description}>
                      {METHOD_META[r.method]?.short || r.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    {r.acquisitionDate ? new Date(r.acquisitionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{gbp(r.acquisitionCost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{gbp(r.annualDep)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{gbp(r.accumulatedDep)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{gbp(r.bookValue)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    <span className={r.remainingYears < 1 ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                      {r.remainingYears}y
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}