import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useLocationLogs } from '@/hooks/useLocationLogs';
import {
  X, Navigation, Clock, MapPin, Briefcase, ShieldCheck, AlertCircle,
  WifiOff, Smartphone, Activity, Radio, Gauge, Loader2, Route, Trash2,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

const STATUS_COLORS = {
  live: '#10b981',
  stale: '#f59e0b',
  dark: '#ef4444',
  off: '#94a3b8',
};

const STATUS_LABELS = {
  live: 'Live · streaming',
  stale: 'Stale · recent gap',
  dark: 'Gone dark · no fix',
  off: 'Off shift / not tracking',
};

// Human-readable explanations for each capture error type
const ERROR_EXPLANATIONS = {
  permission_denied: 'Location permission denied on their phone — they need to enable it in browser/phone Settings.',
  permanently_denied: 'Location permanently denied — they must enable it in phone Settings → Location → browser app.',
  position_unavailable: 'GPS unavailable — likely no signal or poor GPS coverage on their device.',
  no_fix_timeout: 'Waiting for GPS fix — no location received yet. May be indoors or have GPS disabled.',
};

function formatErrorAge(errorAt) {
  if (!errorAt) return null;
  const mins = Math.round((Date.now() - new Date(errorAt).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m ago`;
  return format(new Date(errorAt), 'dd MMM HH:mm');
}

// ── Map helper: fit bounds to trail ──
function TrailBoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

/**
 * CrewDetailDrawer — slide-in drawer showing a crew member's day trail,
 * active job, and tracking health.
 */
export default function CrewDetailDrawer({ crew, open, onClose }) {
  const queryClient = useQueryClient();
  const [showTrail, setShowTrail] = useState(true);
  const [clearing, setClearing] = useState(false);

  const handleClearError = async () => {
    if (!crew?.staffId) return;
    setClearing(true);
    try {
      await base44.entities.Staff.update(crew.staffId, {
        last_capture_error: null,
        last_capture_error_at: null,
      });
      queryClient.invalidateQueries({ queryKey: ['crew-map-staff'] });
      queryClient.invalidateQueries({ queryKey: ['crew-map-assignments'] });
      onClose();
    } catch (e) {
      console.error('Failed to clear error:', e);
    }
    setClearing(false);
  };

  // Fetch today's trail using the shared hook with realtime subscription
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: trailLogs = [], isLoading } = useLocationLogs({
    staffId: crew?.staffId,
    startDate: todayStart.toISOString(),
    endDate: new Date().toISOString(),
    limit: 500,
    enabled: !!crew?.staffId && open,
  });

  // Build the trail polyline, splitting on gaps
  const { trailSegments, gapSegments, allPoints } = useMemo(() => {
    const sorted = [...trailLogs].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    const segments = [];
    let currentSeg = [];
    const gaps = [];
    let lastPoint = null;

    for (const log of sorted) {
      if (log.lat == null || log.lng == null) continue;
      const pt = [log.lat, log.lng];

      if (log.session_event === 'gap_start' && lastPoint) {
        // End current segment, start a gap
        if (currentSeg.length > 0) segments.push(currentSeg);
        gaps.push([lastPoint, pt]);
        currentSeg = [];
      } else if (log.session_event === 'gap_end' || log.session_event === 'resume') {
        // Start a new segment after the gap
        currentSeg = [pt];
      } else {
        currentSeg.push(pt);
        lastPoint = pt;
      }
    }
    if (currentSeg.length > 0) segments.push(currentSeg);

    return {
      trailSegments: segments,
      gapSegments: gaps,
      allPoints: sorted.filter(l => l.lat != null).map(l => [l.lat, l.lng]),
    };
  }, [trailLogs]);

  if (!open || !crew) return null;

  const statusColor = STATUS_COLORS[crew.status] || STATUS_COLORS.off;
  const trailCount = trailLogs.filter(l => l.session_event === 'fix').length;
  const gapCount = trailLogs.filter(l => l.session_event === 'gap_start').length;
  const lastFix = trailLogs.find(l => l.session_event === 'fix' || !l.session_event);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-[1001] w-full max-w-md bg-white shadow-2xl animate-drawer-slide-in flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: statusColor }}>
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 truncate">{crew.staffName}</h3>
            <p className="text-[11px] font-medium flex items-center gap-1" style={{ color: statusColor }}>
              <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
              {STATUS_LABELS[crew.status] || 'Unknown'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active job */}
          {crew.jobName && (
            <div className="insight-card rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-[#2E5A1A]" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active Job</p>
              </div>
              <p className="text-sm font-semibold text-slate-800">{crew.jobName}</p>
            </div>
          )}

          {/* Tracking health */}
          <div className="insight-card rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E5A1A]" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tracking Health</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[9px] text-slate-400 uppercase font-semibold">Consent</p>
                <p className="text-xs font-bold flex items-center gap-1" style={{ color: crew.consentSigned ? '#10b981' : '#ef4444' }}>
                  {crew.consentSigned ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {crew.consentSigned ? 'Signed' : 'Not signed'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[9px] text-slate-400 uppercase font-semibold">Tracking</p>
                <p className="text-xs font-bold flex items-center gap-1" style={{ color: crew.trackingEnabled ? '#10b981' : '#94a3b8' }}>
                  {crew.trackingEnabled ? <Radio className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {crew.trackingEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[9px] text-slate-400 uppercase font-semibold">Last Fix</p>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {crew.timestamp ? format(new Date(crew.timestamp), 'HH:mm:ss') : 'Never'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[9px] text-slate-400 uppercase font-semibold">Accuracy</p>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Gauge className="w-3 h-3" />
                  {crew.accuracy ? `±${Math.round(crew.accuracy)}m` : '—'}
                </p>
              </div>
            </div>
            {crew.lastCaptureError && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-rose-700">Capture Error</p>
                    <p className="text-[11px] text-rose-600 leading-snug">
                      {ERROR_EXPLANATIONS[crew.lastCaptureError] || crew.lastCaptureError}
                    </p>
                    {crew.lastCaptureErrorAt && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Last reported: {formatErrorAge(crew.lastCaptureErrorAt)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClearError}
                  disabled={clearing}
                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-[10px] font-bold hover:bg-rose-50 active:scale-95 transition disabled:opacity-50"
                >
                  {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Clear Error
                </button>
                <p className="text-[9px] text-rose-400 text-center leading-tight">Use once {crew.staffName?.split(' ')[0] || 'they'} confirm they've fixed it on their phone.</p>
              </div>
            )}
          </div>

          {/* Day trail stats */}
          <div className="insight-card rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-3.5 h-3.5 text-[#2E5A1A]" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Today's Trail</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-slate-50 rounded-lg p-2">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{trailCount}</p>
                <p className="text-[9px] text-slate-400 uppercase">Fixes</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-2">
                <p className="text-sm font-bold text-amber-600 tabular-nums">{gapCount}</p>
                <p className="text-[9px] text-slate-400 uppercase">Gaps</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-2">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{crew.isMoving ? 'Yes' : 'No'}</p>
                <p className="text-[9px] text-slate-400 uppercase">Moving</p>
              </div>
            </div>
          </div>

          {/* Trail map */}
          {allPoints.length > 0 && (
            <div className="insight-card rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#2E5A1A]" /> Day Trail</p>
                <button onClick={() => setShowTrail(s => !s)} className="text-[10px] font-semibold text-[#2E5A1A] hover:underline">
                  {showTrail ? 'Hide' : 'Show'}
                </button>
              </div>
              {showTrail && (
                <div style={{ height: 250 }} className="relative">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
                    </div>
                  ) : (
                    <MapContainer center={allPoints[allPoints.length - 1] || UK_CENTER} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <TrailBoundsFitter points={allPoints} />
                      {/* Trail segments (solid lines) */}
                      {trailSegments.map((seg, i) => (
                        <Polyline key={i} positions={seg} pathOptions={{ color: '#2E5A1A', weight: 3, opacity: 0.7 }} />
                      ))}
                      {/* Gap segments (dashed lines) */}
                      {gapSegments.map((gap, i) => (
                        <Polyline key={'gap-' + i} positions={gap} pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.5, dashArray: '6 6' }} />
                      ))}
                      {/* Start marker */}
                      {allPoints.length > 0 && (
                        <CircleMarker center={allPoints[0]} radius={6} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9, weight: 2 }}>
                          <Popup><div className="text-xs font-bold text-emerald-700">Start of day</div></Popup>
                        </CircleMarker>
                      )}
                      {/* Current position */}
                      {allPoints.length > 1 && (
                        <CircleMarker center={allPoints[allPoints.length - 1]} radius={7} pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.9, weight: 3 }}>
                          <Popup><div className="text-xs font-bold">Latest position</div></Popup>
                        </CircleMarker>
                      )}
                    </MapContainer>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No data state */}
          {!isLoading && trailLogs.length === 0 && (
            <div className="insight-card rounded-xl p-6 text-center">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">No GPS data today</p>
              <p className="text-xs text-slate-400 mt-1">This crew member hasn't reported any location points yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const UK_CENTER = [52.3, -1.5];