import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import MobileNavShell from '@/components/mobile/MobileNavShell';

/**
 * EnterpriseShell — layout wrapper for enterprise-level routes on mobile
 * browser. Provides the context-aware MobileNavShell (which renders the
 * enterprise bottom bar + enterprise drawer, NOT the field bottom bar).
 *
 * On PWA/APK (isMobileApp), MobileAppShell already provides MobileNavShell,
 * so this becomes a pass-through — no double navigation.
 *
 * On desktop, MobileNavShell's bottom bar is hidden (lg:hidden) so enterprise
 * pages use their own EnterpriseHeader for navigation.
 */
export default function EnterpriseShell({ children }) {
  const { isMobileApp } = useMobileApp();

  if (isMobileApp) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <div className="h-[100dvh] page-bg-vibrant flex flex-col overflow-hidden safe-area-top">
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
        {children || <Outlet />}
      </main>
    </div>
  );
}