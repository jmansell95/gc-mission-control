import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Briefcase, Percent, ClipboardCheck, PoundSterling } from 'lucide-react';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

/**
 * DashboardStatsBar — the standardized KPI strip for the Command Centre.
 *
 * Shows the four headline operational metrics (active jobs, crew utilisation,
 * timesheet queue, outstanding invoices) in the same HubStatsBar format used
 * by every other hub, so the dashboard feels like part of the same family.
 *
 * Data keys match the dashboard's existing react-query cache so requests are
 * deduplicated.
 */
export default function DashboardStatsBar({ onNavigate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [] } = useQuery({ queryKey: ['cc-tile-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['cc-tile-rotas', todayStr], queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }) });
  const { data: staff = [] } = useQuery({ queryKey: ['cc-tile-staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['cc-tile-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const { data: invoices = [] } = useQuery({ queryKey: ['cc-tile-invoices'], queryFn: () => base44.entities.Invoice.list('-issue_date', 200) });

  const tiles = useMemo(() => {
    const active = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
    const activeStaff = staff.filter(s => s.is_active !== false).length;
    const staffToday = new Set(rotas.map(r => r.staff_id)).size;
    const pct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;
    const pending = timesheets.filter(t => t.status === 'submitted').length;
    const now = Date.now();
    const overdueTs = timesheets.filter(t => t.status === 'submitted' && t.created_date && (now - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const totalOutstanding = outstanding.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
    const overdueInv = invoices.filter(i => i.status === 'overdue').length;

    return [
      { icon: Briefcase, label: 'Active Jobs', value: active, sublabel: `${jobs.length} total`, color: 'brand', onClick: onNavigate ? () => onNavigate('jobs') : undefined },
      { icon: Percent, label: 'Crew Utilisation', value: `${pct}%`, sublabel: `${staffToday} of ${activeStaff} on site`, color: 'blue', onClick: onNavigate ? () => onNavigate('rota') : undefined },
      { icon: ClipboardCheck, label: 'Timesheet Queue', value: pending, sublabel: overdueTs > 0 ? `${overdueTs} overdue (>48h)` : 'All within target', color: overdueTs > 0 ? 'rose' : 'amber', onClick: onNavigate ? () => onNavigate({ section: 'staff', staffTab: 'timesheets' }) : undefined },
      { icon: PoundSterling, label: 'Outstanding', value: gbp(totalOutstanding), sublabel: `${outstanding.length} invoices · ${overdueInv} overdue`, color: overdueInv > 0 ? 'rose' : 'emerald', onClick: onNavigate ? () => onNavigate('billing') : undefined },
    ];
  }, [jobs, rotas, staff, timesheets, invoices, onNavigate]);

  return <HubStatsBar tiles={tiles} />;
}