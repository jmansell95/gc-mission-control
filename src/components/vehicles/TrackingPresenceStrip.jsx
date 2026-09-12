import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Smartphone, WifiOff, AlertCircle, Truck, Users } from 'lucide-react';
import { useLiveStaffLocations } from '@/hooks/useLiveStaffLocations';

/**
 * TrackingPresenceStrip — shows who has the app open & streaming GPS vs
 * who is offline, plus a full roster with per-person status pills.
 *
 * A staff member can have MULTIPLE pills when they have more than one
 * tracking source (e.g. phone GPS streaming + vehicle telematics).
 *
 * Phone pill states:
 *   🟢 App open (streaming)  — fresh phone GPS within 2 min
 *   🟡 App open, no GPS fix  — tracking enabled but no recent fix / capture error
 *   ⚪ App closed / offline  — tracking enabled but no GPS at all
 * Vehicle pill state:
 *   🔵 Vehicle-proxy        — live via company vehicle telematics
 */
const FRESH_MS = 2 * 60 * 1000; // 2 min = "app open & streaming"

export default function TrackingPresenceStrip({ divisionId }) {
  const { liveStaff } = useLiveStaffLocations(divisionId);

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-presence-roster', divisionId],
    queryFn: () => base44.entities.Staff.filter({ division_id: divisionId, is_active: true }),
    enabled: !!divisionId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayAssignments = [] } = useQuery({
    queryKey: ['staff-presence-assignments', divisionId, today],
    queryFn: () => base44.entities.RotaAssignment.filter({ division_id: divisionId, assigned_date: today, assignment_type: 'job' }),
    enabled: !!divisionId,
  });

  // Group live entries by staff member (a staff member can have both
  // a phone entry and a vehicle_proxy entry).
  const liveByStaff = useMemo(() => {
    const map = {};
    liveStaff.forEach(s => {
      if (!map[s.staffId]) map[s.staffId] = [];
      map[s.staffId].push(s);
    });
    return map;
  }, [liveStaff]);

  // Build roster: all staff who are assigned today OR have any live
  // tracking entry (phone or vehicle). This includes staff like Jon Kent
  // who have a Geotab-tracked vehicle but no job assignment today.
  const roster = useMemo(() => {
    const assignedStaffIds = new Set(todayAssignments.map(a => a.staff_id));
    const liveStaffIds = new Set(Object.keys(liveByStaff));
    const allStaffIds = new Set([...assignedStaffIds, ...liveStaffIds]);

    const roster = [];
    for (const staffId of allStaffIds) {
      const staff = staffList.find(s => s.id === staffId);
      if (!staff) continue;
      const assignment = todayAssignments.find(a => a.staff_id === staffId);
      const liveEntries = liveByStaff[staffId] || [];

      // Build one pill per tracking source
      const pills = [];
      let phoneEntry = liveEntries.find(e => e.source === 'phone');
      let vehicleEntry = liveEntries.find(e => e.source === 'vehicle_proxy');

      if (phoneEntry) {
        const age = phoneEntry.timestamp ? Date.now() - new Date(phoneEntry.timestamp).getTime() : Infinity;
        if (age < FRESH_MS) {
          pills.push({ key: 'phone-streaming', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Smartphone, label: 'App open · streaming' });
        } else {
          pills.push({ key: 'phone-stale', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'App open · stale GPS' });
        }
      } else if (staff.tracking_enabled && staff.last_capture_error) {
        pills.push({ key: 'phone-nogps', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: `No GPS · ${staff.last_capture_error}` });
      } else if (staff.tracking_enabled) {
        pills.push({ key: 'phone-offline', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: WifiOff, label: 'App closed / offline' });
      } else if (!vehicleEntry) {
        pills.push({ key: 'disabled', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: WifiOff, label: 'Tracking disabled' });
      }

      if (vehicleEntry) {
        const vAge = vehicleEntry.timestamp ? Date.now() - new Date(vehicleEntry.timestamp).getTime() : Infinity;
        if (vAge < FRESH_MS) {
          pills.push({ key: 'vehicle', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Truck, label: 'Vehicle-proxy' });
        } else {
          pills.push({ key: 'vehicle-stale', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Truck, label: 'Vehicle · stale' });
        }
      }

      roster.push({ staff, assignment, pills, liveEntries });
    }
    return roster;
  }, [staffList, todayAssignments, liveByStaff]);

  // Count pills by type for the summary tiles
  const counts = useMemo(() => {
    const c = { streaming: 0, stale_phone: 0, no_gps: 0, vehicle_proxy: 0, offline: 0, disabled: 0 };
    roster.forEach(r => {
      r.pills.forEach(p => {
        if (p.key === 'phone-streaming') c.streaming++;
        else if (p.key === 'phone-stale') c.stale_phone++;
        else if (p.key === 'phone-nogps') c.no_gps++;
        else if (p.key === 'vehicle' || p.key === 'vehicle-stale') c.vehicle_proxy++;
        else if (p.key === 'phone-offline') c.offline++;
        else if (p.key === 'disabled') c.disabled++;
      });
    });
    return c;
  }, [roster]);

  const summaryTiles = [
    { label: 'Streaming', value: counts.streaming, sub: 'App open · live GPS', icon: Smartphone, gradient: 'stat-gradient-emerald' },
    { label: 'No GPS fix', value: counts.stale_phone + counts.no_gps, sub: 'App open · no fix', icon: AlertCircle, gradient: 'stat-gradient-amber' },
    { label: 'Vehicle-proxy', value: counts.vehicle_proxy, sub: 'Via company vehicle', icon: Truck, gradient: 'stat-gradient-blue' },
    { label: 'Offline', value: counts.offline + counts.disabled, sub: 'App closed / disabled', icon: WifiOff, gradient: 'stat-gradient-slate' },
  ];

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-bold text-slate-800">Crew Tracking Presence</h3>
        <span className="ml-auto text-[11px] text-slate-400">{roster.length} tracked today</span>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {summaryTiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <div key={i} className={`${tile.gradient} rounded-xl p-3 text-white relative overflow-hidden`}>
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-lg font-extrabold tabular-nums">{tile.value}</span>
              </div>
              <p className="text-[11px] font-bold text-white/90">{tile.label}</p>
              <p className="text-[10px] text-white/60">{tile.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Roster list with per-person pills (multiple pills supported) */}
      {roster.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No crew tracked today.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {roster.map(r => (
            <div key={r.staff.id} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-lg px-3 py-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                r.pills.some(p => p.key === 'phone-streaming') ? 'bg-emerald-500' :
                r.pills.some(p => p.key === 'vehicle' || p.key === 'vehicle-stale') ? 'bg-blue-500' :
                r.pills.some(p => p.key === 'phone-stale' || p.key === 'phone-nogps') ? 'bg-amber-500' :
                'bg-slate-300'
              }`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{r.staff.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{r.liveEntries[0]?.jobName || (r.assignment ? 'Assigned today' : 'Tracked via vehicle')}</p>
              </div>
              <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
                {r.pills.map(pill => {
                  const PillIcon = pill.icon;
                  return (
                    <span key={pill.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${pill.color}`}>
                      <PillIcon className="w-3 h-3" />
                      {pill.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}