import React from 'react';
import { Warehouse, Truck, MapPin, PackageCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

const locationConfig = {
  yard: { label: 'At Depot', icon: Warehouse, color: 'text-slate-600', bar: 'bg-slate-400' },
  in_transit: { label: 'In Transit', icon: Truck, color: 'text-blue-600', bar: 'bg-blue-500' },
  site: { label: 'On Site', icon: MapPin, color: 'text-emerald-600', bar: 'bg-emerald-500' },
  returned: { label: 'Returned', icon: PackageCheck, color: 'text-teal-600', bar: 'bg-teal-500' },
};

const locationOrder = ['yard', 'in_transit', 'site', 'returned'];

export default function LifecycleBar({ items, isDecommissioning, onBulkCollect }) {
  const logisticsItems = items.filter(i =>
    i.category !== 'contractor_supplied' &&
    i.category !== 'labour' &&
    i.category !== 'client_supplied' &&
    (i.hire_status || 'active') !== 'off_hired'
  );
  const counts = locationOrder.reduce((acc, loc) => {
    acc[loc] = logisticsItems.filter(i => (i.current_location || 'yard') === loc).length;
    return acc;
  }, {});
  const total = logisticsItems.length;
  const collectedPct = total > 0 ? Math.round((counts.returned / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset Lifecycle</span>
        {isDecommissioning && (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{collectedPct}% collected</span>
        )}
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
        {locationOrder.map(loc => {
          const pct = total > 0 ? (counts[loc] / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={loc} className={locationConfig[loc].bar} style={{ width: `${pct}%` }} title={`${locationConfig[loc].label}: ${counts[loc]}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
        {locationOrder.map(loc => {
          const cfg = locationConfig[loc];
          const Icon = cfg.icon;
          return (
            <div key={loc} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.bar}`} />
              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
              <span className="text-xs font-bold text-slate-900">{counts[loc]}</span>
            </div>
          );
        })}
      </div>
      {isDecommissioning && counts.site > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span><b>{counts.site}</b> item{counts.site !== 1 ? 's' : ''} still on site</span>
          </div>
          <button onClick={onBulkCollect} className="px-2.5 py-1 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition flex-shrink-0 whitespace-nowrap">
            Collect All
          </button>
        </div>
      )}
      {isDecommissioning && counts.site === 0 && counts.returned === total && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>All equipment collected — site is clear</span>
        </div>
      )}
    </div>
  );
}