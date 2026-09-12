import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, UserCircle, CalendarDays, HelpCircle,
  ClipboardList, Inbox, Users, MapPin, LogOut,
} from 'lucide-react';
import { staggerContainer, slideUp, bounceTap } from '@/lib/fieldAnimations';
import { useInbox } from '@/hooks/useInbox';
import { base44 } from '@/api/base44Client';
import LiveCrewMap from '@/components/staff/LiveCrewMap';
import ScheduleSplash from '@/components/staff/ScheduleSplash';
import FieldPageShell from '@/components/field/FieldPageShell';
import FieldContainer from '@/components/field/FieldContainer';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { format } from 'date-fns';

/**
 * MorePage — the "More" tab on the field bottom navigation.
 *
 * Shows a unified grid of secondary navigation tiles (Inbox, My Team,
 * Admin Dashboard, Schedule, Help, Sign Out) plus the live crew map.
 * Uses the same field-card + gradient icon design as the Home hub.
 */
export default function MorePage() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { activeDivision, staff, isPlatformAdmin, allStaff, jobs, visibleAssignments, assignmentsLoading, vehicles, clients, rotaWeeks } = ctx;
  const [showScheduleSummary, setShowScheduleSummary] = useState(false);
  const { counts: inboxCounts } = useInbox();

  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);
  const inboxCount = inboxCounts?.total || 0;

  const publishedWeekStarts = rotaWeeks.filter((w) => w.status === 'published' && !w.superseded).map((w) => w.week_start);
  const latestPublishedWeek = publishedWeekStarts.length > 0 ? [...publishedWeekStarts].sort().reverse()[0] : null;

  const tiles = [
    { label: 'Inbox', icon: Inbox, gradient: 'stat-gradient-rose', badge: inboxCount, onClick: () => navigate('/inbox') },
    ...(isAdmin ? [{ label: 'My Team', icon: Users, gradient: 'stat-gradient-indigo', onClick: () => navigate('/manager-team') }] : []),
    ...(isAdmin ? [{ label: 'Admin Dashboard', icon: LayoutDashboard, gradient: 'stat-gradient-teal', onClick: () => navigate('/admin') }] : []),
    { label: 'My Duties', icon: ClipboardList, gradient: 'stat-gradient-amber', onClick: () => navigate('/my-duties') },
    { label: 'My Profile', icon: UserCircle, gradient: 'stat-gradient-violet', onClick: () => navigate('/staff-profile') },
    ...(staff?.delivery_dashboard_enabled ? [{ label: 'Deliveries', icon: Truck, gradient: 'stat-gradient-blue', onClick: () => navigate('/deliveries') }] : []),
    { label: 'Schedule', icon: CalendarDays, gradient: 'stat-gradient-brand', onClick: () => setShowScheduleSummary(true) },
    { label: 'Help Guides', icon: HelpCircle, gradient: 'stat-gradient-slate', onClick: () => navigate(isAdmin ? '/help' : '/help-field') },
  ];

  const handleSignOut = async () => {
    try {
      await base44.auth.logout('/login');
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <FieldPageShell
      staff={staff}
      stats={inboxCount > 0 ? [{ label: 'Inbox', value: inboxCount, icon: Inbox, gradient: 'stat-gradient-rose' }] : []}
      transparent
      contentClassName="pb-24"
      accentColor={activeDivision?.color}
    >
      <FieldContainer space="5">
        {/* Navigation tiles */}
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiles.map((tile) => (
            <TileCard key={tile.label} tile={tile} />
          ))}
        </motion.div>

        {/* Sign Out button */}
        <motion.button
          variants={slideUp}
          {...bounceTap}
          onClick={handleSignOut}
          className="w-full field-card p-4 flex items-center justify-center gap-2.5 text-rose-600 touch-manipulation"
        >
          <LogOut className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-sm font-bold">Sign Out</span>
        </motion.button>

        {/* Live Crew Map */}
        <motion.div variants={slideUp}>
          <div className="field-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#2E5A1A]" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Crew Map — Today</h3>
                <p className="text-[10px] text-slate-400">See where your crew is deployed right now</p>
              </div>
            </div>
            <LiveCrewMap
              divisionId={activeDivision?.id}
              staff={staff}
              jobs={jobs}
              allStaff={allStaff}
            />
          </div>
        </motion.div>
      </FieldContainer>

      {showScheduleSummary && (
        <ScheduleSplash
          assignments={visibleAssignments}
          jobs={jobs}
          vehicles={vehicles}
          clients={clients}
          teams={ctx.teams}
          staff={staff}
          weekStart={latestPublishedWeek || visibleAssignments[0]?.week_start || format(new Date(), 'yyyy-MM-dd')}
          loading={assignmentsLoading}
          reviewMode
          acknowledgedAt={staff?.schedule_acknowledged_at}
          onClose={() => setShowScheduleSummary(false)}
        />
      )}
    </FieldPageShell>
  );
}

function TileCard({ tile }) {
  const Icon = tile.icon;
  return (
    <motion.button
      variants={slideUp}
      {...bounceTap}
      onClick={tile.onClick}
      className="field-card p-4 flex flex-col items-center gap-2.5 text-center touch-manipulation relative"
    >
      <div className={`relative w-12 h-12 rounded-2xl ${tile.gradient} flex items-center justify-center shadow-md`}>
        <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
        {tile.badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
            {tile.badge > 9 ? '9+' : tile.badge}
          </span>
        )}
      </div>
      <span className="text-xs font-bold text-slate-700">{tile.label}</span>
    </motion.button>
  );
}