import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock, ClipboardList, ScanLine, UserCircle,
  HelpCircle, Truck, Inbox, LayoutDashboard, Users,
  ChevronRight, AlertCircle, PackageOpen,
} from 'lucide-react';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { useInbox } from '@/hooks/useInbox';

/**
 * FieldHomeHub — the new card-based home screen for field staff.
 * Replaces the old 5-tab bottom bar with a single scrollable grid of
 * tappable destination cards. Responsive: 1 column on mobile, 2-3 on tablet.
 *
 * Each card shows an icon, title, subtitle/summary, optional badge count,
 * and navigates on tap. The grid is wrapped in FieldPageShell for the
 * consistent field header (with hamburger → FieldDrawer).
 */
export default function FieldHomeHub() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { counts: inboxCounts } = useInbox();

  const {
    staff, isPlatformAdmin, todaysAssignments, upcomingAssignments,
  } = ctx || {};

  const todayCount = todaysAssignments?.length || 0;
  const upcomingCount = upcomingAssignments?.length || 0;
  const inboxCount = inboxCounts?.total || 0;

  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);

  // Build the card list — order matters (most-used first)
  const cards = [
    {
      id: 'schedule',
      label: "Today's Schedule",
      subtitle: todayCount > 0 ? `${todayCount} assignment${todayCount !== 1 ? 's' : ''} today` : 'No assignments today',
      icon: CalendarClock,
      onClick: () => navigate('/today-schedule'),
      gradient: 'from-emerald-500 to-emerald-600',
      badge: todayCount,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'tasks',
      label: 'My Tasks',
      subtitle: 'Ad-hoc & recurring duties',
      icon: ClipboardList,
      onClick: () => navigate('/my-duties'),
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'scan',
      label: 'Scan Asset',
      subtitle: 'Sign out / return gear',
      icon: ScanLine,
      onClick: () => navigate('/scanner'),
      gradient: 'from-[#2E5A1A] to-[#1c4a12]',
    },
    {
      id: 'profile',
      label: 'My Profile',
      subtitle: 'Compliance, training, timesheets',
      icon: UserCircle,
      onClick: () => navigate('/staff-profile'),
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      id: 'upcoming',
      label: 'Upcoming',
      subtitle: upcomingCount > 0 ? `${upcomingCount} upcoming shift${upcomingCount !== 1 ? 's' : ''}` : 'No upcoming shifts',
      icon: CalendarClock,
      onClick: () => navigate('/upcoming'),
      gradient: 'from-teal-500 to-teal-600',
      badge: upcomingCount,
      badgeColor: 'bg-teal-600',
    },
  ];

  // Operations cards
  if (staff?.delivery_dashboard_enabled) {
    cards.push({
      id: 'deliveries',
      label: 'Deliveries',
      subtitle: 'Delivery dashboard & routes',
      icon: Truck,
      onClick: () => navigate('/deliveries'),
      gradient: 'from-sky-500 to-sky-600',
    });
  }

  // Admin cards
  if (inboxCount > 0 || isAdmin) {
    cards.push({
      id: 'inbox',
      label: 'Inbox',
      subtitle: inboxCount > 0 ? `${inboxCount} item${inboxCount !== 1 ? 's' : ''} awaiting action` : 'No pending items',
      icon: Inbox,
      onClick: () => navigate('/inbox'),
      gradient: 'from-amber-500 to-orange-600',
      badge: inboxCount,
      badgeColor: 'bg-amber-500',
    });
  }

  if (isAdmin) {
    cards.push({
      id: 'admin',
      label: 'Admin Dashboard',
      subtitle: 'Mission control overview',
      icon: LayoutDashboard,
      onClick: () => navigate('/admin'),
      gradient: 'from-slate-700 to-slate-800',
    });
    cards.push({
      id: 'team',
      label: 'My Team',
      subtitle: 'Team schedule & overview',
      icon: Users,
      onClick: () => navigate('/manager-team'),
      gradient: 'from-indigo-500 to-indigo-600',
    });
  }

  // Help card (always last)
  cards.push({
    id: 'help',
    label: 'Help Guides',
    subtitle: 'How-to guides & support',
    icon: HelpCircle,
    onClick: () => navigate('/help-field'),
    gradient: 'from-slate-400 to-slate-500',
  });

  return (
    <div className="min-h-full pb-6">
      {/* Greeting header */}
      <div className="px-4 sm:px-6 pt-4 pb-5">
        <div className="flex items-center gap-3">
          {staff?.avatar_url ? (
            <img src={staff.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white shadow-md" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-lg shadow-md">
              {(staff?.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-ui-caption text-slate-500 font-medium">Welcome back</p>
            <h1 className="text-ui-heading font-bold text-slate-900 truncate">{staff?.name || 'Field Crew'}</h1>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={card.onClick}
                className="field-card group relative overflow-hidden text-left p-4 sm:p-5 animate-slide-up active:scale-[0.98] transition-transform"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.2} />
                  </div>
                  {card.badge != null && card.badge > 0 && (
                    <span className={`min-w-[24px] h-6 px-2 rounded-full ${card.badgeColor} text-white text-ui-caption font-bold flex items-center justify-center shadow-md`}>
                      {card.badge > 99 ? '99+' : card.badge}
                    </span>
                  )}
                </div>
                <div className="mt-3 sm:mt-4">
                  <h3 className="text-ui-subheading font-bold text-slate-900">{card.label}</h3>
                  <p className="text-ui-caption text-slate-500 mt-0.5 line-clamp-2">{card.subtitle}</p>
                </div>
                <ChevronRight className="absolute bottom-4 right-4 w-5 h-5 text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}