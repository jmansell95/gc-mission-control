import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Siren, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';

const SEVERITY_TONE = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-50 text-amber-700', high: 'bg-rose-50 text-rose-700', critical: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' };
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function IncidentTimelineTab({ onReportIncident }) {
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['safety-reports-timeline'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 200) });
  const timeline = useMemo(() => {
    const incidents = reports.filter(r => r.report_type === 'incident').map(r => ({ ...r, _sort: r.conducted_at || r.created_date, _type: 'incident' }));
    const failures = reports.filter(r => r.report_type === 'safetyculture_audit' && r.pass_fail === 'fail').map(r => ({ ...r, _sort: r.conducted_at || r.created_date, _type: 'failure' }));
    return [...incidents, ...failures].sort((a, b) => new Date(b._sort || 0) - new Date(a._sort || 0));
  }, [reports]);
  if (isLoading) return <HubLoadingState variant="list" />;
  if (timeline.length === 0) return <HubEmptyState icon={Siren} title="No incidents or failures" description="Safety incidents and failed Mitti audits will appear here in a chronological timeline." action={{ label: 'Report Incident', onClick: onReportIncident }} />;
  return (
    <HubCard icon={Siren} title="Safety Timeline" subtitle="Incidents & failed audits in chronological order" tone="rose"
      action={<button onClick={onReportIncident} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition">Report Incident</button>}>
      <div className="space-y-2">
        {timeline.slice(0, 50).map(item => (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item._type === 'incident' ? 'bg-rose-100' : 'bg-amber-100'}`}>
              {item._type === 'incident' ? <Siren className="w-4 h-4 text-rose-600" /> : <XCircle className="w-4 h-4 text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800 truncate">{item._type === 'incident' ? (item.description?.slice(0, 60) || 'Incident') : (item.audit_title || item.audit_template_name || 'Failed Audit')}</p>{item.severity && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEVERITY_TONE[item.severity] || SEVERITY_TONE.medium}`}>{item.severity.toUpperCase()}</span>}</div>
              <p className="text-xs text-slate-500 mt-0.5">{item.auditor_name || item.reported_by_id || '—'} · {item.job_name || item.site_name || '—'} · {fmtDateTime(item._sort)}</p>
              {item.description && item._type === 'incident' && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </HubCard>
  );
}