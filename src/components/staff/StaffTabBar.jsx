import React from 'react';
import { CalendarClock, CalendarDays, LayoutGrid, ScanLine, UserCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFieldData } from '@/components/field/FieldDataProvider';

// Route-aware bottom nav: Today · Upcoming · [Scan FAB] · Profile · More
// Highlights the tab matching the current route so it works as a shared
// shell component across all five field pages.

const TABS = [
  { key: 'today', label: 'Today', icon: CalendarClock, path: '/staff-schedule', mPath: '/m/staff-schedule' },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, path: '/upcoming', mPath: '/m/upcoming' },
  { key: 'scan', label: 'Scan', icon: ScanLine, path: '/scanner', mPath: '/m/scanner' },
  { key: 'profile', label: 'Profile', icon: UserCircle, path: '/staff-profile', mPath: '/m/staff-profile' },
  { key: 'more', label: 'More', icon: LayoutGrid, path: '/more', mPath: '/m/more' },
];

export default function StaffTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const fieldData = useFieldData();

  const counts = fieldData ? {
    today: fieldData.todaysAssignments?.length || 0,
    upcoming: fieldData.upcomingAssignments?.length || 0,
  } : {};

  const isMobile = currentPath.startsWith('/m/');

  const isActive = (tab) => {
    const paths = isMobile ? [tab.mPath] : [tab.path];
    return paths.some(p => currentPath === p || currentPath.startsWith(p + '/'));
  };

  const handleNavigate = (tab) => {
    navigate(isMobile ? tab.mPath : tab.path);
  };

  return (
    <nav className="mobile-tab-bar fixed bottom-0 left-0 right-0 z-40 field-header-glass safe-area-bottom">
      <div className="max-w-5xl mx-auto flex items-stretch justify-around px-2 relative">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          const badge = counts[tab.key];
          const hasBadge = badge != null && badge > 0;

          // Centre Scanner FAB — prominent, elevated with glow
          if (tab.key === 'scan') {
            return (
              <button
                key={tab.key}
                onClick={() => handleNavigate(tab)}
                type="button"
                className="flex flex-col items-center justify-center gap-1 px-2 touch-manipulation"
              >
                <div className="w-14 h-14 -mt-6 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white flex items-center justify-center shadow-xl shadow-[#2E5A1A]/40 ring-4 ring-white active:scale-90 transition glow-brand">
                  <ScanLine className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <span className={`text-ui-micro font-bold ${active ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>Scan</span>
              </button>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => handleNavigate(tab)}
              type="button"
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition touch-manipulation ${
                active ? 'text-[#2E5A1A]' : 'text-slate-400'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full" />
              )}
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${active ? 'bg-[#2E5A1A]/10' : ''}`}>
                  <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                </div>
                {hasBadge && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-ui-micro font-bold flex items-center justify-center ring-2 ring-white ${
                    active ? 'bg-[#2E5A1A] text-white' : 'bg-slate-300 text-white'
                  }`}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-ui-micro font-semibold ${active ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}