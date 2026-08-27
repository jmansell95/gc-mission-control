import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Bell, Sparkles, Menu, HelpCircle, Receipt, User, Truck, Boxes, Car, Clock, ShieldCheck, PoundSterling, ShieldAlert, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Wrench, Warehouse, Users, Contact, Zap, FileBarChart, FileUp, ClipboardCheck, FlaskConical,   Crown, ArrowLeftRight, TrendingUp, ScanLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useAIHub } from '@/components/ai/AIHub';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import { canAccessSection, resolveRole } from '@/utils/access';
import { settingsGroups, HUB_MIGRATED_ITEMS, accessibleSettingsItems } from '@/components/SettingsNav';
import Logo from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import { useReadiness } from '@/hooks/useReadiness';
import DivisionSwitcher from '@/components/DivisionSwitcher';
import { useDivision } from '@/contexts/DivisionContext';
import { useGlobalScanner } from '@/contexts/GlobalScannerContext';

export default function AdminNav({ activeSection, setActiveSection, onSettingsTabClick }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  // Super admins AND directors get full nav access
  const isPlatformAdmin = authUser?.role === 'admin' || authUser?.role === 'director';
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('gc-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  // Tablet breakpoint: lg (1024px) to xl (1280px). On tablet the sidebar is
  // always an icon rail (effectiveCollapsed = true) regardless of user pref.
  const [isTablet, setIsTablet] = useState(false);
  const notifications = useNotifications();
  const notifCount = notifications.count;
  const { openHub } = useAIHub();
  const { isComingSoon, isLocked } = useReadiness();
  const { isHubEnabled, activeDivision, isSuperAdmin, permittedDivisions } = useDivision();
  const { openScanner } = useGlobalScanner();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)');
    const handler = () => setIsTablet(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = () => setProfileMenuOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!notifOpen && !drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [notifOpen, drawerOpen]);

  // Allow the mobile bottom-nav Alerts button (a sibling component with no
  // shared state) to open the notification center via a custom DOM event.
  useEffect(() => {
    const handler = () => setNotifOpen(true);
    window.addEventListener('gc-open-notifications', handler);
    return () => window.removeEventListener('gc-open-notifications', handler);
  }, []);

  // Fallback to the auth user's name when the staff profile fetch fails
  // (common on published-site cold starts). Prevents the avatar showing '?'
  // when profile is null but the user is still logged in.
  const displayName = profile?.name || authUser?.full_name || authUser?.email || null;
  const displayAvatar = profile?.avatar_url || null;

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  const allNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
    { id: 'jobs', label: 'Projects Hub', icon: Briefcase },
    { id: 'scheduling', label: 'Scheduling Hub', icon: Calendar },
    { id: 'staff', label: 'Staff Hub', icon: Users },
    { id: 'logistics', label: 'Logistics Hub', icon: Truck },
    { id: 'assets', label: 'Assets Hub', icon: Boxes },
    { id: 'fleet', label: 'Fleet Hub', icon: Car },
    { id: 'investigation', label: 'Investigation Hub', icon: FlaskConical },
    { id: 'compliance', label: 'Compliance Hub', icon: ShieldCheck },
    { id: 'billing', label: 'Financial Hub', icon: PoundSterling },
    { id: 'reports', label: 'Reports Hub', icon: FileBarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('gc-sidebar-collapsed', String(next)); } catch {}
  };

  // On tablet the sidebar is always collapsed (icon rail). On desktop the
  // user's preference is respected.
  const effectiveCollapsed = isTablet || collapsed;

  const navItems = allNavItems
    .filter(item => canAccessSection(profile, item.id, isPlatformAdmin))
    .filter(item => !isLocked(item.id))
    .filter(item => {
      // When no division is active (enterprise overview / settings-only mode),
      // hide all division hubs — only Settings is shown. Division hubs require
      // a division context to avoid cross-division data exposure.
      if (!activeDivision && item.id !== 'settings') return false;
      return isHubEnabled(item.id);
    })
    .map(item => ({ ...item, comingSoon: isComingSoon(item.id) }));
  const canViewSchedule = canAccessSection(profile, 'staff_schedule');

  const desktopNav = (
    <>
      <div className={`${effectiveCollapsed ? 'px-2 pt-3 pb-2' : 'px-4 pt-4 pb-3'} border-b border-white/10`}>
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-col items-center w-full">
            {effectiveCollapsed ? (
              <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-10 h-auto object-contain" />
            ) : (
              <>
                <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-28 h-auto object-contain" />
                <p className="text-[11px] text-white/60 mt-1.5 font-display font-semibold uppercase tracking-[0.22em]">Admin Panel</p>
              </>
            )}
          </div>

        </div>
      </div>
      {!effectiveCollapsed && <DivisionSwitcher variant="sidebar" />}
      {/* Enterprise Command Centre link — prominent at top of nav (super admins + directors only) */}
      {(isSuperAdmin || permittedDivisions.length > 1) && (
        <div className="px-2 pb-1.5">
          <button type="button" onClick={() => navigate('/enterprise')}
            className={`w-full flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-3'} ${effectiveCollapsed ? 'px-0 py-2.5' : 'px-3.5 py-2'} rounded-xl text-sm font-bold transition cursor-pointer touch-manipulation select-none bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-200 hover:from-amber-500/30 hover:to-amber-600/20 ring-1 ring-amber-400/30`}>
            <ArrowLeftRight className="w-[18px] h-[18px] flex-shrink-0 text-amber-300" />
            {!effectiveCollapsed && <span>Switch Business Stream</span>}
          </button>
        </div>
      )}
      <div className="flex-1 px-2 py-1.5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const comingSoon = isComingSoon(item.id);
          const locked = isLocked(item.id);
          if (locked) return null; // hide locked hubs entirely from the nav
          if (comingSoon) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                title={effectiveCollapsed ? item.label : undefined}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium opacity-50 hover:opacity-70 transition cursor-pointer touch-manipulation select-none"
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0 text-white/40" />
                {!effectiveCollapsed && <span className="text-white/40 flex-1">{item.label}</span>}
                {!effectiveCollapsed && <span className="text-[9px] font-bold text-amber-300/80 bg-amber-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Soon</span>}
              </button>
            );
          }
          return (
            <div key={item.id}>
              <button type="button" onClick={() => setActiveSection(item.id)} title={effectiveCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${effectiveCollapsed ? 'justify-center' : 'gap-3'} ${effectiveCollapsed ? 'px-0 py-2.5' : 'px-3.5 py-2'} rounded-xl text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                  isActive
                    ? 'command-gradient text-white shadow-lg glow-brand ring-1 ring-[#8DC63F]/30'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}>
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#8DC63F]' : ''}`} />
                {!effectiveCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              </button>
            </div>
          );
        })}
      </div>
      {/* Action cluster — bigger search, 2 assistant buttons, full-width collapse */}
      <div className={`${effectiveCollapsed ? 'px-1.5' : 'px-3'} pt-2 pb-2 border-t border-white/10 space-y-2`}>
        {!effectiveCollapsed && <GlobalSearch />}
        <button onClick={openScanner} type="button" title="Scan Asset"
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
          <ScanLine className="w-4 h-4 flex-shrink-0 text-[#8DC63F]" />
          {!effectiveCollapsed && <span className="text-xs font-bold">Scan Asset</span>}
        </button>
        <button onClick={openHub} type="button" title="AI Hubs"
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-lg glow-brand">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && <span className="text-xs font-bold">AI Hubs</span>}
        </button>
        {/* Collapse toggle — desktop only (hidden on tablet where icon-rail is always on) */}
        {!isTablet && (
          <button onClick={toggleCollapsed} type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /><span className="text-xs font-semibold">Collapse</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Header — hamburger + brand + actions (mobile + tablet portrait) */}
      <header className="lg:hidden sticky top-0 inset-x-0 z-40 border-b border-white/10 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="absolute inset-0 sidebar-modern" />
        <div className="relative z-10 h-14 flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" type="button"
              className="h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center min-w-0 gap-2">
              <Logo height={30} />
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-[18px] h-[18px]" />
              {notifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-4 px-1 bg-[#8DC63F] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="h-7 w-px bg-white/20 mx-1.5 flex-shrink-0" />
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} aria-label="Profile menu" type="button"
                className="relative flex items-center justify-center active:scale-95 rounded-full transition flex-shrink-0 touch-manipulation select-none ring-2 ring-transparent hover:ring-white/20">
                <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={32} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayName || 'User'}</p>
                    {authUser?.email && <p className="text-xs text-slate-500 truncate mt-0.5">{authUser.email}</p>}
                  </div>
                  <div className="py-1">
                    {canViewSchedule && activeDivision && (
                      <button onClick={() => { navigate('/staff-schedule'); setProfileMenuOpen(false); }} type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                        <CalendarDays className="w-4 h-4 text-slate-400" /> My Schedule
                      </button>
                    )}
                    <button onClick={() => { navigate('/staff-profile'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <User className="w-4 h-4 text-slate-400" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/reports'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <FileBarChart className="w-4 h-4 text-slate-400" /> Reports Hub
                    </button>
                    <button onClick={() => { navigate('/help'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { handleLogout(); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop + Tablet Sidebar — persistent on lg+ (icon rail on tablet, full on desktop) */}
      <nav className={`hidden lg:flex sticky top-0 h-screen ${effectiveCollapsed ? 'w-16' : 'w-64'} border-r border-black/10 flex-col relative transition-all duration-300`}>
        <div className="absolute inset-0 sidebar-modern" />
        <div className="relative z-10 flex flex-col h-full">
          {desktopNav}
        </div>
      </nav>

      <MobileNavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navItems={navItems}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        onNotifications={() => { setNotifOpen(true); setDrawerOpen(false); }}
        notifCount={notifCount}
        onDeliveries={() => { navigate('/deliveries'); setDrawerOpen(false); }}
        onHelp={() => { navigate('/help'); setDrawerOpen(false); }}
        onProfile={() => { navigate('/staff-profile'); setDrawerOpen(false); }}
        onEnterprise={() => { navigate('/enterprise'); setDrawerOpen(false); }}
        profile={profile ? { ...profile, name: displayName, avatar_url: displayAvatar } : (authUser ? { name: displayName, avatar_url: displayAvatar, email: authUser.email } : null)}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
    </>
  );
}