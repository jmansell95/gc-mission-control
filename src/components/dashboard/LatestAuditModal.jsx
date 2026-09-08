import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, ShieldCheck, ExternalLink, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

/**
 * LatestAuditModal — quick-action modal for the Safety/Mitti widget.
 * Fetches the 5 most recent SafetyReport records and shows the latest
 * one's details: title, auditor, date, score, failed items, and action
 * items. Links to the full PDF report if available.
 */
export default function LatestAuditModal({ onClose }) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['latest-audit-modal'],
    queryFn: () => base44.entities.SafetyReport.list('-conducted_at', 5),
  });
  const latest = reports[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(8,23,48,0.96)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-pop-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Latest Safety Audit</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : !latest ? (
          <p className="text-sm text-slate-500 text-center py-6">No safety audits synced yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-sm font-bold text-slate-900">{latest.audit_title || latest.audit_template_name || 'Untitled audit'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{latest.audit_template_name || 'No template'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Auditor</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{latest.auditor_name || 'Unknown'}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Conducted</p>
                <p className="text-sm font-semibold text-slate-800">{latest.conducted_at ? format(new Date(latest.conducted_at), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Score</p>
                <p className="text-sm font-semibold text-slate-800">{latest.score_percentage != null ? `${latest.score_percentage}%` : '—'}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Failed items</p>
                <p className="text-sm font-semibold text-slate-800">{latest.items_failed || 0}</p>
              </div>
            </div>
            {latest.action_items?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-1.5">Action items</p>
                <div className="space-y-1.5">
                  {latest.action_items.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800">{a.description}</p>
                        {a.priority && <p className="text-[10px] text-slate-400 uppercase font-bold">{a.priority}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latest.audit_report_url && (
              <a href={latest.audit_report_url} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition">
                <ExternalLink className="w-4 h-4" /> Open Full Report
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}