import React from 'react';
import { Gauge, Clock, AlertTriangle, CheckCircle2, Wrench, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * UsageHoursWidget — Phase 1 hours-based maintenance dashboard.
 *
 * Shows all rigs and plant assets with their accumulated operating hours,
 * hours since last service, and progress toward the service interval.
 * Includes a "Recalculate Now" button to trigger the usage engine on demand.
 */
export default function UsageHoursWidget() {
  const { toast } = useToast();
  const [recalculating, setRecalculating] = React.useState(false);

  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: ['usage-hours-assets'],
    queryFn: async () => {
      const rigs = await base44.entities.SiteAsset.filter({ asset_type: 'rig' });
      const machinery = await base44.entities.SiteAsset.filter({ asset_type: 'machinery' });
      return [...rigs, ...machinery].sort((a, b) => (b.operating_hours || 0) - (a.operating_hours || 0));
    },
  });

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await base44.functions.invoke('recalculateUsageMaintenance', {});
      const d = res.data || res;
      toast({
        title: d.assets_flagged > 0 ? `${d.assets_flagged} asset(s) flagged` : 'All assets within threshold',
        description: d.bookings_created > 0
          ? `${d.bookings_created} maintenance booking(s) auto-created.`
          : 'No new bookings needed.',
      });
      refetch();
    } catch (e) {
      toast({ title: 'Recalculation failed', description: e?.message, variant: 'destructive' });
    }
    setRecalculating(false);
  };

  const getStatusConfig = (asset) => {
    const interval = asset.service_interval_hours || 250;
    const hoursSince = asset.hours_since_last_service || 0;
    const pct = interval > 0 ? (hoursSince / interval) * 100 : 0;

    if (asset.maintenance_status === 'overdue' || pct >= 100) {
      return { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', ring: 'stroke-rose-500', label: 'Overdue', barColor: 'bg-rose-500' };
    }
    if (asset.maintenance_status === 'due_soon' || pct >= 80) {
      return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'stroke-amber-500', label: 'Due Soon', barColor: 'bg-amber-500' };
    }
    if (hoursSince > 0) {
      return { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'stroke-emerald-500', label: 'OK', barColor: 'bg-emerald-500' };
    }
    return { icon: Gauge, color: 'text-slate-400', bg: 'bg-slate-50', ring: 'stroke-slate-300', label: 'No Data', barColor: 'bg-slate-300' };
  };

  const summary = {
    total: assets.length,
    overdue: assets.filter(a => a.maintenance_status === 'overdue').length,
    dueSoon: assets.filter(a => a.maintenance_status === 'due_soon').length,
    ok: assets.filter(a => a.maintenance_status === 'ok').length,
  };

  return (
    <div className="space-y-3">
      {/* Header + recalculate button */}
      <div className="hub-glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Gauge className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">Usage-Based Maintenance</h3>
            <p className="text-sm text-slate-500">Engine hours tracked from drilling logs — rigs serviced on usage, not calendar dates.</p>
          </div>
        </div>
        <button onClick={handleRecalculate} disabled={recalculating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg font-semibold text-sm hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex-shrink-0 shadow-sm">
          {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
          {recalculating ? 'Calculating…' : 'Recalculate Now'}
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-slate-700 tabular-nums">{summary.total}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{summary.ok}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">OK</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-amber-600 tabular-nums">{summary.dueSoon}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Due Soon</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-rose-600 tabular-nums">{summary.overdue}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Overdue</p>
        </div>
      </div>

      {/* Asset list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 h-20" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <Gauge className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No rigs or machinery assets found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map(asset => {
            const cfg = getStatusConfig(asset);
            const Icon = cfg.icon;
            const interval = asset.service_interval_hours || 250;
            const hoursSince = asset.hours_since_last_service || 0;
            const pct = Math.min(100, interval > 0 ? (hoursSince / interval) * 100 : 0);

            return (
              <div key={asset.id} className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{asset.name}</p>
                      <span className={`text-[10px] font-semibold ${cfg.color} flex-shrink-0`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {Math.round(hoursSince)}h / {interval}h
                      </span>
                      {asset.last_usage_calc_at && (
                        <span className="text-[10px] text-slate-400">
                          Updated {new Date(asset.last_usage_calc_at).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${cfg.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-slate-700 tabular-nums">{Math.round(asset.operating_hours || 0)}h</p>
                    <p className="text-[10px] text-slate-400 uppercase">Total Hours</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}