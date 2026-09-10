import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';

export default function FailedAuditBanner({ onView }) {
  const [dismissed, setDismissed] = useState(false);
  const { data: reports = [] } = useQuery({
    queryKey: ['safety-reports-failed-recent'],
    queryFn: async () => {
      const all = await base44.entities.SafetyReport.list('-created_date', 100);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      return all.filter(r => r.pass_fail === 'fail' && r.auditor_staff_id && r.conducted_at && new Date(r.conducted_at) >= weekAgo);
    },
  });
  if (dismissed || reports.length === 0) return null;
  return (
    <div className="hub-glass rounded-2xl p-4 flex items-center gap-3 border-l-4 border-rose-400 animate-slide-up">
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-5 h-5 text-rose-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{reports.length} audit{reports.length === 1 ? '' : 's'} failed in the last 7 days</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{reports.slice(0, 3).map(r => r.audit_title || r.audit_template_name || 'Audit').join(', ')}{reports.length > 3 ? ` +${reports.length - 3} more` : ''}</p>
      </div>
      {onView && <button onClick={onView} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition flex-shrink-0">View <ChevronRight className="w-3.5 h-3.5" /></button>}
      <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
    </div>
  );
}