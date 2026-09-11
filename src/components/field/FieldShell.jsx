import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';
import { FieldDataProvider } from '@/components/field/FieldDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineBanner from '@/components/field/OfflineBanner';
import UnifiedMobileDrawer from '@/components/mobile/UnifiedMobileDrawer';
import FieldCommsButton from '@/components/field/FieldCommsButton';

/**
 * Shared layout route for all field crew pages. Provides:
 *  - FieldDataProvider (shared data context)
 *  - UnifiedMobileDrawer (hamburger + slide-out nav) — only when NOT
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
        {/* UnifiedMobileDrawer — only when not already provided by MobileAppShell */}
        {!isMobileApp && <UnifiedMobileDrawer />}

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

      {/* Always-active comms button (floating, bottom-right) */}
      <FieldCommsButton />
    </FieldDataProvider>
  );
}