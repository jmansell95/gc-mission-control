import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getVehicleLocationHistory — returns location data for reports
// and the live map on the Vehicles page.
// ============================================================
// Payload:
//   { mode: "live" | "history" | "report" | "geotab_history",
//     vehicle_id?: string,
//     registration_number?: string,
//     from_date?: string (ISO),
//     to_date?: string (ISO),
//     limit?: number }
//
// "live"           → latest reading per vehicle (for the map view)
// "history"        → all cached readings for one vehicle (timeline)
// "report"         → aggregated trip/distance summary per vehicle
// "geotab_history" → pulls trip history DIRECTLY from Geotab API
//                    by registration number (not cached data)

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'live';
    const limit = Math.min(Number(body.limit) || 500, 2000);

    // Load all vehicles for display enrichment
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const vehicleMap: Record<string, any> = {};
    for (const v of vehicles) vehicleMap[v.id] = v;

    // ── GEOTAB DIRECT HISTORY MODE ──
    // Pulls trip history directly from the Geotab API (not cached data).
    // Matches the vehicle by registration number or vehicle_id, then
    // queries Geotab's Trip endpoint for the date range.
    if (mode === 'geotab_history') {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
      const cfg = settings[0]?.value || {};
      if (!cfg.username || !cfg.password || !cfg.database) {
        return Response.json({ ok: false, error: 'Geotab credentials not configured. Add them in Settings → Geotab GPS Sync.' });
      }

      // Find the vehicle by reg or vehicle_id
      let vehicle: any = null;
      if (body.vehicle_id) {
        vehicle = vehicleMap[body.vehicle_id];
      } else if (body.registration_number) {
        const regNorm = body.registration_number.toUpperCase().replace(/\s+/g, '');
        vehicle = vehicles.find((v: any) => (v.registration_number || '').toUpperCase().replace(/\s+/g, '') === regNorm);
      }
      if (!vehicle) {
        return Response.json({ ok: false, error: 'Vehicle not found. Provide a valid vehicle_id or registration_number.' });
      }
      if (!vehicle.geotab_device_id) {
        return Response.json({ ok: false, error: 'This vehicle has no Geotab device linked. Sync from Geotab first.' });
      }

      const server = cfg.server || 'my.geotab.com';
      const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;

      // Authenticate — with a 5s timeout so slow Geotab responses don't
      // block the entire trip history request.
      const authController = new AbortController();
      const authTimeout = setTimeout(() => authController.abort(), 5000);
      const authRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: { userName: cfg.username, password: cfg.password, database: cfg.database },
        }),
        signal: authController.signal,
      }).catch(() => null);
      clearTimeout(authTimeout);

      if (!authRes || !authRes.ok) {
        return Response.json({ ok: false, error: 'Geotab authentication failed' });
      }
      const authJson = await authRes.json().catch(() => null);
      const creds: GeotabCredentials | null = authJson?.result?.credentials || null;
      if (!creds?.sessionId) {
        return Response.json({ ok: false, error: 'Geotab authentication returned no session' });
      }

      // Build date range (default: last 7 days)
      const toDate = body.to_date ? new Date(body.to_date) : new Date();
      const fromDate = body.from_date ? new Date(body.from_date) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch Trip records from Geotab
      const tripRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: {
            typeName: 'Trip',
            credentials: creds,
            search: {
              deviceSearch: { id: vehicle.geotab_device_id },
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString(),
            },
            resultsLimit: Math.min(limit, 500),
          },
        }),
      }).catch(() => null);

      const tripJson = tripRes ? await tripRes.json().catch(() => null) : null;
      const trips: any[] = Array.isArray(tripJson?.result) ? tripJson.result : [];

      // Fetch LogRecord breadcrumbs ONLY for days that contain trips. Fetching
      // all logs for a 7-day range requires 7 Geotab API calls (~17s each =
      // 2+ minutes). By extracting the unique trip dates first and fetching
      // logs only for those days, we cut the number of API calls from 7 to
      // typically 2-3, reducing total time from 2+ minutes to ~30-45 seconds.
      const logs: any[] = [];
      const dayMs = 24 * 60 * 60 * 1000;
      const tripDays = new Set<string>();
      for (const t of trips) {
        if (t.start) tripDays.add(new Date(t.start).toISOString().slice(0, 10));
        if (t.stop) tripDays.add(new Date(t.stop).toISOString().slice(0, 10));
      }
      // Fetch all trip-day LogRecords in PARALLEL — previously sequential
      // (N days × ~17s each = 2+ minutes for a 7-day range). Parallel cuts
      // total time to ~17-20s regardless of day count.
      const dayFetches = [...tripDays].map(async (dayStr) => {
        const dayStart = new Date(dayStr + 'T00:00:00.000Z');
        const dayEnd = new Date(Math.min(dayStart.getTime() + dayMs, toDate.getTime()));
        // Per-day 10s timeout — if one day's LogRecord fetch hangs, we still
        // get the rest of the days' data instead of blocking the whole request.
        const dayController = new AbortController();
        const dayTimeout = setTimeout(() => dayController.abort(), 10000);
        const logRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'Get',
            params: {
              typeName: 'LogRecord',
              credentials: creds,
              search: {
                deviceSearch: { id: vehicle.geotab_device_id },
                fromDate: dayStart.toISOString(),
                toDate: dayEnd.toISOString(),
              },
              resultsLimit: 5000,
            },
          }),
          signal: dayController.signal,
        }).catch(() => null);
        clearTimeout(dayTimeout);
        const logJson = logRes ? await logRes.json().catch(() => null) : null;
        return Array.isArray(logJson?.result) ? logJson.result : [];
      });
      const dayResults = await Promise.all(dayFetches);
      for (const dayLogs of dayResults) logs.push(...dayLogs);

      // Format log breadcrumbs (defined first — trips reference these for coordinates)
      const formattedLogs = logs.map((l: any) => ({
        lat: l.latitude ? Number(l.latitude) : null,
        lng: l.longitude ? Number(l.longitude) : null,
        speed_kph: l.speed ? Math.round(Number(l.speed)) : 0,
        heading: l.heading ? Number(l.heading) : 0,
        timestamp: l.dateTime,
      })).filter((l: any) => l.lat !== null && l.lng !== null)
         .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

      // Parse Geotab duration: either a time string "HH:MM:SS.fffffff" or milliseconds
      function parseDuration(val: any): number {
        if (val == null) return 0;
        if (typeof val === 'number') return Math.round(val / 60000);
        const s = String(val);
        const parts = s.split(':');
        if (parts.length < 3) return 0;
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const sec = parseFloat(parts[2]) || 0;
        return Math.round(h * 60 + m + sec / 60);
      }

      const sortedLogs = formattedLogs;

      // Format trips — Geotab Trip fields (verified from live API):
      //   distance: KILOMETERS (not meters!)
      //   drivingDuration: time string "HH:MM:SS.fffffff" (not ms)
      //   idlingDuration: time string
      //   maximumSpeed: km/h (not maxSpeed)
      //   odometer: meters
      //   No startPoint/endPoint — coordinates come from LogRecord breadcrumbs
      // Reverse geocoding is handled by the FRONTEND (TripTimelineEnhanced.jsx)
      // using BigDataCloud, which works reliably in the browser but fails
      // intermittently in the edge runtime. Returning raw coordinates here
      // and letting the frontend geocode them avoids 2+ minute timeouts on
      // 7-day ranges (one geocode call per trip endpoint that mostly fails).

      // Detect stops within a trip — periods where speed = 0 for >= 2 minutes.
      // Returns an array of stop events with location, duration, and arrival/departure times.
      function detectStops(crumbs: any[], tripStart: string, tripEnd: string): any[] {
        const stops: any[] = [];
        let stopStart: any = null;
        for (let i = 0; i < crumbs.length; i++) {
          const crumb = crumbs[i];
          const isStopped = (crumb.speed_kph || 0) === 0;
          if (isStopped && !stopStart) {
            stopStart = crumb;
          } else if (!isStopped && stopStart) {
            const durationMs = new Date(crumb.timestamp).getTime() - new Date(stopStart.timestamp).getTime();
            if (durationMs >= 120000) { // 2+ minutes = a real stop
              stops.push({
                lat: stopStart.lat,
                lng: stopStart.lng,
                arrival_time: stopStart.timestamp,
                departure_time: crumb.timestamp,
                duration_minutes: Math.round(durationMs / 60000),
              });
            }
            stopStart = null;
          }
        }
        // Handle a stop at the end of the trip
        if (stopStart) {
          const durationMs = new Date(tripEnd).getTime() - new Date(stopStart.timestamp).getTime();
          if (durationMs >= 120000) {
            stops.push({
              lat: stopStart.lat,
              lng: stopStart.lng,
              arrival_time: stopStart.timestamp,
              departure_time: tripEnd,
              duration_minutes: Math.round(durationMs / 60000),
            });
          }
        }
        return stops;
      }

      // Format trips with stop detection + reverse geocoding for start/end/stops.
      // Geocoding is limited to the first/last point + detected stops to keep
      // the request count reasonable (Nominatim rate-limits to 1 req/sec).
      // A small delay is added between geocode calls to respect the rate limit.
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const formattedTrips: any[] = [];
      for (const t of trips) {
        const startTime = t.start;
        const endTime = t.stop;
        // Widen the breadcrumb filter by 60 seconds on each side to catch
        // logs that fall just outside the trip's official start/stop times
        // (Geotab timestamps can differ by a few seconds between Trip and LogRecord).
        const startMinus = new Date(new Date(startTime).getTime() - 60000).toISOString();
        const endPlus = new Date(new Date(endTime).getTime() + 60000).toISOString();
        let tripCrumbs = sortedLogs.filter(b => {
          const ts = b.timestamp;
          return ts >= startMinus && ts <= endPlus;
        });
        // Fallback: if still no crumbs, find the nearest logs to the trip
        // start AND end times independently. Geotab Trip records don't
        // contain coordinates — they come from LogRecord breadcrumbs. If
        // the breadcrumb timestamps don't fall within the trip window
        // (common for short trips or sparse logging), we grab the closest
        // breadcrumb to each endpoint so we still get start/end locations.
        if (tripCrumbs.length === 0 && sortedLogs.length > 0) {
          let nearestStart = null;
          let minDiffStart = Infinity;
          let nearestEnd = null;
          let minDiffEnd = Infinity;
          for (const l of sortedLogs) {
            const ts = new Date(l.timestamp).getTime();
            const diffStart = Math.abs(ts - new Date(startTime).getTime());
            const diffEnd = Math.abs(ts - new Date(endTime).getTime());
            if (diffStart < minDiffStart) { minDiffStart = diffStart; nearestStart = l; }
            if (diffEnd < minDiffEnd) { minDiffEnd = diffEnd; nearestEnd = l; }
          }
          // Use if within 10 minutes of the respective endpoint
          if (nearestStart && minDiffStart < 10 * 60 * 1000) {
            if (nearestEnd && nearestEnd !== nearestStart && minDiffEnd < 10 * 60 * 1000) {
              tripCrumbs = [nearestStart, nearestEnd];
            } else {
              tripCrumbs = [nearestStart];
            }
          }
        }
        const startCrumb = tripCrumbs[0];
        const endCrumb = tripCrumbs.length > 1 ? tripCrumbs[tripCrumbs.length - 1] : tripCrumbs[0];

        // Detect stops within the trip
        const stops = detectStops(tripCrumbs, startTime, endTime);

        // Geocoding is handled by the frontend — return raw coordinates only.
        // The frontend (TripTimelineEnhanced) geocodes via BigDataCloud in the
        // browser where it works reliably, replacing "Unknown location" labels.
        formattedTrips.push({
          trip_id: t.id,
          start_time: startTime,
          end_time: endTime,
          start_lat: startCrumb?.lat ?? null,
          start_lng: startCrumb?.lng ?? null,
          end_lat: endCrumb?.lat ?? null,
          end_lng: endCrumb?.lng ?? null,
          start_location: '',
          end_location: '',
          stops: stops.map(s => ({ ...s, location: '' })),
          stop_count: stops.length,
          distance_km: t.distance != null ? Number(t.distance) : 0,
          duration_minutes: parseDuration(t.drivingDuration),
          max_speed_kph: t.maximumSpeed != null ? Math.round(Number(t.maximumSpeed)) : (t.maxSpeed != null ? Math.round(Number(t.maxSpeed)) : 0),
          idle_minutes: parseDuration(t.idlingDuration),
          odometer_km: t.odometer != null ? Number(t.odometer) / 1000 : null,
          average_speed_kph: t.averageSpeed != null ? Math.round(Number(t.averageSpeed)) : null,
        });
      }
      formattedTrips.sort((a, b) => (b.start_time || '').localeCompare(a.start_time || ''));

      return Response.json({
        ok: true,
        mode: 'geotab_history',
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        vehicle_name: vehicle.name,
        date_range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        trips: formattedTrips,
        trip_count: formattedTrips.length,
        breadcrumbs: formattedLogs,
        breadcrumb_count: formattedLogs.length,
        total_distance_km: formattedTrips.reduce((sum: number, t: any) => sum + (t.distance_km || 0), 0),
      });
    }

    if (mode === 'live' || mode === 'live_fast') {
      // Get the latest location log per vehicle (cached)
      const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', limit);
      const latestByVehicle: Record<string, any> = {};
      for (const log of allLogs) {
        const vid = log.vehicle_id;
        if (!vid) continue;
        if (!latestByVehicle[vid] || (log.timestamp || '') > (latestByVehicle[vid].timestamp || '')) {
          latestByVehicle[vid] = log;
        }
      }

      // live_fast skips the Geotab API overlay call (which adds 2-5s latency)
      // and returns cached logs instantly. The full "live" mode overlays
      // fresh driving/ignition status from Geotab for real-time accuracy.
      let freshStatusByDeviceId: Record<string, any> = {};
      if (mode === 'live' || mode === 'live_fast') {
        // ── FRESH GEOTAB STATUS OVERLAY ──
        // Cached logs can be stale (sync runs every few minutes). Fetch the
        // current driving/ignition status directly from Geotab in a single
        // DeviceStatusInfo API call so the fleet map reflects reality right now.
        try {
          const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
          const cfg = settings[0]?.value || {};
          if (cfg.username && cfg.password && cfg.database) {
            const server = cfg.server || 'my.geotab.com';
            const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;
            // 4s timeout on the Geotab auth call — if Geotab is slow or
            // unreachable, we skip the fresh status overlay and return
            // cached logs instantly so the live map always loads fast.
            const liveAuthController = new AbortController();
            const liveAuthTimeout = setTimeout(() => liveAuthController.abort(), mode === 'live_fast' ? 3000 : 4000);
            const authRes = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method: 'Authenticate',
                params: { userName: cfg.username, password: cfg.password, database: cfg.database },
              }),
              signal: liveAuthController.signal,
            });
            clearTimeout(liveAuthTimeout);
            const authJson = authRes.ok ? await authRes.json().catch(() => null) : null;
            const creds = authJson?.result?.credentials;
            if (creds?.sessionId) {
              const statusController = new AbortController();
              const statusTimeout = setTimeout(() => statusController.abort(), mode === 'live_fast' ? 3000 : 4000);
              const statusRes = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  method: 'Get',
                  params: {
                    typeName: 'DeviceStatusInfo',
                    credentials: creds,
                    resultsLimit: 500,
                  },
                }),
                signal: statusController.signal,
              });
              clearTimeout(statusTimeout);
              const statusJson = statusRes.ok ? await statusRes.json().catch(() => null) : null;
              const statusList: any[] = Array.isArray(statusJson?.result) ? statusJson.result : [];
              for (const s of statusList) {
                const devId = s.device?.id;
                if (!devId) continue;
                freshStatusByDeviceId[devId] = {
                  isDriving: !!s.isDriving,
                  isIgnitionOn: s.isDriving || (s.engineState === 'on') || false,
                  lat: s.latitude ? Number(s.latitude) : null,
                  lng: s.longitude ? Number(s.longitude) : null,
                  speed: s.speed ? Number(s.speed) : 0,
                  heading: s.heading ? Number(s.heading) : 0,
                  timestamp: s.dateTime || null,
                };
              }
            }
          }
        } catch (_) {
          // Geotab overlay is best-effort — fall back to cached logs silently
        }
      }

      // Build results from cached logs, enriching with fresh Geotab status
      const results = Object.values(latestByVehicle).map((log: any) => {
        const vehicle = vehicleMap[log.vehicle_id];
        const fresh = vehicle?.geotab_device_id ? freshStatusByDeviceId[vehicle.geotab_device_id] : null;
        const ignition_on = fresh?.isDriving ? true : (fresh?.isIgnitionOn ?? log.ignition_on);
        const speed_kph = fresh?.isDriving ? Math.max(log.speed_kph || 0, 5) : (fresh?.speed || log.speed_kph);
        // Use fresh Geotab position if the cached log is stale (>1h old) or missing lat/lng
        const logTime = log.timestamp ? new Date(log.timestamp).getTime() : 0;
        const isStale = Date.now() - logTime > 60 * 60 * 1000;
        const useFreshPos = fresh && (isStale || (log.lat == null || log.lng == null)) && fresh.lat != null && fresh.lng != null;
        return {
          vehicle_id: log.vehicle_id,
          registration_number: log.registration_number || vehicle?.registration_number || vehicle?.name || '',
          vehicle_name: log.vehicle_name || vehicle?.name || '',
          lat: useFreshPos ? fresh.lat : log.lat,
          lng: useFreshPos ? fresh.lng : log.lng,
          speed_kph,
          heading: fresh?.heading || log.heading,
          ignition_on,
          odometer_km: log.odometer_km,
          driver_name: log.driver_name,
          timestamp: useFreshPos && fresh.timestamp ? fresh.timestamp : log.timestamp,
          is_driving_now: fresh?.isDriving || false,
        };
      });

      // Also include Geotab-synced vehicles that have NO cached logs at all.
      // These vehicles have a geotab_device_id but no VehicleLocationLog entries,
      // so they never appeared on the live map. Use DeviceStatusInfo for position
      // if available; otherwise include with null position (shows in sidebar, not on map).
      const existingVids = new Set(results.map((r: any) => r.vehicle_id));
      for (const v of vehicles) {
        if (!v.geotab_device_id || v.geotab_sync_status !== 'synced') continue;
        if (existingVids.has(v.id)) continue;
        const fresh = freshStatusByDeviceId[v.geotab_device_id];
        results.push({
          vehicle_id: v.id,
          registration_number: v.registration_number || v.name || '',
          vehicle_name: v.name || '',
          lat: fresh?.lat ?? null,
          lng: fresh?.lng ?? null,
          speed_kph: fresh?.speed || 0,
          heading: fresh?.heading || 0,
          ignition_on: fresh?.isIgnitionOn ?? false,
          odometer_km: null,
          driver_name: v.geotab_keeper_name || v.geotab_driver_name || null,
          timestamp: fresh?.timestamp || null,
          is_driving_now: fresh?.isDriving || false,
        });
      }
      return Response.json({ ok: true, mode, count: results.length, vehicles: results });
    }

    if (mode === 'history') {
      const vehicleId = body.vehicle_id;
      if (!vehicleId) return Response.json({ error: 'vehicle_id is required for history mode' }, { status: 400 });
      const fromDate = body.from_date;
      const toDate = body.to_date;

      let logs: any[];
      if (fromDate && toDate) {
        logs = await base44.asServiceRole.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', limit);
        logs = logs.filter(l => l.timestamp >= fromDate && l.timestamp <= toDate);
      } else {
        logs = await base44.asServiceRole.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', limit);
      }
      return Response.json({
        ok: true,
        mode: 'history',
        vehicle_id: vehicleId,
        registration_number: logs[0]?.registration_number || '',
        count: logs.length,
        points: logs.map(l => ({
          lat: l.lat, lng: l.lng, speed_kph: l.speed_kph, heading: l.heading,
          ignition_on: l.ignition_on, odometer_km: l.odometer_km, driver_name: l.driver_name,
          timestamp: l.timestamp,
        })),
      });
    }

    if (mode === 'report') {
      const fromDate = body.from_date;
      const toDate = body.to_date;
      const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', limit);
      // Filter by date range server-side when provided
      const dateFiltered = allLogs.filter((l: any) => {
        const ts = l.timestamp || '';
        if (fromDate && ts < fromDate) return false;
        if (toDate && ts > toDate + 'T23:59:59') return false;
        return true;
      });
      const byVehicle: Record<string, any[]> = {};
      for (const log of dateFiltered) {
        const vid = log.vehicle_id || log.registration_number;
        if (!byVehicle[vid]) byVehicle[vid] = [];
        byVehicle[vid].push(log);
      }

      const report = Object.entries(byVehicle).map(([vid, logs]) => {
        const sorted = logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        const latest = sorted[0];
        const first = sorted[sorted.length - 1];
        const distanceKm = (Number(latest.odometer_km) || 0) - (Number(first.odometer_km) || 0);
        return {
          vehicle_id: latest.vehicle_id || vid,
          registration_number: latest.registration_number,
          vehicle_name: latest.vehicle_name || vehicleMap[latest.vehicle_id]?.name || '',
          total_readings: logs.length,
          first_seen: first.timestamp,
          last_seen: latest.timestamp,
          last_lat: latest.lat,
          last_lng: latest.lng,
          last_speed_kph: latest.speed_kph,
          last_ignition_on: latest.ignition_on,
          last_driver_name: latest.driver_name,
          distance_km: Math.max(0, Math.round(distanceKm * 100) / 100),
        };
      });

      return Response.json({ ok: true, mode: 'report', count: report.length, vehicles: report });
    }

    return Response.json({ error: 'Invalid mode. Use "live", "history", "report" or "geotab_history".' }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}