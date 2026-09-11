import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';
import AdminNav from '@/components/AdminNav';
import Breadcrumbs from '@/components/Breadcrumbs';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import { STANDALONE_ROUTES, ROUTE_TO_SECTION } from '@/utils/standaloneRoutes';
import MobileNavShell from '@/components/mobile/MobileNavShell';

// Maps standalone routes to the closest AdminNav section so the
// sidebar highlights the right item when on a non-dashboard page.
const ROUTE_SECTION_MAP = {
  '/enterprise': '',
  '/staff-schedule': 'scheduling',
  '/staff-profile': 'scheduling',
  '/admin/profile': '',
  '/subcontractor': 'scheduling',
  '/deliveries': 'logistics',
  '/admin/logistics': 'logistics',
  '/pat-testing': 'assets',
  '/fleet': 'fleet',
  '/access-levels': 'access-levels',
  '/safety': 'compliance',
  '/help': 'overview',
  '/presentation-pack': 'overview',
  '/keylogbook-docs': 'overview',
  '/roadmap': 'overview',
  ...ROUTE_TO_SECTION,
};

/**
 * Shared layout that gives every authenticated page the admin sidebar
 * (desktop) and the fixed mobile header with hamburger drawer (mobile).
 * AdminDashboard manages its own AdminNav; all other admin pages use this
 * layout via the router.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobileApp } = useMobileApp();

  // Mobile app mode: the MobileAppShell provides the UnifiedMobileDrawer and chrome.
  // AppLayout becomes a pass-through so there's exactly one navigation layer.
  if (isMobileApp) return <Outlet />;

  const activeSection = ROUTE_SECTION_MAP[location.pathname] || '';

  const setActiveSection = (s) => {
    // Standalone pages get a direct route push — no blank-flash round-trip
    // through the AdminDashboard section state.
    if (STANDALONE_ROUTES[s]) {
      navigate(STANDALONE_ROUTES[s]);
    } else {
      navigate('/admin', { state: { section: s } });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-bg-vibrant">
      {/* Mobile browser: MobileNavShell provides the bottom Menu bar + slide-out nav.
           Hidden on desktop (lg+) where AdminNav sidebar is visible.
           Hidden when isMobileApp (MobileAppShell provides its own). */}
      <div className="lg:hidden">
        <MobileNavShell />
      </div>
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} onSettingsTabClick={(tab) => navigate('/admin', { state: { section: 'settings', settingsTab: tab } })} />
      <div className="flex-1 flex flex-col min-h-0">
        <RedAlertBanner />
        <main
          className="flex-1 overflow-auto lg:pt-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <DivisionIdentityBar />
          {/* Responsive hub canvas: phone = stacked + bottom-nav clearance,
              tablet = condensed gutters, desktop = breathable + sidebar. */}
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 pt-3 lg:pt-6 pb-24 lg:pb-8 w-full max-w-[1600px] mx-auto">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}