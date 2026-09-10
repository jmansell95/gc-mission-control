import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getNavConfigs, resolveNavItems } from '@/utils/divisionNav';

const DivisionContext = createContext(null);
const STORAGE_KEY = 'gc-active-division';

/**
 * DivisionProvider — the multi-division context that powers the whole platform.
 *
 * Three access tiers:
 *  - Super Admin (role='admin'): sees ALL divisions, can switch freely, lands on
 *    the Enterprise Selector after login.
 *  - Director (role='director'): sees only their managed_division_ids, can switch
 *    between those divisions only, lands on the Enterprise Selector (filtered).
 *  - Standard User (role='user'): locked to their single division_id, cannot
 *    switch, lands directly in that division's workspace.
 *
 * Persists the selected division in localStorage so it survives refreshes.
 */
export function DivisionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const isDirector = user?.role === 'director';
  // Enterprise admin = anyone who can access the Enterprise Selector and switch.
  // Includes Business Stream Admins (users with managed_division_ids set) —
  // they can switch between their assigned BUs/BSs and the enterprise dashboard.
  const managedDivisionIds = user?.managed_division_ids || [];
  const isEnterpriseAdmin = isSuperAdmin || isDirector || user?.is_enterprise_admin === true || managedDivisionIds.length > 0;

  const { data: divisions = [], isLoading: divisionsLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
    enabled: !!isAuthenticated,
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile-division'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
    enabled: !!isAuthenticated,
  });

  const myDivisionId = profile?.division_id || user?.division_id || null;

  const [activeDivisionId, setActiveDivisionIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  const activeDivision = useMemo(
    () => divisions.find(d => d.id === activeDivisionId) || null,
    [divisions, activeDivisionId]
  );

  // Permitted divisions based on role:
  // Super Admin → all, Enterprise Admin (director or BS admin with managed_division_ids)
  // → home division + all managed divisions, Standard User → single division only.
  const permittedDivisions = useMemo(() => {
    if (isSuperAdmin) return divisions;
    if (managedDivisionIds.length > 0) {
      return divisions.filter(d => d.id === myDivisionId || managedDivisionIds.includes(d.id));
    }
    // Standard user: only their own division
    return divisions.filter(d => d.id === myDivisionId);
  }, [divisions, isSuperAdmin, managedDivisionIds, myDivisionId]);

  const permittedDivisionIds = useMemo(
    () => permittedDivisions.map(d => d.id),
    [permittedDivisions]
  );

  // Lock standard (non-enterprise) users to their own division.
  useEffect(() => {
    if (divisionsLoading || !isAuthenticated) return;
    if (!isEnterpriseAdmin && myDivisionId && activeDivisionId !== myDivisionId) {
      setActiveDivisionIdState(myDivisionId);
      try { localStorage.setItem(STORAGE_KEY, myDivisionId); } catch {}
    }
  }, [divisionsLoading, isAuthenticated, isEnterpriseAdmin, myDivisionId, activeDivisionId]);

  // Validate stored active division against permitted list.
  // If a director's managed divisions changed, or a user's division was reassigned,
  // reset the stale stored selection.
  useEffect(() => {
    if (divisionsLoading || !isAuthenticated || !divisions.length) return;
    if (!activeDivisionId) return; // null = enterprise overview, valid for enterprise admins
    if (isEnterpriseAdmin) {
      // Non-super-admin enterprise admins: must be in permitted list. Super admins: anything is fine.
      if (!isSuperAdmin && activeDivisionId && !permittedDivisionIds.includes(activeDivisionId)) {
        setActiveDivisionIdState(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    } else {
      // Standard user: must be their own division
      if (myDivisionId && activeDivisionId !== myDivisionId) {
        setActiveDivisionIdState(myDivisionId);
        try { localStorage.setItem(STORAGE_KEY, myDivisionId); } catch {}
      }
    }
  }, [divisionsLoading, isAuthenticated, divisions, isEnterpriseAdmin, isDirector, permittedDivisionIds, myDivisionId, activeDivisionId]);

  const setActiveDivision = (id) => {
    // Block standard users from switching
    if (!isEnterpriseAdmin && id && id !== myDivisionId) return;
    // Block non-super-admin enterprise admins from switching to non-permitted divisions
    if (!isSuperAdmin && id && !permittedDivisionIds.includes(id)) return;
    setActiveDivisionIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id || ''); } catch {}
  };

  const isHubEnabled = (hubId) => {
    if (!activeDivision) return true; // Enterprise overview = all hubs
    const hubs = activeDivision.enabled_hubs || [];
    if (hubs.length === 0) return true; // Not configured = show all
    return hubs.includes(hubId);
  };

  // Resolve the mobile bottom-nav items for the active division.
  const navItems = useMemo(() => {
    if (!activeDivision) return [];
    return getNavConfigs(activeDivision);
  }, [activeDivision]);

  const navItemIds = useMemo(() => {
    if (!activeDivision) return [];
    return resolveNavItems(activeDivision);
  }, [activeDivision]);

  const getDivisionSetting = (key, fallback) => {
    if (!activeDivision?.settings) return fallback;
    const val = activeDivision.settings[key];
    return val === undefined ? fallback : val;
  };

  // Apply the active division's accent colour as a CSS variable so per-BS
  // theming (badges, active states) works without hardcoding. Falls back to
  // the brand green when no division is active (enterprise overview) or the
  // division has no colour set.
  useEffect(() => {
    const color = activeDivision?.color || '#2E5A1A';
    document.documentElement.style.setProperty('--division-accent', color);
    return () => { document.documentElement.style.removeProperty('--division-accent'); };
  }, [activeDivision?.color]);

  const value = {
    divisions,
    permittedDivisions,
    permittedDivisionIds,
    activeDivision,
    activeDivisionId,
    setActiveDivision,
    isSuperAdmin,
    isDirector,
    isEnterpriseAdmin,
    myDivisionId,
    managedDivisionIds,
    isLoading: divisionsLoading,
    isHubEnabled,
    navItems,
    navItemIds,
    getDivisionSetting,
  };

  return <DivisionContext.Provider value={value}>{children}</DivisionContext.Provider>;
}

export function useDivision() {
  const ctx = useContext(DivisionContext);
  if (!ctx) {
    return {
      divisions: [], permittedDivisions: [], permittedDivisionIds: [],
      activeDivision: null, activeDivisionId: null,
      setActiveDivision: () => {}, isSuperAdmin: false, isDirector: false,
      isEnterpriseAdmin: false, myDivisionId: null, managedDivisionIds: [],
      isLoading: true, isHubEnabled: () => true,
      navItems: [], navItemIds: [], getDivisionSetting: (k, f) => f,
    };
  }
  return ctx;
}