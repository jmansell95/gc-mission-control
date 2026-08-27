import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * useDivisionAppSetting — division-scoped AppSetting read/write hook.
 *
 * Reads the AppSetting record for `key` scoped to the active business stream
 * (division_id = activeDivisionId). When no division is active, it reads the
 * global record (division_id = null). Saves write back to the same scope.
 *
 * This is the frontend half of per-stream integration config: each business
 * stream stores its own integration credentials, so different streams can
 * connect different Geotab / Holman / Asset Panda accounts.
 *
 * @param {string} key - AppSetting key (e.g. 'geotab_config')
 * @param {object} opts - { label, defaultValue }
 * @returns { config, setConfig, rec, save, saving, isLoading, activeDivisionId }
 */
export function useDivisionAppSetting(key, { label, defaultValue = {} } = {}) {
  const { activeDivisionId } = useDivision();
  const qc = useQueryClient();
  const [config, setConfig] = useState(defaultValue);
  const [saving, setSaving] = useState(false);

  const queryKey = ['app-setting', key, activeDivisionId || 'global'];

  const { data: rec, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const filter = activeDivisionId ? { key, division_id: activeDivisionId } : { key, division_id: null };
      const recs = await base44.entities.AppSetting.filter(filter, '-created_date', 5);
      return recs?.[0] || null;
    },
  });

  useEffect(() => {
    if (rec?.value) setConfig({ ...defaultValue, ...rec.value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);

  const save = useCallback(async (value) => {
    setSaving(true);
    try {
      const payload = { key, label, value: value ?? config, division_id: activeDivisionId || null };
      if (rec?.id) {
        await base44.entities.AppSetting.update(rec.id, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      qc.invalidateQueries({ queryKey });
      return true;
    } catch (e) {
      return false;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, config, activeDivisionId, key, label]);

  return { config, setConfig, rec, save, saving, isLoading, activeDivisionId };
}