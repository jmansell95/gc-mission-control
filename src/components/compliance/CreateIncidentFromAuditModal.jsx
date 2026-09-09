import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Loader2, ShieldAlert, CheckCircle2, Siren, Flag, MapPin,
} from 'lucide-react';

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

/**
 * CreateIncidentFromAuditModal — pre-fills an incident report from
 * a failed Mitti audit or a specific failed check item.
 * Props: audit (the SafetyReport), failedItem (optional specific item), onClose
 */
export default function CreateIncidentFromAuditModal({ audit, failedItem, onClose }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-incident'],
    queryFn: () => base44.entities.Job.list(),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-incident'],
    queryFn: () => base44.entities.Staff.list(),
  });

  // Pre-fill from the audit data
  const prefillDesc = failedItem
    ? `Failed audit item: "${failedItem.label || 'Unknown check'}"\nResponse: ${failedItem.response || 'N/A'}\n${failedItem.comments ? `Comments: ${failedItem.comments}` : ''}\n\nThis item was flagged as a failure during the "${audit?.audit_title || audit?.audit_template_name || 'audit'}" and has been escalated to an incident.`
    : `Escalated from failed audit: "${audit?.audit_title || audit?.audit_template_name || 'Audit'}" conducted by ${audit?.auditor_name || 'unknown auditor'} on ${audit?.conducted_at ? new Date(audit.conducted_at).toLocaleDateString('en-GB') : 'unknown date'}.\n\nPlease describe what happened and the immediate action taken.`;

  const [form, setForm] = useState({
    incident_type: 'incident',
    severity: failedItem?.status === 'fail' ? 'medium' : 'low',
    job_id: audit?.job_id || '',
    site_name: audit?.site_name || audit?.job_name || '',
    description: prefillDesc,
    immediate_action: '',
    root_cause: '',
    reported_by_id: '',
    riddor_reportable: false,
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

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
        auditor_name: reporter?.name || audit?.auditor_name || 'Escalated from audit',
        job_id: form.job_id || audit?.job_id || undefined,
        job_name: job?.name || audit?.job_name || '',
        site_name: form.site_name || job?.location || audit?.site_name || '',
        conducted_at: new Date().toISOString(),
        description: form.description,
        immediate_action: form.immediate_action || undefined,
        root_cause: form.root_cause || undefined,
        reported_by_id: form.reported_by_id || undefined,
        riddor_reportable: form.riddor_reportable,
        status: 'open',
      });
      queryClient.invalidateQueries({ queryKey: ['safety-reports'] });
      queryClient.invalidateQueries({ queryKey: ['incident-reports'] });
      queryClient.invalidateQueries({ queryKey: ['safety-reports-timeline'] });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the report.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden rounded-t-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
              <Siren className="w-4 h-4 text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create Incident from Audit</h2>
              <p className="text-xs text-slate-400">Escalate a failed audit item to a formal incident</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3 py-2">{error}</div>}

          {/* Pre-fill banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Pre-filled from: <span className="font-bold">{audit?.audit_title || audit?.audit_template_name || 'Audit'}</span>
              {failedItem && <> · Failed item: <span className="font-bold">{failedItem.label}</span></>}
            </p>
          </div>

          {/* Type */}
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

          {/* Severity */}
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

          {/* Job + Site */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Job</label>
              <select value={form.job_id} onChange={e => set('job_id', e.target.value)} className={inputCls}>
                <option value="">{audit?.job_name || 'No specific job'}</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Site / Location</label>
              <input type="text" value={form.site_name} onChange={e => set('site_name', e.target.value)} placeholder="Where did it happen?" className={inputCls} />
            </div>
          </div>

          {/* Reported by */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reported By</label>
            <select value={form.reported_by_id} onChange={e => set('reported_by_id', e.target.value)} className={inputCls}>
              <option value="">{audit?.auditor_name || 'Select staff member'}</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">What happened? <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows="4" className={inputCls} />
          </div>

          {/* Immediate action */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Immediate action taken</label>
            <textarea value={form.immediate_action} onChange={e => set('immediate_action', e.target.value)} rows="2" placeholder="First aid, area secured, equipment isolated..." className={inputCls} />
          </div>

          {/* RIDDOR */}
          <label className="flex items-center gap-2.5 p-3 bg-red-50 rounded-xl border border-red-200 cursor-pointer">
            <input type="checkbox" checked={form.riddor_reportable} onChange={e => set('riddor_reportable', e.target.checked)} className="w-4 h-4 accent-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> RIDDOR Reportable</p>
              <p className="text-[11px] text-red-500">Check if this is a reportable injury, dangerous occurrence, occupational disease, or fatality.</p>
            </div>
          </label>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
          <button type="submit" onClick={handleSubmit} disabled={saving} className="command-gradient flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Create Incident
          </button>
        </div>
      </div>
    </div>
  );
}