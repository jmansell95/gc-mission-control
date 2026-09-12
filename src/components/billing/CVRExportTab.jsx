import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Download, FileSpreadsheet, Loader2, Search, CheckCircle2,
  Clock, FileBarChart, ArrowRight,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function csvEscape(val) {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function generateCVRPackCSV(cvrs) {
  const rows = [];
  // ── Portfolio Summary ──
  rows.push('CVR EXPORT PACK — PORTFOLIO SUMMARY');
  rows.push(`Generated,${new Date().toLocaleDateString('en-GB')}`);
  rows.push('');
  rows.push('Job,Client,Contract Value,Forecast Final,Total Cost,Profit/Loss,Margin %');
  let totalContract = 0, totalForecast = 0, totalCost = 0, totalPL = 0;
  for (const entry of cvrs) {
    const cvr = entry.cvr;
    const contract = Number(cvr?.contract_value) || 0;
    const forecast = Number(cvr?.forecast_final_value) || 0;
    const cost = Number(cvr?.total_cost) || 0;
    const pl = Number(cvr?.profit_loss) || 0;
    totalContract += contract; totalForecast += forecast; totalCost += cost; totalPL += pl;
    rows.push([csvEscape(cvr?.job_name || ''), csvEscape(cvr?.client_name || ''), contract, forecast, cost, pl, (cvr?.profit_pct || 0).toFixed(1)].join(','));
  }
  rows.push(['TOTAL', '', totalContract, totalForecast, totalCost, totalPL, totalForecast > 0 ? ((totalPL / totalForecast) * 100).toFixed(1) : '0.0'].join(','));
  rows.push('');
  rows.push('===');
  rows.push('');

  // ── Per-CVR detail ──
  for (const entry of cvrs) {
    const cvr = entry.cvr;
    rows.push(`JOB: ${csvEscape(cvr?.job_name || '')} (Ref: ${csvEscape(cvr?.job_reference || '')})`);
    rows.push(`Client,${csvEscape(cvr?.client_name || '')}`);
    rows.push(`Contract Value,${cvr?.contract_value || 0},Forecast Final,${cvr?.forecast_final_value || 0},Total Cost,${cvr?.total_cost || 0},Profit/Loss,${cvr?.profit_loss || 0},Margin %,${(cvr?.profit_pct || 0).toFixed(1)}`);
    rows.push('');
    // Line items
    rows.push('Line Items:');
    rows.push(['Description', 'Supplier', 'Tender Value', 'Forecast Final', 'Total Cost', 'Profit/Loss', 'Profit %'].join(','));
    for (const li of (entry.line_items || [])) {
      rows.push([csvEscape(li.description), csvEscape(li.supplier || ''), li.tender_value || 0, li.forecast_final_value || 0, li.total_cost || 0, li.profit_loss || 0, (li.profit_pct || 0).toFixed(1)].join(','));
    }
    rows.push('');
    // Variations
    if ((entry.variations || []).length > 0) {
      rows.push('Variations:');
      rows.push(['VO #', 'Description', 'Agreed Value', 'Total Cost', 'Margin'].join(','));
      for (const v of entry.variations) {
        rows.push([v.vo_number, csvEscape(v.description || ''), v.agreed_value || 0, v.total_cost || 0, v.profit_margin || 0].join(','));
      }
      rows.push('');
    }
    // Cash flow
    if ((entry.cash_flow || []).length > 0) {
      rows.push('Cash Flow:');
      rows.push(['Month', 'Description', 'App Value', 'Amount'].join(','));
      for (const cf of entry.cash_flow) {
        rows.push([cf.month_date || '', csvEscape(cf.description || ''), cf.app_value || 0, cf.amount || 0].join(','));
      }
      rows.push('');
    }
    rows.push('---');
    rows.push('');
  }
  return rows.join('\n');
}

/**
 * CVRExportTab — replaces the Invoicing tab. Lets the billing team
 * select jobs and download CVR packs (Excel) for higher management
 * to use in their external payment system. No invoice creation.
 */
export default function CVRExportTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  const { data: cvrs = [], isLoading } = useQuery({
    queryKey: ['cvr-export-list'],
    queryFn: () => base44.entities.CVR.list('-updated_date', 500),
  });

  const filtered = useMemo(() => {
    if (!search) return cvrs;
    const q = search.toLowerCase();
    return cvrs.filter(c =>
      (c.job_name || '').toLowerCase().includes(q) ||
      (c.job_reference || '').toLowerCase().includes(q) ||
      (c.client_name || '').toLowerCase().includes(q)
    );
  }, [cvrs, search]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    setExportResult(null);
    try {
      const res = await base44.functions.invoke('exportCVRPack', {
        cvr_ids: Array.from(selected),
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);

      // Generate CSV client-side from the structured CVR data
      const csv = generateCVRPackCSV(data.cvrs || []);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const fileName = `CVR_Pack_${new Date().toISOString().slice(0, 10)}.csv`;

      setExportResult({
        count: data.count || selected.size,
        file_url: url,
        file_name: fileName,
      });
    } catch (e) {
      console.error(e);
      setExportResult({ error: e.message || 'Export failed' });
    }
    setExporting(false);
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Export bar */}
      <div className="hub-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">CVR Export Hub</p>
            <p className="text-[11px] text-slate-400">Download CVR packs for higher management — invoicing handled externally</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={selected.size === 0 || exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50 glow-brand"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export {selected.size > 0 ? `(${selected.size})` : 'CVR Pack'}
        </button>
      </div>

      {/* Export result */}
      {exportResult && !exportResult.error && (
        <div className="hub-glass rounded-2xl p-3.5 bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">CVR Pack Generated</p>
          </div>
          <p className="text-xs text-emerald-700 mb-2">
            {exportResult.count || selected.size} CVR(s) exported. Download below — send to higher management for payment processing.
          </p>
          {exportResult.file_url && (
            <a
              href={exportResult.file_url}
              download={exportResult.file_name || 'CVR_Pack.xlsx'}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
            >
              <Download className="w-3.5 h-3.5" /> {exportResult.file_name || 'Download CVR Pack'}
            </a>
          )}
        </div>
      )}
      {exportResult?.error && (
        <div className="hub-glass rounded-2xl p-3.5 bg-rose-50 border-rose-200">
          <p className="text-sm font-bold text-rose-800">Export Failed</p>
          <p className="text-xs text-rose-600 mt-1">{exportResult.error}</p>
        </div>
      )}

      {/* Search + select all */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, clients, references…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={selectAll}
          className="px-3 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
        >
          {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* CVR list — Mobile cards */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileBarChart className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">No CVRs available</p>
          <p className="text-xs text-slate-400 mt-1">Push AFPs to CVR from the AFP Builder to generate CVRs for export.</p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-2.5">
            {filtered.map(cvr => {
              const isSelected = selected.has(cvr.id);
              return (
                <div
                  key={cvr.id}
                  onClick={() => toggleSelect(cvr.id)}
                  className={`hub-glass rounded-2xl p-3.5 cursor-pointer transition active:scale-[0.98] ${
                    isSelected ? 'ring-2 ring-primary bg-emerald-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-primary border-primary' : 'border-slate-300'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{cvr.job_name || '—'}</p>
                        {cvr.job_reference && <p className="text-[10px] text-slate-400">{cvr.job_reference}</p>}
                      </div>
                    </div>
                    <span className="font-bold text-emerald-700 text-sm tabular-nums">{fmt(cvr.forecast_final_value || cvr.contract_value || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 pl-7">
                    <span>{cvr.client_name || '—'}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Updated {fmtDate(cvr.last_updated_at || cvr.updated_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hub-glass rounded-2xl overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80">
                  <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-3 py-2.5 font-semibold w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={selectAll}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold">Job</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Client</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Contract</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Forecast</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Profit</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(cvr => {
                    const isSelected = selected.has(cvr.id);
                    return (
                      <tr
                        key={cvr.id}
                        onClick={() => toggleSelect(cvr.id)}
                        className={`hover:bg-emerald-50/30 cursor-pointer transition ${isSelected ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(cvr.id)}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-800 truncate max-w-[200px]">{cvr.job_name || '—'}</p>
                          {cvr.job_reference && <p className="text-[10px] text-slate-400">{cvr.job_reference}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{cvr.client_name || '—'}</td>
                        <td className="text-right px-3 py-2.5 text-slate-700 tabular-nums">{fmt(cvr.contract_value || 0)}</td>
                        <td className="text-right px-3 py-2.5 text-slate-700 tabular-nums">{fmt(cvr.forecast_final_value || 0)}</td>
                        <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${(cvr.profit_loss || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {fmt(cvr.profit_loss || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-[11px]">{fmtDate(cvr.last_updated_at || cvr.updated_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}