import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Percent, ClipboardCheck, PoundSterling, ShieldAlert,
  AlertTriangle, ShieldCheck, Gauge,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

/**
 * BentoStatTiles — compact stat tile grid for the bottom of the bento dashboard.
 * Replaces both DashboardStatsBar and MissionControlStrip with a single
 * responsive auto-fill grid of 7 clickable stat tiles.
 *
 * Each tile navigates to the relevant hub/section on click.
 */
export default function BentoStatTiles({ onNavigate }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [] } = useQuery({ queryKey: ['bento-tile-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['bento-tile-rotas', todayStr], queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }) });
  const { data: staff = [] } = useQuery({ queryKey: ['bento-tile-staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['bento-tile-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const { data: invoices = [] } = useQuery({ queryKey: ['bento-tile-invoices'], queryFn: () => base44.entities.Invoice.list('-issue_date', 200) });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['bento-tile-compliance'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 300) });
  const { data: safetyReports = [] } = useQuery({ queryKey: ['bento-tile-safety'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }, '-created_date', 50) });
  const { data: siteAssets = [] } = useQuery({ queryKey: ['bento-tile-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { isConnected: scConnected } = useMittiStatus();

  const tiles = useMemo(() => {
    const active = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
    const activeStaff = staff.filter(s => s.is_active !== false).length;
    const staffToday = new Set(rotas.map(r => r.staff_id)).size;
    const crewPct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;

    const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
    const now = Date.now();
    const overdueTs = timesheets.filter(t => t.status === 'submitted' && t.created_date && (now - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;

    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const totalOutstanding = outstanding.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
    const overdueInv = invoices.filter(i => i.status === 'overdue').length;

    const now2 = new Date();
    const overdueActions = complianceItems.filter(i => {
      if (!i.expiry_date || i.status_override !== 'auto') return false;
      const d = differenceInDays(new Date(i.expiry_date + 'T00:00:00'), now2);
      return d < 0;
    }).length;

    const redAlerts = scConnected ? safetyReports.filter(r => r.severity === 'critical').length : 0;

    const activeAssets = siteAssets.filter(a => a.is_active !== false);
    const compliantAssets = activeAssets.filter(a => a.compliance_status === 'compliant').length;
    const fleetPct = activeAssets.length > 0 ? Math.round((compliantAssets / activeAssets.length) * 100) : 0;

    const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
    const totalBudget = activeJobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const totalActualCost = activeJobs.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0);
    const burnRate = totalBudget > 0 ? Math.round((totalActualCost / totalBudget) * 100) : 0;

    return [
      { icon: Briefcase, label: 'Active Jobs', value: active, sub: `${jobs.length} total`, color: 'emerald', nav: 'jobs' },
      { icon: Percent, label: 'Crew Utilisation', value: `${crewPct}%`, sub: `${staffToday} of ${activeStaff}`, color: 'blue', nav: 'rota' },
      { icon: ClipboardCheck, label: 'Timesheet Queue', value: pendingTs, sub: overdueTs > 0 ? `${overdueTs} overdue` : 'On track', color: overdueTs > 0 ? 'rose' : 'amber', nav: { section: 'staff', staffTab: 'timesheets' } },
      { icon: PoundSterling, label: 'Outstanding', value: gbp(totalOutstanding), sub: `${overdueInv} overdue`, color: overdueInv > 0 ? 'rose' : 'emerald', nav: 'billing' },
      { icon: ShieldAlert, label: 'Overdue Actions', value: overdueActions, sub: overdueActions > 0 ? 'Need attention' : 'All clear', color: overdueActions > 0 ? 'rose' : 'emerald', nav: 'compliance' },
      { icon: AlertTriangle, label: 'Red Alerts', value: redAlerts, sub: scConnected ? (redAlerts > 0 ? 'Critical' : 'None') : 'Mitti off', color: redAlerts > 0 ? 'rose' : 'slate', nav: 'compliance' },
      { icon: ShieldCheck, label: 'Fleet Compliance', value: `${fleetPct}%`, sub: `${compliantAssets}/${activeAssets.length} assets`, color: fleetPct < 80 ? 'amber' : 'emerald', nav: 'fleet' },
      { icon: Gauge, label: 'Burn Rate', value: `${burnRate}%`, sub: burnRate > 80 ? 'Over budget' : burnRate > 60 ? 'Monitor' : 'On track', color: burnRate > 80 ? 'rose' : burnRate > 60 ? 'amber' : 'emerald', nav: 'billing' },
    ];
  }, [jobs, rotas, staff, timesheets, invoices, complianceItems, safetyReports, siteAssets, scConnected]);

  const handleNav = (nav) => {
    if (!nav) return;
    if (onNavigate) onNavigate(nav);
  };

  const colorMap = {
    emerald: { iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
    blue: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
    amber: { iconBg: 'bg-amber-100', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
    rose: { iconBg: 'bg-rose-100', iconColor: 'text-rose-600', valueColor: 'text-rose-700' },
    slate: { iconBg: 'bg-slate-100', iconColor: 'text-slate-500', valueColor: 'text-slate-700' },
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        const c = colorMap[tile.color] || colorMap.slate;
        return (
          <button
            key={i}
            onClick={() => handleNav(tile.nav)}
            className="insight-card rounded-xl p-3 text-left hover:shadow-md transition group cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center mb-2 group-hover:scale-110 transition`}>
              <Icon className={`w-4 h-4 ${c.iconColor}`} />
            </div>
            <p className={`text-xl font-bold tabular-nums leading-none ${c.valueColor}`}>{tile.value}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1 truncate">{tile.label}</p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{tile.sub}</p>
          </button>
        );
      })}
    </div>
  );
}