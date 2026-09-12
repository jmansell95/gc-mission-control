import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Satellite, Wrench, Truck } from 'lucide-react';

/**
 * FleetHealthRings — circular progress indicators showing fleet-wide health.
 * Replaces the old flat stat tiles with colourful, at-a-glance health rings.
 */
function HealthRing({ value, total, label, sublabel, gradient, icon: Icon }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const circumference = 2 * Math.PI * 34;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-100" />
          <circle
            cx="40" cy="40" r="34" fill="none" stroke="url(#grad)" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-4 h-4 text-slate-400 mb-0.5" />
          <span className="text-lg font-bold text-slate-800 tabular-nums leading-none">{value}</span>
        </div>
      </div>
      <p className="text-[11px] font-bold text-slate-700 mt-1.5 leading-tight">{label}</p>
      {sublabel && <p className="text-[9px] text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

export default function FleetHealthRings({ stats }) {
  const { total, compliant, warning, expired, geotabSynced, holmanSynced, activeBookings } = stats;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-800">Fleet Health Overview</h3>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
        <HealthRing value={total} total={Math.max(total, 1)} label="Total Fleet" sublabel="vehicles" gradient={['#2E5A1A', '#5A8C1E']} icon={Truck} />
        <HealthRing value={compliant} total={Math.max(total, 1)} label="Compliant" sublabel={`${total > 0 ? Math.round((compliant / total) * 100) : 0}% healthy`} gradient={['#10b981', '#059669']} icon={ShieldCheck} />
        <HealthRing value={warning} total={Math.max(total, 1)} label="Attention" sublabel="due soon" gradient={['#f59e0b', '#d97706']} icon={ShieldAlert} />
        <HealthRing value={expired} total={Math.max(total, 1)} label="Critical" sublabel="overdue" gradient={['#f43f5e', '#be123c']} icon={ShieldX} />
        <HealthRing value={geotabSynced} total={Math.max(total, 1)} label="Geotab Live" sublabel="tracking" gradient={['#06b6d4', '#0e7490']} icon={Satellite} />
        <HealthRing value={activeBookings} total={Math.max(total, 1)} label="Bookings" sublabel="active" gradient={['#8b5cf6', '#6d28d9']} icon={Wrench} />
      </div>
    </div>
  );
}