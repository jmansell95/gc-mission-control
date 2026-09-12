import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { resolveSettings, getEffectiveSetting } from '@/lib/enterpriseSettingsConfig';

/**
 * Resolves the effective settings for the active division by merging
 * enterprise-wide defaults (EnterpriseSetting singleton) with the active
 * division's settings_overrides.
 *
 * Returns:
 *   - settings: the merged effective settings object
 *   - get(key): helper to fetch a single effective setting value
 *   - isLoading: whether the settings are still loading
 *   - division: the active division record (with settings_overrides)
 *   - enterpriseSettings: the raw enterprise defaults
 */
export function useEffectiveSettings() {
  const { activeDivision } = useDivision();

  const { data: enterpriseSettings, isLoading: isLoadingEnterprise } = useQuery({
    queryKey: ['enterprise-settings-global'],
    queryFn: async () => {
      const res = await base44.entities.EnterpriseSetting.filter({ key: 'global' }, '-created_date', 1);
      return res?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const divisionOverrides = activeDivision?.settings_overrides || {};
  const settings = resolveSettings(enterpriseSettings, divisionOverrides);

  const get = (key) => getEffectiveSetting(enterpriseSettings, divisionOverrides, key);

  return {
    settings,
    get,
    isLoading: isLoadingEnterprise,
    division: activeDivision,
    enterpriseSettings,
    overrides: divisionOverrides,
  };
}

export default useEffectiveSettings;