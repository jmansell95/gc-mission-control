import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, CalendarDays, ScanLine, Wrench, LayoutGrid } from 'lucide-react';

/**
 * FieldBottomNav — the unified 5-tab bottom navigation for all field pages.
 *
 * Tabs: Home, Today, [Scan — prominent raised center], Tools, More
 * "More" opens the UnifiedMobileDrawer (passed via onMoreClick).
 * "Scan" is a raised gradient circle — the primary field action.
 *
 * Replaces the old single-button MobileMenuBar. Rendered by MobileNavShell
 * for mobile-browser field routes (when not inside the PWA/APK shell).
 */
const TABS = [
  { key: 'home', label: 'Home', icon: Home, path: '/staff-schedule' },
  { key: 'today', label: 'Today', icon: CalendarDays, path: '/today-schedule' },
  { key: 'scan', label: 'Scan', icon: ScanLine, path: '/scanner', prominent: true },
  { key: 'tools', label: 'Tools', icon: Wrench, path: '/tools' },
  { key: 'more', label: 'More', icon: LayoutGrid, isMore: true },
];

const ACTIVE_ROUTES = {
  home: ['/staff-schedule', '/m/staff-schedule'],
  today: ['/today-schedule', '/m/today-schedule'],
  scan: ['/scanner', '/m/scanner'],
  tools: ['/tools', '/m/tools'],
};

export default function FieldBottomNav({ onMoreClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (key) => {
    const routes = ACTIVE_ROUTES[key];
    if (!routes) return false;
    return routes.some((r) => location.pathname === r || location.pathname.startsWith(r + '/'));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden">
      <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-2px_16px_-4px_rgba(15,23,42,0.10)] safe-area-bottom">
        <div className="flex items-end justify-around px-2 pt-2 pb-1.5 relative">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.key);

            if (tab.prominent) {
              return (
                <button
                  key={tab.key}
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center gap-1 -mt-7 active:scale-90 transition-transform touch-manipulation"
                  aria-label={tab.label}
                >
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    className="w-16 h-16 rounded-2xl command-gradient flex items-center justify-center shadow-lg ring-[5px] ring-white/90 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/30" />
                    <Icon className="w-7 h-7 text-white relative z-10" strokeWidth={2.5} />
                  </motion.div>
                  <span className="text-[10px] font-bold text-slate-700">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.key}
                onClick={() => (tab.isMore ? onMoreClick?.() : navigate(tab.path))}
                className="flex flex-col items-center gap-1 py-1.5 px-3 min-w-[56px] active:scale-90 transition-transform touch-manipulation"
                aria-label={tab.label}
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-colors ${active ? 'text-primary' : 'text-slate-400'}`}
                    strokeWidth={2.5}
                  />
                  {active && (
                    <motion.div
                      layoutId="fieldNavActive"
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold transition-colors ${active ? 'text-primary' : 'text-slate-500'}`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}