import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MapPin, Calendar, Users, Clock, PoundSterling, TrendingUp, Mountain,
  Activity, FileText, MessageSquare, Target, AlertTriangle,
  Truck, HardHat, ShieldCheck, Building2, Phone, User, FolderOpen,
  Loader2, RefreshCw, Gauge, ArrowRightLeft, Receipt,
  Send, CheckCircle2, CalendarClock, UsersRound,   Briefcase, UserPlus,
  ChevronRight, Navigation,
} from 'lucide-react';
import { format } from 'date-fns';
import { getJobTypeLabel } from '@/utils/jobTeams';
import { getTotalMetres } from '@/utils/geotechBilling';

import QuickAssignStaffModal from '@/components/jobs/QuickAssignStaffModal';
import DecommissioningBanner from '@/components/decommissioning/DecommissioningBanner';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import DisciplineEditorModal from '@/components/disciplines/DisciplineEditorModal';
import SubcontractorCrewCard from '@/components/jobs/SubcontractorCrewCard';
import JobOverviewExtras from '@/components/jobs/JobOverviewExtras';
import { Pencil } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

const METHOD_LABELS = {
  cp: { label: 'CP', full: 'Cable Percussion', dot: 'bg-blue-500', text: 'text-blue-700' },
  rotary: { label: 'Rotary', full: 'Rotary Core', dot: 'bg-orange-500', text: 'text-orange-700' },
  mixed: { label: 'Mixed', full: 'Mixed Methods', dot: 'bg-purple-500', text: 'text-purple-700' },
  not_applicable: { label: 'N/A', full: 'Non-Drilling', dot: 'bg-slate-400', text: 'text-slate-500' },
};

function VitalsField({ label, icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
        <div className="text-sm text-slate-800 font-medium">{children}</div>
      </div>
    </div>
  );
}

