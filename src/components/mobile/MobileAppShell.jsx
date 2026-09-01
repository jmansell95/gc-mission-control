import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { resolveMobileTabs } from '@/utils/mobileTabs';
import MobileTabBar from '@/components/mobile/MobileTabBar';
import MoreSheet from '@/components/mobile/MoreSheet';
import RedAlertBanner from '@/components/safety/RedAlertBanner';

/**
 * Unified mobile app shell for PWA / APK builds.
 *
 * Full-height flex column:
 *   <main> — scrollable page content (Outlet), padded for the tab bar
 *   <nav>  — fixed bottom tab bar (4 tabs, role-aware)
 *   More sheet — slide-up bottom sheet with all remaining hubs
 *
 * Replaces the desktop AppLayout sidebar when isMobileApp is true.
 * All existing routes render inside this shell via <Outlet/> — no new
 * routes are created.
 */
export default function MobileAppShell() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Fetch staff profile for role-aware tab resolution
  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        setProfile(res.data);
      } catch (e) {}
    })();
  }, []);

  const isPlatformAdmin = authUser?.role === 'admin' || authUser?.role === 'director';
  const tabs = resolveMobileTabs(profile, isPlatformAdmin);

  // Close More sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="h-[100dvh] flex flex-col page-bg-vibrant overflow-hidden">
      <RedAlertBanner />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
        style={{
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}
      >
        <Outlet />
      </main>
      <MobileTabBar tabs={tabs} onMore={() => setMoreOpen(true)} />
      <MoreSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} tabs={tabs} />
    </div>
  );
}