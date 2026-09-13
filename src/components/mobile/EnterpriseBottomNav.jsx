import React from 'react';
import { Menu } from 'lucide-react';

/**
 * EnterpriseBottomNav — minimal bottom bar for enterprise-level routes.
 *
 * A single "Menu" button that opens the UnifiedMobileDrawer (which, in
 * enterprise context, shows enterprise-level links + "Enter My Stream").
 *
 * This replaces the 5-tab FieldBottomNav on enterprise routes so the field
 * navigation (Home, Today, Scan, Tools) never leaks into the enterprise
 * context. Hidden on desktop (lg+).
 */
export default function EnterpriseBottomNav({ onMenuClick }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden">
      <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-2px_12px_-4px_rgba(15,23,42,0.08)] safe-area-bottom">
        <button
          onClick={onMenuClick}
          className="w-full flex items-center justify-center gap-2 py-3.5 active:scale-95 transition touch-manipulation"
          aria-label="Open enterprise navigation menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
          <span className="text-sm font-bold text-slate-700">Menu</span>
        </button>
      </div>
    </div>
  );
}