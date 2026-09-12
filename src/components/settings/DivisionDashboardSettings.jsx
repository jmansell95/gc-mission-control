import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid, Users, BarChart3, Save, Eye, EyeOff, GripVertical,
  Shield, Briefcase, HardHat, Cog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  WIDGET_REGISTRY, WIDGET_CATEGORIES, DEFAULT_WIDGETS,
} from '@/components/dashboard/registry';
import CustomKPIBuilder from '@/components/settings/CustomKPIBuilder';

const ROLES = [
  { key: 'field', label: 'Field', icon: HardHat, description: 'Field crew default layout' },
  { key: 'office', label: 'Office', icon: Briefcase, description: 'Office staff default layout' },
  { key: 'management', label: 'Management', icon: Users, description: 'Managers default layout' },
  { key: 'admin', label: 'Admin', icon: Shield, description: 'Admins default layout' },
];

/**
 * DivisionDashboardSettings — Enterprise Settings tab for configuring
 * per-division dashboard defaults: widget library, role-based layouts,
 * and custom KPI tiles.
 */
export default function DivisionDashboardSettings({ divisions, canEditAll }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('widgets');

  useEffect(() => {
    if (!selectedDivisionId && divisions.length > 0) {
      setSelectedDivisionId(canEditAll ? divisions[0].id : divisions.find(d => d.is_active !== false)?.id || divisions[0]?.id);
    }
  }, [divisions, selectedDivisionId, canEditAll]);

  const selectedDivision = divisions.find(d => d.id === selectedDivisionId);

  useEffect(() => {
    if (!selectedDivision) { setConfig(null); return; }
    const cfg = selectedDivision.dashboard_config || {};
    setConfig({
      enabled_widgets: cfg.enabled_widgets || [],
      role_defaults: cfg.role_defaults || {},
      custom_kpi_tiles: cfg.custom_kpi_tiles || [],
    });
  }, [selectedDivisionId, selectedDivision]);

  const update = (field, value) => setConfig(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!selectedDivision || !config) return;
    setSaving(true);
    try {
      await base44.entities.Division.update(selectedDivision.id, {
        dashboard_config: config,
      });
      await base44.functions.invoke('logSystemAudit', {
        action: 'update_division_dashboard_config',
        entity_type: 'Division',
        entity_id: selectedDivision.id,
        details: `Updated dashboard config for ${selectedDivision.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['division-dashboard-config'] });
      queryClient.invalidateQueries({ queryKey: ['divisions-for-login'] });
      toast({ title: 'Saved', description: `Dashboard config for ${selectedDivision.name} updated.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Widget library toggle
  const toggleWidgetEnabled = (widgetId) => {
    const enabled = config.enabled_widgets || [];
    update('enabled_widgets', enabled.includes(widgetId)
      ? enabled.filter(id => id !== widgetId)
      : [...enabled, widgetId]
    );
  };

  // Role default toggle (add/remove a widget from a role's default layout)
  const toggleRoleWidget = (roleKey, widgetId) => {
    const defaults = { ...(config.role_defaults || {}) };
    const current = defaults[roleKey] || [];
    if (current.includes(widgetId)) {
      defaults[roleKey] = current.filter(id => id !== widgetId);
    } else {
      defaults[roleKey] = [...current, widgetId];
    }
    update('role_defaults', defaults);
  };

  // Custom KPI tile save/delete
  const saveKpiTile = (tile) => {
    const tiles = [...(config.custom_kpi_tiles || [])];
    const idx = tiles.findIndex(t => t.id === tile.id);
    if (idx >= 0) tiles[idx] = tile;
    else tiles.push(tile);
    update('custom_kpi_tiles', tiles);
    handleSave();
  };

  const deleteKpiTile = (tileId) => {
    update('custom_kpi_tiles', (config.custom_kpi_tiles || []).filter(t => t.id !== tileId));
    setTimeout(handleSave, 100);
  };

  if (!selectedDivision || !config) {
    return <div className="hub-glass rounded-2xl p-8 text-center text-sm text-slate-400">No divisions available</div>;
  }

  const SECTIONS = [
    { key: 'widgets', label: 'Widget Library', icon: LayoutGrid },
    { key: 'roles', label: 'Role Defaults', icon: Users },
    { key: 'kpi', label: 'Custom KPIs', icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* Division selector + save */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Division:</span>
          <select
            value={selectedDivisionId || ''}
            onChange={e => setSelectedDivisionId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-primary"
          >
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button size="sm" onClick={handleSave} disabled={saving} className="ml-auto">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                active ? 'bg-primary text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      {activeSection === 'widgets' && (
        <div className="hub-glass rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Widget Library</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Toggle which widgets are available to users in this division. When empty, all widgets are available.
              {config.enabled_widgets.length > 0 && (
                <button onClick={() => update('enabled_widgets', [])} className="ml-2 text-primary font-semibold hover:underline">Show all</button>
              )}
            </p>
          </div>
          {WIDGET_CATEGORIES.map(cat => {
            const catWidgets = Object.entries(WIDGET_REGISTRY).filter(([id, w]) => w.category === cat.key);
            if (catWidgets.length === 0) return null;
            const CatIcon = cat.icon;
            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                    <CatIcon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.label}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catWidgets.map(([id, w]) => {
                    const enabled = config.enabled_widgets.length === 0 || config.enabled_widgets.includes(id);
                    const Icon = w.icon;
                    return (
                      <label key={id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-primary/10' : 'bg-slate-100'}`}>
                          <Icon className={`w-4 h-4 ${enabled ? 'text-primary' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${enabled ? 'text-slate-800' : 'text-slate-400'}`}>{w.title}</p>
                          <p className="text-xs text-slate-400 truncate">{w.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleWidgetEnabled(id)}
                          className="w-4 h-4 accent-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === 'roles' && (
        <div className="space-y-3">
          {ROLES.map(role => {
            const RoleIcon = role.icon;
            const roleWidgets = config.role_defaults[role.key] || [];
            return (
              <div key={role.key} className="hub-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <RoleIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{role.label} Default Layout</h3>
                    <p className="text-xs text-slate-400">{role.description} · {roleWidgets.length} widgets</p>
                  </div>
                </div>
                {/* Widget toggles for this role */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(WIDGET_REGISTRY).map(([id, w]) => {
                    const active = roleWidgets.includes(id);
                    const Icon = w.icon;
                    return (
                      <button
                        key={id}
                        onClick={() => toggleRoleWidget(role.key, id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition ${
                          active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-50" />}
                        {w.title}
                      </button>
                    );
                  })}
                </div>
                {roleWidgets.length === 0 && (
                  <p className="text-xs text-slate-400">No default layout set — users with this role will see the system default ({DEFAULT_WIDGETS.length} widgets).</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeSection === 'kpi' && (
        <CustomKPIBuilder
          existingTiles={config.custom_kpi_tiles || []}
          onSave={saveKpiTile}
          onDelete={deleteKpiTile}
        />
      )}
    </div>
  );
}