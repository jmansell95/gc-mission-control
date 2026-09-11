// Role-aware bottom tab bar configuration for the mobile app shell.
// Reuses the existing access/role utilities so tabs are personalised
// per user without new routing — each tab points to an existing route.

import {
  Grid3x3, CalendarDays, Truck, Car, Menu, ScanLine, Briefcase, FlaskConical, Wrench,
} from 'lucide-react';
import { resolveRole, isDriver, isScannerOnly } from '@/utils/access';

/**
 * Returns the 4 bottom-tab configs for the current user.
 * Each config: { id, label, icon, path?, isMore? }
 *
 * The "More" tab is always last and opens the More sheet.
 */
export function resolveMobileTabs(profile, isPlatformAdmin) {
  // Scanner-only users — single-purpose app
  if (isScannerOnly(profile)) {
    return [
      { id: 'scanner', label: 'Scan', icon: ScanLine, path: '/scanner' },
      { id: 'more', label: 'More', icon: Menu, isMore: true },
    ];
  }

  // Drivers — delivery-focused
  if (isDriver(profile)) {
    return [
      { id: 'deliveries', label: 'Deliveries', icon: Truck, path: '/deliveries' },
      { id: 'more', label: 'More', icon: Menu, isMore: true },
    ];
  }

  // Subcontractors — logging portal
  if (profile?.worker_type === 'subcontractor') {
    return [
      { id: 'home', label: 'Home', icon: Grid3x3, path: '/subcontractor' },
      { id: 'more', label: 'More', icon: Menu, isMore: true },
    ];
  }

  const role = resolveRole(profile, isPlatformAdmin);

  // Field crew
  if (role === 'field') {
    return [
      { id: 'schedule', label: 'Today', icon: CalendarDays, path: '/staff-schedule' },
      { id: 'tools', label: 'Tools', icon: Wrench, path: '/tools' },
      { id: 'scanner', label: 'Scan', icon: ScanLine, path: '/scanner' },
      { id: 'deliveries', label: 'Deliveries', icon: Truck, path: '/deliveries' },
      { id: 'more', label: 'More', icon: Menu, isMore: true },
    ];
  }

  // Enterprise admins / directors — enterprise-first
  if (isPlatformAdmin || role === 'super_admin') {
    return [
      { id: 'home', label: 'Home', icon: Grid3x3, path: '/enterprise' },
      { id: 'ops', label: 'Ops', icon: Briefcase, path: '/admin' },
      { id: 'fleet', label: 'Fleet', icon: Car, path: '/fleet' },
      { id: 'more', label: 'More', icon: Menu, isMore: true },
    ];
  }

  // Office staff (admin, management, user, read_only)
  // "Schedule" goes to the Scheduling Hub (rota builder) via /admin with
  // section state — the AdminDashboard's location.state effect picks it up.
  return [
    { id: 'home', label: 'Home', icon: Grid3x3, path: '/admin', state: { section: 'overview' } },
    { id: 'schedule', label: 'Rota', icon: CalendarDays, path: '/admin', state: { section: 'scheduling' } },
    { id: 'fleet', label: 'Fleet', icon: Car, path: '/fleet' },
    { id: 'more', label: 'More', icon: Menu, isMore: true },
  ];
}

/**
 * Returns true if the given tab is the active one for the current route.
 * Tabs with a `state` property (e.g. { section: 'scheduling' }) are only
 * active when both the path AND the location state section match.
 */
export function isTabActive(tab, pathname, state) {
  if (tab.isMore) return false;
  if (!tab.path) return false;
  // State-aware tabs: match path AND state.section.
  // The "overview" (Home) tab is also active when there's no state at all
  // (initial load / fresh navigation to /admin with no section state).
  if (tab.state) {
    if (tab.state.section === 'overview') {
      return pathname === tab.path && (!state?.section || state.section === 'overview');
    }
    return pathname === tab.path && state?.section === tab.state.section;
  }
  // Non-state tabs: if multiple non-state tabs share the same path (e.g. both
  // point to /admin), only match when no state-specific tab is active.
  if (tab.path === '/admin') {
    return pathname === '/admin' && !state?.section;
  }
  // Exact match, or prefix match for nested routes (e.g. /fleet/123)
  return pathname === tab.path || pathname.startsWith(tab.path + '/');
}

/**
 * Returns true if the current route belongs to the "More" sheet (i.e. none
 * of the primary tabs match). Used to highlight the More tab.
 */
export function isActiveInMore(tabs, pathname, state) {
  return !tabs.some((t) => !t.isMore && isTabActive(t, pathname, state));
}