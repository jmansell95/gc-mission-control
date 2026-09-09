import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Plus, X, Loader2, ShieldAlert, CheckCircle2, Clock,
  Flag, MapPin, ChevronRight,
} from 'lucide-react';
import IncidentAutoAnalysis from '@/components/safety/IncidentAutoAnalysis';
import HubCard from '@/components/hubs/HubCard';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import HubEmptyState from '@/components/hubs/HubEmptyState';

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const INCIDENT_TYPES = [
  { val: 'near_miss', label: 'Near Miss' },
  { val: 'incident', label: 'Incident' },
  { val: 'accident', label: 'Accident' },
  { val: 'dangerous_occurrence', label: 'Dangerous Occurrence' },
  { val: 'environmental', label: 'Environmental' },
  { val: 'other', label: 'Other' },
];

const SEVERITIES = [
  { val: 'low', label: 'Low', desc: 'First aid' },
  { val: 'medium', label: 'Medium', desc: 'Medical' },
  { val: 'high', label: 'High', desc: 'Lost time' },
  { val: 'critical', label: 'Critical', desc: 'Life-threatening' },
];

const TYPE_STYLES = {
  near_miss: 'bg-amber-100 text-amber-700',
  incident: 'bg-blue-100 text-blue-700',
  accident: 'bg-rose-100 text-rose-700',
  dangerous_occurrence: 'bg-red-100 text-red-700',
  environmental: 'bg-teal-100 text-teal-700',
  other: 'bg-slate-100 text-slate-600',
};

const SEVERITY_STYLES = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
  critical: 'bg-red-100 text-red-700 ring-2 ring-red-200',
};

const QUICK_TEMPLATES = [
  { label: 'Near miss — trip hazard', type: 'near_miss', severity: 'low', desc: 'A trip hazard was identified on site. The area was made safe and the hazard removed. No injury occurred but had the potential to cause harm.' },
  { label: 'Near miss — vehicle reversing', type: 'near_miss', severity: 'medium', desc: 'A vehicle was observed reversing without a banksman in a pedestrian area. No contact was made but the risk of collision was significant.' },
  { label: 'Incident — minor injury', type: 'incident', severity: 'medium', desc: 'A crew member sustained a minor injury (cut/bruise) while carrying out work. First aid was administered on site. No hospital treatment required.' },
  { label: 'Incident — equipment damage', type: 'incident', severity: 'medium', desc: 'Equipment was damaged during operations. The equipment was isolated and removed from service. No personal injury occurred.' },
  { label: 'Accident — lost time injury', type: 'accident', severity: 'high', desc: 'A crew member sustained an injury that prevented them from continuing work. Medical treatment was required. The incident is RIDDOR reportable as an over-7-day injury.' },
  { label: 'Dangerous occurrence', type: 'dangerous_occurrence', severity: 'high', desc: 'A dangerous occurrence took place on site (e.g. collapse, equipment failure, near-miss with significant potential). No injury occurred but the event is RIDDOR-reportable.' },
  { label: 'Environmental — spill', type: 'environmental', severity: 'medium', desc: 'A spill of hydraulic fluid / diesel / coolant occurred on site. The spill was contained using the spill kit and the area was cleaned. No watercourse contamination.' },
];

