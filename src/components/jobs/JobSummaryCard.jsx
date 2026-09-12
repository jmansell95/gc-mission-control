import React, { useState } from 'react';
import {
  MapPin, CalendarClock, Users, Ruler, PoundSterling, Layers,
  FileText, Eye, Edit2, Copy, Trash2, FolderOpen, User, Phone, Mountain, Wrench, StickyNote,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, CircleDashed, Building2, Zap,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import WeatherBadge from '@/components/weather/WeatherBadge';
import QuickEditJobModal from '@/components/jobs/QuickEditJobModal';
import MiniLocationMap from '@/components/jobs/MiniLocationMap';
import What3WordsPill from '@/components/jobs/What3WordsPill';
import LiveMarginBadge from '@/components/dashboard/LiveMarginBadge';

const STATUS_META = {
  planning: { label: 'Planning', icon: CircleDashed, grad: 'from-slate-500 to-slate-600', chip: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200', text: 'text-slate-700' },
  in_progress: { label: 'In Progress', icon: TrendingUp, grad: 'from-[#2E5A1A] to-[#4d7c2a]', chip: 'bg-primary/15 text-primary ring-1 ring-primary/20', text: 'text-primary' },
  decommissioning: { label: 'Decommissioning', icon: AlertTriangle, grad: 'from-orange-500 to-amber-600', chip: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200', text: 'text-orange-700' },
  completed: { label: 'Completed', icon: CheckCircle2, grad: 'from-teal-500 to-cyan-600', chip: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200', text: 'text-teal-700' },
  on_hold: { label: 'On Hold', icon: Clock, grad: 'from-amber-500 to-yellow-600', chip: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', text: 'text-amber-700' },
  cancelled: { label: 'Cancelled', icon: AlertTriangle, grad: 'from-red-500 to-rose-600', chip: 'bg-red-100 text-red-700 ring-1 ring-red-200', text: 'text-red-700' },
};

const fmtDateShort = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM') : '—'; } catch { return d || '—'; }
};
const calcDuration = (start, end) => {
  if (!start || !end) return null;
  try {
    const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
    return days <= 0 ? 1 : days;
  } catch { return null; }
};

const STAT_TONES = {
  slate: 'bg-slate-100 text-slate-500',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  orange: 'bg-orange-100 text-orange-600',
  brand: 'bg-primary/10 text-primary',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-600',
};

function StatTile({ icon: Icon, label, value, tone = 'slate' }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-slate-50/70 border border-slate-100/80">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${STAT_TONES[tone]}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-ui-micro font-semibold uppercase tracking-wider text-slate-400 leading-none">{label}</div>
        <div className="text-ui-body font-bold text-slate-800 leading-tight mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-ui-micro text-slate-400 uppercase font-medium flex-shrink-0">{label}</span>
      <span className="text-ui-body text-slate-700 font-medium truncate">{value}</span>
    </div>
  );
}

export default function JobSummaryCard({
  job, client, parentClient, project, siblingCount, crewCount, rigCount, jobTypes, teams, cloningId,
  onView, onEdit, onClone, onDelete, onProjectClick,
}) {
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const duration = calcDuration(job.start_date, job.end_date);
  const isDrillingJob = ['cp', 'rotary', 'mixed'].includes(job.drilling_method);
  const methodLabel = { cp: 'CP', rotary: 'Rotary', mixed: 'CP + Rotary' }[job.drilling_method] || '';
  const siteCount = Array.isArray(job.sites) ? job.sites.length : 0;
  const status = STATUS_META[job.status || 'planning'] || STATUS_META.planning;
  const StatusIcon = status.icon;

  // Partner badge logic — shows parent group (e.g. Phenna Group) alongside the
  // operating entity (e.g. Concept) so managers can instantly tell which group
  // a partner job belongs to while still identifying the specific subsidiary.
  const showPartnerBadge = client?.is_partner;
  const partnerColor = client?.partner_color || '#2563eb';

  const hasCoords = job.site_lat != null && job.site_lng != null;

  return (
    <>
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-white border border-slate-200/80"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 4px 16px -4px rgba(15,23,42,0.06)' }}
      onClick={() => onView(job)}
    >
      {/* Gradient header — status-colored with overlay pattern */}
      <div className={`relative h-14 bg-gradient-to-r ${status.grad} overflow-hidden`}>
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2), transparent 50%)' }} />
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm ${status.text}`}>
              <StatusIcon className="w-3 h-3" /> {status.label}
            </span>
            {job.status === 'in_progress' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
          </div>
          {job.job_reference && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-white/90 bg-white/15 backdrop-blur-sm px-2 py-1 rounded-md">
              <FileText className="w-2.5 h-2.5" />{job.job_reference}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 space-y-3">
        {/* Badges row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-1.5">
              <DisciplinePills job={job} size="sm" />
              <LiveMarginBadge job={job} />
              {job.site_lat != null && job.site_lng != null && (
                <WeatherBadge lat={job.site_lat} lng={job.site_lng} />
              )}
            </div>
            {/* Partner badge — shows parent group + operating entity */}
            {showPartnerBadge && (
              <div className="flex flex-wrap gap-1">
                {parentClient && (
                  <div
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold w-fit"
                    style={{
                      backgroundColor: (parentClient.partner_color || partnerColor) + '15',
                      color: parentClient.partner_color || partnerColor,
                    }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">Group</span>
                    <span className="opacity-30">·</span>
                    <span className="truncate">{parentClient.name}</span>
                  </div>
                )}
                <div
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold w-fit"
                  style={{
                    backgroundColor: partnerColor + '15',
                    color: partnerColor,
                  }}
                >
                  {parentClient && <span className="opacity-30">↳</span>}
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">Partner</span>
                  <span className="opacity-30">·</span>
                  <span className="truncate">{client.name}</span>
                </div>
              </div>
            )}
          </div>
          {/* Mini calendar tile — top-right corner */}
          <div className="flex-shrink-0 relative">
            <div className="w-14 rounded-lg overflow-hidden shadow-sm border border-slate-200 bg-white">
              <div className={`h-1.5 bg-gradient-to-r ${status.grad}`} />
              <div className="px-1.5 pt-1 pb-1.5 text-center">
                <div className="text-[8px] font-bold uppercase tracking-wider text-primary leading-none">
                  {job.start_date ? format(parseISO(job.start_date), 'MMM') : 'TBC'}
                </div>
                <div className="text-base font-bold text-slate-800 leading-none mt-0.5 tabular-nums">
                  {job.start_date ? format(parseISO(job.start_date), 'dd') : '—'}
                </div>
                <div className="text-[8px] text-slate-400 leading-none mt-1 flex items-center justify-center gap-0.5">
                  <CalendarClock className="w-2.5 h-2.5" />
                  {job.end_date ? format(parseISO(job.end_date), 'dd MMM') : '—'}
                </div>
              </div>
            </div>
            {job.requisition_list_url && <FileText className="w-3 h-3 text-primary absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100" title="Has requisition list" />}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-2">{job.name}</h3>

        {/* Project + client */}
        <div className="space-y-0.5">
          {project && (
            <button onClick={(e) => { e.stopPropagation(); onProjectClick?.(e); }} className="flex items-center gap-1.5 hover:underline">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-medium text-indigo-600 truncate">{project.name}</span>
              <span className="text-[10px] text-slate-400">· {siblingCount} job{siblingCount !== 1 ? 's' : ''}</span>
            </button>
          )}
          {client && <p className="text-xs text-slate-400 truncate">{client.name}</p>}
        </div>

        {/* Location */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
            {siteCount > 1 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold flex-shrink-0">
                <Layers className="w-3 h-3" />{siteCount} sites
              </span>
            )}
          </div>
          {job.what3words && <What3WordsPill value={job.what3words} size="sm" />}
        </div>

        {/* Mini location map — visual site pinpoint */}
        {hasCoords && (
          <MiniLocationMap lat={job.site_lat} lng={job.site_lng} label={job.name} height={100} />
        )}

        {/* Stat tiles — subtle, modern */}
        <div className="grid grid-cols-2 gap-2">
          <StatTile icon={CalendarClock} label="Duration" value={duration != null ? `${duration} ${duration === 1 ? 'day' : 'days'}` : 'TBC'} tone={duration == null ? 'slate' : duration <= 7 ? 'blue' : duration <= 30 ? 'amber' : 'violet'} />
          <StatTile icon={Users} label="Crew" value={crewCount > 0 ? `${crewCount} ${crewCount === 1 ? 'person' : 'people'}` : 'Unassigned'} tone={crewCount > 0 ? 'emerald' : 'slate'} />
          {isDrillingJob && (
            <StatTile icon={Mountain} label="Method" value={methodLabel} tone="cyan" />
          )}
          {rigCount > 0 && (
            <StatTile icon={Wrench} label="Rigs" value={`${rigCount} ${rigCount === 1 ? 'rig' : 'rigs'}`} tone="orange" />
          )}
          {job.budget_amount != null && job.budget_amount > 0 && (
            <StatTile icon={PoundSterling} label="Budget" value={`£${Number(job.budget_amount).toLocaleString()}`} tone="brand" />
          )}
          {job.meterage_target != null && job.meterage_target > 0 && (
            <StatTile icon={Ruler} label="Target" value={`${job.meterage_target}m`} tone="fuchsia" />
          )}
        </div>

        {/* Details grid — full contact & management info */}
        <div className="grid grid-cols-1 gap-y-1.5 text-xs pt-0.5 border-t border-slate-100 pt-2.5">
          {job.project_manager && <DetailItem icon={User} label="Project Manager" value={job.project_manager} />}
          {job.site_contact_name && <DetailItem icon={User} label="Site Contact" value={job.site_contact_name} />}
          {job.site_contact_phone && <DetailItem icon={Phone} label="Site Phone" value={job.site_contact_phone} />}
        </div>

        {/* Notes preview */}
        {job.notes && (
          <div className="flex items-start gap-1.5 text-xs text-slate-400 pt-1 border-t border-slate-100">
            <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p className="line-clamp-2 break-words">{job.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onView(job)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/90 transition">
          <Eye className="w-4 h-4" /> View Details
        </button>
        <div className="flex gap-1">
          <button onClick={() => setShowQuickEdit(true)} className="inline-flex items-center gap-1 px-2 py-1.5 text-primary hover:bg-primary/10 rounded-lg transition text-xs font-semibold" title="Quick edit location, dates, status & notes">
            <Zap className="w-3.5 h-3.5" /> Quick Edit
          </button>
          <button onClick={() => onEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Full edit"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => onClone(job)} disabled={cloningId === job.id} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition disabled:opacity-50" title="Clone job"><Copy className="w-4 h-4" /></button>
          <button onClick={() => onDelete(job.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

    </div>

      {/* Quick edit modal — rendered OUTSIDE the card so the card's hover
          transform doesn't create a containing block that traps the
          fixed-position popup inside the card. */}
      <QuickEditJobModal open={showQuickEdit} onClose={() => setShowQuickEdit(false)} job={job} />
    </>
  );
}