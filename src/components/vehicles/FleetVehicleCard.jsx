import React, { useState } from 'react';
import {
  Truck, ShieldCheck, ShieldAlert, ShieldX, Wrench, Gauge,
  Satellite, Link2, Car, Hash, Navigation, Zap, Clock, Palette, User,
  FileText, Loader2, BadgeCheck, AlertTriangle, CloudOff, Receipt, CalendarCheck,
} from 'lucide-react';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import { generateVehicleReport } from '@/utils/vehiclePdfReport';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';

const LEVEL_BADGE = {
  compliant: { label: 'OK', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', accent: 'border-l-emerald-500' },
  warning: { label: 'Attention', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200', accent: 'border-l-amber-500' },
  expired: { label: 'Critical', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200', accent: 'border-l-rose-500' },
  unknown: { label: 'Not Synced', Icon: CloudOff, cls: 'bg-slate-50 text-slate-500 border-slate-200', accent: 'border-l-slate-300' },
};

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  if (v.mot_expiry) {
    const d = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
    if (d < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days: d });
    else if (d <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days: d });
  } else if (v.mot_status === 'not_valid') {
    issues.push({ label: 'MOT Invalid', severity: 'expired', days: null });
  }
  if (v.service_due_date) {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (d < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days: d });
    else if (d <= 30) issues.push({ label: 'Service Due', severity: 'warning', days: d });
  }
  const hasComplianceData = v.mot_expiry || v.service_due_date ||
    v.mot_status === 'valid' || v.mot_status === 'not_valid';
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : (hasComplianceData ? 'compliant' : 'unknown');
  return { issues, level };
}

function getMotionStatus(liveLocation, geotabLive) {
  if (!geotabLive) return { state: 'offline', label: 'Offline', color: 'slate', Icon: Satellite };
  if (!liveLocation) return { state: 'no_data', label: 'No Signal', color: 'slate', Icon: Satellite };
  if (liveLocation.is_driving_now) return { state: 'moving', label: 'Moving', color: 'emerald', Icon: Navigation };
  const isMoving = liveLocation.ignition_on && (liveLocation.speed_kph || 0) > 0;
  if (isMoving) return { state: 'moving', label: 'Moving', color: 'emerald', Icon: Navigation };
  if (liveLocation.ignition_on) return { state: 'idle', label: 'Engine On', color: 'amber', Icon: Zap };
  return { state: 'stopped', label: 'Stopped', color: 'slate', Icon: Clock };
}

