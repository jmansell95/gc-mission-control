import React, { useMemo } from 'react';
import { Briefcase, MapPin, Calendar, Clock, ChevronRight, Truck } from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { EmptyState } from '@/components/StateViews';

const STATUS_META = {
  assigned: { label: 'Assigned', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  on_site: { label: 'On Site', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  returned: { label: 'Returned', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/**
 * Deployment tab — shows current and historical job assignments for this
 * asset, plus a button to assign to a new job.
 */
export default function AssetDeploymentTab({ asset, assignments = [], jobs = [], onAssign }) {
  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  const sorted = useMemo(() =>
    [...assignments].sort((a, b) => new Date(b.assigned_date || b.created_date) - new Date(a.assigned_date || a.created_date)),
    [assignments]
  );

  const active = sorted.filter(a => a.status === 'assigned' || a.status === 'on_site');
  const historical = sorted.filter(a => a.status === 'returned');

  return (
    <div className="space-y-4">
      {/* Assign button */}
      <button
        onClick={onAssign}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-[#244715] transition shadow-sm"
      >
        <Briefcase className="w-4 h-4" /> Assign to Job
      </button>

      {/* Active deployments */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" /> Active ({active.length})
        </h3>
        {active.length === 0 ? (
          <div className="hub-glass rounded-2xl">
            <EmptyState icon={MapPin} title="Not deployed" message="This asset is in the yard and available for assignment." />
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(a => {
              const job = jobById[a.job_id] || { name: a.job_name || 'Unknown Job', location: '' };
              const sm = STATUS_META[a.status] || STATUS_META.assigned;
              return (
                <div key={a.id} className="hub-glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{job.name}</p>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {job.location || 'No location'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${sm.cls} flex-shrink-0`}>
                    {sm.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical deployments */}
      {historical.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> History ({historical.length})
          </h3>
          <div className="space-y-2">
            {historical.map(a => {
              const job = jobById[a.job_id] || { name: a.job_name || 'Unknown Job', location: '' };
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{job.name}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {a.assigned_date ? safeFormat(a.assigned_date, 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                    Returned
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}