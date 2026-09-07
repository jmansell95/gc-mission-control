import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, CheckCircle2, XCircle, AlertTriangle, FileText, ExternalLink, Loader2 } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function AuditList({ onSelect }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['safety-reports-audit-list'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 200) });
  const filtered = useMemo(() => {
    let list = reports;
    if (filter === 'fail') list = list.filter(r => r.pass_fail === 'fail');
    else if (filter === 'pass') list = list.filter(r => r.pass_fail === 'pass');
    else if (filter === 'actions') list = list.filter(r => (r.action_items || []).length > 0);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r => (r.audit_title || '').toLowerCase().includes(q) || (r.audit_template_name || '').toLowerCase().includes(q) || (r.auditor_name || '').toLowerCase().includes(q) || (r.job_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [reports, filter, query]);
  const chips = [{ key: 'all', label: 'All' }, { key: 'fail', label: 'Failed' }, { key: 'pass', label: 'Passed' }, { key: 'actions', label: 'Has Actions' }];
  if (isLoading) return <HubLoadingState variant="list" />;
  if (reports.length === 0) return <HubEmptyState icon={FileText} title="No audits synced" description="Mitti audits will appear here once the integration is configured and synced." />;
  return (
    <HubCard icon={FileText} title="All Audits" subtitle={`${filtered.length} of ${reports.length} audits`} tone="brand"
      action={<div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A] w-40 sm:w-52" /></div>}>
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {chips.map(c => <button key={c.key} onClick={() => setFilter(c.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${filter === c.key ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c.label}</button>)}
      </div>
      <div className="space-y-2">
        {filtered.slice(0, 50).map(r => {
          const failed = r.pass_fail === 'fail';
          const actionCount = (r.action_items || []).length;
          return (
            <button key={r.id} onClick={() => onSelect(r)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition hover:bg-slate-50/80 ${failed ? 'border-l-4 border-rose-400 bg-rose-50/30' : 'border-l-4 border-transparent'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${failed ? 'bg-rose-100' : r.pass_fail === 'pass' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                {failed ? <XCircle className="w-4 h-4 text-rose-600" /> : r.pass_fail === 'pass' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                <p className="text-xs text-slate-500 truncate">{r.auditor_name || '—'} · {r.job_name || r.site_name || 'No job'} · {fmtDate(r.conducted_at)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.score_percentage != null && <span className="text-xs font-bold tabular-nums text-slate-600">{Math.round(r.score_percentage)}%</span>}
                {actionCount > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />{actionCount}</span>}
                {r.audit_report_url && <a href={r.audit_report_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-emerald-700 hover:underline"><ExternalLink className="w-3.5 h-3.5" /></a>}
              </div>
            </button>
          );
        })}
      </div>
    </HubCard>
  );
}