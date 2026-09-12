import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_WIDGETS } from '@/components/dashboard/registry';

/**
 * useDashboardLayout — manages the user's per-division dashboard layout.
 *
 * Loads the DashboardLayout record (filtered by staff_id + division_id),
 * falls back to the division's role-based default, and provides debounced
 * save back to the entity.
 *
 * Returns:
 *   widgets — array of { id, visible, order, position_x, position_y, size_w, size_h }
 *   editMode — 'simple' | 'advanced'
 *   layoutId — the DashboardLayout entity ID (null if not yet saved)
 *   saving — boolean
 *   setWidgets(updater) — update the widgets array
 *   setEditMode(mode) — update the edit mode
 *   resetLayout() — reset to defaults
 */
export function useDashboardLayout({ staffId, divisionId, roleDefault }) {
  const queryClient = useQueryClient();
  const [widgets, setWidgets] = useState(null);
  const [editMode, setEditMode] = useState('simple');
  const [layoutId, setLayoutId] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const hasAppliedServer = useRef(false);

  // Load the saved layout
  const { data: savedLayout } = useQuery({
    queryKey: ['my-dashboard-layout-v2', staffId, divisionId],
    queryFn: async () => {
      if (!staffId) return null;
      const filter = { staff_id: staffId };
      if (divisionId) filter.division_id = divisionId;
      const layouts = await base44.entities.DashboardLayout.filter(filter);
      // Prefer the layout that matches the division, fall back to any
      return layouts.find(l => l.division_id === divisionId) || layouts[0] || null;
    },
    enabled: !!staffId,
    staleTime: 60 * 1000,
  });

  // Apply the saved layout or the role default on first load
  useEffect(() => {
    if (hasAppliedServer.current) return;
    if (savedLayout) {
      hasAppliedServer.current = true;
      if (savedLayout.widgets && savedLayout.widgets.length > 0) {
        setWidgets(savedLayout.widgets);
      } else {
        // Fall back to role default or system default
        const defaults = roleDefault || DEFAULT_WIDGETS;
        setWidgets(defaults.map((id, i) => ({
          id, visible: true, order: i,
          position_x: 0, position_y: i, size_w: 4, size_h: 1,
        })));
      }
      if (savedLayout.edit_mode) setEditMode(savedLayout.edit_mode);
      if (savedLayout.id) setLayoutId(savedLayout.id);
    } else if (!staffId) {
      // No staff ID yet — use defaults
      const defaults = roleDefault || DEFAULT_WIDGETS;
      setWidgets(defaults.map((id, i) => ({
        id, visible: true, order: i,
        position_x: 0, position_y: i, size_w: 4, size_h: 1,
      })));
    }
  }, [savedLayout, staffId, roleDefault]);

  // Debounced save
  const save = useCallback((newWidgets, newEditMode) => {
    if (!staffId || !newWidgets) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = {
          staff_id: staffId,
          division_id: divisionId || null,
          edit_mode: newEditMode,
          widgets: newWidgets,
        };
        if (layoutId) {
          await base44.entities.DashboardLayout.update(layoutId, payload);
        } else {
          const created = await base44.entities.DashboardLayout.create(payload);
          if (created?.id) setLayoutId(created.id);
        }
        queryClient.invalidateQueries({ queryKey: ['my-dashboard-layout-v2', staffId, divisionId] });
      } catch (err) {
        console.error('Dashboard layout save error:', err);
      }
      setSaving(false);
    }, 800);
  }, [staffId, divisionId, layoutId, queryClient]);

  // Trigger save when widgets or editMode change
  useEffect(() => {
    if (widgets) save(widgets, editMode);
  }, [widgets, editMode, save]);

  const resetLayout = useCallback(() => {
    const defaults = roleDefault || DEFAULT_WIDGETS;
    setWidgets(defaults.map((id, i) => ({
      id, visible: true, order: i,
      position_x: 0, position_y: i, size_w: 4, size_h: 1,
    })));
  }, [roleDefault]);

  return {
    widgets,
    editMode,
    layoutId,
    saving,
    setWidgets,
    setEditMode,
    resetLayout,
  };
}