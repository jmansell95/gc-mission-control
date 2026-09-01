import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMobileApp } from '@/contexts/MobileAppContext';

/**
 * Detects mobile devices and redirects field crew pages to their /m/ equivalents.
 * Mounted at the top of the route tree — only redirects for the four field crew
 * routes (staff-schedule, staff-profile, deliveries, scanner). Admin/office hubs
 * are left alone and stay responsive.
 *
 * The redirect is skipped if:
 *   - The user is on a tablet (768px+), which keeps the responsive layout
 *   - The user explicitly navigated to the /m/ version already
 *   - The viewport is desktop
 */
const FIELD_ROUTE_MAP = {
  '/staff-schedule': '/m/staff-schedule',
  '/staff-profile': '/m/staff-profile',
  '/deliveries': '/m/deliveries',
  '/scanner': '/m/scanner',
};

export default function MobileFieldRedirect({ children }) {
  const location = useLocation();
  const { isMobileApp } = useMobileApp();

  // Only redirect for the four field routes
  const target = FIELD_ROUTE_MAP[location.pathname];
  if (!target) return children;

  // Mobile app mode: the unified MobileAppShell handles all routes —
  // no redirect to /m/ needed.
  if (isMobileApp) return children;

  // Check if this is a phone (not tablet). Tablets (768px+) keep the responsive layout.
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isPhone) {
    return <Navigate to={target} replace />;
  }

  return children;
}