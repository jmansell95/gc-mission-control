import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isTabActive, isActiveInMore } from '@/utils/mobileTabs';

/**
 * Fixed bottom tab bar — 4 slots, thumb-reachable, respects safe-area.
 * Hidden automatically when a full-screen modal is open (via CSS:
 * body:has(.fixed.inset-0) .mobile-tab-bar).
 */
export default function MobileTabBar({ tabs, onMore }) {
  const navigate = useNavigate();
  const location = useLocation();

  const moreActive = isActiveInMore(tabs, location.pathname);

  return (
    <nav
      className="mobile-tab-bar fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around max-w-md mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isMore ? moreActive : isTabActive(tab, location.pathname);

          const handleClick = () => {
            if (tab.isMore) {
              onMore();
              return;
            }
            if (tab.path) navigate(tab.path);
          };

          return (
            <button
              key={tab.id}
              type="button"
              onClick={handleClick}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] touch-manipulation select-none active:scale-95 transition"
            >
              <Icon
                className={`w-[22px] h-[22px] transition-colors ${
                  active ? 'text-[#2E5A1A]' : 'text-slate-400'
                }`}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={`text-[10px] font-semibold leading-none transition-colors ${
                  active ? 'text-[#2E5A1A]' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-[#2E5A1A] -mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}