import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { FieldDataProvider } from '@/components/field/FieldDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/field/OfflineBanner';
import FieldDrawer from '@/components/field/FieldDrawer';
import FieldCommsButton from '@/components/field/FieldCommsButton';

/**
 * Shared layout route for all field crew pages. Provides:
 *  - FieldDataProvider (shared data context)
 *  - A floating hamburger button (top-left) → FieldDrawer (slide-out left nav)
 *  - The fresh field background
 *  - ErrorBoundary wrapping all content
 *  - OfflineBanner
 *
 * The old 5-tab bottom bar (Today/Upcoming/Scan/Profile/More) is replaced
 * by the FieldHomeHub card grid (at /staff-schedule) + the FieldDrawer.
 * The floating hamburger sits over each page's own header (FieldPageShell
 * or custom), so there's no double-header conflict.
 */
export default function FieldShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <FieldDataProvider>
      <div className="h-[100dvh] field-bg flex flex-col overflow-hidden safe-area-top">
        {/* Floating hamburger button — always visible, top-left */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="absolute top-3 left-3 z-30 w-10 h-10 rounded-xl bg-white/80 backdrop-blur-md shadow-md flex items-center justify-center transition active:scale-95 touch-manipulation hover:bg-white/90"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        <OfflineBanner />

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          <ErrorBoundary>
            {children || <Outlet />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Slide-out drawer */}
      <FieldDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Always-active comms button (floating, bottom-right) */}
      <FieldCommsButton />
    </FieldDataProvider>
  );
}