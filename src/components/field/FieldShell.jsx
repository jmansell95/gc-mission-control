import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';
import { FieldDataProvider } from '@/components/field/FieldDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/field/OfflineBanner';
import MobileNavShell from '@/components/mobile/MobileNavShell';
import FieldCommsButton from '@/components/field/FieldCommsButton';

/**
 * Shared layout route for all field crew pages. Provides:
 *  - FieldDataProvider (shared data context)
 *  - MobileNavShell (bottom Menu bar + slide-out drawer) — only when NOT
 *    inside the PWA/APK shell (MobileAppShell already renders it).
 *  - The fresh field background
 *  - ErrorBoundary wrapping all content
 *  - OfflineBanner
 *
 * When isMobileApp is true, MobileAppShell wraps this route and already
 * provides the UnifiedMobileDrawer — so FieldShell skips its own to
 * avoid a double hamburger. When isMobileApp is false (mobile browser),
 * FieldShell renders the UnifiedMobileDrawer itself.
 */
export default function FieldShell({ children }) {
  const { isMobileApp } = useMobileApp();

  return (
    <FieldDataProvider>
      <div className="h-[100dvh] field-bg flex flex-col overflow-hidden safe-area-top">
        {/* MobileNavShell — bottom Menu bar + slide-out drawer.
            Only when not already provided by MobileAppShell. */}
        {!isMobileApp && <MobileNavShell />}

        <OfflineBanner />

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
          style={{
            paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
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

      {/* Always-active comms button (floating, bottom-right) */}
      <FieldCommsButton />
    </FieldDataProvider>
  );
}