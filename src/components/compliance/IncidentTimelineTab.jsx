import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Siren, XCircle, AlertTriangle, ChevronRight, Flag, Filter, Search,
} from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';

const SEVERITY_TONE = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  critical: 'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-300',
};

const TYPE_TONE = {
  near_miss: 'bg-amber-50 text-amber-700 border-amber-200',
  incident: 'bg-blue-50 text-blue-700 border-blue-200',
  accident: 'bg-rose-50 text-rose-700 border-rose-200',
  dangerous_occurrence: 'bg-red-100 text-red-800 border-red-300',
  environmental: 'bg-teal-50 text-teal-700 border-teal-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPE_LABELS = {
  near_miss: 'Near Miss',
  incident: 'Incident',
  accident: 'Accident',
  dangerous_occurrence: 'Dangerous Occurrence',
  environmental: 'Environmental',
  other: 'Other',
};

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function IncidentTimelineTab({ onReportIncident }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [query, setQuery] = useState('');

  const { data: reports = [], isLoading } = useQuery({ queryKey: ['safety-reports-timeline'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 300) });

  const timeline = useMemo(() => {
    const incidents = reports.filter(r => r.report_type === 'incident').map(r => ({ ...r, _sort: r.conducted_at || r.created_date, _type: 'incident' }));
    const failures = reports.filter(r => r.report_type === 'safetyculture_audit' && r.pass_fail === 'fail').map(r => ({ ...r, _sort: r.conducted_at || r.created_date, _type: 'failure' }));
    return [...incidents, ...failures].sort((a, b) => new Date(b._sort || 0) - new Date(a._sort || 0));
  }, [reports]);

  const filtered = useMemo(() => {
    let list = timeline;
    if (typeFilter !== 'all') {
      if (typeFilter === 'failure') list = list.filter(i => i._type === 'failure');
      else list = list.filter(i => i._type === 'incident' && i.incident_type === typeFilter);
    }
    if (severityFilter !== 'all') list = list.filter(i => i.severity === severityFilter);
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff = null;
      if (dateFilter === '7d') cutoff = new Date(now.getTime() - 7 * 86400000);
      else if (dateFilter === '30d') cutoff = new Date(now.getTime() - 30 * 86400000);
      else if (dateFilter === '90d') cutoff = new Date(now.getTime() - 90 * 86400000);
      if (cutoff) list = list.filter(i => { const d = i._sort; return d && new Date(d) >= cutoff; });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.audit_title || '').toLowerCase().includes(q) ||
        (i.auditor_name || '').toLowerCase().includes(q) ||
        (i.job_name || '').toLowerCase().includes(q) ||
        (i.site_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [timeline, typeFilter, severityFilter, dateFilter, query]);

  if (isLoading) return <HubLoadingState variant="list" />;
  if (timeline.length === 0) return <HubEmptyState icon={Siren} title="No incidents or failures" description="Safety incidents and failed Mitti audits will appear here in a chronological timeline." action={{ label: 'Report Incident', onClick: onReportIncident }} />;

  return (
    <div className="space-y-3">
      <HubCard icon={Siren} title="Safety Timeline" subtitle={`${filtered.length} of ${timeline.length} events · Incidents & failed audits`} tone="rose"
        action={<button onClick={onReportIncident} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition">Report Incident</button>}>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A]">
            <option value="all">All types</option>
            <option value="failure">Failed Audits</option>
            <option value="near_miss">Near Miss</option>
            <option value="incident">Incident</option>
            <option value="accident">Accident</option>
            <option value="dangerous_occurrence">Dangerous Occurrence</option>
            <option value="environmental">Environmental</option>
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A]">
            <option value="all">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A]">
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-2">
              <Filter className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No events match these filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, 60).map(item => {
              const isIncident = item._type === 'incident';
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isIncident ? 'bg-rose-100' : 'bg-amber-100'}`}>
                    {isIncident ? <Siren className="w-4 h-4 text-rose-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate flex-1 min-w-0">
                        {isIncident ? (item.description?.slice(0, 60) || 'Incident') : (item.audit_title || item.audit_template_name || 'Failed Audit')}
                      </p>
                      {/* Type badge */}
                      {isIncident && item.incident_type && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_TONE[item.incident_type] || TYPE_TONE.other}`}>
                          {TYPE_LABELS[item.incident_type] || item.incident_type}
                        </span>
                      )}
                      {/* Severity badge */}
                      {item.severity && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_TONE[item.severity] || SEVERITY_TONE.medium}`}>
                          {item.severity.toUpperCase()}
                        </span>
                      )}
                      {/* RIDDOR badge */}
                      {item.riddor_reportable && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 ${
                          item.riddor_submitted_at
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}>
                          <Flag className="w-2.5 h-2.5" />
                          {item.riddor_submitted_at ? 'RIDDOR Submitted' : 'RIDDOR Pending'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.auditor_name || item.reported_by_id || '—'} · {item.job_name || item.site_name || '—'} · {fmtDateTime(item._sort)}
                    </p>
                    {item.description && isIncident && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HubCard>
    </div>
  );
}