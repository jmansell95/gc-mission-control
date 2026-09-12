import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Download, Loader2 } from 'lucide-react';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'custom', label: 'Custom' },
];

function quarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), q * 3, 1);
  const to = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function presetToRange(preset) {
  const today = new Date().toISOString().slice(0, 10);
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (preset === 'quarter') return quarterRange();
  return { from: '', to: '' };
}

/**
 * Redesigned filter bar — preset date pills (Today/7d/30d/Quarter/Custom),
 * division scope, and CSV export. Matches the Site Logs preset pattern.
 */
export default function ReportFilterBar({ filters, setFilters, onExport, exporting, hubLabel }) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

  const applyPreset = (preset) => {
    if (preset === 'custom') { set('datePreset', 'custom'); return; }
    const { from, to } = presetToRange(preset);
    setFilters(prev => ({ ...prev, datePreset: preset, dateFrom: from, dateTo: to }));
  };

  return (
    <div className="hub-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-ui-micro font-bold text-slate-400 uppercase tracking-wide">Report Scope</p>
            <p className="text-ui-subheading font-extrabold text-slate-900">{hubLabel}</p>
          </div>
        </div>

        {/* Preset date pills */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={`h-9 px-3 rounded-lg text-ui-caption font-semibold transition ${filters.datePreset === p.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {filters.datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-primary outline-none" />
            <span className="text-slate-400 text-ui-caption">to</span>
            <input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-primary outline-none" />
          </div>
        )}

        {/* Division scope */}
        <select value={filters.divisionId || ''} onChange={e => set('divisionId', e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-primary outline-none min-w-[160px]">
          <option value="">All Business Streams</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <button onClick={onExport} disabled={exporting}
          className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-ui-caption font-semibold transition disabled:opacity-50 flex-shrink-0">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
        </button>
      </div>
    </div>
  );
}