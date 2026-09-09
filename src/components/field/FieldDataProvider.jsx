import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isFuture } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { useJobTypes } from '@/hooks/useJobTypes';
import { useStaffTracking } from '@/hooks/useStaffTracking';
import { syncAllOfflineData } from '@/utils/offlineSync';
import { useToast } from '@/components/ui/use-toast';

const FieldDataContext = createContext(null);
export const useFieldData = () => useContext(FieldDataContext);

/**
 * Centralises all shared data fetching for the field crew pages
 * (Today, Upcoming, More) so navigating between routes doesn't re-fetch.
 * React Query deduplicates via cache; this provider ensures the queries
 * are mounted once at the shell level rather than per-page.
 */
export function FieldDataProvider({ children }) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin' || user?.role === 'director';
  const { activeDivision } = useDivision();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Staff profile
  const { data: staff = null, isLoading: loading } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        const profile = res.data;
        if (profile && (profile.id || profile.is_admin)) return profile;
        if (isPlatformAdmin) {
          return { id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true, delivery_dashboard_enabled: true };
        }
        return null;
      } catch (error) {
        console.error('Error loading staff:', error);
        if (isPlatformAdmin) {
          return { id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true, delivery_dashboard_enabled: true };
        }
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  // Online/offline sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncAllOfflineData().then(result => {
        if (result.total > 0) {
          queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
          const parts = [];
          if (result.briefings > 0) parts.push(`${result.briefings} briefing${result.briefings !== 1 ? 's' : ''}`);
          if (result.deliveries > 0) parts.push(`${result.deliveries} deliver${result.deliveries !== 1 ? 'ies' : 'y'}`);
          toast({ title: 'Offline data synced', description: `${parts.join(' and ')} uploaded.` });
        }
      }).catch(err => console.error('Sync error:', err));
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time sync
  useEffect(() => {
    if (!staff?.id) return;
    const unsub1 = base44.entities.RotaAssignment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    });
    const unsub2 = base44.entities.RotaWeek.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
    });
    return () => { if (unsub1) unsub1(); if (unsub2) unsub2(); };
  }, [staff?.id, queryClient]);

  // Assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      try {
        const rawRotas = await base44.entities.RotaAssignment.filter({ staff_id: staff.id });
        const _seen = {};
        const rotas = rawRotas.filter(a => {
          const k = `${a.job_id}|${a.assigned_date}`;
          if (_seen[k]) return false;
          _seen[k] = true;
          return true;
        });
        const sorted = rotas.sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date));
        localStorage.setItem('cached_assignments_' + staff.id, JSON.stringify(sorted));
        return sorted;
      } catch (err) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_assignments_' + staff.id);
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
    enabled: !!staff?.id
  });

  // Reference data — cached to localStorage for offline access so field crews
  // can see job names, locations, client info and crew mates even without signal.
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-assignments'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Job.list();
        try { localStorage.setItem('cached_jobs', JSON.stringify(list)); } catch {}
        return list;
      } catch (err) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_jobs');
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Vehicle.list();
        try { localStorage.setItem('cached_vehicles', JSON.stringify(list)); } catch {}
        return list;
      } catch (err) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_vehicles');
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Client.list();
        try { localStorage.setItem('cached_clients', JSON.stringify(list)); } catch {}
        return list;
      } catch (err) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_clients');
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
  });
  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      try {
        const list = await base44.entities.Staff.list();
        try { localStorage.setItem('cached_all_staff', JSON.stringify(list)); } catch {}
        return list;
      } catch (err) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_all_staff');
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
  });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: allAssignments = [] } = useQuery({ queryKey: ['all-rota-assignments'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: mgrTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: rotaWeeks = [] } = useQuery({ queryKey: ['rota-weeks'], queryFn: () => base44.entities.RotaWeek.list() });
  const { data: bizConfig } = useQuery({ queryKey: ['business-config'], queryFn: async () => { const list = await base44.entities.BusinessConfig.filter({ key: 'global' }); return list[0] || null; } });
  const { data: myCompliance = [] } = useQuery({ queryKey: ['staff-compliance', staff?.id], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }), enabled: !!staff?.id });
  const { data: jobAssets = [] } = useQuery({ queryKey: ['job-asset-assignments-staff'], queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 500) });
  const { data: siteAssetsStaff = [] } = useQuery({ queryKey: ['site-assets-staff'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: equipmentCompliance = [] } = useQuery({ queryKey: ['equipment-compliance'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'equipment' }) });
  const { data: myHotelBookings = [] } = useQuery({ queryKey: ['my-hotel-bookings', staff?.id], queryFn: () => base44.entities.HotelBooking.list('-created_date', 500).then(list => list.filter(b => (b.assigned_staff_ids || []).includes(staff.id) || b.staff_id === staff.id)), enabled: !!staff?.id });
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-active-staff'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true, is_active: true }) });
  const { data: jobTypes = [] } = useJobTypes();
  const { data: myDeliveries = [] } = useQuery({ queryKey: ['my-deliveries-today', staff?.id], queryFn: () => base44.entities.DeliveryLog.filter({ driver_staff_id: staff.id }), enabled: !!staff?.id });

  // GPS tracking
  const todayStrForTracking = format(new Date(), 'yyyy-MM-dd');
  const activeTrackingAssignment = assignments.find(a => a.assigned_date === todayStrForTracking && (a.status || 'assigned') !== 'completed' && a.assignment_type !== 'yard_depot') || null;
  const { isTracking: gpsTracking, hasFix: gpsHasFix, pointsQueued: gpsPointsQueued, errorType: gpsErrorType } = useStaffTracking({
    staff,
    activeAssignment: activeTrackingAssignment,
    enabled: !!staff?.id && !staff?.is_admin,
  });

  // Derived counts for the tab bar
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const visibleWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const hasAnyRotaWeeks = rotaWeeks.length > 0;
  const isAdminUser = staff?.is_admin || isPlatformAdmin;
  const visibleAssignments = useMemo(() => {
    const cancelledJobIds = new Set(jobs.filter(j => j.status === 'cancelled').map(j => j.id));
    const base = isAdminUser ? assignments : (hasAnyRotaWeeks ? assignments.filter(a => visibleWeekStarts.includes(a.week_start)) : assignments);
    return base.filter(a => !cancelledJobIds.has(a.job_id));
  }, [assignments, jobs, isAdminUser, hasAnyRotaWeeks, visibleWeekStarts]);

  const todaysAssignments = visibleAssignments.filter(a => a.assigned_date === todayStr);
  const upcomingAssignments = visibleAssignments.filter(a => isFuture(new Date(a.assigned_date + 'T00:00:00')) && a.assigned_date !== todayStr);

  const value = {
    staff, loading, isPlatformAdmin, activeDivision,
    assignments, assignmentsLoading, visibleAssignments,
    todaysAssignments, upcomingAssignments,
    jobs, vehicles, clients, allStaff, teams,
    allAssignments, mgrTimesheets, rotaWeeks, bizConfig, myCompliance,
    jobAssets, siteAssetsStaff, equipmentCompliance, myHotelBookings, rigs,
    jobTypes, myDeliveries, isOnline,
    gpsTracking, gpsHasFix, gpsPointsQueued, gpsErrorType,
    queryClient, toast,
  };

  return <FieldDataContext.Provider value={value}>{children}</FieldDataContext.Provider>;
}