import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Built-in default SafetyCulture (Mitti) inspection links — used when no
// per-stream URL is configured in MittiConfig. These match the hardcoded
// links in JobBriefingModal so the prompts and the briefing stay consistent.
const DEFAULT_VEHICLE_CHECK_URL =
  'https://app.safetyculture.com/inspection/audit_a7b6591dc3064b2f8e4557c3ce1e432e?page=1&isNew=true&holisticOnboarding=false';
const DEFAULT_POWRA_URL =
  'https://app.safetyculture.com/inspection/audit_349a23db07de4cfba675bb2a0a9f7bd8?page=1&isNew=true&holisticOnboarding=false';
const DEFAULT_EQUIP_CHECK_URL =
  'https://app.safetyculture.com/inspection/audit_bc585d98c32640b4a333d34afad8b3b9?page=1&isNew=true&holisticOnboarding=false';

/**
 * useMittiCheckLinks — reads the configurable Mitti/SafetyCulture inspection
 * URLs from MittiConfig, falling back to the built-in defaults when blank.
 *
 * Returns { vehicleCheckUrl, powraUrl, equipmentCheckUrl, isLoading }.
 *
 * Used by the ShiftWizard safety prompts (DailyChecksStep, ArriveStep) so
 * the "Open Mitti" buttons always point at the right audit, whether the
 * admin has configured a custom link or not.
 */
export function useMittiCheckLinks() {
  const { data: config, isLoading } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => {
      const list = await base44.entities.MittiConfig.filter({ key: 'global' });
      return list?.[0] || null;
    },
    staleTime: 60 * 1000,
  });

  return {
    vehicleCheckUrl: config?.vehicle_check_url || DEFAULT_VEHICLE_CHECK_URL,
    powraUrl: config?.powra_url || DEFAULT_POWRA_URL,
    equipmentCheckUrl: config?.equipment_check_url || DEFAULT_EQUIP_CHECK_URL,
    isLoading,
  };
}