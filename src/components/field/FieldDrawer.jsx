import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarClock, ClipboardList, ScanLine, UserCircle,
  Truck, Inbox, LayoutDashboard, Users, HelpCircle,
  X, ChevronRight, MapPin, Settings, LogOut,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { useInbox } from '@/hooks/useInbox';

/**
 * FieldDrawer — slide-out left navigation drawer for field staff.
 * Opens via the hamburger button in the FieldShell header.
 * Closes via backdrop tap or the X button.
 *
 * Sections:
 *  - Primary: Today, Tasks, Scan, Profile, Upcoming
 *  - Operations: Deliveries, My Duties, Live Crew Map
 *  - Admin: Inbox, Admin Dashboard, My Team, Settings
 *  - Help: Guides, Contact Support, Sign Out
 */
export default function FieldDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useFieldData();
  const { counts: inboxCounts } = useInbox();

  const { staff, isPlatformAdmin } = ctx || {};
  const inboxCount = inboxCounts?.total || 0;
  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const handleSignOut = async () => {
    try {
      await base44.auth.logout('/login');
    } catch {
      window.location.href = '/login';
    }
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const sections = [
    {
      title: 'Primary',
      items: [
        { label: 'Home', icon: CalendarClock, path: '/staff-schedule', active: isActive('/staff-schedule') },
        { label: "Today's Schedule", icon: CalendarClock, path: '/today-schedule', active: isActive('/today-schedule') },
        { label: 'My Tasks', icon: ClipboardList, path: '/my-duties', active: isActive('/my-duties') },
        { label: 'Scan Asset', icon: ScanLine, path: '/scanner', active: isActive('/scanner') },
        { label: 'My Profile', icon: UserCircle, path: '/staff-profile', active: isActive('/staff-profile') },
        { label: 'Upcoming', icon: CalendarClock, path: '/upcoming', active: isActive('/upcoming') },
      ],
    },
    {
      title: 'Operations',
      items: [
        ...(staff?.delivery_dashboard_enabled ? [{ label: 'Deliveries', icon: Truck, path: '/deliveries', active: isActive('/deliveries') }] : []),
        { label: 'My Duties', icon: ClipboardList, path: '/my-duties', active: isActive('/my-duties') },
      ],
    },
  ];

  if (isAdmin) {
    sections.push({
      title: 'Admin',
      items: [
        { label: 'Inbox', icon: Inbox, path: '/inbox', active: isActive('/inbox'), badge: inboxCount },
        { label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin', active: isActive('/admin') },
        { label: 'My Team', icon: Users, path: '/manager-team', active: isActive('/manager-team') },
      ],
    });
  }

  sections.push({
    title: 'Help',
    items: [
      { label: 'Help Guides', icon: HelpCircle, path: '/help-field', active: isActive('/help-field') },
      { label: 'Sign Out', icon: LogOut, onClick: handleSignOut, active: false },
    ],
  });

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm animate-slide-up"
        onClick={onClose}
        style={{ animationDuration: '0.2s' }}
      />

      {/* Drawer panel */}
      <div className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm field-bg shadow-2xl animate-drawer-slide-in flex flex-col safe-area-top">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200/60 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {staff?.avatar_url ? (
              <img src={staff.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold">
                {(staff?.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-ui-subheading font-bold text-slate-900 truncate">{staff?.name || 'Field Crew'}</p>
              <p className="text-ui-caption text-slate-500 truncate">{staff?.job_title || staff?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Drawer sections */}
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
                        ? 'bg-[#2E5A1A]/8 text-[#2E5A1A]'
                        : 'text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${item.active ? 'text-[#2E5A1A]' : 'text-slate-400'}`} />
                    <span className="flex-1 text-ui-body font-semibold">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-ui-micro font-bold flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                    {item.active && <ChevronRight className="w-4 h-4 text-[#2E5A1A]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}