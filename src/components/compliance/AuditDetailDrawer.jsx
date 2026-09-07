import React from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Briefcase, User, Calendar, ClipboardList } from 'lucide-react';

const PRIORITY_TONE = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-50 text-amber-700', high: 'bg-rose-50 text-rose-700', critical: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' };
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AuditDetailDrawer({ audit, onClose }) {
  if (!audit) return null;
  const failed = audit.pass_fail === 'fail';
  const actions = audit.action_items || [];
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center gap-3 z-10">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${failed ? 'bg-rose-100' : audit.pass_fail === 'pass' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
            {failed ? <XCircle className="w-5 h-5 text-rose-600" /> : audit.pass_fail === 'pass' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ClipboardList className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0"><h3 className="text-base font-bold text-slate-900 truncate">{audit.audit_title || audit.audit_template_name || 'Untitled audit'}</h3><p className="text-xs text-slate-500">{audit.audit_template_name || '—'}</p></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-slate-400" /><div><p className="text-xs text-slate-400">Auditor</p><p className="font-semibold text-slate-700 truncate">{audit.auditor_name || '—'}</p></div></div>
            <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-slate-400" /><div><p className="text-xs text-slate-400">Conducted</p><p className="font-semibold text-slate-700">{fmtDateTime(audit.conducted_at)}</p></div></div>
            <div className="flex items-center gap-2 text-sm"><Briefcase className="w-4 h-4 text-slate-400" /><div><p className="text-xs text-slate-400">Job / Site</p><p className="font-semibold text-slate-700 truncate">{audit.job_name || audit.site_name || '—'}</p></div></div>
            <div className="flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4 text-slate-400" /><div><p className="text-xs text-slate-400">Score</p><p className="font-semibold text-slate-700">{audit.score_percentage != null ? `${Math.round(audit.score_percentage)}%` : '—'}{audit.items_failed > 0 && <span className="text-rose-600 ml-1">· {audit.items_failed} failed</span>}</p></div></div>
          </div>
          {audit.audit_report_url && <a href={audit.audit_report_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition"><ExternalLink className="w-4 h-4" /> View Full Report</a>}
          <div>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-500" /><h4 className="text-sm font-bold text-slate-900">Action Items ({actions.length})</h4></div>
            {actions.length === 0 ? <p className="text-sm text-slate-400 py-2">No action items raised.</p> : (
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_TONE[a.priority] || PRIORITY_TONE.medium}`}>{(a.priority || 'medium').toUpperCase()}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm text-slate-800">{a.description || 'Untitled action'}</p><div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-500">{a.assignee && <span>👤 {a.assignee}</span>}{a.due_date && <span>📅 {fmtDate(a.due_date)}</span>}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}