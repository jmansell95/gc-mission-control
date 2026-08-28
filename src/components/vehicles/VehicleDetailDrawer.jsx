import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Truck, Gauge, CalendarClock, Wrench, Link2, Satellite,
  ShieldCheck, ShieldAlert, ShieldX, Hash, Fuel, Palette, Car, User, Users,
  MapPin, Navigation, Clock, Activity, Zap, Radio, Database, FileText, Loader2, Route, CloudOff,
  Weight, Ruler, Box,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';
import VehicleLocationMiniMap from '@/components/vehicles/VehicleLocationMiniMap';
import TripTimelineEnhanced from '@/components/vehicles/TripTimelineEnhanced';
import TravelReconciliationReport from '@/components/vehicles/TravelReconciliationReport';
import MaintenanceTimeline from '@/components/vehicles/MaintenanceTimeline';
import MOTHistoryTimeline from '@/components/vehicles/MOTHistoryTimeline';
import SafetyEventsDrillDown from '@/components/vehicles/SafetyEventsDrillDown';
import { generateVehicleReport } from '@/utils/vehiclePdfReport';
import { Dialog, DialogContent } from '@/components/ui/dialog';

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  const holmanSynced = v.holman_sync_status === 'synced';
  const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null' && v.mot_expiry !== 'None') ? v.mot_expiry : null;
  if (motExpiry) {
    const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days: d });
    }
  }
  if (v.service_due_date && v.service_due_date !== 'null' && v.service_due_date !== 'None') {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'Service Due', severity: 'warning', days: d });
    }
  }
  const hasComplianceData = holmanSynced && (motExpiry || v.service_due_date);
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : (hasComplianceData ? 'compliant' : 'unknown');
  return { issues, level };
}

