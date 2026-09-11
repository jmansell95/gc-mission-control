import React from 'react';
import { Outlet } from 'react-router-dom';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import UnifiedMobileDrawer from '@/components/mobile/UnifiedMobileDrawer';

/**
 * Unified mobile app shell for PWA / APK builds.
 *
 * Full-height flex column:
 *   <main> — scrollable page content (Outlet), no bottom-bar padding
 *   UnifiedMobileDrawer — floating hamburger (top-left) + slide-out drawer
 *
 * The old bottom tab bar + More sheet have been replaced by the
 * UnifiedMobileDrawer so there is exactly one navigation chrome on mobile.
 */
export default function MobileAppShell() {
  return (
    <div className="h-[100dvh] flex flex-col page-bg-vibrant overflow-hidden">
      <RedAlertBanner />
      <UnifiedMobileDrawer />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}