const MOTION_STYLES = {
  moving: { badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-400', pulse: true },
  idle: { badge: 'bg-amber-500 text-white', dot: 'bg-amber-400', pulse: true },
  stopped: { badge: 'bg-slate-400 text-white', dot: 'bg-slate-300', pulse: false },
  no_data: { badge: 'bg-slate-200 text-slate-500', dot: 'bg-slate-300', pulse: false },
  offline: { badge: 'bg-slate-200 text-slate-500', dot: 'bg-slate-300', pulse: false },
};

const KM_TO_MI = 0.621371;

export default function FleetVehicleCard({ vehicle, liveLocation, nextBooking, driverName, onSelect, onBookMaintenance }) {
  const [reportLoading, setReportLoading] = useState(false);
  const { issues, level } = getVehicleStatus(vehicle);
  const badge = LEVEL_BADGE[level];
  const StatusIcon = badge.Icon;
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');

  const geotabLive = vehicle.geotab_sync_status === 'synced';
  const holmanSynced = vehicle.holman_sync_status === 'synced';
  const motExpiry = (vehicle.mot_expiry && vehicle.mot_expiry !== 'null' && vehicle.mot_expiry !== 'None') ? vehicle.mot_expiry : null;
  const motDays = motExpiry ? differenceInDays(new Date(motExpiry + 'T00:00:00'), new Date()) : null;
  let motBadge;
  if (motDays != null && !isNaN(motDays)) {
    motBadge = motDays < 0
      ? { label: 'MOT EXPIRED', cls: 'bg-red-500 text-white', Icon: ShieldX }
      : motDays <= 30
        ? { label: 'MOT DUE', cls: 'bg-amber-500 text-white', Icon: ShieldAlert }
        : { label: 'MOT OK', cls: 'bg-emerald-500 text-white', Icon: BadgeCheck };
  } else {
    motBadge = null;
  }
  const motion = getMotionStatus(liveLocation, geotabLive);
  const motionStyle = MOTION_STYLES[motion.state];
  const MotionIcon = motion.Icon;

  const speedMph = liveLocation?.speed_kph ? Math.round(liveLocation.speed_kph * KM_TO_MI) : 0;
  const isMoving = motion.state === 'moving';
  const lastSeen = liveLocation?.timestamp
    ? new Date(liveLocation.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleDownloadReport = async (e) => {
    e.stopPropagation();
    setReportLoading(true);
    try {
      const [tripRes, bookingRes] = await Promise.all([
        geotabLive
          ? base44.functions.invoke('getVehicleLocationHistory', {
              mode: 'geotab_history', vehicle_id: vehicle.id,
              from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              limit: 100,
            })
          : Promise.resolve({ data: { trips: [] } }),
        base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: vehicle.id }, '-booking_date', 50),
      ]);
      const tripData = tripRes?.data || tripRes || {};
      await generateVehicleReport(vehicle, tripData, bookingRes || []);
    } catch (_) {
      await generateVehicleReport(vehicle, { trips: [] }, []);
    }
    setReportLoading(false);
  };

  return (
    <div
      onClick={() => onSelect(vehicle)}
      className={`hub-glass rounded-3xl overflow-hidden relative cursor-pointer group border-l-4 ${badge.accent} transition-all hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-mono font-bold text-slate-900 truncate text-base tracking-tight">{vehicle.registration_number}</p>
              <p className="text-xs text-slate-500 truncate">{makeModel || vehicle.name || '—'}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${badge.cls} flex-shrink-0`}>
            <StatusIcon className="w-3 h-3" /> {badge.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {motBadge && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${motBadge.cls}`}>
              <motBadge.Icon className="w-3 h-3" /> {motBadge.label}
              {motDays != null && motDays >= 0 && motDays <= 30 && <span className="opacity-80">({motDays}d)</span>}
            </span>
          )}
          {(() => {
            const taxDue = vehicle.tax_due_date;
            const taxDays = taxDue ? differenceInDays(new Date(taxDue + 'T00:00:00'), new Date()) : null;
            if (vehicle.tax_status === 'untaxed' || (taxDays != null && taxDays < 0)) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-500 text-white"><Receipt className="w-3 h-3" /> TAX EXPIRED</span>;
            if (vehicle.tax_status === 'sorn') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-600"><Receipt className="w-3 h-3" /> SORN</span>;
            if (taxDays != null && taxDays <= 30) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500 text-white"><Receipt className="w-3 h-3" /> TAX DUE ({taxDays}d)</span>;
            if (vehicle.tax_status === 'taxed' || (taxDays != null && taxDays > 30)) return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500 text-white"><Receipt className="w-3 h-3" /> TAX OK</span>;
            return null;
          })()}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${motionStyle.badge}`}>
            <span className={`relative w-2 h-2 rounded-full ${motionStyle.dot}`}>
              {motionStyle.pulse && <span className={`absolute inset-0 rounded-full ${motionStyle.dot} animate-ping opacity-75`} />}
            </span>
            <MotionIcon className="w-3 h-3" /> {motion.label}
            {isMoving && speedMph > 0 && <span className="ml-0.5">{speedMph} mph</span>}
          </span>
          {lastSeen && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {lastSeen}</span>}
        </div>

        {(vehicle.engine_hours != null || vehicle.current_mileage != null) && (
          <div className="flex items-center gap-2 mb-2">
            {vehicle.engine_hours != null && (
              <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100 flex-1">
                <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-blue-400 uppercase leading-none">Engine Hours</p>
                  <p className="text-sm font-bold text-blue-700 tabular-nums leading-tight">{Math.round(Number(vehicle.engine_hours)).toLocaleString()}h</p>
                </div>
              </div>
            )}
            {vehicle.current_mileage != null && (
              <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100 flex-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-emerald-400 uppercase leading-none">Mileage</p>
                  <p className="text-sm font-bold text-emerald-700 tabular-nums leading-tight">{Number(vehicle.current_mileage).toLocaleString()} mi</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {vehicle.geotab_keeper_name ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200"><Satellite className="w-3 h-3" /> Keeper: {vehicle.geotab_keeper_name}</span>
          ) : vehicle.geotab_driver_name ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200"><Satellite className="w-3 h-3" /> Driver: {vehicle.geotab_driver_name}</span>
          ) : geotabLive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 border border-slate-200 border-dashed"><Satellite className="w-3 h-3" /> No Geotab driver</span>
          ) : driverName ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200"><User className="w-3 h-3" /> Assigned: {driverName}</span>
          ) : null}
          {vehicle.geotab_keeper_name && vehicle.geotab_driver_name && vehicle.geotab_driver_name !== vehicle.geotab_keeper_name && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Driving: {vehicle.geotab_driver_name}</span>
          )}
        </div>

        {vehicle.current_operator_name && (
          <>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow-sm">
                <span className="relative w-2 h-2 rounded-full bg-white"><span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" /></span>
                <Navigation className="w-3 h-3" /> Driving: {vehicle.current_operator_name}
              </span>
            </div>
            {vehicle.current_job_name && (
              <p className="text-[10px] text-emerald-700 font-medium mb-2 leading-tight pl-0.5">
                {vehicle.current_delivery_type === 'supplier_collection' ? 'Collecting' : 'Delivering'}
                {vehicle.current_delivery_items ? ` ${vehicle.current_delivery_items.substring(0, 36)}${vehicle.current_delivery_items.length > 36 ? '…' : ''}` : ''}
                {' '}for <span className="font-bold">{vehicle.current_job_name}</span>
              </p>
            )}
          </>
        )}

        {vehicle.geotab_sync_status === 'synced' && vehicle.safety_event_count != null && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
              (vehicle.driver_risk_score || 100) >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              (vehicle.driver_risk_score || 100) >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <ShieldAlert className="w-3 h-3" /> Risk {vehicle.driver_risk_score ?? 100}/100
            </span>
            {vehicle.safety_event_count > 0 && <span className="text-[10px] text-slate-500 font-medium">{vehicle.safety_event_count} event{vehicle.safety_event_count === 1 ? '' : 's'} · 30d</span>}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {vehicle.year && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1"><Car className="w-2.5 h-2.5" /> {vehicle.year}</span>}
          {vehicle.color && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1"><Palette className="w-2.5 h-2.5" /> {vehicle.color}</span>}
          {vehicle.fuel_type && vehicle.fuel_type !== 'unknown' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{vehicle.fuel_type.charAt(0).toUpperCase() + vehicle.fuel_type.slice(1)}</span>}
          {vehicle.vehicle_type && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{vehicle.vehicle_type}</span>}
          {vehicle.vin && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono flex items-center gap-1"><Hash className="w-2.5 h-2.5" /> {vehicle.vin.slice(-6)}</span>}
          {vehicle.spec_lookup_confidence === 'low' && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium"><AlertTriangle className="w-2.5 h-2.5" /> Review spec</span>}
          {vehicle.last_service_date && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium flex items-center gap-1"><CalendarCheck className="w-2.5 h-2.5" /> {new Date(vehicle.last_service_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
        </div>

        {issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {issues.map((issue, i) => (
              <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {issue.label}{issue.days >= 0 ? ` (${issue.days}d)` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        <VehicleLocationMiniMap {...(liveLocation || {})} />
      </div>

      {nextBooking && (
        <button onClick={(e) => { e.stopPropagation(); onBookMaintenance(); }}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-y border-violet-100 text-left hover:bg-violet-100 transition">
          <Wrench className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-violet-700 truncate flex-1">
            {nextBooking.booking_type ? nextBooking.booking_type.charAt(0).toUpperCase() + nextBooking.booking_type.slice(1) : 'Booking'} booked
          </span>
          <span className="text-[11px] text-violet-600 font-medium flex-shrink-0">
            {nextBooking.booking_date ? new Date(nextBooking.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'TBC'}
          </span>
        </button>
      )}

      <div className="px-4 py-3 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); onBookMaintenance(); }} className="flex items-center gap-1 text-[#2E5A1A] font-semibold hover:underline">
            <Wrench className="w-3 h-3" /> Book
          </button>
          <button onClick={handleDownloadReport} disabled={reportLoading} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline disabled:opacity-50">
            {reportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} PDF
          </button>
        </div>
        <div className="flex items-center gap-2">
          {geotabLive && <span className="flex items-center gap-1 text-cyan-600 font-semibold"><Satellite className="w-3 h-3" /> Live</span>}
          {holmanSynced && <span className="flex items-center gap-1 text-blue-600 font-semibold"><Link2 className="w-3 h-3" /> Holman</span>}
        </div>
      </div>
    </div>
  );
}