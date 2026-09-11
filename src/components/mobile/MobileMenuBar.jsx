import React from 'react';
import { Menu } from 'lucide-react';

/**
 * MobileMenuBar — persistent bottom bar with a single "Menu" button.
 *
 * Replaces the floating hamburger button that overlapped page content.
 * Fixed to the bottom of the viewport with safe-area padding, translucent
 * glass background, and a hairline top border. Tapping the Menu button
 * opens the UnifiedMobileDrawer slide-out navigation.
 *
 * Rendered by MobileNavShell alongside the drawer. The bar is hidden on
 * desktop (lg+) via lg:hidden — it only appears on mobile/tablet.
 */
export default function MobileMenuBar({ onMenuClick }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden">
      <div className="bg-white/90 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-2px_12px_-4px_rgba(15,23,42,0.08)] safe-area-bottom">
        <button
          onClick={onMenuClick}
          className="w-full flex items-center justify-center gap-2 py-3.5 active:scale-95 transition touch-manipulation"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
          <span className="text-sm font-bold text-slate-700">Menu</span>
        </button>
      </div>
    </div>
  );
}