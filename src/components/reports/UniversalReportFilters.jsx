import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Download, FileText, Loader2, Users, Briefcase, Tag } from 'lucide-react';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'Last Year' },
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
  if (preset === 'year') {
    const now = new Date();
    const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
    return { from: from.toISOString().slice(0, 10), to: today };
  }
  return { from: '', to: '' };
}

/**
 * Universal report filter bar — date presets, division, team, client,
 * job type, and CSV + PDF export buttons. All filter state lives in
 * one object: { datePreset, dateFrom, dateTo, divisionId, teamId, clientId, jobTypeId }.
 */
export default function UniversalReportFilters({ filters, setFilters, onExportCsv, onExportPdf, exporting, hubLabel }) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['report-filter-teams', filters.divisionId],
    queryFn: () => base44.entities.Team.filter(
      filters.divisionId ? { division_id: filters.divisionId } : {},
      '-created_date', 200
    ),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['report-filter-clients', filters.divisionId],
    queryFn: () => base44.entities.Client.filter(
      filters.divisionId ? { division_id: filters.divisionId } : {},
      '-created_date', 200
    ),
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['report-filter-jobtypes'],
    queryFn: () => base44.entities.JobType.list('-created_date', 100),
  });

  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

  const applyPreset = (preset) => {
    if (preset === 'custom') { set('datePreset', 'custom'); return; }
    const { from, to } = presetToRange(preset);
    setFilters(prev => ({ ...prev, datePreset: preset, dateFrom: from, dateTo: to }));
  };

  // When division changes, reset team + client
  const onDivisionChange = (val) => {
    setFilters(prev => ({ ...prev, divisionId: val, teamId: '', clientId: '' }));
  };

  const selectCls = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-[#2E5A1A] outline-none min-w-[110px] sm:min-w-[130px] bg-white flex-1 sm:flex-none';

  return (
    <div className="insight-card rounded-2xl p-4 space-y-3">
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
              className={`h-9 px-3 rounded-lg text-ui-caption font-semibold transition ${filters.datePreset === p.id ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {filters.datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={filters.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-[#2E5A1A] outline-none" />
            <span className="text-slate-400 text-ui-caption">to</span>
            <input type="date" value={filters.dateTo || ''} onChange={e => set('dateTo', e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-ui-body font-medium text-slate-900 focus:border-[#2E5A1A] outline-none" />
          </div>
        )}
      </div>

      {/* Dimension filters row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
        {/* Division */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
          <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select value={filters.divisionId || ''} onChange={e => onDivisionChange(e.target.value)} className={selectCls}>
            <option value="">All Streams</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Team */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select value={filters.teamId || ''} onChange={e => set('teamId', e.target.value)} className={selectCls}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Client */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
          <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select value={filters.clientId || ''} onChange={e => set('clientId', e.target.value)} className={selectCls}>
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Job Type */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-none min-w-0">
          <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select value={filters.jobTypeId || ''} onChange={e => set('jobTypeId', e.target.value)} className={selectCls}>
            <option value="">All Job Types</option>
            {jobTypes.map(jt => <option key={jt.id} value={jt.key || jt.id}>{jt.label || jt.name || jt.key}</option>)}
          </select>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
          <button onClick={onExportCsv} disabled={exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-ui-caption font-semibold transition disabled:opacity-50 flex-1 sm:flex-none justify-center">
            {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} CSV
          </button>
          <button onClick={onExportPdf} disabled={exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] hover:bg-[#244715] text-white text-ui-caption font-semibold transition disabled:opacity-50 shadow-sm flex-1 sm:flex-none justify-center">
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </button>
        </div>
      </div>
    </div>
  );
}