export default function IncidentReporter() {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['incident-reports'],
    queryFn: () => base44.entities.SafetyReport.filter({ report_type: 'incident' }, '-created_date', 200),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list(), enabled: showForm });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-list'], queryFn: () => base44.entities.Staff.list(), enabled: showForm });

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);

  const stats = {
    total: reports.length,
    open: reports.filter(r => r.status === 'open').length,
    critical: reports.filter(r => r.severity === 'critical' && r.status === 'open').length,
    riddor: reports.filter(r => r.riddor_reportable).length,
  };

  const statTiles = [
    { icon: ShieldAlert, label: 'Total', value: stats.total, gradient: 'stat-gradient-slate' },
    { icon: Clock, label: 'Open', value: stats.open, gradient: 'stat-gradient-amber' },
    { icon: AlertTriangle, label: 'Critical', value: stats.critical, gradient: 'stat-gradient-rose' },
    { icon: Flag, label: 'RIDDOR', value: stats.riddor, gradient: 'stat-gradient-rose' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {statTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="hub-glass rounded-2xl p-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-lg ${tile.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">{tile.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{tile.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filter + New button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {['all', 'open', 'actioned', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="command-gradient inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Reports list */}
      {isLoading ? (
        <HubLoadingState variant="list" count={4} />
      ) : filtered.length === 0 ? (
        <HubEmptyState
          icon={CheckCircle2}
          title="No incidents reported"
          description="Use 'Report Incident' to log a near-miss, accident, or dangerous occurrence"
          action={{ label: 'Report Incident', onClick: () => setShowForm(true) }}
        />
      ) : (
        <HubCard icon={AlertTriangle} title="Incident Reports" subtitle={`${filtered.length} report${filtered.length !== 1 ? 's' : ''}`} tone="rose" padded={false}>
          <div className="divide-y divide-slate-100">
            {filtered.map(r => (
              <IncidentCard key={r.id} report={r} />
            ))}
          </div>
        </HubCard>
      )}

      {/* Report form modal */}
      {showForm && (
        <IncidentForm
          jobs={jobs}
          staff={staff}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['incident-reports'] });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function IncidentCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  const typeStyle = TYPE_STYLES[report.incident_type] || TYPE_STYLES.other;
  const sevStyle = SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.low;
  const date = report.conducted_at ? new Date(report.conducted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="hover:bg-slate-50/50 transition">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 sm:px-5 py-3 flex items-center gap-3 text-left">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeStyle} capitalize`}>
            {(report.incident_type || 'other').replace(/_/g, ' ')}
          </span>
          {report.severity && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevStyle} capitalize text-center`}>{report.severity}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{report.audit_title || report.description?.slice(0, 80) || 'Incident'}</p>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>{report.auditor_name || 'Unknown'}</span>
            {report.site_name && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{report.site_name}</span>}
            <span>{date}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {report.riddor_reportable && <Flag className="w-4 h-4 text-red-500" />}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${report.status === 'open' ? 'bg-amber-100 text-amber-700' : report.status === 'actioned' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'} capitalize`}>
            {report.status}
          </span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {report.description && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Description</p>
              <p className="text-sm text-slate-600">{report.description}</p>
            </div>
          )}
          {report.immediate_action && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Immediate Action</p>
              <p className="text-sm text-slate-600">{report.immediate_action}</p>
            </div>
          )}
          {report.root_cause && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Root Cause</p>
              <p className="text-sm text-slate-600">{report.root_cause}</p>
            </div>
          )}
          {report.riddor_reportable && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <p className="text-xs font-bold text-red-700 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> RIDDOR Reportable</p>
              {report.riddor_reference && <p className="text-xs text-red-600 mt-0.5">Ref: {report.riddor_reference}</p>}
            </div>
          )}
          {report.action_items && report.action_items.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Corrective Actions</p>
              <div className="space-y-1">
                {report.action_items.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-slate-50 rounded-xl px-2.5 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${a.priority === 'critical' ? 'bg-red-100 text-red-700' : a.priority === 'high' ? 'bg-rose-100 text-rose-700' : a.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{a.priority}</span>
                    <span className="text-slate-600 flex-1">{a.description}</span>
                    {a.due_date && <span className="text-slate-400">due {new Date(a.due_date).toLocaleDateString('en-GB')}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IncidentForm({ jobs, staff, onClose, onSaved }) {
  const [form, setForm] = useState({
    incident_type: 'near_miss',
    severity: 'low',
    job_id: '',
    site_name: '',
    description: '',
    immediate_action: '',
    root_cause: '',
    reported_by_id: '',
    riddor_reportable: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleApplySuggestions = (suggestions) => {
    setForm(prev => ({
      ...prev,
      root_cause: suggestions.root_cause || prev.root_cause,
      riddor_reportable: suggestions.riddor_reportable || prev.riddor_reportable,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError('Please describe what happened.'); return; }
    setSaving(true);
    setError('');
    try {
      const job = jobs.find(j => j.id === form.job_id);
      const reporter = staff.find(s => s.id === form.reported_by_id);
      await base44.entities.SafetyReport.create({
        report_type: 'incident',
        safetyculture_audit_id: `INC-${Date.now()}`,
        incident_type: form.incident_type,
        severity: form.severity,
        audit_title: `${form.incident_type.replace(/_/g, ' ')} — ${form.site_name || job?.name || 'Site'}`,
        auditor_name: reporter?.name || 'Manual report',
        job_id: form.job_id || undefined,
        job_name: job?.name || '',
        site_name: form.site_name || job?.location || '',
        conducted_at: new Date().toISOString(),
        description: form.description,
        immediate_action: form.immediate_action || undefined,
        root_cause: form.root_cause || undefined,
        reported_by_id: form.reported_by_id || undefined,
        riddor_reportable: form.riddor_reportable,
        status: 'open',
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Could not save the report.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-4 h-4 text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Report Incident</h2>
              <p className="text-xs text-slate-400">Log a near-miss, accident, or dangerous occurrence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

          {/* Quick-fill template selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quick-fill template (optional)</label>
            <select
              onChange={(e) => {
                const tpl = QUICK_TEMPLATES.find(t => t.label === e.target.value);
                if (tpl) {
                  setForm(prev => ({
                    ...prev,
                    incident_type: tpl.type,
                    severity: tpl.severity,
                    description: tpl.desc,
                    riddor_reportable: tpl.severity === 'high' || tpl.type === 'dangerous_occurrence',
                  }));
                }
              }}
              className={inputCls}
              value=""
            >
              <option value="">Choose a template to pre-fill…</option>
              {QUICK_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {INCIDENT_TYPES.map(t => (
                <button key={t.val} type="button" onClick={() => set('incident_type', t.val)}
                  className={`px-2 py-2 rounded-xl border text-xs font-semibold transition ${form.incident_type === t.val ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {SEVERITIES.map(s => (
                <button key={s.val} type="button" onClick={() => set('severity', s.val)}
                  className={`px-2 py-2 rounded-xl border text-center transition ${form.severity === s.val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                  <span className="block text-xs font-bold">{s.label}</span>
                  <span className="block text-[9px] opacity-70">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Job (optional)</label>
              <select value={form.job_id} onChange={e => set('job_id', e.target.value)} className={inputCls}>
                <option value="">No specific job</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Site / Location</label>
              <input type="text" value={form.site_name} onChange={e => set('site_name', e.target.value)} placeholder="Where did it happen?" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reported By</label>
            <select value={form.reported_by_id} onChange={e => set('reported_by_id', e.target.value)} className={inputCls}>
              <option value="">Select staff member</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">What happened? <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows="3" placeholder="Describe what was being done, what went wrong, and what happened next..." className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Immediate action taken</label>
            <textarea value={form.immediate_action} onChange={e => set('immediate_action', e.target.value)} rows="2" placeholder="First aid, area secured, equipment isolated..." className={inputCls} />
          </div>

          {form.description.trim().length > 20 && (
            <div className="hub-glass rounded-2xl p-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">AI Analysis</label>
              <IncidentAutoAnalysis
                incident={{
                  type: form.incident_type,
                  severity: form.severity,
                  description: form.description,
                  immediate_action: form.immediate_action,
                  job_name: jobs.find(j => j.id === form.job_id)?.name,
                  location: form.site_name,
                }}
                onApplySuggestions={handleApplySuggestions}
              />
            </div>
          )}

          <label className="flex items-center gap-2.5 p-3 bg-red-50 rounded-xl border border-red-200 cursor-pointer">
            <input type="checkbox" checked={form.riddor_reportable} onChange={e => set('riddor_reportable', e.target.checked)} className="w-4 h-4 accent-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> RIDDOR Reportable</p>
              <p className="text-[11px] text-red-500">Check if this is a reportable injury (over-7-day), dangerous occurrence, occupational disease, or fatality.</p>
            </div>
          </label>
        </form>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
          <button type="submit" onClick={handleSubmit} disabled={saving} className="command-gradient flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}