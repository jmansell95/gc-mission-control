import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Fetches and manages the settings page lockdown config stored in AppSetting.
// The config is a JSON map: { [pageId]: { locked, allowedRoles, lockedBy, lockedAt } }
// When a page is locked, only users whose role is in allowedRoles can access it.
// Super admins always bypass every lock.
export function useSettingsAccess() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings-access-control'],
    queryFn: async () => {
      const records = await base44.entities.AppSetting.filter({ key: 'settings_access_control' });
      return records[0] || null;
    },
    staleTime: 15000,
  });

  const lockdownMap = (data?.value) || {};
  const settingId = data?.id;

  const isPageAccessible = (pageId, role) => {
    if (role === 'super_admin') return true;
    const config = lockdownMap[pageId];
    if (!config || !config.locked) return true;
    return (config.allowedRoles || []).includes(role);
  };

  const saveLockdown = async (newMap) => {
    const payload = { key: 'settings_access_control', value: newMap };
    if (settingId) {
      await base44.entities.AppSetting.update(settingId, payload);
    } else {
      await base44.entities.AppSetting.create(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['settings-access-control'] });
  };

  const toggleLock = async (pageId, locked, allowedRoles, lockedByName) => {
    const newMap = { ...lockdownMap };
    if (locked) {
      newMap[pageId] = {
        locked: true,
        allowedRoles,
        lockedBy: lockedByName || 'Admin',
        lockedAt: new Date().toISOString(),
      };
    } else {
      delete newMap[pageId];
    }
    await saveLockdown(newMap);
  };

  return { lockdownMap, isPageAccessible, toggleLock, saveLockdown, isLoading };
}