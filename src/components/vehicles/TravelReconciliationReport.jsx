import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Route, Loader2, Clock, MapPin, ChevronDown, ChevronRight, RefreshCw,
  AlertCircle, FileDown, Calendar, TrendingDown, Timer, Navigation,
  CheckCircle2, AlertTriangle, XCircle, User, Circle, Flag, Square,
  ExternalLink, Gauge, Activity, Car,
} from 'lucide-react';
import { batchReverseGeocodeStructured, buildLabelFromParts } from '@/utils/reverseGeocode';
import jsPDF from 'jspdf';

const KM_TO_MI = 0.621371;
function kmToMi(km) { return (Number(km) || 0) * KM_TO_MI; }
function formatDuration(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatTimeSec(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Group trips by day — each day gets its trips sorted by start time,
// plus aggregated stats (distance, duration, first start, last end, stops).
function groupTripsByDay(trips) {
  const groups = {};
  for (const t of trips) {
    const dayKey = (t.start_time || '').slice(0, 10);
    if (!dayKey) continue;
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(t);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayTrips]) => {
      const sorted = dayTrips.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      return {
        date,
        trips: sorted,
        distance: sorted.reduce((s, t) => s + (t.distance_km || 0), 0),
        duration: sorted.reduce((s, t) => s + (t.duration_minutes || 0), 0),
        idle: sorted.reduce((s, t) => s + (t.idle_minutes || 0), 0),
        stops: sorted.reduce((s, t) => s + (t.stop_count || 0), 0),
        firstStart: sorted.reduce((m, t) => (m && m < t.start_time ? m : t.start_time), null),
        lastEnd: sorted.reduce((m, t) => (m && m > t.end_time ? m : t.end_time), null),
      };
    });
}

