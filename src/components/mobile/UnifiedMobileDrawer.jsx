import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarClock, ClipboardList, ScanLine, UserCircle, Truck, Inbox,
  LayoutDashboard, Users, HelpCircle, X, ChevronRight, LogOut,
  Grid3x3, Briefcase, Calendar, Boxes, Car, FlaskConical, ShieldCheck,
  PoundSterling, FileBarChart, Settings, ArrowLeftRight, Sparkles, Wrench,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { useInbox } from '@/hooks/useInbox';
import { useAIHub } from '@/components/ai/AIHub';
import { canAccessSection } from '@/utils/access';
import { STANDALONE_ROUTES } from '@/utils/standaloneRoutes';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

const ALL_HUBS = [
  { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
  { id: 'jobs', label: 'Projects Hub', icon: Briefcase },
  { id: 'scheduling', label: 'Scheduling Hub', icon: Calendar },
  { id: 'staff', label: 'People Hub', icon: Users },
  { id: 'logistics', label: 'Logistics Hub', icon: Truck },
  { id: 'assets', label: 'Assets Hub', icon: Boxes },
  { id: 'fleet', label: 'Tracking', icon: Car },
  { id: 'investigation', label: 'Investigation Hub', icon: FlaskConical },
  { id: 'compliance', label: 'Compliance Hub', icon: ShieldCheck },
  { id: 'billing', label: 'Financial Hub', icon: PoundSterling },
  { id: 'reports', label: 'Reports Hub', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * UnifiedMobileDrawer — the single mobile navigation component.
 *
 * Renders a floating hamburger button (top-left) and a slide-out drawer
 * containing all navigation links, role-aware:
 *  - Field staff: Today, Upcoming, Scan, Profile, Duties, Deliveries
 *  - Admin staff: all hubs (Dashboard, Projects, Scheduling, etc.)
 *  - Everyone: Help, Sign Out
 *
 * Replaces both the MobileAppShell bottom tab bar + MoreSheet and the
 * FieldShell's separate FieldDrawer. Exactly one instance should be
 * mounted per mobile view — MobileAppShell renders it for PWA/APK builds,
 * and FieldShell renders it for mobile-browser field routes.
 */
export default function UnifiedMobileDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const { isHubEnabled, activeDivision, isSuperAdmin, permittedDivisions } = useDivision();
  const { counts: inboxCounts } = useInbox();
  const { openHub } = useAIHub();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        setProfile(res.data);
      } catch (e) {}
    })();
  }, []);

  const isPlatformAdmin = authUser?.role === 'admin' || authUser?.role === 'director';
  const isAdmin = isPlatformAdmin || profile?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(profile?.system_role);
  const inboxCount = inboxCounts?.total || 0;

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleNavigate = (path, state) => {
    navigate(path, state ? { state } : undefined);
    onClose();
  };

  const handleHubClick = (hubId) => {
    onClose();
    if (STANDALONE_ROUTES[hubId]) {
      navigate(STANDALONE_ROUTES[hubId]);
    } else {
      navigate('/admin', { state: { section: hubId } });
    }
  };

  const handleSignOut = async () => {
    onClose();
    try {
      await base44.auth.logout('/login');
    } catch {
      window.location.href = '/login';
    }
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Accessible admin hubs (filtered by role + division + readiness)
  const accessibleHubs = useMemo(() => {
    return ALL_HUBS.filter((hub) => {
      if (!canAccessSection(profile, hub.id, isPlatformAdmin)) return false;
      if (!activeDivision && hub.id !== 'settings') return false;
      if (!isHubEnabled(hub.id)) return false;
      return true;
    });
  }, [profile, isPlatformAdmin, activeDivision, isHubEnabled]);

  // Build sections
  const sections = useMemo(() => {
    const secs = [];

    // Field section — always shown
    secs.push({
      title: 'Field',
      items: [
        { label: 'Home', icon: CalendarClock, path: '/staff-schedule', active: isActive('/staff-schedule') },
        { label: "Today's Schedule", icon: CalendarClock, path: '/today-schedule', active: isActive('/today-schedule') },
        { label: 'Upcoming', icon: CalendarClock, path: '/upcoming', active: isActive('/upcoming') },
        { label: 'My Duties', icon: ClipboardList, path: '/my-duties', active: isActive('/my-duties') },
        { label: 'Field Tools', icon: Wrench, path: '/tools', active: isActive('/tools') },
        { label: 'Scan Asset', icon: ScanLine, path: '/scanner', active: isActive('/scanner') },
        { label: 'My Profile', icon: UserCircle, path: '/staff-profile', active: isActive('/staff-profile') },
        ...(profile?.delivery_dashboard_enabled ? [{ label: 'Deliveries', icon: Truck, path: '/deliveries', active: isActive('/deliveries') }] : []),
      ],
    });

    // Admin section — only for admin users
    if (isAdmin) {
      secs.push({
        title: 'Admin',
        items: [
          { label: 'Inbox', icon: Inbox, path: '/inbox', active: isActive('/inbox'), badge: inboxCount },
          { label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin', active: isActive('/admin') },
          { label: 'My Team', icon: Users, path: '/manager-team', active: isActive('/manager-team') },
          { label: 'AI Hubs', icon: Sparkles, onClick: () => { onClose(); openHub(); } },
        ],
      });
      // Hub links
      const hubItems = accessibleHubs.map((hub) => ({
        label: hub.label,
        icon: hub.icon,
        onClick: () => handleHubClick(hub.id),
        active: location.pathname === (STANDALONE_ROUTES[hub.id] || '/admin') && (STANDALONE_ROUTES[hub.id] || location.state?.section === hub.id),
      }));
      if (hubItems.length > 0) {
        secs.push({ title: 'Hubs', items: hubItems });
      }
    }

    // Help section
    secs.push({
      title: 'Help',
      items: [
        { label: 'Help Guides', icon: HelpCircle, path: isAdmin ? '/help' : '/help-field', active: isActive(isAdmin ? '/help' : '/help-field') },
        { label: 'Sign Out', icon: LogOut, onClick: handleSignOut, active: false },
      ],
    });

    return secs;
  }, [profile, isAdmin, accessibleHubs, inboxCount, location.pathname, location.state]);

  const displayName = profile?.name || authUser?.full_name || authUser?.email || 'User';

  return (
    <>
      {/* Drawer — controlled by parent (MobileNavShell) */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm animate-slide-up"
            onClick={onClose}
            style={{ animationDuration: '0.2s' }}
          />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm field-bg shadow-2xl animate-drawer-slide-in flex flex-col safe-area-top">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar name={displayName} avatarUrl={profile?.avatar_url} size={40} />
                <div className="min-w-0">
                  <p className="text-ui-subheading font-bold text-slate-900 truncate">{displayName}</p>
                  <p className="text-ui-caption text-slate-500 truncate">{profile?.job_title || authUser?.email || ''}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Enterprise switch */}
            {(isSuperAdmin || permittedDivisions.length > 1) && (
              <div className="px-3 pt-3">
                <button
                  onClick={() => { onClose(); navigate('/enterprise'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/50 ring-1 ring-amber-200 text-amber-800 active:scale-[0.98] transition"
                >
                  <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-bold flex-1 text-left">Switch Business Stream</span>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            )}

            {/* Sections */}
            <div className="flex-1 overflow-y-auto py-3">
              {sections.map((section) => (
                <div key={section.title} className="mb-2">
                  <p className="px-4 py-1.5 text-ui-micro font-bold text-slate-400 uppercase tracking-wider">{section.title}</p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => item.onClick ? item.onClick() : handleNavigate(item.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition active:scale-[0.98] ${
                          item.active
                            ? 'bg-primary/8 text-primary'
                            : 'text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${item.active ? 'text-primary' : 'text-slate-400'}`} />
                        <span className="flex-1 text-ui-body font-semibold">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-ui-micro font-bold flex items-center justify-center">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                        {item.active && <ChevronRight className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}