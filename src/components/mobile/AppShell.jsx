import React from 'react';
import { Outlet } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';
import MobileAppShell from '@/components/mobile/MobileAppShell';

/**
 * Layout route that swaps between the desktop pass-through and the
 * mobile app shell based on the MobileAppContext flag.
 *
 * Desktop: renders <Outlet/> (standalone routes render directly;
 *           the nested <AppLayout> group adds its own sidebar).
 * Mobile:  renders <MobileAppShell/> (bottom tab bar + Outlet).
 *           AppLayout skips its own chrome on mobile, so there is
 *           exactly one navigation chrome — the tab bar.
 */
export default function AppShell() {
  const { isMobileApp } = useMobileApp();
  if (isMobileApp) return <MobileAppShell />;
  return <Outlet />;
}