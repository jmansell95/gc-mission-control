import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, LogOut, Grid3x3, Briefcase, Calendar, Users, Truck, Boxes,
  Car, FlaskConical, ShieldCheck, PoundSterling, FileBarChart, Settings,
  CalendarDays, User, HelpCircle, ArrowLeftRight, ScanLine,
  ChevronRight,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { canAccessSection } from '@/utils/access';
import { STANDALONE_ROUTES } from '@/utils/standaloneRoutes';
import { useDivision } from '@/contexts/DivisionContext';
import { useReadiness } from '@/hooks/useReadiness';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

const ALL_HUBS = [
  { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
  { id: 'jobs', label: 'Projects Hub', icon: Briefcase },
  { id: 'scheduling', label: 'Scheduling Hub', icon: Calendar },
  { id: 'staff', label: 'Staff Hub', icon: Users },
  { id: 'logistics', label: 'Logistics Hub', icon: Truck },
  { id: 'assets', label: 'Assets Hub', icon: Boxes },
  { id: 'fleet', label: 'Tracking', icon: Car },
  { id: 'investigation', label: 'Investigation Hub', icon: FlaskConical },
  { id: 'compliance', label: 'Compliance Hub', icon: ShieldCheck },
  { id: 'billing', label: 'Financial Hub', icon: PoundSterling },
  { id: 'reports', label: 'Reports Hub', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const HUB_GROUPS = [
  { label: 'Operations', ids: ['overview', 'jobs', 'scheduling', 'logistics', 'investigation'] },
  { label: 'People', ids: ['staff', 'compliance'] },
  { label: 'Assets & Fleet', ids: ['assets', 'fleet'] },
  { label: 'Financial', ids: ['billing', 'reports'] },
  { label: 'System', ids: ['settings'] },
];

export default function MoreSheet({ isOpen, onClose, tabs }) {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const { isHubEnabled, activeDivision, isSuperAdmin, permittedDivisions } = useDivision();
  const { isComingSoon, isLocked } = useReadiness();
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        setProfile(res.data);
      } catch (e) {}
    })();
  }, [isOpen]);

  const isPlatformAdmin = authUser?.role === 'admin' || authUser?.role === 'director';

  // Filter hubs by access, lockdown, division, and search query
  const accessibleHubs = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ALL_HUBS.filter((hub) => {
      if (!canAccessSection(profile, hub.id, isPlatformAdmin)) return false;
      if (isLocked(hub.id)) return false;
      if (!activeDivision && hub.id !== 'settings') return false;
      if (!isHubEnabled(hub.id)) return false;
      if (q && !hub.label.toLowerCase().includes(q)) return false;
      return true;
    }).map((hub) => ({
      ...hub,
      comingSoon: isComingSoon(hub.id),
    }));
  }, [profile, isPlatformAdmin, isLocked, activeDivision, isHubEnabled, isComingSoon, query]);

  const tabPaths = new Set(tabs.filter((t) => t.path).map((t) => t.path));

  const handleHubClick = (hubId) => {
    onClose();
    if (STANDALONE_ROUTES[hubId]) {
      navigate(STANDALONE_ROUTES[hubId]);
    } else {
      navigate('/admin', { state: { section: hubId } });
    }
  };

  const handleLogout = async () => {
    onClose();
    await base44.auth.logout('/');
  };

  const displayName = profile?.name || authUser?.full_name || authUser?.email || 'User';
  const displayAvatar = profile?.avatar_url || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-slide-up"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-slide-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">More</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-90 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hubs…"
              className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Enterprise switch */}
          {(isSuperAdmin || permittedDivisions.length > 1) && (
            <button
              onClick={() => { onClose(); navigate('/enterprise'); }}
              className="w-full flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/50 ring-1 ring-amber-200 text-amber-800 active:scale-[0.98] transition"
            >
              <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-bold flex-1 text-left">Switch Business Stream</span>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Hub groups */}
          {HUB_GROUPS.map((group) => {
            const items = accessibleHubs.filter((h) => group.ids.includes(h.id));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1.5">
                  {group.label}
                </p>
                <div className="bg-slate-50 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {items.map((hub) => {
                    const Icon = hub.icon;
                    return (
                      <button
                        key={hub.id}
                        onClick={() => handleHubClick(hub.id)}
                        className="w-full flex items-center gap-3 px-3 py-3 active:bg-slate-100 transition"
                      >
                        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Icon className="w-[18px] h-[18px] text-[#2E5A1A]" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 flex-1 text-left">
                          {hub.label}
                        </span>
                        {hub.comingSoon && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                            Soon
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Personal section */}
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1.5">
              Personal
            </p>
            <div className="bg-slate-50 rounded-2xl overflow-hidden divide-y divide-slate-100">
              <MoreRow icon={CalendarDays} label="My Schedule" onClick={() => { onClose(); navigate('/staff-schedule'); }} />
              <MoreRow icon={User} label="My Profile" onClick={() => { onClose(); navigate('/staff-profile'); }} />
              {profile?.delivery_dashboard_enabled && (
                <MoreRow icon={Truck} label="Driver Hub" onClick={() => { onClose(); navigate('/deliveries'); }} />
              )}
              <MoreRow icon={ScanLine} label="Scan Asset" onClick={() => { onClose(); navigate('/scanner'); }} />
              <MoreRow icon={HelpCircle} label="Help Guides" onClick={() => { onClose(); navigate(isPlatformAdmin || (profile?.system_role && profile.system_role !== 'field') ? '/help' : '/help-field'); }} />
            </div>
          </div>
        </div>

        {/* Footer — profile + logout */}
        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-3 bg-white">
          <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
            {authUser?.email && <p className="text-xs text-slate-400 truncate">{authUser.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 active:scale-90 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MoreRow({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 active:bg-slate-100 transition"
    >
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon className="w-[18px] h-[18px] text-slate-600" />
      </div>
      <span className="text-sm font-medium text-slate-700 flex-1 text-left">{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </button>
  );
}