import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Smartphone, WifiOff, AlertCircle, Truck, Users } from 'lucide-react';
import { useLiveStaffLocations } from '@/hooks/useLiveStaffLocations';

/**
 * TrackingPresenceStrip — shows who has the app open & streaming GPS vs
 * who is offline, plus a full roster with per-person status pills.
 *
 * Status pills:
 *   🟢 App open (streaming)  — fresh phone GPS within 2 min
 *   🟡 App open, no GPS fix  — tracking enabled but no recent fix / capture error
 *   ⚪ App closed / offline  — tracking enabled but no GPS at all
 *   🔵 Vehicle-proxy only    — no phone GPS but showing via vehicle telematics
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

  // Build roster: only staff on shift today (assigned to a job)
  const roster = useMemo(() => {
    const assignedStaffIds = new Set(todayAssignments.map(a => a.staff_id));
    const liveByStaff = {};
    liveStaff.forEach(s => { liveByStaff[s.staffId] = s; });

    return todayAssignments
      .map(a => {
        const staff = staffList.find(s => s.id === a.staff_id);
        if (!staff) return null;
        const live = liveByStaff[a.staff_id];
        let status, statusColor, statusIcon, statusLabel;
        if (live && live.source === 'phone') {
          const age = live.timestamp ? Date.now() - new Date(live.timestamp).getTime() : Infinity;
          if (age < FRESH_MS) {
            status = 'streaming';
            statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            statusIcon = Smartphone;
            statusLabel = 'App open · streaming';
          } else {
            status = 'stale_phone';
            statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
            statusIcon = AlertCircle;
            statusLabel = 'App open · stale GPS';
          }
        } else if (live && live.source === 'vehicle_proxy') {
          status = 'vehicle_proxy';
          statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
          statusIcon = Truck;
          statusLabel = 'Vehicle-proxy only';
        } else if (staff.tracking_enabled && staff.last_capture_error) {
          status = 'no_gps';
          statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
          statusIcon = AlertCircle;
          statusLabel = `No GPS · ${staff.last_capture_error}`;
        } else if (staff.tracking_enabled) {
          status = 'offline';
          statusColor = 'bg-slate-100 text-slate-500 border-slate-200';
          statusIcon = WifiOff;
          statusLabel = 'App closed / offline';
        } else {
          status = 'disabled';
          statusColor = 'bg-slate-100 text-slate-400 border-slate-200';
          statusIcon = WifiOff;
          statusLabel = 'Tracking disabled';
        }
        return { staff, assignment: a, status, statusColor, statusIcon, statusLabel, live };
      })
      .filter(Boolean);
  }, [staffList, todayAssignments, liveStaff]);

  const counts = useMemo(() => {
    const c = { streaming: 0, stale_phone: 0, no_gps: 0, vehicle_proxy: 0, offline: 0, disabled: 0 };
    roster.forEach(r => { c[r.status]++; });
    return c;
  }, [roster]);

  const summaryTiles = [
    { label: 'Streaming', value: counts.streaming, sub: 'App open · live GPS', icon: Smartphone, gradient: 'stat-gradient-emerald' },
    { label: 'No GPS fix', value: counts.stale_phone + counts.no_gps, sub: 'App open · no fix', icon: AlertCircle, gradient: 'stat-gradient-amber' },
    { label: 'Vehicle-proxy', value: counts.vehicle_proxy, sub: 'Via company vehicle', icon: Truck, gradient: 'stat-gradient-blue' },
    { label: 'Offline', value: counts.offline + counts.disabled, sub: 'App closed / disabled', icon: WifiOff, gradient: 'stat-gradient-slate' },
  ];

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-bold text-slate-800">Crew Tracking Presence</h3>
        <span className="ml-auto text-[11px] text-slate-400">{roster.length} on shift today</span>
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

      {/* Roster list with per-person pills */}
      {roster.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No crew on shift today.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {roster.map(r => {
            const StatusIcon = r.statusIcon;
            const job = r.assignment?.job_id;
            return (
              <div key={r.staff.id} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-lg px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  r.status === 'streaming' ? 'bg-emerald-500' :
                  r.status === 'stale_phone' || r.status === 'no_gps' ? 'bg-amber-500' :
                  r.status === 'vehicle_proxy' ? 'bg-blue-500' :
                  'bg-slate-300'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{r.staff.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{r.live?.jobName || 'Assigned today'}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${r.statusColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  {r.statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}