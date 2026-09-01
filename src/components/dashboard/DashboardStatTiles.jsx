import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '@/components/dashboard/StatCard';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';
import {
  Briefcase, Percent, ClipboardCheck, ShieldAlert,
  PoundSterling, Gauge, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const gbp = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

function LoadingTile() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-16 bg-slate-100 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ── Operations ──

export function ActiveJobsTile({ onNavigate }) {
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['cc-tile-jobs'], queryFn: () => base44.entities.Job.list() });
  const active = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={Briefcase} value={active} label="Active Jobs" sub={`${jobs.length} total`} gradient="stat-gradient-emerald" onClick={onNavigate ? () => onNavigate('jobs') : undefined} arrow />;
}

export function CrewUtilisationTile({ onNavigate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: rotas = [], isLoading } = useQuery({ queryKey: ['cc-tile-rotas', todayStr], queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }) });
  const { data: staff = [] } = useQuery({ queryKey: ['cc-tile-staff'], queryFn: () => base44.entities.Staff.list() });
  const activeStaff = staff.filter(s => s.is_active !== false).length;
  const staffToday = new Set(rotas.map(r => r.staff_id)).size;
  const pct = activeStaff > 0 ? Math.round((staffToday / activeStaff) * 100) : 0;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={Percent} value={`${pct}%`} label="Crew Utilisation" sub={`${staffToday} of ${activeStaff} on site`} gradient="stat-gradient-blue" onClick={onNavigate ? () => onNavigate('rota') : undefined} arrow />;
}

export function TimesheetQueueTile({ onNavigate }) {
  const { data: timesheets = [], isLoading } = useQuery({ queryKey: ['cc-tile-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });
  const pending = timesheets.filter(t => t.status === 'submitted').length;
  const now = Date.now();
  const overdue = timesheets.filter(t => t.status === 'submitted' && t.created_date && (now - new Date(t.created_date).getTime()) > 48 * 3600 * 1000).length;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={ClipboardCheck} value={pending} label="Timesheet Queue" sub={overdue > 0 ? `${overdue} overdue (>48h)` : 'All within target'} gradient={overdue > 0 ? 'stat-gradient-rose' : 'stat-gradient-amber'} onClick={onNavigate ? () => onNavigate({ section: 'staff', staffTab: 'timesheets' }) : undefined} arrow />;
}

// ── Financial ──

export function OutstandingInvoicesTile({ onNavigate }) {
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['cc-tile-invoices'], queryFn: () => base44.entities.Invoice.list('-issue_date', 200) });
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const total = outstanding.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').length;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={PoundSterling} value={gbp(total)} label="Outstanding" sub={`${outstanding.length} invoices · ${overdue} overdue`} gradient="stat-gradient-blue" onClick={onNavigate ? () => onNavigate('billing') : undefined} arrow />;
}

export function BurnRateTile({ onNavigate }) {
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['cc-tile-burn-jobs'], queryFn: () => base44.entities.Job.list('-updated_date', 200) });
  const active = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const budget = active.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
  const actual = active.reduce((s, j) => s + (Number(j.actual_cost) || 0), 0);
  const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={Gauge} value={`${pct}%`} label="Burn Rate" sub={`${active.length} active jobs`} gradient={pct > 80 ? 'stat-gradient-rose' : pct > 60 ? 'stat-gradient-amber' : 'stat-gradient-emerald'} onClick={onNavigate ? () => onNavigate('billing') : undefined} arrow />;
}

// ── Safety & Compliance ──

export function OverdueActionsTile({ onNavigate }) {
  const { data: safetyReports = [], isLoading } = useQuery({ queryKey: ['cc-tile-safety'], queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }) });
  const { isConnected } = useMittiStatus();
  const overdue = isConnected ? safetyReports.flatMap(r => r.action_items || []).filter(a => a && a.due_date && new Date(a.due_date) < new Date()).length : 0;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={ShieldAlert} value={overdue} label="Overdue Actions" sub={isConnected ? (overdue > 0 ? 'Safety items past due' : 'No overdue actions') : 'SafetyCulture not connected'} gradient={overdue > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate'} onClick={onNavigate ? () => onNavigate('compliance') : undefined} arrow />;
}

export function RedAlertsTile({ onNavigate }) {
  const { data: safetyReports = [], isLoading } = useQuery({ queryKey: ['cc-tile-red-alerts'], queryFn: () => base44.entities.SafetyReport.filter({ severity: 'critical', status: 'open' }, '-created_date', 10) });
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={ShieldAlert} value={safetyReports.length} label="Red Alerts" sub={safetyReports.length > 0 ? 'Critical safety items' : 'No critical alerts'} gradient={safetyReports.length > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate'} onClick={onNavigate ? () => onNavigate('compliance') : undefined} arrow />;
}

export function FleetComplianceTile({ onNavigate }) {
  const { data: assets = [], isLoading } = useQuery({ queryKey: ['cc-tile-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const active = assets.filter(a => a.is_active !== false);
  const compliant = active.filter(a => a.compliance_status === 'compliant').length;
  const pct = active.length > 0 ? Math.round((compliant / active.length) * 100) : 0;
  if (isLoading) return <LoadingTile />;
  return <StatCard icon={ShieldCheck} value={`${pct}%`} label="Fleet Compliance" sub={`${compliant}/${active.length} assets`} gradient={pct < 80 ? 'stat-gradient-amber' : 'stat-gradient-emerald'} onClick={onNavigate ? () => onNavigate('assets') : undefined} arrow />;
}