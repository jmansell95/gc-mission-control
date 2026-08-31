import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Global realtime sync — the single source of "no manual refresh" for the
 * whole site. Mounted once near the app root (inside AuthenticatedApp).
 *
 * Subscribes to every core entity. On any create/update/delete event (from
 * this user OR any other user/device), it invalidates the React Query caches
 * that depend on that entity, so every open list, dashboard and detail view
 * refreshes automatically.
 *
 * This is intentionally broad — invalidating a partial key like ['rotas']
 * refreshes every ['rotas', weekStart, division] variant. That keeps the
 * behaviour identical across the site without wiring a hook into each page.
 */
const ENTITY_QUERY_KEYS = {
  Job: [
    ['jobs'], ['job'], ['my-today-assignments'], ['outstanding-asset-assignments'],
    ['job-asset-assignments'], ['job-chain-legs-detail'], ['job-chain-legs'],
    ['delivery-legs-map'], ['admin-all-deliveries'], ['driver-day-stops'],
    ['all-jobs-financials'], ['job-financials'], ['site-assets'],
    ['investigation-logs'], ['job-cost-items'], ['job-deliveries'],
  ],
  RotaAssignment: [
    ['rotas'], ['staff-all-rotas'], ['staff-assignments'], ['my-today-assignments'],
    ['rota-week'], ['recurring-depot-duty'],
  ],
  Timesheet: [
    ['timesheets'], ['staff-timesheets'], ['all-timesheets-mgr'], ['timesheet-delegations'],
  ],
  InvestigationLog: [
    ['investigation-logs'], ['site-logs'], ['staff-timesheets'], ['all-timesheets-mgr'],
  ],
  Staff: [
    ['staff'], ['staff-all-rotas'], ['compliance-staff-all'], ['staff-assignments'],
    ['my-today-assignments'], ['permission-groups'], ['teams'],
  ],
  Vehicle: [
    ['vehicles'], ['fleet-vehicles'], ['driver-day-stops'], ['deliveries-for-drivers'],
  ],
  SiteAsset: [
    ['site-assets'], ['rigs-active'], ['rigs-active-rota'], ['assets'],
    ['job-asset-assignments'], ['outstanding-asset-assignments'],
  ],
  DeliveryLog: [
    ['deliveries-for-drivers'], ['admin-all-deliveries'], ['driver-day-stops'],
    ['delivery-legs-map'], ['deliveries'], ['job-deliveries'],
  ],
  JobCostItem: [
    ['job-cost-items'], ['job-financials'], ['all-jobs-financials'], ['cvr'],
  ],
  ComplianceItem: [
    ['compliance-items'], ['compliance-staff-all'], ['compliance'],
  ],
  Invoice: [
    ['invoices'], ['invoicing'], ['all-jobs-financials'],
  ],
  AFP: [
    ['afp'], ['afps'], ['job-financials'], ['all-jobs-financials'],
  ],
  CVR: [
    ['cvr'], ['cvrs'], ['job-financials'], ['all-jobs-financials'],
  ],
  Absence: [
    ['absences'], ['recurring-absences'], ['staff-all-rotas'],
  ],
  HotelBooking: [
    ['hotel-bookings'], ['job-hotel-bookings'],
  ],
};

export default function useJobRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubs = [];
    for (const entityName of Object.keys(ENTITY_QUERY_KEYS)) {
      try {
        const keys = ENTITY_QUERY_KEYS[entityName];
        const unsub = base44.entities[entityName]?.subscribe((event) => {
          if (!event || !event.type) return;
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        });
        if (typeof unsub === 'function') unsubs.push(unsub);
      } catch {
        // Realtime not available for this entity — silently skip.
      }
    }
    return () => {
      for (const unsub of unsubs) {
        try { unsub(); } catch {}
      }
    };
  }, [queryClient]);
}