import React, { useMemo } from 'react';
import {
  Truck, CheckCircle2, Navigation, ShieldAlert, Clock, Gauge,
  AlertTriangle, Wrench,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

/**
 * FleetCommandHeader — inline KPI strip for the Tracking Hub.
 *
 * All stat tiles in a single responsive row with gap-3. The old live
 * mini-map has been removed (the full map lives in the Live Tracking tab).
 */
export default function FleetCommandHeader({ vehicles, liveByVehicle }) {
  const stats = useMemo(() => {
    let compliant = 0, driving = 0, motDue = 0, serviceDue = 0;
    let totalEngineHours = 0, totalMileage = 0, riskScores = [];
    const today = new Date();

    vehicles.forEach(v => {
      const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null' && v.mot_expiry !== 'None') ? v.mot_expiry : null;
      if (motExpiry) {
        const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), today);
        if (d < 0 || d <= 30) motDue++;
        if (d >= 0) compliant++;
      } else if (v.mot_status === 'valid') {
        compliant++;
      }
      if (v.service_due_date && v.service_due_date !== 'null' && v.service_due_date !== 'None') {
        const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
        if (d <= 30) serviceDue++;
      }

      const live = liveByVehicle[v.id];
      if (live && (live.is_driving_now || (live.ignition_on && (live.speed_kph || 0) > 0))) driving++;

      if (v.engine_hours != null) totalEngineHours += Number(v.engine_hours) || 0;
      if (v.current_mileage != null) totalMileage += Number(v.current_mileage) || 0;

      if (v.driver_risk_score != null) riskScores.push(v.driver_risk_score);
    });

    const avgRisk = riskScores.length > 0
      ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      : null;

    return {
      total: vehicles.length,
      compliant,
      driving,
      motDue,
      serviceDue,
      totalEngineHours: Math.round(totalEngineHours),
      totalMileage: Math.round(totalMileage),
      avgRisk,
    };
  }, [vehicles, liveByVehicle]);

  // All tiles in one inline row — gradient KPIs first, then light summary tiles
  const tiles = [
    { icon: Truck, label: 'Fleet Size', value: stats.total, sub: 'Drilling group', gradient: 'stat-gradient-brand', light: false },
    { icon: CheckCircle2, label: 'Compliant', value: stats.compliant, sub: 'MOT & service OK', gradient: 'stat-gradient-emerald', light: false },
    { icon: Navigation, label: 'Driving Now', value: stats.driving, sub: 'Live from Geotab', gradient: 'stat-gradient-blue', light: false },
    { icon: ShieldAlert, label: 'Avg Risk', value: stats.avgRisk ?? '—', sub: stats.avgRisk != null ? `${stats.avgRisk}/100` : 'No data', gradient: stats.avgRisk != null && stats.avgRisk >= 80 ? 'stat-gradient-emerald' : stats.avgRisk != null && stats.avgRisk >= 50 ? 'stat-gradient-amber' : 'stat-gradient-slate', light: false },
    { icon: Clock, label: 'Engine Hours', value: `${stats.totalEngineHours.toLocaleString()}h`, sub: stats.totalEngineHours > 0 ? 'Across fleet' : 'No Geotab data', light: true, color: 'blue' },
    { icon: Gauge, label: 'Total Mileage', value: stats.totalMileage > 0 ? `${stats.totalMileage.toLocaleString()} mi` : '—', sub: 'Across fleet', light: true, color: 'emerald' },
    { icon: AlertTriangle, label: 'MOT Due', value: stats.motDue, sub: 'Within 30 days', light: true, color: stats.motDue > 0 ? 'amber' : 'slate' },
    { icon: Wrench, label: 'Service Due', value: stats.serviceDue, sub: 'Within 30 days', light: true, color: stats.serviceDue > 0 ? 'amber' : 'slate' },
  ];

  const lightColorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-500',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        if (tile.light) {
          return (
            <div key={i} className={`hub-glass rounded-xl p-3.5 border ${lightColorMap[tile.color]}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <p className="text-ui-micro font-bold uppercase tracking-wide opacity-70">{tile.label}</p>
              </div>
              <p className="text-ui-kpi font-bold tabular-nums">{tile.value}</p>
              <p className="text-ui-caption opacity-60 mt-0.5">{tile.sub}</p>
            </div>
          );
        }
        return (
          <div key={i} className={`${tile.gradient} rounded-xl p-3.5 relative overflow-hidden`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-ui-micro font-bold uppercase tracking-wide text-white/80 truncate">{tile.label}</p>
                <p className="text-ui-kpi font-bold tabular-nums text-white mt-0.5">{tile.value}</p>
                <p className="text-ui-caption text-white/70 mt-0.5 truncate">{tile.sub}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}