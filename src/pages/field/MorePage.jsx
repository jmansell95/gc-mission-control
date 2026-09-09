import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, UserCircle, CalendarDays, HelpCircle, LayoutGrid, ClipboardList, Inbox } from 'lucide-react';
import SelfServiceHub from '@/components/staff/SelfServiceHub';
import { useInbox } from '@/hooks/useInbox';
import LiveCrewMap from '@/components/staff/LiveCrewMap';
import ScheduleSplash from '@/components/staff/ScheduleSplash';
import FieldPageShell from '@/components/field/FieldPageShell';
import FieldContainer from '@/components/field/FieldContainer';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { format } from 'date-fns';

export default function MorePage() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { activeDivision, staff, isPlatformAdmin, allStaff, jobs, visibleAssignments, assignmentsLoading, vehicles, clients, rotaWeeks } = ctx;
  const [showScheduleSummary, setShowScheduleSummary] = useState(false);
  const { counts: inboxCounts } = useInbox();

  const publishedWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const latestPublishedWeek = publishedWeekStarts.length > 0 ? [...publishedWeekStarts].sort().reverse()[0] : null;

  const tiles = [];
  tiles.push({
    label: 'Inbox', icon: Inbox,
    onClick: () => navigate('/inbox'),
    className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-[#8DC63F]',
    iconBg: 'bg-gradient-to-br from-[#8DC63F]/15 to-[#8DC63F]/5', iconColor: 'text-[#2E5A1A]', textClass: 'text-slate-800',
    badge: inboxCounts.total || 0,
  });
  if (isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role)) {
    tiles.push({
      label: 'Admin Dashboard', icon: LayoutDashboard,
      onClick: () => navigate('/admin'),
      className: 'bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-lg shadow-[#2E5A1A]/25 glow-brand',
      iconBg: 'bg-white/20', iconColor: 'text-white', textClass: 'text-white',
    });
  }
  if (staff?.delivery_dashboard_enabled) {
    tiles.push({
      label: 'Deliveries', icon: Truck,
      onClick: () => navigate('/deliveries'),
      className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-blue-400',
      iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100/50', iconColor: 'text-blue-600', textClass: 'text-slate-800',
    });
  }
  tiles.push({
    label: 'My Duties', icon: ClipboardList,
    onClick: () => navigate('/my-duties'),
    className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-[#2E5A1A]',
    iconBg: 'bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10', iconColor: 'text-[#2E5A1A]', textClass: 'text-slate-800',
  });
  tiles.push({
    label: 'Profile', icon: UserCircle,
    onClick: () => navigate('/staff-profile'),
    className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-violet-400',
    iconBg: 'bg-gradient-to-br from-violet-50 to-violet-100/50', iconColor: 'text-violet-600', textClass: 'text-slate-800',
  });
  tiles.push({
    label: 'Schedule', icon: CalendarDays,
    onClick: () => setShowScheduleSummary(true),
    className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-[#2E5A1A]',
    iconBg: 'bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10', iconColor: 'text-[#2E5A1A]', textClass: 'text-slate-800',
  });
  tiles.push({
    label: 'Help Guides', icon: HelpCircle,
    onClick: () => navigate('/help'),
    className: 'bg-white border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] hover:border-amber-400',
    iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100/50', iconColor: 'text-amber-600', textClass: 'text-slate-800',
  });

  return (
    <FieldPageShell
      title="More"
      subtitle="Self-service, comms & quick links"
      icon={LayoutGrid}
      transparent
      contentClassName="pb-24"
      accentColor={activeDivision?.color}
    >
      <DivisionIdentityBar />
      <FieldContainer space="4">
        {/* Quick link tiles — 2 col on phone, 3 on tablet, 4 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button key={tile.label} onClick={tile.onClick} type="button"
                className={`rounded-2xl flex flex-col items-center gap-3 p-5 hover:shadow-lg active:scale-95 transition touch-manipulation ${tile.className}`}>
                <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${tile.iconBg}`}>
                  <Icon className={`w-7 h-7 ${tile.iconColor}`} strokeWidth={2.5} />
                  {tile.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
                      {tile.badge > 9 ? '9+' : tile.badge}
                    </span>
                  )}
                </div>
                <span className={`text-base font-bold ${tile.textClass}`}>{tile.label}</span>
              </button>
            );
          })}
        </div>

        {/* Self-Service Hub */}
        <div className="field-card p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-1">Self-Service & Comms</h3>
          <p className="text-xs text-slate-500 mb-3">Request time off, swap shifts, message your crew</p>
          <SelfServiceHub
            staff={staff}
            divisionId={activeDivision?.id}
            divisionStaff={allStaff}
            myAssignments={visibleAssignments.map(a => ({
              ...a,
              jobName: jobs.find(j => j.id === a.job_id)?.name,
              location: jobs.find(j => j.id === a.job_id)?.location,
            }))}
            isManager={staff?.is_admin || isPlatformAdmin}
          />
        </div>

        {/* Live Crew Map */}
        <div className="field-card p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-1">Crew Map — Today</h3>
          <p className="text-xs text-slate-500 mb-3">See where your crew is deployed right now</p>
          <LiveCrewMap
            divisionId={activeDivision?.id}
            staff={staff}
            jobs={jobs}
            allStaff={allStaff}
          />
        </div>
      </FieldContainer>

      {showScheduleSummary && (
        <ScheduleSplash
          assignments={visibleAssignments} jobs={jobs} vehicles={vehicles} clients={clients}
          teams={ctx.teams} staff={staff}
          weekStart={latestPublishedWeek || (visibleAssignments[0]?.week_start) || format(new Date(), 'yyyy-MM-dd')}
          loading={assignmentsLoading} reviewMode
          acknowledgedAt={staff?.schedule_acknowledged_at}
          onClose={() => setShowScheduleSummary(false)}
        />
      )}
    </FieldPageShell>
  );
}