function FinTile({ label, value, icon: Icon, gradient, sub }) {
  return (
    <div className={'rounded-xl p-3 text-white ' + gradient}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-white/70 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActivityItem({ icon: Icon, iconColor, title, subtitle, time, badge }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-0">
      <div className={'w-7 h-7 rounded-lg ' + iconColor + ' flex items-center justify-center flex-shrink-0'}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-800 truncate">{title}</p>
          {badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 flex-shrink-0">{badge}</span>}
        </div>
        <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
      </div>
      {time && <span className="text-[10px] text-slate-400 flex-shrink-0 whitespace-nowrap">{time}</span>}
    </div>
  );
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd';
  return format(d, 'dd MMM');
}

function CrewCompositionBar({ assignedStaff, rotas, contractors, onAddStaff }) {
  if (!assignedStaff || assignedStaff.length === 0) return null;
  const direct = assignedStaff.filter(s => !s.worker_type || s.worker_type === 'direct_employee');
  const subbies = assignedStaff.filter(s => s.worker_type === 'subcontractor');
  const agency = assignedStaff.filter(s => s.worker_type === 'agency');
  const total = assignedStaff.length;
  const segments = [
    { label: 'Direct', count: direct.length, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', icon: User },
    { label: 'Subcontractor', count: subbies.length, color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', icon: HardHat },
    { label: 'Agency', count: agency.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', icon: Briefcase },
  ].filter(s => s.count > 0);

  return (
    <div className="insight-card rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm icon-tile-glow">
          <UsersRound className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Crew Composition</h3>
          <p className="text-xs text-slate-500">{total} {total === 1 ? 'person' : 'people'} on this job</p>
        </div>
        {onAddStaff && (
          <button onClick={onAddStaff} className="flex items-center gap-1 text-[11px] font-bold text-[#2E5A1A] hover:bg-[#2E5A1A]/10 px-2.5 py-1.5 rounded-lg transition flex-shrink-0">
            <UserPlus className="w-3.5 h-3.5" /> Add Staff
          </button>
        )}
      </div>

      {/* Proportional bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-4 shadow-inner">
        {segments.map(s => (
          <div key={s.label} className={s.color + ' transition-all duration-500'} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>

      {/* Type cards — compact inline row */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {segments.map(s => {
          const Icon = s.icon;
          const staffList = s.label === 'Direct' ? assignedStaff.filter(st => !st.worker_type || st.worker_type === 'direct_employee')
            : s.label === 'Subcontractor' ? assignedStaff.filter(st => st.worker_type === 'subcontractor')
            : assignedStaff.filter(st => st.worker_type === 'agency');
          const withShifts = staffList.filter(st => rotas.some(r => r.staff_id === st.id)).length;
          return (
            <div key={s.label} className={'flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ' + s.light + ' border-slate-200'}>
              <div className={'w-8 h-8 rounded-lg ' + s.color + ' flex items-center justify-center flex-shrink-0'}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className={'text-xs font-bold ' + s.text}>{s.label}</p>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {s.count} <span className="text-xs font-normal text-slate-500">· {withShifts} with shifts</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff listing with lead/second man for subcontractor/agency workers */}
      {(() => {
        const externalStaff = assignedStaff.filter(s => s.worker_type === 'subcontractor' || s.worker_type === 'agency');
        const withCrew = externalStaff.filter(s => s.lead_driller_name || s.second_man_name);
        if (withCrew.length === 0) return null;
        return (
          <div className="mt-3 space-y-1">
            {withCrew.map(s => {
              const parts = [];
              if (s.lead_driller_name) parts.push(`Lead: ${s.lead_driller_name}`);
              if (s.second_man_name) parts.push(`Second: ${s.second_man_name}`);
              return (
                <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50">
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${s.worker_type === 'agency' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    {s.worker_type === 'agency' ? <Briefcase className="w-2.5 h-2.5 text-blue-600" /> : <HardHat className="w-2.5 h-2.5 text-orange-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 truncate">{s.name}</p>
                    <p className="text-[10px] text-blue-600 font-medium truncate">{parts.join(' · ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

function SetupChecklist({ job, rotas, hotelBookings }) {
  return (
    <div className="rounded-xl p-4 bg-gradient-to-br from-slate-50 to-[#2E5A1A]/5 border border-emerald-200">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="font-semibold text-slate-900 text-sm">Setup Checklist</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className={`rounded-lg p-2.5 border ${job.required_team_ids?.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            {job.required_team_ids?.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <UsersRound className="w-3.5 h-3.5 text-slate-400" />}
            <p className="text-xs font-bold text-slate-800">1. Teams</p>
          </div>
          <p className="text-[11px] text-slate-500">{job.required_team_ids?.length > 0 ? `${job.required_team_ids.length} assigned` : 'Pick required teams'}</p>
        </div>
        <div className={`rounded-lg p-2.5 border ${hotelBookings?.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            {hotelBookings?.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <CalendarClock className="w-3.5 h-3.5 text-slate-400" />}
            <p className="text-xs font-bold text-slate-800">2. Hotels <span className="font-normal text-slate-400">(opt)</span></p>
          </div>
          <p className="text-[11px] text-slate-500">{hotelBookings?.length > 0 ? `${hotelBookings.length} booking(s)` : 'Add if needed'}</p>
        </div>
        <div className={`rounded-lg p-2.5 border ${rotas.length > 0 ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            {rotas.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <CalendarClock className="w-3.5 h-3.5 text-slate-400" />}
            <p className="text-xs font-bold text-slate-800">3. Rota</p>
          </div>
          <p className="text-[11px] text-slate-500">{rotas.length > 0 ? `${rotas.length} shifts` : 'Build the rota'}</p>
        </div>
        <div className={`rounded-lg p-2.5 border ${job.status === 'in_progress' || job.status === 'completed' ? 'border-[#2E5A1A]/20 bg-[#2E5A1A]/5' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            {job.status === 'in_progress' || job.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <Send className="w-3.5 h-3.5 text-slate-400" />}
            <p className="text-xs font-bold text-slate-800">4. Publish</p>
          </div>
          <p className="text-[11px] text-slate-500">{job.status === 'in_progress' || job.status === 'completed' ? 'Activated' : 'Submit to email staff'}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * JobContextView — the merged Summary view.
 * Combines job vitals, crew, vehicles, live financials, drilling performance,
 * recent activity, project links, portal, and notes into one high-density pane.
 * Duplicate info already shown in the hero header (location, dates, budget,
 * status, type, name) is omitted here.
 */
export default function JobContextView({ job, primaryType, assignedStaff, rotas, allStaff, client, contractor, suppliers, vehicles, hotelBookings, canSeeCosts, isDrillingJob, colors, statusBadge: sb, statusLabels: sl, startDate, endDate, jobTypes }) {
  const navigate = useNavigate();
  const [activeActivity, setActiveActivity] = useState('all');
  const [showAssignStaff, setShowAssignStaff] = useState(false);
  const [showDisciplineEditor, setShowDisciplineEditor] = useState(false);

  const { data: fin, isLoading: finLoading, error: finError, refetch, isFetching } = useQuery({
    queryKey: ['auto-job-financials', job.id],
    queryFn: async () => { const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id }); return res.data; },
    enabled: !!job.id && canSeeCosts,
    retry: 1,
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['ctx-recent-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }, '-created_date', 12),
  });

  const { data: allInvLogs = [] } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });
  const reconciledTotalMetres = getTotalMetres(allInvLogs);
  const { data: recentComments = [] } = useQuery({
    queryKey: ['ctx-recent-comments', job.id],
    queryFn: () => base44.entities.JobComment.filter({ job_id: job.id }, '-created_date', 8),
  });
  const { data: recentMilestones = [] } = useQuery({
    queryKey: ['ctx-recent-milestones', job.id],
    queryFn: () => base44.entities.JobMilestone.filter({ job_id: job.id }, '-created_date', 6),
  });
  const { data: recentCosts = [] } = useQuery({
    queryKey: ['ctx-recent-costs', job.id],
    queryFn: () => base44.entities.DailyCost.filter({ job_id: job.id }, '-date', 6),
  });
  const { data: recentSubcon = [] } = useQuery({
    queryKey: ['ctx-recent-subcon', job.id],
    queryFn: () => base44.entities.SubcontractorLog.filter({ job_id: job.id }, '-date', 6),
  });

  // Fetch contractors so we can show which company each subcontractor/agency worker is from
  const hasExternalStaff = assignedStaff.some(st => (st.worker_type === 'subcontractor' || st.worker_type === 'agency') && st.agency_id);
  const { data: contractors = [] } = useQuery({
    queryKey: ['ctx-contractors'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 500),
    enabled: hasExternalStaff,
  });
  const contractorById = new Map(contractors.map(c => [c.id, c]));

  const activityFeed = [
    ...recentLogs.map(l => ({ type: 'log', time: l.created_date || l.date, icon: Activity, iconColor: 'bg-blue-100 text-blue-600', title: l.borehole_ref ? l.borehole_ref + ' — ' + (l.log_type || '').replace(/_/g, ' ') : (l.log_type || '').replace(/_/g, ' '), subtitle: l.description || l.staff_name || 'Site log', badge: l.manager_review_status })),
    ...recentComments.map(c => ({ type: 'comment', time: c.created_date, icon: MessageSquare, iconColor: 'bg-slate-100 text-slate-600', title: c.author_name, subtitle: c.message, badge: c.is_client ? 'Client' : null })),
    ...recentMilestones.map(m => ({ type: 'milestone', time: m.created_date || m.target_date, icon: Target, iconColor: 'bg-amber-100 text-amber-600', title: m.title || m.label, subtitle: m.description || (m.is_complete ? 'Completed' : 'Pending') })),
    ...recentCosts.map(c => ({ type: 'cost', time: c.date, icon: Receipt, iconColor: 'bg-violet-100 text-violet-600', title: c.category + ' · ' + fmt2(c.amount_net), subtitle: c.description || c.staff_name })),
    ...recentSubcon.map(s => ({ type: 'subcon', time: s.date, icon: ArrowRightLeft, iconColor: 'bg-orange-100 text-orange-600', title: (s.subcontractor_name || 'Sub-con') + ' · ' + s.work_type, subtitle: 'Buy ' + fmt2(s.purchase_cost_net) + ' → Sell ' + fmt2(s.client_charge_net), badge: s.status })),
  ].filter(a => a.time).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 14);

  const filteredFeed = activeActivity === 'all' ? activityFeed : activityFeed.filter(a => a.type === activeActivity);

  const s = fin?.summary || {};
  const dp = fin?.drilling_performance || {};
  const dm = fin?.drilling_method || {};
  const bs = fin?.billing_setup || {};

  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const assignedVehicles = assignedVehicleIds.map(id => vehicles?.find(v => v.id === id)).filter(Boolean);

  return (
    <div className="space-y-3">
      <>
      {/* Setup checklist for planning jobs */}
      {job.status === 'planning' && (
        <SetupChecklist job={job} rotas={rotas} hotelBookings={hotelBookings} />
      )}

      {/* Decommissioning banner — shown when job is in decommissioning */}
      <DecommissioningBanner job={job} />

      {/* Multi-discipline pills — at-a-glance visibility, with inline edit */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DisciplinePills job={job} size="md" showStatus />
        <button
          onClick={() => setShowDisciplineEditor(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E5A1A] bg-[#2E5A1A]/10 hover:bg-[#2E5A1A]/20 px-3 py-1.5 rounded-lg transition flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit Disciplines
        </button>
      </div>

      {/* Visual crew composition — direct / subcontractor / agency breakdown */}
      {assignedStaff.length > 0 ? (
        <CrewCompositionBar assignedStaff={assignedStaff} rotas={rotas} contractors={contractors} onAddStaff={() => setShowAssignStaff(true)} />
      ) : (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm icon-tile-glow">
              <UsersRound className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">Crew Composition</h3>
              <p className="text-xs text-slate-500">No crew assigned yet</p>
            </div>
            <button onClick={() => setShowAssignStaff(true)} className="flex items-center gap-1 text-[11px] font-bold text-[#2E5A1A] hover:bg-[#2E5A1A]/10 px-2.5 py-1.5 rounded-lg transition flex-shrink-0">
              <UserPlus className="w-3.5 h-3.5" /> Add Staff
            </button>
          </div>
        </div>
      )}

      {/* Subcontractors & agency staff from the Subcontractors wizard step */}
      <SubcontractorCrewCard job={job} />

      {/* Enriched overview: contacts, site info, weather, progress stats */}
      <JobOverviewExtras job={job} client={client} contractor={contractor} invLogs={allInvLogs} canSeeCosts={canSeeCosts} fin={fin} isDrillingJob={isDrillingJob} />

      {/* Main 3-pane grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT PANE: Details + Crew + Vehicles */}
        <div className="lg:col-span-3 space-y-3">
          {/* Details — no duplicates with hero (location, dates, budget, status, type, name all in hero) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Details</h3>
            </div>
            <div className="px-4 py-1 divide-y divide-slate-50">
              {job.job_reference && <VitalsField label="Reference" icon={FileText}>{job.job_reference}</VitalsField>}
              {client && <VitalsField label="Client" icon={Building2}>{client.name}</VitalsField>}
              {contractor && <VitalsField label="Contractor" icon={HardHat}>{contractor.name}</VitalsField>}
              {job.project_manager && <VitalsField label="Project Manager" icon={User}>{job.project_manager}</VitalsField>}
              {job.site_contact_name && <VitalsField label="Site Contact" icon={Phone}>{job.site_contact_name}{job.site_contact_phone ? ' · ' + job.site_contact_phone : ''}</VitalsField>}
              {!job.job_reference && !client && !contractor && !job.project_manager && !job.site_contact_name && (
                <p className="text-xs text-slate-400 py-3 text-center">No details set</p>
              )}
            </div>
          </div>

          {/* Vehicles */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-3.5 h-3.5 text-violet-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Vehicles</h3>
              <span className="ml-auto text-xs font-bold text-slate-900">{assignedVehicles.length || ''}</span>
            </div>
            {assignedVehicles.length > 0 ? (
              <div className="space-y-1.5">
                {assignedVehicles.map(v => {
                  const liveDriver = v.current_operator_name || v.geotab_driver_name;
                  return (
                  <button key={v.id} type="button" onClick={() => navigate(`/fleet?vehicle=${v.id}`)}
                    className="w-full flex items-center gap-2 p-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition group text-left">
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Truck className="w-3 h-3 text-slate-500 group-hover:text-[#2E5A1A] transition" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-bold text-slate-900">{v.registration_number}</p>
                      <p className="text-[11px] text-slate-500 truncate">{v.name}</p>
                      {liveDriver && (
                        <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 truncate">
                          <Navigation className="w-2.5 h-2.5 flex-shrink-0" /> {liveDriver}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2E5A1A] flex-shrink-0 transition" />
                  </button>
                  );
                })}
                {job.requisition_list_url && (
                  <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/20 rounded-lg text-xs font-medium transition">
                    <FileText className="w-3 h-3" /> Requisition List
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No vehicles assigned</p>
            )}
          </div>
        </div>

        {/* CENTER PANE: Live Financials + Drilling */}
        <div className="lg:col-span-5 space-y-3">
          {canSeeCosts ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg stat-gradient-brand flex items-center justify-center">
                  <PoundSterling className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Live Financials</h3>
                <span className="ml-auto text-[10px] text-slate-400">{s.revenue_method_label || s.revenue_method || '—'}</span>
                <button onClick={() => refetch()} disabled={isFetching} className="p-1 text-slate-400 hover:text-[#2E5A1A] transition">
                  <RefreshCw className={'w-3.5 h-3.5 ' + (isFetching ? 'animate-spin' : '')} />
                </button>
              </div>

              {finLoading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>
              ) : finError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <AlertTriangle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                  <p className="text-xs text-red-700 font-medium">Couldn't load financials</p>
                  <p className="text-[10px] text-red-500 mt-0.5">{finError.message}</p>
                  <button onClick={() => refetch()} className="text-[10px] text-red-600 font-medium mt-1 underline">Retry</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <FinTile label="Revenue" value={fmt(s.total_revenue_net)} icon={TrendingUp} gradient="stat-gradient-brand" sub={s.total_revenue_vat ? '+' + fmt(s.total_revenue_vat) + ' VAT' : ''} />
                    <FinTile label="Cost" value={fmt(s.total_cost_net)} icon={PoundSterling} gradient="stat-gradient-amber" />
                    <FinTile label="Profit" value={fmt(s.profit)} icon={TrendingUp} gradient={s.profit >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose'} />
                    <FinTile label="Margin" value={(s.margin_pct || 0).toFixed(1) + '%'} icon={Target} gradient="stat-gradient-violet" />
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2.5 mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-slate-500 font-medium">Revenue mix</span>
                      <span className="text-slate-400">{fmt(s.total_revenue_net)} total</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
                      {s.meterage_revenue > 0 && <div className="bg-blue-500" style={{ width: (s.total_revenue_net > 0 ? (s.meterage_revenue / s.total_revenue_net) * 100 : 0) + '%' }} title={'Meterage: ' + fmt(s.meterage_revenue)} />}
                      {s.sor_revenue > 0 && <div className="bg-emerald-500" style={{ width: (s.total_revenue_net > 0 ? (s.sor_revenue / s.total_revenue_net) * 100 : 0) + '%' }} title={'SOR: ' + fmt(s.sor_revenue)} />}
                      {s.additional_charges > 0 && <div className="bg-amber-500" style={{ width: (s.total_revenue_net > 0 ? (s.additional_charges / s.total_revenue_net) * 100 : 0) + '%' }} title={'Charges: ' + fmt(s.additional_charges)} />}
                      {fin?.cost_breakdown?.subcon_client_charge_net > 0 && <div className="bg-orange-500" style={{ width: (s.total_revenue_net > 0 ? (fin.cost_breakdown.subcon_client_charge_net / s.total_revenue_net) * 100 : 0) + '%' }} title={'Sub-con: ' + fmt(fin.cost_breakdown.subcon_client_charge_net)} />}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-slate-500">
                      {s.meterage_revenue > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Meterage {fmt(s.meterage_revenue)}</span>}
                      {s.sor_revenue > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />SOR {fmt(s.sor_revenue)}</span>}
                      {s.additional_charges > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Charges {fmt(s.additional_charges)}</span>}
                      {fin?.cost_breakdown?.subcon_client_charge_net > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Sub-con {fmt(fin.cost_breakdown.subcon_client_charge_net)}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Rigs</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(fin?.cost_breakdown?.rig_cost)}</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Crew</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(fin?.cost_breakdown?.crew_cost)}</p>
                    </div>
                    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2">
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Expenses</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(fin?.cost_breakdown?.daily_costs_net)}</p>
                    </div>
                  </div>

                  {bs.warnings?.length > 0 && (
                    <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span className="text-[11px] font-bold text-amber-800">{bs.warnings.length} billing alert{bs.warnings.length !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-[10px] text-amber-700">{bs.warnings[0]}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Financials restricted</p>
              <p className="text-xs text-slate-400 mt-1">Costings visible to admin/management roles only.</p>
            </div>
          )}

          {isDrillingJob && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg stat-gradient-blue flex items-center justify-center">
                  <Mountain className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Drilling Performance</h3>
                <span className={'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 ' + (METHOD_LABELS[dm.job_method]?.text || 'text-slate-500')}>
                  <span className={'w-1.5 h-1.5 rounded-full ' + (METHOD_LABELS[dm.job_method]?.dot || 'bg-slate-300')} />
                  {METHOD_LABELS[dm.job_method]?.full || 'Not set'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="text-center bg-blue-50 rounded-lg border border-blue-100 p-2">
                  <Gauge className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{reconciledTotalMetres.toFixed(1)}m</p>
                  <p className="text-[9px] text-slate-400 uppercase">Drilled</p>
                </div>
                <div className="text-center bg-emerald-50 rounded-lg border border-emerald-100 p-2">
                  <PoundSterling className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(dp.meterage_revenue)}</p>
                  <p className="text-[9px] text-slate-400 uppercase">Revenue</p>
                </div>
                <div className="text-center bg-amber-50 rounded-lg border border-amber-100 p-2">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(dp.profit_per_metre)}</p>
                  <p className="text-[9px] text-slate-400 uppercase">Profit/m</p>
                </div>
                <div className="text-center bg-violet-50 rounded-lg border border-violet-100 p-2">
                  <Truck className="w-3.5 h-3.5 text-violet-600 mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{dp.working_days || 0}</p>
                  <p className="text-[9px] text-slate-400 uppercase">Work days</p>
                </div>
              </div>
              {dp.target_metres > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-medium flex items-center gap-1"><Target className="w-3 h-3" /> Target progress</span>
                    <span className="text-slate-600 font-bold">{dp.target_pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] rounded-full transition-all" style={{ width: dp.target_pct + '%' }} />
                  </div>
                </div>
              )}
              {fin?.rig_profitability?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">Rig profitability ({fin.rig_profitability.length})</p>
                  <div className="space-y-1">
                    {fin.rig_profitability.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        <Truck className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700 font-medium truncate flex-1">{r.rig_name}</span>
                        <span className="text-slate-400">{r.metres_drilled.toFixed(1)}m</span>
                        <span className={'font-bold tabular-nums ' + (r.profit >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(r.profit)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT PANE: Recent Activity Feed */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-16">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-[#2E5A1A]" />
                <h3 className="text-sm font-semibold text-slate-900">Activity Feed</h3>
                <span className="ml-auto text-xs text-slate-400">{activityFeed.length} recent</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'log', label: 'Logs' },
                  { key: 'comment', label: 'Comments' },
                  { key: 'cost', label: 'Costs' },
                  { key: 'subcon', label: 'Sub-con' },
                  { key: 'milestone', label: 'Milestones' },
                ].map(f => (
                  <button key={f.key} onClick={() => setActiveActivity(f.key)}
                    className={'px-2 py-0.5 rounded-full text-[10px] font-bold transition ' + (activeActivity === f.key ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-3 py-1 max-h-[500px] overflow-y-auto">
              {filteredFeed.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No recent activity</p>
                </div>
              ) : (
                filteredFeed.map((a, i) => (
                  <ActivityItem
                    key={i}
                    icon={a.icon}
                    iconColor={a.iconColor}
                    title={a.title}
                    subtitle={a.subtitle}
                    time={relTime(a.time)}
                    badge={a.badge}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </>

      {/* Quick assign staff modal */}
      <QuickAssignStaffModal open={showAssignStaff} onClose={() => setShowAssignStaff(false)} job={job} allStaff={allStaff} rotas={rotas} />

      {/* Discipline editor modal */}
      <DisciplineEditorModal open={showDisciplineEditor} onClose={() => setShowDisciplineEditor(false)} job={job} />
    </div>
  );
}