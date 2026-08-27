import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HardHat, Loader2, User } from 'lucide-react';

const WORK_TYPE_LABELS = {
  drilling: 'Drilling', coring: 'Coring', groundworks: 'Groundworks',
  trial_pit: 'Trial Pit', enabling_works: 'Enabling', site_investigation: 'Geotechnical SI',
  equipment_hire: 'Equipment Hire', materials_supply: 'Materials', transport: 'Transport',
  supervision: 'Supervision', other: 'Other',
};

// Shows subcontractor crew names (crew lead, second man, worker) pulled from
// SubcontractorLog records. These are free-text names entered by the billing
// team — external sub-con crew are NOT internal Staff records, so they don't
// appear in the Assigned Staff list. This section gives them their own visible
// home on the Schedule & Crew tab.
export default function SubcontractorCrewSection({ jobId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['subcontractor-crew-names', jobId],
    queryFn: () => base44.entities.SubcontractorLog.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  // Group by subcontractor company, collecting unique crew names + work types
  const bySubcontractor = {};
  logs.forEach(log => {
    const subName = log.subcontractor_name || 'Unassigned Subcontractor';
    if (!bySubcontractor[subName]) bySubcontractor[subName] = { names: new Set(), workTypes: new Set() };
    if (log.crew_lead_name) bySubcontractor[subName].names.add(log.crew_lead_name);
    if (log.crew_second_name) bySubcontractor[subName].names.add(log.crew_second_name);
    if (log.worker_name) bySubcontractor[subName].names.add(log.worker_name);
    if (log.work_type) bySubcontractor[subName].workTypes.add(log.work_type);
  });

  const entries = Object.entries(bySubcontractor);
  const totalNames = entries.reduce((s, [, v]) => s + v.names.size, 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading subcontractor crew…
      </div>
    );
  }

  if (totalNames === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
          <HardHat className="w-4 h-4 text-orange-600" />
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">Subcontractor Crew</h3>
        <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
          {totalNames} {totalNames === 1 ? 'person' : 'people'}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {entries.map(([subName, data]) => (
          <div key={subName} className="px-5 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-bold text-orange-700">{subName}</span>
              {data.workTypes.size > 0 && (
                <span className="text-[10px] text-slate-400">
                  · {[...data.workTypes].map(w => WORK_TYPE_LABELS[w] || w).join(', ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[...data.names].map(name => (
                <div key={name} className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-2.5 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-700 font-bold text-[10px]">{name.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-700">{name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}