import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useVehicleCheckFrequency — reads the vehicle's check frequency setting
 * and the last vehicle check audit to determine whether the Daily Checks
 * step should gate (daily) or be skippable (weekly with a recent check).
 *
 * Returns:
 *  - frequency: 'daily' | 'weekly' (effective frequency after auto-detection)
 *  - weeklyCheckDone: boolean — true when a vehicle check was completed within the last 7 days
 *  - daysSinceLastCheck: number — days since the last vehicle check audit
 *  - lastCheckAt: ISO timestamp of the last vehicle check
 *  - vehicleName: vehicle name for display
 *  - isLoading
 */
export function useVehicleCheckFrequency({ vehicleId, staffId, enabled = true }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-check-frequency', vehicleId, staffId],
    queryFn: async () => {
      let vehicle = null;
      let lastCheck = null;

      // Get vehicle
      if (vehicleId) {
        try {
          const vList = await base44.entities.Vehicle.filter({ id: vehicleId });
          vehicle = vList?.[0] || null;
        } catch (e) { /* continue */ }
      }

      // Get last vehicle check audit for this staff member
      if (staffId) {
        try {
          const audits = await base44.entities.SafetyReport.filter({
            auditor_staff_id: staffId,
            audit_category: 'vehicle_check',
          });
          if (audits && audits.length > 0) {
            lastCheck = audits
              .sort((a, b) => new Date(b.conducted_at || b.completed_at || 0).getTime() - new Date(a.conducted_at || a.completed_at || 0).getTime())[0];
          }
        } catch (e) { /* continue */ }
      }

      // Determine effective frequency
      let frequency = 'weekly';
      if (vehicle) {
        if (vehicle.check_frequency === 'daily') {
          frequency = 'daily';
        } else if (vehicle.check_frequency === 'weekly') {
          frequency = 'weekly';
        } else {
          // auto — use cached weekly mileage
          frequency = (vehicle.weekly_mileage_miles || 0) >= 300 ? 'daily' : 'weekly';
        }
      }

      // Calculate days since last check
      const lastCheckDate = lastCheck?.conducted_at || lastCheck?.completed_at || null;
      let daysSince = Infinity;
      if (lastCheckDate) {
        const d = new Date(lastCheckDate);
        if (!isNaN(d.getTime())) {
          daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      return {
        frequency,
        weeklyCheckDone: daysSince <= 7,
        daysSinceLastCheck: daysSince === Infinity ? null : daysSince,
        lastCheckAt: lastCheckDate,
        vehicleName: vehicle?.name || null,
        weeklyMileage: vehicle?.weekly_mileage_miles || 0,
      };
    },
    enabled: !!vehicleId && !!staffId && enabled,
    staleTime: 60 * 1000,
  });

  return { ...data, isLoading };
}