const LEVEL_BADGE = {
  compliant: { label: 'Compliant', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { label: 'Attention', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Critical', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Not Synced', Icon: CloudOff, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const FUEL_LABELS = {
  diesel: 'Diesel', petrol: 'Petrol', hybrid: 'Hybrid', electric: 'Electric',
  lpg: 'LPG', cng: 'CNG', unknown: 'Unknown',
};

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
};

function SpecTile({ icon: Icon, label, value, source, color }) {
  const hasValue = value && value !== '—' && value !== 'Unknown';
  return (
    <div className={`rounded-lg p-2.5 border ${hasValue ? color || 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-dashed border-slate-200'}`}>
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3 h-3 ${hasValue ? 'text-slate-400' : 'text-slate-300'}`} />
          <span className="text-[10px] uppercase text-slate-400 font-semibold">{label}</span>
        </div>
        {source && (
          <span className={`text-[8px] px-1 py-0.5 rounded-full font-bold ${source === 'VIN' ? 'bg-blue-100 text-blue-600' : 'bg-cyan-100 text-cyan-600'}`}>
            {source}
          </span>
        )}
      </div>
      <p className={`text-sm font-bold truncate ${hasValue ? 'text-slate-800' : 'text-slate-300 italic'}`}>
        {hasValue ? value : 'Not available'}
      </p>
    </div>
  );
}

export default function VehicleDetailDrawer({ vehicle, onClose }) {
  const [activeTab, setActiveTab] = useState('live');
  const [reportLoading, setReportLoading] = useState(false);

  const handleDownloadReport = async () => {
    if (!vehicle) return;
    setReportLoading(true);
    try {
      const [tripRes, bookingRes] = await Promise.all([
        vehicle.geotab_device_id
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

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
    enabled: !!vehicle,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!vehicle,
  });
  const { data: liveLocations = [] } = useQuery({
    queryKey: ['geotab-live-locations-fleet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      const data = res?.data ?? res;
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.vehicles) ? data.vehicles : (Array.isArray(data?.locations) ? data.locations : []));
      return arr;
    },
    enabled: !!vehicle,
    refetchInterval: 15000,
  });

  const latestLoc = useMemo(() => {
    if (!vehicle) return null;
    const locs = Array.isArray(liveLocations) ? liveLocations : [];
    const forVehicle = locs.filter(l => l.vehicle_id === vehicle.id);
    if (forVehicle.length === 0) return null;
    return forVehicle.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
  }, [liveLocations, vehicle]);

  if (!vehicle) return null;

  const { issues, level } = getVehicleStatus(vehicle);
  const badge = LEVEL_BADGE[level];
  const StatusIcon = badge.Icon;
  const assignedStaff = staff.find(s => s.id === vehicle.assigned_staff_id);
  const team = teams.find(t => t.id === vehicle.team_id);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || null;
  const geotabLive = vehicle.geotab_sync_status === 'synced';

  const specSource = (field) => {
    if (field) return geotabLive ? 'Geotab' : null;
    return null;
  };

  const specFields = [vehicle.make, vehicle.model, vehicle.year, vehicle.fuel_type, vehicle.color, vehicle.vehicle_type, vehicle.vin];
  const filledSpecs = specFields.filter(Boolean).length;
  const specConfidence = filledSpecs >= 6 ? 'verified' : filledSpecs >= 3 ? 'partial' : 'unknown';
  const SPEC_CONFIDENCE = {
    verified: { label: 'Spec Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheck },
    partial: { label: 'Partial Spec', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: ShieldAlert },
    unknown: { label: 'No Spec Data', cls: 'bg-slate-50 text-slate-500 border-slate-200', Icon: ShieldX },
  };
  const confidenceMeta = SPEC_CONFIDENCE[specConfidence];

  const isMoving = latestLoc?.ignition_on && (latestLoc?.speed_kph || 0) > 0;
  const motionLabel = !geotabLive ? 'Offline' : !latestLoc ? 'No Signal' : isMoving ? 'Moving' : latestLoc.ignition_on ? 'Engine On' : 'Stopped';
  const motionColor = isMoving ? 'emerald' : latestLoc?.ignition_on ? 'amber' : 'slate';

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl p-0 sm:p-0 overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* ── Header ── */}
        <div className="hero-gradient text-white px-5 py-4 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-mono font-bold text-lg truncate">{vehicle.registration_number || 'No Reg'}</p>
                <p className="text-sm text-white/80 truncate">{makeModel || vehicle.name || 'Vehicle'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={handleDownloadReport} disabled={reportLoading}
                className="p-2 hover:bg-white/15 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold text-white/90 disabled:opacity-50">
                {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <StatusIcon className="w-3.5 h-3.5" /> {badge.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
              motionColor === 'emerald' ? 'bg-emerald-500 text-white' :
              motionColor === 'amber' ? 'bg-amber-500 text-white' :
              'bg-slate-400 text-white'
            }`}>
              {isMoving && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              <Navigation className="w-3.5 h-3.5" /> {motionLabel}
              {isMoving && latestLoc?.speed_kph ? ` ${Math.round(latestLoc.speed_kph * 0.621371)} mph` : ''}
            </span>
            {geotabLive && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                <Satellite className="w-3.5 h-3.5" /> Geotab
              </span>
            )}
            {vehicle.geotab_keeper_name && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                <User className="w-3.5 h-3.5" /> Assigned: {vehicle.geotab_keeper_name}
              </span>
            )}
            {vehicle.geotab_driver_name && vehicle.geotab_driver_name !== vehicle.geotab_keeper_name && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Driving: {vehicle.geotab_driver_name}
              </span>
            )}
            {vehicle.holman_sync_status === 'synced' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Link2 className="w-3.5 h-3.5" /> Holman
              </span>
            )}
          </div>
        </div>

        {/* ── Attention banner ── */}
        {issues.length > 0 && (
          <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-rose-700">Action Required</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {issues.map((issue, i) => (
                  <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${issue.severity === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {issue.label} ({issue.days >= 0 ? `in ${issue.days}d` : `${Math.abs(issue.days)}d ago`})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="mx-5 mt-4 flex p-1 bg-slate-100 rounded-lg">
          <button onClick={() => setActiveTab('live')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'live' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
            <Satellite className="w-3.5 h-3.5" /> Live Ops
          </button>
          <button onClick={() => setActiveTab('spec')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'spec' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            <Car className="w-3.5 h-3.5" /> Spec
          </button>
          <button onClick={() => setActiveTab('compliance')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'compliance' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            <Wrench className="w-3.5 h-3.5" /> Maintenance
          </button>
          <button onClick={() => setActiveTab('reconciliation')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'reconciliation' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
            <Route className="w-3.5 h-3.5" /> Travel
          </button>
          {vehicle.geotab_sync_status === 'synced' && (
            <button onClick={() => setActiveTab('safety')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition ${activeTab === 'safety' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}>
              <ShieldAlert className="w-3.5 h-3.5" /> Safety
            </button>
          )}
        </div>

        {/* ═════════════ LIVE OPS TAB (Geotab) ═════════════ */}
        {activeTab === 'live' && (
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5 border border-blue-200">
                <p className="text-[10px] uppercase text-blue-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Engine Hours</p>
                <p className="text-base font-bold text-blue-700 tabular-nums mt-0.5">{vehicle.engine_hours != null ? Math.round(Number(vehicle.engine_hours)).toLocaleString() : '—'} <span className="text-[10px] font-normal">h</span></p>
              </div>
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-2.5 border border-cyan-200">
                <p className="text-[10px] uppercase text-cyan-600 font-semibold flex items-center gap-1"><Gauge className="w-3 h-3" /> Mileage</p>
                <p className="text-base font-bold text-cyan-700 tabular-nums mt-0.5">{vehicle.current_mileage ? Number(vehicle.current_mileage).toLocaleString() : '—'} <span className="text-[10px] font-normal">mi</span></p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2.5 border border-emerald-200">
                <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1"><Zap className="w-3 h-3" /> Ignition</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5">{latestLoc?.ignition_on ? 'ON' : 'OFF'}</p>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-2.5 border border-violet-200">
                <p className="text-[10px] uppercase text-violet-600 font-semibold flex items-center gap-1"><Navigation className="w-3 h-3" /> Speed</p>
                <p className="text-base font-bold text-violet-700 tabular-nums mt-0.5">{latestLoc?.speed_kph ? Math.round(latestLoc.speed_kph * 0.621371) : 0} <span className="text-[10px] font-normal">mph</span></p>
              </div>
            </div>

            {vehicle.geotab_sync_status === 'synced' && vehicle.safety_event_count != null && (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-bold text-slate-800">Driver Safety</h3>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    (vehicle.driver_risk_score || 100) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    (vehicle.driver_risk_score || 100) >= 50 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    Risk Score: {vehicle.driver_risk_score ?? 100}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                    <p className="text-[10px] uppercase text-red-500 font-semibold">Harsh Braking</p>
                    <p className="text-lg font-bold text-red-700 tabular-nums">{vehicle.safety_harsh_braking_count || 0}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                    <p className="text-[10px] uppercase text-amber-500 font-semibold">Speeding</p>
                    <p className="text-lg font-bold text-amber-700 tabular-nums">{vehicle.safety_speeding_count || 0}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2 border border-orange-100">
                    <p className="text-[10px] uppercase text-orange-500 font-semibold">Harsh Accel</p>
                    <p className="text-lg font-bold text-orange-700 tabular-nums">{vehicle.safety_harsh_accel_count || 0}</p>
                  </div>
                  <div className="bg-violet-50 rounded-lg p-2 border border-violet-100">
                    <p className="text-[10px] uppercase text-violet-500 font-semibold">Harsh Cornering</p>
                    <p className="text-lg font-bold text-violet-700 tabular-nums">{vehicle.safety_harsh_cornering_count || 0}</p>
                  </div>
                </div>
                {vehicle.geotab_driver_name && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <User className="w-3 h-3" /> Last detected driver: <span className="font-semibold text-slate-700">{vehicle.geotab_driver_name}</span>
                  </div>
                )}
                <button onClick={() => setActiveTab('safety')}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold text-red-700 transition">
                  <ShieldAlert className="w-3.5 h-3.5" /> View Full Violation Log with Dates & Times
                </button>
                <p className="text-[10px] text-slate-400 mt-1.5">Events from the last 30 days · Click above to drill down</p>
              </div>
            )}

            {latestLoc ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-slate-800">Live Position</h3>
                  <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(latestLoc.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <VehicleLocationMiniMap {...latestLoc} />
                {latestLoc.driver_name && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <User className="w-3 h-3" /> Driver: <span className="font-semibold text-slate-700">{latestLoc.driver_name}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-xl">
                <Satellite className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">{geotabLive ? 'No live position data right now' : 'Not tracking via Geotab yet'}</p>
              </div>
            )}

            <TripTimelineEnhanced vehicle={vehicle} />
          </div>
        )}

        {/* ═════════════ SPEC TAB ═════════════ */}
        {activeTab === 'spec' && (
          <div className="px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Vehicle Specification</h3>
                <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceMeta.cls}`}>
                  <confidenceMeta.Icon className="w-3 h-3" /> {confidenceMeta.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SpecTile icon={Car} label="Make" value={vehicle.make || '—'} source={specSource(vehicle.make)} color="bg-blue-50 border-blue-200" />
                <SpecTile icon={Car} label="Model" value={vehicle.model || '—'} source={specSource(vehicle.model)} color="bg-blue-50 border-blue-200" />
                <SpecTile icon={CalendarClock} label="Year" value={vehicle.year || '—'} source={vehicle.year ? 'VIN' : null} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Fuel} label="Fuel" value={FUEL_LABELS[vehicle.fuel_type] || '—'} source={specSource(vehicle.fuel_type && vehicle.fuel_type !== 'unknown')} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Palette} label="Colour" value={vehicle.color || '—'} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Truck} label="Type" value={vehicle.vehicle_type || '—'} source={specSource(vehicle.vehicle_type)} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Hash} label="VIN" value={vehicle.vin || '—'} source={specSource(vehicle.vin)} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={User} label="Driver" value={vehicle.geotab_keeper_name || assignedStaff?.name || 'Unassigned'} source={vehicle.geotab_keeper_name ? 'Geotab' : null} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Users} label="Team" value={team?.name || '—'} color="bg-slate-50 border-slate-200" />
                <SpecTile icon={Weight} label="Max Payload" value={vehicle.max_weight_kg ? `${Math.round(vehicle.max_weight_kg)} kg` : '—'} color="bg-blue-50 border-blue-200" />
                <SpecTile icon={Ruler} label="Height" value={vehicle.height_m ? `${vehicle.height_m} m` : '—'} color="bg-violet-50 border-violet-200" />
                <SpecTile icon={Box} label="Max Volume" value={vehicle.max_volume_m3 ? `${vehicle.max_volume_m3} m³` : '—'} color="bg-slate-50 border-slate-200" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-600">Data Sources</h4>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5"><Satellite className="w-3 h-3 text-cyan-500" /> Geotab (Live Telemetry)</span>
                  <span className={`font-bold ${geotabLive ? 'text-emerald-600' : 'text-slate-400'}`}>{geotabLive ? 'Connected' : 'Not synced'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5"><Link2 className="w-3 h-3 text-blue-500" /> Holman (Compliance)</span>
                  <span className={`font-bold ${vehicle.holman_sync_status === 'synced' ? 'text-emerald-600' : 'text-slate-400'}`}>{vehicle.holman_sync_status === 'synced' ? 'Connected' : 'Not synced'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5"><Radio className="w-3 h-3 text-violet-500" /> VIN Decode</span>
                  <span className={`font-bold ${vehicle.vin ? 'text-emerald-600' : 'text-slate-400'}`}>{vehicle.vin ? 'Available' : 'No VIN'}</span>
                </div>
              </div>
              {vehicle.last_geotab_sync && (
                <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
                  Last Geotab sync: {new Date(vehicle.last_geotab_sync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ═════════════ MAINTENANCE TAB (Holman) ═════════════ */}
        {activeTab === 'compliance' && (
          <div className="px-5 py-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Key Compliance Dates</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'MOT Due', date: vehicle.mot_expiry, icon: ShieldCheck },
                  { label: 'Service Due', date: vehicle.service_due_date, icon: Wrench },
                  { label: 'Last Service', date: vehicle.last_service_date, icon: Activity },
                ].filter(d => d.date).map(d => {
                  const date = new Date(d.date + 'T00:00:00');
                  const days = differenceInDays(date, new Date());
                  const tone = days < 0 ? 'rose' : days <= 30 ? 'amber' : 'emerald';
                  const colors = COLOR_MAP[tone] || COLOR_MAP.slate;
                  return (
                    <div key={d.label} className={`flex items-center gap-3 p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                      <d.icon className={`w-4 h-4 ${colors.text}`} />
                      <div className="flex-1">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">{d.label}</p>
                        <p className={`text-sm font-bold ${colors.text}`}>
                          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold ${colors.text}`}>
                        {days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                      </span>
                    </div>
                  );
                })}
                {!vehicle.mot_expiry && !vehicle.service_due_date && !vehicle.last_service_date && (
                  <p className="text-xs text-slate-400 px-3 py-2">No compliance dates on record. Sync Holman to populate.</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">MOT History</h3>
                <span className="ml-auto text-[10px] text-slate-400">Holman</span>
              </div>
              <MOTHistoryTimeline vehicleId={vehicle.id} vehicle={vehicle} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Maintenance History</h3>
                <span className="ml-auto text-[10px] text-slate-400">Holman</span>
              </div>
              <MaintenanceTimeline vehicleId={vehicle.id} />
            </div>
          </div>
        )}

        {/* ═════════════ TRAVEL RECONCILIATION TAB ═════════════ */}
        {activeTab === 'reconciliation' && (
          <div className="px-5 py-4">
            <TravelReconciliationReport vehicle={vehicle} />
          </div>
        )}

        {/* ═════════════ SAFETY DRILL-DOWN TAB ═════════════ */}
        {activeTab === 'safety' && (
          <div className="px-5 py-4">
            <SafetyEventsDrillDown vehicle={vehicle} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}