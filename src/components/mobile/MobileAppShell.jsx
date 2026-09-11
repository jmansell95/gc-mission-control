import React from 'react';
import { Outlet } from 'react-router-dom';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import MobileNavShell from '@/components/mobile/MobileNavShell';

/**
 * Unified mobile app shell for PWA / APK builds.
 *
 * Full-height flex column:
 *   <main> — scrollable page content (Outlet)
 *   MobileNavShell — persistent bottom Menu bar + slide-out drawer
 *
 * The bottom Menu bar replaces the old floating hamburger button so
 * navigation never overlaps page content.
 */
export default function MobileAppShell() {
  return (
    <div className="h-[100dvh] flex flex-col page-bg-vibrant overflow-hidden">
      <RedAlertBanner />
      <MobileNavShell />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
        style={{
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
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