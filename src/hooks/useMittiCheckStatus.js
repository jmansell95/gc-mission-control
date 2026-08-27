import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

/**
 * useMittiCheckStatus — reads the live Mitti/SafetyCulture verification
 * state for a given assignment + staff member.
 *
 * Returns:
 *  - isConnected: whether Mitti webhook is configured (drives hard vs soft gating)
 *  - vehicleCheckAt: ISO timestamp when the vehicle check was verified by Mitti (or null)
 *  - powraAt: ISO timestamp when the POWRA was verified by Mitti (or null)
 *  - equipmentCheckAt: ISO timestamp when the equipment check was verified (or null)
 *  - vehicleVerified / powraVerified / equipmentVerified: boolean convenience flags
 *  - isLoading
 *
 * The verification timestamps come from the RotaAssignment itself
 * (mitti_*_at fields, stamped by receiveMittiData when an audit arrives),
 * so this is real-time — the ShiftWizard re-renders automatically when a
 * Mitti webhook lands via the shared query cache.
 */
export function useMittiCheckStatus({ assignmentId, staffId, jobDate, enabled = true }) {
  const { isConnected } = useMittiStatus();

  const { data: assignment, isLoading } = useQuery({
    queryKey: ['mitti-check-status', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const list = await base44.entities.RotaAssignment.filter({ id: assignmentId });
      return list?.[0] || null;
    },
    enabled: !!assignmentId && enabled,
    staleTime: 15 * 1000,
    refetchInterval: enabled && isConnected ? 30 * 1000 : false, // poll every 30s when Mitti is live
  });

  const vehicleCheckAt = assignment?.mitti_vehicle_check_at || null;
  const powraAt = assignment?.mitti_powra_at || null;
  const equipmentCheckAt = assignment?.mitti_equipment_check_at || null;

  return {
    isConnected,
    vehicleCheckAt,
    powraAt,
    equipmentCheckAt,
    vehicleVerified: !!vehicleCheckAt,
    powraVerified: !!powraAt,
    equipmentVerified: !!equipmentCheckAt,
    isLoading,
  };
}