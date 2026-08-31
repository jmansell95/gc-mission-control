import React from 'react';
import { Briefcase, PoundSterling, Car, Users, ShieldCheck, Boxes } from 'lucide-react';

/**
 * Summary stat tiles — blended KPIs pulled from every hub. Each tile uses a
 * stat-gradient background and shows a label, value, and icon.
 */
export default function ReportStatTiles({ data }) {
  const { jobs, afps, vehicles, staff, assets } = data;

  const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
  const revenue = afps.reduce((s, a) => s + (Number(a.agreed_total) || Number(a.total_claimed) || 0), 0);
  const fleetSynced = vehicles.filter(v => v.geotab_sync_status === 'synced').length;
  const fleetPct = vehicles.length ? Math.round((fleetSynced / vehicles.length) * 100) : 0;
  const activeStaff = staff.filter(s => s.status === 'active' || !s.status).length;
  const compliantAssets = assets.filter(a => a.compliance_status === 'compliant').length;
  const compliancePct = assets.length ? Math.round((compliantAssets / assets.length) * 100) : 0;
  const assetValue = assets.reduce((s, a) => s + (Number(a.acquisition_cost) || Number(a.current_book_value) || 0), 0);

  const tiles = [
    { label: 'Revenue (AFP Agreed)', value: `£${Math.round(revenue).toLocaleString()}`, icon: PoundSterling, gradient: 'stat-gradient-brand' },
    { label: 'Active Jobs', value: activeJobs, icon: Briefcase, gradient: 'stat-gradient-emerald' },
    { label: 'Fleet Synced', value: `${fleetPct}%`, icon: Car, gradient: 'stat-gradient-blue' },
    { label: 'Active Staff', value: activeStaff, icon: Users, gradient: 'stat-gradient-amber' },
    { label: 'Compliance', value: `${compliancePct}%`, icon: ShieldCheck, gradient: 'stat-gradient-teal' },
    { label: 'Asset Value', value: `£${Math.round(assetValue).toLocaleString()}`, icon: Boxes, gradient: 'stat-gradient-violet' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <div key={i} className={`${t.gradient} rounded-2xl p-3 sm:p-4 text-white relative overflow-hidden min-w-0`}>
            <div className="absolute -right-4 -bottom-4 opacity-20">
              <Icon className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>
            <div className="relative">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 sm:mb-2 opacity-80" />
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide opacity-80 leading-tight">{t.label}</p>
              <p className="text-lg sm:text-2xl font-extrabold tabular-nums mt-0.5 truncate">{t.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}