import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { Loader2, Activity, Briefcase, DollarSign, Users, AlertTriangle, ShieldCheck, TrendingUp, CalendarClock, Truck, Wrench, Gauge, FileText, Zap, MapPin, BarChart3, Percent, ClipboardCheck, ShieldAlert, PoundSterling, Mountain, Cog, Drill, CloudSun, Bot, Package, Building2, HardHat, Layers } from 'lucide-react';

// Curated icon map for custom KPI tiles — the admin picks from these in the builder
export const KPI_ICON_MAP = {
  Activity, Briefcase, DollarSign, Users, AlertTriangle, ShieldCheck, TrendingUp,
  CalendarClock, Truck, Wrench, Gauge, FileText, Zap, MapPin, BarChart3, Percent,
  ClipboardCheck, ShieldAlert, PoundSterling, Mountain, Cog, Drill, CloudSun, Bot,
  Package, Building2, HardHat, Layers,
};

/**
 * CustomKPITile — renders a custom KPI tile defined by an admin in
 * Enterprise Settings → Division Dashboard → Custom KPI Builder.
 *
 * Queries the specified entity with the filter, applies the aggregation,
 * and displays the formatted result with the configured icon and colour.
 *
 * Props:
 *   tile — the tile definition from Division.dashboard_config.custom_kpi_tiles
 *          { id, label, entity_name, aggregation, value_field, filter, icon, color, format }
 */
export default function CustomKPITile({ tile }) {
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const entity = base44.entities[tile.entity_name];
        if (!entity) throw new Error(`Entity ${tile.entity_name} not found`);

        const records = await entity.filter(tile.filter || {}, '-created_date', 500);
        if (cancelled) return;

        let result;
        if (tile.aggregation === 'count') {
          result = records.length;
        } else {
          const field = tile.value_field;
          const values = records.map(r => r[field]).filter(v => v != null && !isNaN(v));
          if (values.length === 0) {
            result = 0;
          } else if (tile.aggregation === 'sum') {
            result = values.reduce((a, b) => a + b, 0);
          } else if (tile.aggregation === 'avg') {
            result = values.reduce((a, b) => a + b, 0) / values.length;
          } else if (tile.aggregation === 'min') {
            result = Math.min(...values);
          } else if (tile.aggregation === 'max') {
            result = Math.max(...values);
          }
        }

        if (!cancelled) { setValue(result); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tile.entity_name, tile.aggregation, tile.value_field, JSON.stringify(tile.filter)]);

  function formatValue(val) {
    if (val == null) return '—';
    switch (tile.format) {
      case 'currency':
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
      case 'percent':
        return `${val}%`;
      case 'raw':
        return String(val);
      case 'number':
      default:
        return new Intl.NumberFormat('en-GB').format(val);
    }
  }

  const Icon = KPI_ICON_MAP[tile.icon] || Activity;
  const color = tile.color || '#2E5A1A';

  return (
    <WidgetShell icon={Icon} title={tile.label} subtitle="">
      <div className="flex items-center justify-center py-6">
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-rose-500 font-medium">Error</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: `${color}15` }}>
              <Icon className="w-7 h-7" style={{ color }} />
            </div>
            <p className="text-4xl font-extrabold tabular-nums" style={{ color }}>
              {formatValue(value)}
            </p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}