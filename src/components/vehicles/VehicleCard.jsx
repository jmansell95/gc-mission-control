import React from 'react';
import { Truck, ShieldCheck, ShieldAlert, ShieldX, Gauge, Wrench, Link2, Link2Off, AlertTriangle, Weight, Ruler, Satellite } from 'lucide-react';
import { differenceInDays } from 'date-fns';

function getStatus(vehicle) {
  const today = new Date();
  const issues = [];
  if (vehicle.mot_expiry) {
    const days = differenceInDays(new Date(vehicle.mot_expiry + 'T00:00:00'), today);
    if (days < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days });
    else if (days <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days });
  }
  if (vehicle.service_due_date) {
    const days = differenceInDays(new Date(vehicle.service_due_date + 'T00:00:00'), today);
    if (days < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days });
    else if (days <= 30) issues.push({ label: 'Service Due', severity: 'warning', days });
  }
  const worst = issues.find(i => i.severity === 'expired') || issues.find(i => i.severity === 'warning');
  const level = worst ? (worst.severity === 'expired' ? 'expired' : 'warning') : (vehicle.mot_expiry || vehicle.service_due_date ? 'compliant' : 'unknown');
  return { issues, level };
}

const LEVEL_META = {
  compliant: { label: 'Compliant', Icon: ShieldCheck, tone: 'border-l-emerald-500 ring-emerald-100', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', grad: 'stat-gradient-emerald' },
  warning: { label: 'Attention', Icon: ShieldAlert, tone: 'border-l-amber-500 ring-amber-100', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', grad: 'stat-gradient-amber' },
  expired: { label: 'Critical', Icon: ShieldX, tone: 'border-l-red-500 ring-red-100', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', grad: 'stat-gradient-rose' },
  unknown: { label: 'No Data', Icon: ShieldX, tone: 'border-l-slate-400 ring-slate-100', badge: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400', grad: 'stat-gradient-slate' },
};

export default function VehicleCard({ vehicle, staff, team, onClick }) {
  const { issues, level } = getStatus(vehicle);
  const meta = LEVEL_META[level];
  const StatusIcon = meta.Icon;
  const assignedStaff = staff?.find(s => s.id === vehicle.assigned_staff_id);
  const teamName = team?.find(t => t.id === vehicle.team_id)?.name;

  return (
    <button onClick={() => onClick(vehicle)} className={`hub-glass rounded-xl p-4 text-left border-l-4 ${meta.tone} w-full`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-11 h-11 rounded-xl ${meta.grad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-mono font-bold text-slate-900 truncate text-[15px]">{vehicle.registration_number}</p>
            <p className="text-xs text-slate-500 truncate">{vehicle.name}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.badge} flex-shrink-0`}>
          <StatusIcon className="w-3.5 h-3.5" /> {meta.label}
        </span>
      </div>

      {/* Issues */}
      {issues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {issues.map((issue, i) => (
            <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              {issue.label}{issue.days >= 0 ? ` (${issue.days}d)` : ''}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {vehicle.mot_expiry && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">MOT: {new Date(vehicle.mot_expiry + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
          {vehicle.service_due_date && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Service: {new Date(vehicle.service_due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
        </div>
      )}

      {/* Payload & height badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {vehicle.max_weight_kg > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium" title="Maximum payload weight">
            <Weight className="w-3 h-3" /> {Math.round(vehicle.max_weight_kg)} kg
          </span>
        )}
        {vehicle.height_m > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium" title="Vehicle height">
            <Ruler className="w-3 h-3" /> {vehicle.height_m} m H
          </span>
        )}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          {teamName && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{teamName}</span>}
          {assignedStaff ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{assignedStaff.name}</span> : <span className="text-slate-300">Unassigned</span>}
          {vehicle.geotab_keeper_name && (
            <span className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-medium" title="Geotab assigned keeper">
              <Satellite className="w-3 h-3" /> {vehicle.geotab_keeper_name}
            </span>
          )}
          {vehicle.geotab_driver_name && vehicle.geotab_driver_name !== vehicle.geotab_keeper_name && (
            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium" title="Currently driving (differs from keeper)">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> {vehicle.geotab_driver_name}
            </span>
          )}
          {vehicle.spec_lookup_confidence === 'low' && (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium" title="Spec lookup returned partial data — review make/model manually">
              <AlertTriangle className="w-3 h-3" /> Review spec
            </span>
          )}
        </div>
        {vehicle.holman_sync_status === 'synced' ? (
          <span className="flex items-center gap-1 text-blue-600 font-medium"><Link2 className="w-3 h-3" /> Holman</span>
        ) : (
          <span className="flex items-center gap-1 text-slate-300"><Link2Off className="w-3 h-3" /> Not synced</span>
        )}
      </div>

      {vehicle.current_mileage != null && (
        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><Gauge className="w-3 h-3" /> {Number(vehicle.current_mileage).toLocaleString()} mi</p>
      )}
    </button>
  );
}