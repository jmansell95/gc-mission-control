import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock, PoundSterling, TrendingUp, AlertTriangle,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const complianceMeta = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'bg-red-100 text-red-700' },
  unknown: { label: 'Unknown', icon: ShieldCheck, cls: 'bg-slate-100 text-slate-500' },
};

export default function CrewComplianceSummary({ assignedStaff, rotas, canSeeCosts }) {
  // Fetch compliance items for the assigned staff
  const staffIds = (assignedStaff || []).map(s => s.id).filter(Boolean);
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['staff-compliance-summary', staffIds.sort().join(',')],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }, '-created_date', 500),
    enabled: staffIds.length > 0,
  });

  // Per-staff stats
  const staffStats = (assignedStaff || []).map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const shiftCount = memberRotas.length;
    const overtimeCount = memberRotas.filter(r => r.is_overtime).length;
    const dayRate = member.day_rate || 0;
    const estimatedCost = dayRate > 0 ? dayRate * shiftCount : 0;

    // Compliance: find items for this staff member (by staff_id or name match)
    const memberCompliance = complianceItems.filter(ci =>
      ci.staff_id === member.id || ci.reference_id === member.id
    );
    const now = new Date();
    let expiring = 0, expired = 0;
    memberCompliance.forEach(ci => {
      if (!ci.expiry_date || ci.status_override === 'not_required') return;
      try {
        const d = new Date(ci.expiry_date + '-01');
        if (isNaN(d.getTime())) return;
        const days = Math.ceil((d - now) / 86400000);
        if (days < 0) expired++;
        else if (days <= 30) expiring++;
      } catch {}
    });

    let status = 'compliant';
    if (expired > 0) status = 'expired';
    else if (expiring > 0) status = 'expiring';
    else if (memberCompliance.length === 0) status = 'unknown';

    return { member, shiftCount, overtimeCount, dayRate, estimatedCost, expiring, expired, status, complianceCount: memberCompliance.length };
  });

  const totalShifts = staffStats.reduce((s, x) => s + x.shiftCount, 0);
  const totalOvertime = staffStats.reduce((s, x) => s + x.overtimeCount, 0);
  const totalCost = staffStats.reduce((s, x) => s + x.estimatedCost, 0);
  const totalExpired = staffStats.reduce((s, x) => s + x.expired, 0);
  const totalExpiring = staffStats.reduce((s, x) => s + x.expiring, 0);

  if (!assignedStaff || assignedStaff.length === 0) return null;

  return (
    <div className="insight-card rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Crew Readiness Summary</h3>
          <p className="text-xs text-slate-500">Shifts, costs & training compliance per crew member</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalExpired > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1">
              <ShieldX className="w-3 h-3" /> {totalExpired} expired
            </span>
          )}
          {totalExpiring > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> {totalExpiring} expiring
            </span>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="text-center bg-blue-50 rounded-lg border border-blue-100 p-2">
          <Clock className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
          <p className="text-sm font-bold text-slate-800 tabular-nums">{totalShifts}</p>
          <p className="text-[9px] text-slate-400 uppercase">Total Shifts</p>
        </div>
        <div className="text-center bg-amber-50 rounded-lg border border-amber-100 p-2">
          <TrendingUp className="w-3.5 h-3.5 text-amber-600 mx-auto mb-0.5" />
          <p className="text-sm font-bold text-slate-800 tabular-nums">{totalOvertime}</p>
          <p className="text-[9px] text-slate-400 uppercase">Overtime</p>
        </div>
        {canSeeCosts && (
          <div className="text-center bg-emerald-50 rounded-lg border border-emerald-100 p-2">
            <PoundSterling className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(totalCost)}</p>
            <p className="text-[9px] text-slate-400 uppercase">Est. Labour Cost</p>
          </div>
        )}
        <div className="text-center bg-violet-50 rounded-lg border border-violet-100 p-2">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-600 mx-auto mb-0.5" />
          <p className="text-sm font-bold text-slate-800 tabular-nums">{staffStats.filter(s => s.status === 'compliant').length}</p>
          <p className="text-[9px] text-slate-400 uppercase">Compliant</p>
        </div>
      </div>

      {/* Per-person table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400">
              <th className="text-left font-semibold uppercase tracking-wide py-2 px-2">Crew Member</th>
              <th className="text-center font-semibold uppercase tracking-wide py-2 px-2">Shifts</th>
              <th className="text-center font-semibold uppercase tracking-wide py-2 px-2">OT</th>
              {canSeeCosts && <th className="text-right font-semibold uppercase tracking-wide py-2 px-2">Day Rate</th>}
              {canSeeCosts && <th className="text-right font-semibold uppercase tracking-wide py-2 px-2">Est. Cost</th>}
              <th className="text-center font-semibold uppercase tracking-wide py-2 px-2">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {staffStats.map(({ member, shiftCount, overtimeCount, dayRate, estimatedCost, status, expiring, expired }) => {
              const cm = complianceMeta[status] || complianceMeta.unknown;
              const CIcon = cm.icon;
              return (
                <tr key={member.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-lg object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-500">{member.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{member.name}</p>
                        <p className="text-[10px] text-slate-400">{member.job_title || member.worker_type?.replace(/_/g, ' ') || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2 font-bold text-slate-700 tabular-nums">{shiftCount}</td>
                  <td className="text-center py-2 px-2">
                    {overtimeCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">{overtimeCount}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {canSeeCosts && (
                    <td className="text-right py-2 px-2 text-slate-600 tabular-nums">{dayRate > 0 ? fmt(dayRate) : '—'}</td>
                  )}
                  {canSeeCosts && (
                    <td className="text-right py-2 px-2 font-bold text-slate-700 tabular-nums">{estimatedCost > 0 ? fmt(estimatedCost) : '—'}</td>
                  )}
                  <td className="text-center py-2 px-2">
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cm.cls}`}>
                      <CIcon className="w-2.5 h-2.5" /> {cm.label}
                      {(expiring > 0 || expired > 0) && ` (${expired + expiring})`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}