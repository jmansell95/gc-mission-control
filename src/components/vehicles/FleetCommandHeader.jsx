import React, { useMemo } from 'react';
import {
  Truck, CheckCircle2, Navigation, ShieldAlert, Clock, Gauge,
  AlertTriangle, Wrench, Satellite,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import FleetLiveMap from './FleetLiveMap';

/**
 * FleetCommandHeader — rich dashboard header for the Fleet Hub.
 * Shows KPI gauges (fleet size, compliant, driving now, avg risk),
 * summary tiles (engine hours, mileage, MOT due, service due),
 * and a prominent live fleet map.
 *
 * Uses insight-card surfaces and stat-gradient-* tiles to match the
 * site-wide card system.
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

  const kpiTiles = [
    { icon: Truck, label: 'Fleet Size', value: stats.total, sub: 'Drilling group', gradient: 'stat-gradient-brand', textCls: 'text-white' },
    { icon: CheckCircle2, label: 'Compliant', value: stats.compliant, sub: 'MOT & service OK', gradient: 'stat-gradient-emerald', textCls: 'text-white' },
    { icon: Navigation, label: 'Driving Now', value: stats.driving, sub: 'Live from Geotab', gradient: 'stat-gradient-blue', textCls: 'text-white' },
    { icon: ShieldAlert, label: 'Avg Risk', value: stats.avgRisk ?? '—', sub: stats.avgRisk != null ? `${stats.avgRisk}/100` : 'No data', gradient: stats.avgRisk != null && stats.avgRisk >= 80 ? 'stat-gradient-emerald' : stats.avgRisk != null && stats.avgRisk >= 50 ? 'stat-gradient-amber' : 'stat-gradient-slate', textCls: 'text-white' },
  ];

  const summaryTiles = [
    { icon: Clock, label: 'Total Engine Hours', value: stats.totalEngineHours > 0 ? `${stats.totalEngineHours.toLocaleString()}h` : '—', sub: 'Across fleet', color: 'blue' },
    { icon: Gauge, label: 'Total Mileage', value: stats.totalMileage > 0 ? `${stats.totalMileage.toLocaleString()} mi` : '—', sub: 'Across fleet', color: 'emerald' },
    { icon: AlertTriangle, label: 'MOT Due', value: stats.motDue, sub: 'Within 30 days', color: stats.motDue > 0 ? 'amber' : 'slate' },
    { icon: Wrench, label: 'Service Due', value: stats.serviceDue, sub: 'Within 30 days', color: stats.serviceDue > 0 ? 'amber' : 'slate' },
  ];

  const summaryColorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-500',
  };

  return (
    <div className="space-y-3">
      {/* KPI gauges row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiTiles.map((tile, i) => (
          <div key={i} className={`${tile.gradient} rounded-xl p-4 relative overflow-hidden`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">{tile.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${tile.textCls} mt-1`}>{tile.value}</p>
                <p className="text-[10px] text-white/70 mt-0.5">{tile.sub}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <tile.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary tiles + live map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Summary tiles — 2 columns */}
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
          {summaryTiles.map((tile, i) => (
            <div key={i} className={`insight-card rounded-xl p-3.5 border ${summaryColorMap[tile.color]}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <tile.icon className="w-4 h-4 flex-shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{tile.label}</p>
              </div>
              <p className="text-lg font-bold tabular-nums">{tile.value}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{tile.sub}</p>
            </div>
          ))}
        </div>

        {/* Live fleet map — 2 columns */}
        <div className="lg:col-span-2">
          <div className="insight-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
              <Satellite className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-800">Live Fleet Map</h3>
              <span className="ml-auto text-xs text-slate-400">{stats.driving} driving · {stats.total} total</span>
            </div>
            <div style={{ height: 280 }}>
              <FleetLiveMap vehicles={vehicles} liveByVehicle={liveByVehicle} height={280} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}