// Match GPS trips to timesheet entries for the same staff member on the same date.
function reconcileTripsWithTimesheets(trips, timesheets, staffMap, assignedStaffId, vehicleName) {
  const byDate = {};
  for (const t of trips) {
    const date = (t.start_time || '').slice(0, 10);
    if (!date) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(t);
  }

  const reconciliations = [];
  for (const [date, dayTrips] of Object.entries(byDate)) {
    const gpsDriveMins = dayTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
    const gpsFirstStart = dayTrips.reduce((m, t) => (m && m < t.start_time ? m : t.start_time), null);
    const gpsLastEnd = dayTrips.reduce((m, t) => (m > t.end_time ? m : t.end_time), null);
    const distanceMi = kmToMi(dayTrips.reduce((s, t) => s + (t.distance_km || 0), 0));

    const matchingTs = timesheets.filter(ts =>
      ts.staff_id === assignedStaffId &&
      (ts.date || '').slice(0, 10) === date &&
      !ts.is_break
    );

    if (matchingTs.length > 0) {
      const claimedTravelMins = matchingTs.reduce((s, ts) => {
        const travel = Number(ts.travel_to_minutes || 0) + Number(ts.travel_from_minutes || 0);
        if (travel === 0 && (ts.task_type === 'travel_to' || ts.task_type === 'travel_from')) {
          return s + Number(ts.task_duration_minutes || 0);
        }
        return s + travel;
      }, 0);
      const variance = gpsDriveMins - claimedTravelMins;
      const status = Math.abs(variance) <= 15 ? 'match' : variance > 15 ? 'under_claimed' : 'over_claimed';
      const staff = staffMap[assignedStaffId];

      reconciliations.push({
        staff_name: staff?.name || matchingTs[0]?.staff_name || 'Unknown',
        date,
        gps_drive_mins: gpsDriveMins,
        gps_first_start: gpsFirstStart,
        gps_last_end: gpsLastEnd,
        claimed_travel_mins: claimedTravelMins,
        variance,
        status,
        trip_count: dayTrips.length,
        distance_mi: distanceMi,
      });
    } else {
      reconciliations.push({
        staff_name: staffMap[assignedStaffId]?.name || vehicleName || 'Unassigned',
        date,
        gps_drive_mins: gpsDriveMins,
        gps_first_start: gpsFirstStart,
        gps_last_end: gpsLastEnd,
        claimed_travel_mins: 0,
        variance: gpsDriveMins,
        status: 'unrecorded',
        trip_count: dayTrips.length,
        distance_mi: distanceMi,
      });
    }
  }
  return reconciliations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ── PDF GENERATION ──
// Day-by-day report: each day gets a header, a movement-by-movement breakdown,
// and a reconciliation row. Designed for printing and auditing.
function generateFullPDF(vehicle, dayGroups, reconciliations, dateRange) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297, margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y > pageH - needed - 10) { doc.addPage(); y = margin; }
  };

  // ── Header bar ──
  doc.setFillColor(46, 90, 26);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Travel Reconciliation Report', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, margin, 20);
  doc.text('GC Mission Control — Fleet Command', margin, 26);
  y = 42;

  // ── Vehicle identity ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${vehicle.registration_number || 'Unknown Reg'}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name || '';
  if (makeModel) { doc.text(`Make/Model: ${makeModel}`, margin, y); y += 5; }
  if (dateRange.from || dateRange.to) {
    doc.text(`Period: ${dateRange.from || '—'} to ${dateRange.to || '—'}`, margin, y); y += 5;
  }
  y += 3;

  // ── Summary stats ──
  const allTrips = dayGroups.flatMap(dg => dg.trips);
  const totalDistMi = kmToMi(allTrips.reduce((s, t) => s + (t.distance_km || 0), 0));
  const totalDriveMins = allTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalIdleMins = allTrips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
  const totalStops = allTrips.reduce((s, t) => s + (t.stop_count || 0), 0);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Summary', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Days: ${dayGroups.length}`, margin, y); y += 5;
  doc.text(`Total Trips: ${allTrips.length}`, margin, y); y += 5;
  doc.text(`Total Distance: ${totalDistMi.toFixed(1)} mi`, margin, y); y += 5;
  doc.text(`Total Drive Time: ${formatDuration(totalDriveMins)}`, margin, y); y += 5;
  doc.text(`Total Idle Time: ${formatDuration(totalIdleMins)}`, margin, y); y += 5;
  doc.text(`Total Stops: ${totalStops}`, margin, y); y += 8;

  // ── Reconciliation summary table ──
  if (reconciliations.length > 0) {
    ensureSpace(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Travel-Hour Reconciliation (GPS vs Timesheet)', margin, y);
    y += 6;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Date', margin + 2, y + 5.5);
    doc.text('Staff', margin + 28, y + 5.5);
    doc.text('GPS Drive', margin + 75, y + 5.5);
    doc.text('Claimed', margin + 105, y + 5.5);
    doc.text('Variance', margin + 135, y + 5.5);
    doc.text('Status', margin + 165, y + 5.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    for (const r of reconciliations) {
      ensureSpace(15);
      const date = r.date || '—';
      const staff = (r.staff_name || '').slice(0, 22);
      const gps = formatDuration(r.gps_drive_mins);
      const claimed = formatDuration(r.claimed_travel_mins);
      const variance = (r.variance > 0 ? '+' : '') + formatDuration(r.variance);
      const status = r.status === 'match' ? 'MATCH' : r.status === 'under_claimed' ? 'UNDER' : r.status === 'over_claimed' ? 'OVER' : 'UNRECORDED';

      doc.text(date, margin + 2, y + 5);
      doc.text(staff, margin + 28, y + 5);
      doc.text(gps, margin + 75, y + 5);
      doc.text(claimed, margin + 105, y + 5);
      if (r.status === 'match') doc.setTextColor(16, 185, 129);
      else if (r.status === 'under_claimed') doc.setTextColor(245, 158, 11);
      else doc.setTextColor(239, 68, 68);
      doc.text(variance, margin + 135, y + 5);
      doc.text(status, margin + 165, y + 5);
      doc.setTextColor(71, 85, 105);
      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageW - margin, y);
    }
    y += 6;
  }

  // ── Day-by-day movement log ──
  ensureSpace(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Daily Movement Log', margin, y);
  y += 8;

  for (const dg of dayGroups) {
    ensureSpace(25);
    // Day header bar
    doc.setFillColor(46, 90, 26);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateLong(dg.date), margin + 2, y + 5);
    const dayStats = `${dg.trips.length} trips · ${kmToMi(dg.distance).toFixed(1)} mi · ${formatDuration(dg.duration)} drive · ${formatDuration(dg.idle)} idle`;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dayStats, pageW - margin - 2, y + 5, { align: 'right' });
    y += 9;

    // Reconciliation row for this day (if any)
    const recon = reconciliations.find(r => r.date === dg.date);
    if (recon) {
      ensureSpace(10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      const reconLine = `Staff: ${recon.staff_name}  |  GPS Drive: ${formatDuration(recon.gps_drive_mins)}  |  Claimed: ${formatDuration(recon.claimed_travel_mins)}  |  Variance: ${(recon.variance > 0 ? '+' : '') + formatDuration(recon.variance)}  |  ${recon.status.toUpperCase()}`;
      doc.text(reconLine, margin + 2, y + 4);
      y += 6;
    }

    // Trip movements
    doc.setFontSize(8);
    for (const trip of dg.trips) {
      ensureSpace(18);
      const startT = formatTime(trip.start_time);
      const endT = formatTime(trip.end_time);
      const distMi = kmToMi(trip.distance_km).toFixed(1);
      const dur = formatDuration(trip.duration_minutes);

      // Trip row — time | from → to | dist | dur
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${startT}–${endT}`, margin + 2, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const from = (trip.start_location || '—').slice(0, 38);
      const to = (trip.end_location || '—').slice(0, 38);
      doc.text(`From: ${from}`, margin + 24, y + 4);
      doc.text(`To:   ${to}`, margin + 24, y + 8);
      doc.text(`${distMi}mi`, pageW - margin - 30, y + 4, { align: 'right' });
      doc.text(dur, pageW - margin - 2, y + 4, { align: 'right' });

      // Stops detail
      if (trip.stops && trip.stops.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        for (let si = 0; si < Math.min(trip.stops.length, 3); si++) {
          const s = trip.stops[si];
          ensureSpace(6);
          const stopLoc = (s.location || '—').slice(0, 45);
          doc.text(`  • Stop ${si + 1}: ${stopLoc} (${formatDuration(s.duration_minutes)})`, margin + 24, y + 12 + si * 4);
        }
        y += 12 + Math.min(trip.stops.length, 3) * 4;
      } else {
        y += 10;
      }
      doc.setFontSize(8);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageW - margin, y);
      y += 2;
    }
    y += 4;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount} · GC Mission Control`, pageW / 2, pageH - 8, { align: 'center' });
  }

  const filename = `travel-reconciliation-${(vehicle.registration_number || 'unknown').replace(/\s/g, '')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export default function TravelReconciliationReport({ vehicle }) {
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [geocodedTrips, setGeocodedTrips] = useState({});

  const effectiveFrom = useMemo(() => {
    if (fromDate) return new Date(fromDate + 'T00:00:00').toISOString();
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }, [fromDate]);
  const effectiveTo = useMemo(() => {
    if (toDate) return new Date(toDate + 'T23:59:59').toISOString();
    return new Date().toISOString();
  }, [toDate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['travel-reconciliation', vehicle?.id, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'geotab_history',
        vehicle_id: vehicle.id,
        from_date: effectiveFrom,
        to_date: effectiveTo,
        limit: 500,
      });
      return res?.data || res;
    },
    enabled: !!vehicle?.id && !!vehicle?.geotab_device_id,
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-for-reconciliation'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 500),
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-for-reconciliation'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const staffMap = useMemo(() => {
    const m = {};
    for (const s of staffList) m[s.id] = s;
    return m;
  }, [staffList]);

  const trips = data?.trips || [];

  // Frontend geocoding — resolves "Unknown location" labels with street + postcode
  useEffect(() => {
    if (trips.length === 0) return;
    let cancelled = false;
    (async () => {
      const coords = [];
      for (const t of trips) {
        if (t.start_lat != null) coords.push({ lat: t.start_lat, lng: t.start_lng });
        if (t.end_lat != null) coords.push({ lat: t.end_lat, lng: t.end_lng });
        for (const s of (t.stops || [])) {
          if (s.lat != null) coords.push({ lat: s.lat, lng: s.lng });
        }
      }
      if (coords.length === 0) return;
      const labels = await batchReverseGeocodeStructured(coords);
      if (cancelled) return;
      const updated = {};
      for (const t of trips) {
        const sKey = t.start_lat != null ? `${Number(t.start_lat).toFixed(4)},${Number(t.start_lng).toFixed(4)}` : null;
        const eKey = t.end_lat != null ? `${Number(t.end_lat).toFixed(4)},${Number(t.end_lng).toFixed(4)}` : null;
        const startLabel = sKey && labels[sKey] ? buildLabelFromParts(labels[sKey]) : null;
        const endLabel = eKey && labels[eKey] ? buildLabelFromParts(labels[eKey]) : null;
        const stopLocs = (t.stops || []).map(s => {
          const stKey = s.lat != null ? `${Number(s.lat).toFixed(4)},${Number(s.lng).toFixed(4)}` : null;
          const sl = stKey && labels[stKey] ? buildLabelFromParts(labels[stKey]) : null;
          return sl ? { ...s, location: sl } : s;
        });
        updated[t.trip_id] = {
          start_location: startLabel || t.start_location,
          end_location: endLabel || t.end_location,
          stops: stopLocs,
        };
      }
      if (!cancelled) setGeocodedTrips(updated);
    })();
    return () => { cancelled = true; };
  }, [trips]);

  // Merge geocoded locations into trips
  const geocodedTripList = useMemo(() =>
    trips.map(t => {
      const geo = geocodedTrips[t.trip_id];
      return geo ? { ...t, start_location: geo.start_location, end_location: geo.end_location, stops: geo.stops } : t;
    }),
    [trips, geocodedTrips]
  );

  const reconciliations = useMemo(() =>
    reconcileTripsWithTimesheets(geocodedTripList, timesheets, staffMap, vehicle?.assigned_staff_id, vehicle?.name),
    [geocodedTripList, timesheets, staffMap, vehicle?.assigned_staff_id, vehicle?.name]
  );

  const dayGroups = useMemo(() => groupTripsByDay(geocodedTripList), [geocodedTripList]);

  const totalDistance = data?.total_distance_km || 0;
  const totalDriveMins = trips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalIdleMins = trips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
  const totalStops = trips.reduce((s, t) => s + (t.stop_count || 0), 0);
  const matchCount = reconciliations.filter(r => r.status === 'match').length;
  const underClaimedCount = reconciliations.filter(r => r.status === 'under_claimed').length;
  const unrecordedCount = reconciliations.filter(r => r.status === 'unrecorded').length;

  const handleDownloadPDF = () => {
    generateFullPDF(vehicle, dayGroups, reconciliations, { from: fromDate, to: toDate });
  };

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-xl">
        <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No Geotab device linked to this vehicle.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with date picker + PDF */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-800">Travel Reconciliation</h3>
          <span className="text-[10px] text-slate-400">Geotab · {vehicle.registration_number}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-cyan-400" />
            <span className="text-xs text-slate-400">→</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-cyan-400" />
          </div>
          <button onClick={handleDownloadPDF} disabled={isLoading || trips.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition">
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Fetching trips & reconciling...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-600">
          {error.message || 'Failed to fetch trip history'}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-xl">
          <Route className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No trips recorded in this period.</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-2.5 border border-cyan-200">
              <p className="text-[10px] uppercase text-cyan-600 font-semibold flex items-center gap-1"><Route className="w-3 h-3" /> Trips</p>
              <p className="text-lg font-bold text-cyan-700 tabular-nums mt-0.5">{trips.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2.5 border border-emerald-200">
              <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Miles</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">{kmToMi(totalDistance).toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5 border border-blue-200">
              <p className="text-[10px] uppercase text-blue-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Drive</p>
              <p className="text-lg font-bold text-blue-700 tabular-nums mt-0.5">{formatDuration(totalDriveMins)}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] uppercase text-amber-600 font-semibold flex items-center gap-1"><Timer className="w-3 h-3" /> Idle</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums mt-0.5">{formatDuration(totalIdleMins)}</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-2.5 border border-violet-200">
              <p className="text-[10px] uppercase text-violet-600 font-semibold flex items-center gap-1"><MapPin className="w-3 h-3" /> Stops</p>
              <p className="text-lg font-bold text-violet-700 tabular-nums mt-0.5">{totalStops}</p>
            </div>
          </div>

          {/* Reconciliation summary */}
          {reconciliations.length > 0 && (
            <div className="hub-glass rounded-3xl p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Travel-Hour Reconciliation (GPS vs Timesheet)
              </h4>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-600">{matchCount} matched</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-600">{underClaimedCount} under-claimed</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-slate-600">{unrecordedCount} unrecorded</span>
                </div>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {reconciliations.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded hover:bg-slate-50">
                    <span className="font-mono text-slate-500 w-20">{r.date}</span>
                    <span className="font-semibold text-slate-700 flex-1 truncate">{r.staff_name}</span>
                    <span className="text-slate-500">GPS: {formatDuration(r.gps_drive_mins)}</span>
                    <span className="text-slate-400">vs</span>
                    <span className="text-slate-500">Claimed: {formatDuration(r.claimed_travel_mins)}</span>
                    <span className={`font-bold w-20 text-right ${
                      r.status === 'match' ? 'text-emerald-600' :
                      r.status === 'under_claimed' ? 'text-amber-600' :
                      r.status === 'over_claimed' ? 'text-rose-600' : 'text-rose-600'
                    }`}>
                      {r.variance > 0 ? '+' : ''}{formatDuration(r.variance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day-by-day movement log */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {dayGroups.map((dg) => {
              const isDayOpen = expandedDay === dg.date || (expandedDay === null && dg === dayGroups[0]);
              const recon = reconciliations.find(r => r.date === dg.date);
              return (
                <div key={dg.date} className="hub-glass rounded-3xl overflow-hidden">
                  {/* Day header */}
                  <button
                    onClick={() => setExpandedDay(isDayOpen ? null : dg.date)}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-gradient-to-r from-[#2E5A1A] to-[#4d7c2a] hover:from-[#1c4a12] hover:to-[#3a6b1e] transition text-left"
                  >
                    {isDayOpen ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
                    <Calendar className="w-3.5 h-3.5 text-white/80" />
                    <span className="text-sm font-bold text-white">
                      {formatDateLong(dg.date)}
                    </span>
                    <div className="flex-1" />
                    {/* Daily stats */}
                    <div className="flex items-center gap-2.5 text-[11px] text-white/90">
                      <span className="flex items-center gap-0.5 font-semibold" title="Trips">
                        <Route className="w-3 h-3" />{dg.trips.length}
                      </span>
                      <span className="flex items-center gap-0.5 font-bold" title="Distance">
                        <TrendingDown className="w-3 h-3" />{kmToMi(dg.distance).toFixed(1)}mi
                      </span>
                      <span className="flex items-center gap-0.5 font-semibold" title="Drive time">
                        <Clock className="w-3 h-3" />{formatDuration(dg.duration)}
                      </span>
                      <span className="flex items-center gap-0.5 font-semibold" title="Idle time">
                        <Timer className="w-3 h-3" />{formatDuration(dg.idle)}
                      </span>
                      <span className="flex items-center gap-0.5 font-semibold" title="Stops">
                        <MapPin className="w-3 h-3" />{dg.stops}
                      </span>
                    </div>
                  </button>

                  {/* Day content */}
                  {isDayOpen && (
                    <div className="bg-white">
                      {/* Reconciliation banner for this day */}
                      {recon && (
                        <div className={`px-3 py-2 border-b text-[11px] flex items-center gap-2 ${
                          recon.status === 'match' ? 'bg-emerald-50 border-emerald-100' :
                          recon.status === 'under_claimed' ? 'bg-amber-50 border-amber-100' :
                          recon.status === 'unrecorded' ? 'bg-rose-50 border-rose-100' : 'bg-rose-50 border-rose-100'
                        }`}>
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="font-semibold text-slate-700">{recon.staff_name}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">GPS: <b>{formatDuration(recon.gps_drive_mins)}</b></span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">Claimed: <b>{formatDuration(recon.claimed_travel_mins)}</b></span>
                          <span className="text-slate-400">·</span>
                          <span className={`font-bold ${
                            recon.status === 'match' ? 'text-emerald-600' :
                            recon.status === 'under_claimed' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {recon.status === 'match' ? '✓ Match' :
                             recon.status === 'under_claimed' ? `⚠ Under-claimed (+${formatDuration(recon.variance)})` :
                             recon.status === 'over_claimed' ? `⚠ Over-claimed (${formatDuration(recon.variance)})` :
                             `✗ Unrecorded (+${formatDuration(recon.variance)})`}
                          </span>
                        </div>
                      )}

                      {/* Movement timeline */}
                      <div className="p-3 space-y-2">
                        {dg.trips.map((trip, ti) => {
                          const isTripOpen = expandedTrip === trip.trip_id;
                          return (
                            <div key={trip.trip_id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                              {/* Trip header — movement summary */}
                              <button
                                onClick={() => setExpandedTrip(isTripOpen ? null : trip.trip_id)}
                                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-100 transition text-left"
                              >
                                {isTripOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 mt-1" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-1" />}
                                {/* Time block */}
                                <div className="flex-shrink-0 text-center bg-white rounded-lg px-2 py-1 border border-slate-200 min-w-[60px]">
                                  <p className="text-[10px] text-slate-400 font-semibold">TRIP {ti + 1}</p>
                                  <p className="text-xs font-bold text-slate-700 tabular-nums">{formatTime(trip.start_time)}</p>
                                  <p className="text-[10px] text-slate-400 tabular-nums">→ {formatTime(trip.end_time)}</p>
                                </div>
                                {/* From → To */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Circle className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0 fill-emerald-500" />
                                    <span className="text-slate-700 truncate font-medium">{trip.start_location || 'Resolving...'}</span>
                                    {trip.start_lat != null && (
                                      <a href={`https://www.google.com/maps?q=${trip.start_lat},${trip.start_lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                        className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Flag className="w-2.5 h-2.5 text-rose-500 flex-shrink-0 fill-rose-500" />
                                    <span className="text-slate-700 truncate font-medium">{trip.end_location || 'Resolving...'}</span>
                                    {trip.end_lat != null && (
                                      <a href={`https://www.google.com/maps?q=${trip.end_lat},${trip.end_lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                        className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {/* Quick stats */}
                                <div className="flex flex-col items-end gap-0.5 text-[11px] flex-shrink-0">
                                  <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                                    <TrendingDown className="w-3 h-3" />{kmToMi(trip.distance_km).toFixed(1)}mi
                                  </span>
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <Clock className="w-3 h-3" />{formatDuration(trip.duration_minutes)}
                                  </span>
                                </div>
                              </button>

                              {/* Expanded trip detail */}
                              {isTripOpen && (
                                <div className="px-3 pb-3 pt-1 bg-white space-y-2 border-t border-slate-100">
                                  {/* Stats grid */}
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-100 text-center">
                                      <Gauge className="w-3 h-3 text-cyan-500 mx-auto mb-0.5" />
                                      <p className="text-[9px] uppercase text-cyan-500 font-semibold">Max</p>
                                      <p className="text-sm font-bold text-cyan-700 tabular-nums">{Math.round(kmToMi(trip.max_speed_kph))}mph</p>
                                    </div>
                                    <div className="bg-violet-50 rounded-lg p-2 border border-violet-100 text-center">
                                      <Activity className="w-3 h-3 text-violet-500 mx-auto mb-0.5" />
                                      <p className="text-[9px] uppercase text-violet-500 font-semibold">Avg</p>
                                      <p className="text-sm font-bold text-violet-700 tabular-nums">{Math.round(kmToMi(trip.average_speed_kph || 0))}mph</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 text-center">
                                      <Timer className="w-3 h-3 text-amber-500 mx-auto mb-0.5" />
                                      <p className="text-[9px] uppercase text-amber-500 font-semibold">Idle</p>
                                      <p className="text-sm font-bold text-amber-700 tabular-nums">{formatDuration(trip.idle_minutes)}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-center">
                                      <Car className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
                                      <p className="text-[9px] uppercase text-slate-400 font-semibold">Odo</p>
                                      <p className="text-sm font-bold text-slate-600 tabular-nums">{Math.round(kmToMi(trip.odometer_km || 0)).toLocaleString()}mi</p>
                                    </div>
                                  </div>

                                  {/* Stops timeline */}
                                  {(trip.stops || []).length > 0 && (
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                                      <p className="text-[10px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-amber-500" /> {trip.stops.length} Stop(s)
                                      </p>
                                      <div className="space-y-1">
                                        {trip.stops.map((s, si) => (
                                          <div key={si} className="flex items-center gap-2 text-[11px] py-0.5">
                                            <Square className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                                            <span className="text-slate-700 truncate flex-1">{s.location || 'Resolving...'}</span>
                                            <span className="text-slate-400 font-mono">{formatTime(s.arrival_time)} → {formatTime(s.departure_time)}</span>
                                            <span className="text-amber-600 font-semibold">{formatDuration(s.duration_minutes)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Coordinates */}
                                  {trip.start_lat != null && (
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                                        Start: {trip.start_lat?.toFixed(4)}, {trip.start_lng?.toFixed(4)}
                                      </span>
                                      {trip.end_lat != null && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="w-2.5 h-2.5 text-rose-400" />
                                          End: {trip.end_lat?.toFixed(4)}, {trip.end_lng?.toFixed(4)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}