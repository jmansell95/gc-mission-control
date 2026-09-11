import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, Tooltip, useMap, Polyline } from 'react-leaflet';
import {
  Users, Loader2, RefreshCw, Filter, MapPin, Navigation, Clock,
  WifiOff, AlertCircle, Smartphone, ChevronLeft, X, Activity,
  ShieldCheck, Briefcase, Gauge, Radio, Tablet, Monitor,
} from 'lucide-react';
import { deviceTypeLabel } from '@/utils/deviceDetect';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useLocationLogs } from '@/hooks/useLocationLogs';
import CrewDetailDrawer from './CrewDetailDrawer';

const UK_CENTER = [52.3, -1.5];

// Status thresholds (milliseconds since last fix)
const LIVE_MS = 2 * 60 * 1000;       // <2 min = live (green)
const STALE_MS = 15 * 60 * 1000;     // 2-15 min = stale (amber), >15 min = dark (red)

// Status colours
const STATUS_COLORS = {
  live: '#10b981',
  stale: '#f59e0b',
  dark: '#ef4444',
  off: '#94a3b8',
};

// ── Map helper: fit bounds when data changes ──
function MapBoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      const bounds = points.filter(p => p[0] != null && p[1] != null);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [points, map]);
  return null;
}

// ── Crew marker with status colour + accuracy halo ──
function CrewMarker({ crew, onClick }) {
  const pos = [crew.lat, crew.lng];
  if (crew.lat == null || crew.lng == null) return null;
  const colour = STATUS_COLORS[crew.status] || STATUS_COLORS.off;
  const isOff = crew.status === 'off';

  const icon = window.L?.divIcon({
    html: `<div style="position:relative;opacity:${isOff ? 0.6 : 1}">
      <div style="background:${colour};width:30px;height:30px;border-radius:50%;border:3px solid white;${isOff ? 'border-style:dashed;' : ''}box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z"/></svg>
      </div>
      ${crew.status === 'live' ? '<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ' + colour + ';opacity:0.35;animation:pulse 2s infinite"></div>' : ''}
      <div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);background:${colour};color:white;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis">${crew.staffName}</div>
    </div>`,
    className: 'hazard-map-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  if (!icon) return <Marker position={pos}><Popup>{crew.staffName}</Popup></Marker>;

  const timeStr = crew.timestamp
    ? new Date(crew.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <Marker position={pos} icon={icon} eventHandlers={{ click: () => onClick(crew) }}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm">{crew.staffName}</p>
          <p className="flex items-center gap-1" style={{ color: colour }}>
            <span className="w-2 h-2 rounded-full" style={{ background: colour }} />
            {crew.status === 'live' ? 'Live · streaming' : crew.status === 'stale' ? 'Stale · recent gap' : crew.status === 'dark' ? 'Gone dark · no fix' : 'Off shift'}
          </p>
          {crew.jobName && <p className="flex items-center gap-1 text-slate-600"><Briefcase className="w-3 h-3" /> {crew.jobName}</p>}
          {crew.deviceType && <p className="flex items-center gap-1 text-slate-500">{crew.deviceType === 'tablet' ? <Tablet className="w-3 h-3" /> : crew.deviceType === 'desktop' ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />} {deviceTypeLabel(crew.deviceType)}</p>}
          <p className="flex items-center gap-1 text-slate-500">
            {crew.isMoving ? <Navigation className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
            {crew.isMoving ? 'Moving' : 'Stationary'}
          </p>
          <p className="flex items-center gap-1 text-slate-400"><Clock className="w-3 h-3" /> {timeStr}</p>
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * LiveCrewTab — the Live Crew map view for the Fleet Hub.
 *
 * Shows every tracked crew member as a status-coloured marker:
 *   green = live fix <2 min
 *   amber = stale 2-15 min
 *   red = dark >15 min
 *   slate = off shift / not tracking
 *
 * Auto-refreshes every 30s. Marker tap opens a detail drawer with the
 * crew's day trail, active job, and tracking health.
 */
export default function LiveCrewTab() {
  const { activeDivision } = useDivision();
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterJob, setFilterJob] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch recent staff location logs (last 2 hours) using the shared hook
  // with built-in realtime subscription + server-side date filtering.
  // divisionId null = all divisions (enterprise admin view).
  const twoHrAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const { data: locationLogs = [], isLoading, isFetching, dataUpdatedAt, refetch } = useLocationLogs({
    divisionId: activeDivision?.id || null,
    startDate: twoHrAgo,
    endDate: nowIso,
    limit: 500,
    enabled: true,
  });

  // Fetch staff list — all divisions for enterprise admins, scoped for division managers
  const { data: staffList = [] } = useQuery({
    queryKey: ['crew-map-staff', activeDivision?.id],
    queryFn: () => base44.entities.Staff.filter(
      activeDivision?.id
        ? { division_id: activeDivision.id, is_active: true }
        : { is_active: true }
    ),
  });

  // Fetch today's assignments — all divisions for enterprise admins
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayAssignments = [] } = useQuery({
    queryKey: ['crew-map-assignments', activeDivision?.id, today],
    queryFn: () => base44.entities.RotaAssignment.filter(
      activeDivision?.id
        ? { division_id: activeDivision.id, assigned_date: today }
        : { assigned_date: today }
    ),
  });

  // Fetch jobs for job names
  const { data: jobs = [] } = useQuery({
    queryKey: ['crew-map-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  // Build the live crew array: latest position per staff member + status
  const liveCrew = useMemo(() => {
    // Deduplicate: latest log per staff
    const latestByStaff = {};
    for (const log of locationLogs) {
      if (!log.staff_id) continue;
      if (!latestByStaff[log.staff_id] || new Date(log.recorded_at) > new Date(latestByStaff[log.staff_id].recorded_at)) {
        latestByStaff[log.staff_id] = log;
      }
    }

    const now = Date.now();
    const assignedStaffIds = new Set(todayAssignments.map(a => a.staff_id));
    const crew = [];

    // Staff with GPS logs
    for (const [staffId, log] of Object.entries(latestByStaff)) {
      const staff = staffList.find(s => s.id === staffId);
      const assignment = todayAssignments.find(a => a.staff_id === staffId);
      const job = assignment?.job_id ? jobs.find(j => j.id === assignment.job_id) : null;
      const age = log.recorded_at ? now - new Date(log.recorded_at).getTime() : Infinity;
      const isAssigned = assignedStaffIds.has(staffId);

      let status;
      if (!isAssigned) status = 'off';
      else if (age < LIVE_MS) status = 'live';
      else if (age < STALE_MS) status = 'stale';
      else status = 'dark';

      crew.push({
        staffId,
        staffName: staff?.name || 'Unknown',
        lat: log.lat,
        lng: log.lng,
        accuracy: log.accuracy_m,
        speed: log.speed_mps,
        heading: log.heading,
        timestamp: log.recorded_at,
        isMoving: log.is_moving,
        status,
        jobName: job?.name || null,
        jobId: job?.id || null,
        assignmentId: assignment?.id || null,
        trackingEnabled: staff?.tracking_enabled,
        lastCaptureError: staff?.last_capture_error,
        lastCaptureErrorAt: staff?.last_capture_error_at,
        consentSigned: !!staff?.tracking_consent_signed_at,
        deviceType: log.device_type || null,
      });
    }

    // Staff assigned today but with NO GPS logs (off/dark)
    for (const staff of staffList) {
      if (latestByStaff[staff.id]) continue; // already have GPS
      if (!assignedStaffIds.has(staff.id)) continue;
      const assignment = todayAssignments.find(a => a.staff_id === staff.id);
      const job = assignment?.job_id ? jobs.find(j => j.id === assignment.job_id) : null;
      crew.push({
        staffId: staff.id,
        staffName: staff.name,
        lat: null,
        lng: null,
        accuracy: null,
        speed: null,
        heading: null,
        timestamp: null,
        isMoving: false,
        status: staff.tracking_enabled ? 'dark' : 'off',
        jobName: job?.name || null,
        jobId: job?.id || null,
        assignmentId: assignment?.id || null,
        trackingEnabled: staff.tracking_enabled,
        lastCaptureError: staff.last_capture_error,
        lastCaptureErrorAt: staff.last_capture_error_at,
        consentSigned: !!staff.tracking_consent_signed_at,
      });
    }

    return crew;
  }, [locationLogs, staffList, todayAssignments, jobs]);

  // Status counts
  const counts = useMemo(() => {
    const c = { live: 0, stale: 0, dark: 0, off: 0 };
    liveCrew.forEach(cr => { c[cr.status] = (c[cr.status] || 0) + 1; });
    return c;
  }, [liveCrew]);

  // Unique jobs for filter
  const jobOptions = useMemo(() => {
    const set = new Map();
    liveCrew.forEach(cr => { if (cr.jobName) set.set(cr.jobId, cr.jobName); });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [liveCrew]);

  // Filtered crew for map + list
  const filteredCrew = useMemo(() => {
    return liveCrew.filter(cr => {
      if (filterStatus !== 'all' && cr.status !== filterStatus) return false;
      if (filterJob !== 'all' && cr.jobId !== filterJob) return false;
      return true;
    });
  }, [liveCrew, filterStatus, filterJob]);

  // Map markers (only those with a position)
  const mapCrew = filteredCrew.filter(cr => cr.lat != null && cr.lng != null);
  const boundsPoints = mapCrew.map(cr => [cr.lat, cr.lng]);

  const handleCrewClick = (crew) => {
    setSelectedCrew(crew);
    setDrawerOpen(true);
  };

  const statusTiles = [
    { key: 'live', label: 'Live', sub: 'Fix <2 min', icon: Radio, color: 'stat-gradient-emerald' },
    { key: 'stale', label: 'Stale', sub: '2-15 min', icon: AlertCircle, color: 'stat-gradient-amber' },
    { key: 'dark', label: 'Gone Dark', sub: '>15 min', icon: WifiOff, color: 'stat-gradient-rose' },
    { key: 'off', label: 'Off Shift', sub: 'Not tracking', icon: Users, color: 'stat-gradient-slate' },
  ];

  return (
    <div className="space-y-3">
      {/* ── Tracking health summary tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statusTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              onClick={() => setFilterStatus(filterStatus === tile.key ? 'all' : tile.key)}
              className={`${tile.color} rounded-xl p-3.5 text-white relative overflow-hidden transition hover:scale-[1.02] ${filterStatus === tile.key ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-lg font-extrabold tabular-nums">{counts[tile.key] || 0}</span>
              </div>
              <p className="text-[11px] font-bold text-white/90">{tile.label}</p>
              <p className="text-[10px] text-white/60">{tile.sub}</p>
            </button>
          );
        })}
      </div>

      {/* ── Controls bar ── */}
      <div className="insight-card rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <div className="w-10 h-10 rounded-xl stat-gradient-brand flex items-center justify-center icon-tile-glow">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Live Crew Map</p>
            <p className="text-[11px] text-slate-500">{mapCrew.length} on map · {liveCrew.length} total crew</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              {isFetching ? 'Syncing…' : `Synced ${dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}`}
              <span className="text-slate-300">·</span>
              <span className="text-[#2E5A1A] font-semibold">Auto 30s</span>
            </p>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex p-1 bg-slate-100 rounded-lg gap-0.5">
          {[
            { val: 'all', label: 'All', count: liveCrew.length },
            { val: 'live', label: 'Live', count: counts.live },
            { val: 'stale', label: 'Stale', count: counts.stale },
            { val: 'dark', label: 'Dark', count: counts.dark },
          ].map(opt => (
            <button key={opt.val} onClick={() => setFilterStatus(opt.val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${filterStatus === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
              {opt.label}
              <span className={`text-[10px] tabular-nums ${filterStatus === opt.val ? 'text-[#8DC63F]' : 'text-slate-400'}`}>{opt.count}</span>
            </button>
          ))}
        </div>

        {/* Job filter */}
        {jobOptions.length > 0 && (
          <select
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 bg-white"
          >
            <option value="all">All Jobs</option>
            {jobOptions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        )}

        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Split-pane: map + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Map */}
        <div className="lg:col-span-2 insight-card rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 600 }}>
              <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading crew locations…</p>
            </div>
          ) : mapCrew.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 600 }}>
              <MapPin className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No crew locations yet</p>
              <p className="text-xs text-slate-400 mt-1">Crew with the app open will appear here in real time.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                <Users className="w-4 h-4 text-[#2E5A1A]" />
                <h3 className="text-sm font-bold text-slate-800">Live Crew Map</h3>
                <span className="ml-auto text-xs text-slate-400">{mapCrew.length} crew shown</span>
              </div>
              <div style={{ height: 560 }} className="relative rounded-b-2xl">
                <MapContainer center={UK_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl dragging>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <MapBoundsFitter points={boundsPoints} />
                  {/* Crew markers */}
                  {mapCrew.map(cr => (
                    <CrewMarker key={cr.staffId} crew={cr} onClick={handleCrewClick} />
                  ))}
                  {/* Accuracy halos for live/stale crew */}
                  {mapCrew.filter(cr => cr.accuracy && cr.accuracy < 200 && cr.status !== 'off').map(cr => (
                    <CircleMarker
                      key={cr.staffId + '-halo'}
                      center={[cr.lat, cr.lng]}
                      radius={Math.min(cr.accuracy / 2, 50)}
                      pathOptions={{ color: STATUS_COLORS[cr.status], fillColor: STATUS_COLORS[cr.status], fillOpacity: 0.08, weight: 1, opacity: 0.3 }}
                    />
                  ))}
                </MapContainer>
                {/* Legend */}
                <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-[10px] space-y-1 pointer-events-none">
                  <p className="font-bold text-slate-700 text-[11px] mb-1">Crew Status</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: STATUS_COLORS.live, border: '2px solid white' }} />
                    <span className="text-slate-600">Live (fix &lt;2 min)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: STATUS_COLORS.stale, border: '2px solid white' }} />
                    <span className="text-slate-600">Stale (2-15 min)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: STATUS_COLORS.dark, border: '2px solid white' }} />
                    <span className="text-slate-600">Gone dark (&gt;15 min)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: STATUS_COLORS.off, border: '2px dashed white' }} />
                    <span className="text-slate-600">Off shift / disabled</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar — crew list */}
        <div className="lg:col-span-1 space-y-3">
          <div className="insight-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Users className="w-4 h-4 text-[#2E5A1A]" /> Crew ({filteredCrew.length})</p>
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> {filterStatus !== 'all' ? filterStatus : 'all'}</span>
            </div>
            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-50">
              {filteredCrew.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No crew match this filter.</p>
              ) : filteredCrew.map(cr => (
                <button key={cr.staffId}
                  onClick={() => handleCrewClick(cr)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{cr.staffName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{cr.jobName || (cr.assignmentId ? 'Assigned today' : 'Not assigned')}</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[cr.status] }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    {cr.isMoving && <span className="flex items-center gap-0.5"><Navigation className="w-3 h-3" /> Moving</span>}
                    {cr.timestamp && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(cr.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {cr.deviceType && (
                      <span className="flex items-center gap-0.5 text-slate-500" title={deviceTypeLabel(cr.deviceType)}>
                        {cr.deviceType === 'tablet' ? <Tablet className="w-3 h-3" /> : cr.deviceType === 'desktop' ? <Monitor className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                        {deviceTypeLabel(cr.deviceType)}
                      </span>
                    )}
                    {!cr.timestamp && cr.status === 'dark' && <span className="flex items-center gap-0.5 text-rose-500"><WifiOff className="w-3 h-3" /> No GPS</span>}
                    {!cr.timestamp && cr.status === 'off' && <span className="flex items-center gap-0.5 text-slate-400"><WifiOff className="w-3 h-3" /> Off</span>}
                  </div>
                  {cr.lastCaptureError && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-500">
                      <AlertCircle className="w-3 h-3" />
                      <span className="truncate">{cr.lastCaptureError === 'permission_denied' || cr.lastCaptureError === 'permanently_denied' ? 'Location denied' : cr.lastCaptureError === 'no_fix_timeout' ? 'No GPS fix' : 'GPS error'}</span>
                      {cr.lastCaptureErrorAt && (
                        <span className="text-rose-300">· {Math.round((Date.now() - new Date(cr.lastCaptureErrorAt).getTime()) / 60000)}m ago</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Crew detail drawer ── */}
      <CrewDetailDrawer
        crew={selectedCrew}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}