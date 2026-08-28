import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

// ============================================================
// getRouteComparison — compares a vehicle's actual driven route
// against the Google Maps optimal road route (A→B) and the
// optimized delivery stop-order route.
//
// Payload:
//   { start_lat, start_lng, end_lat, end_lng,
//     driver_staff_id?, date?,
//     actual_distance_km?, actual_duration_min? }
//
// Returns:
//   { google_optimal: { polyline, distance_km, duration_min },
//     optimized_stops: { polyline, stops, distance_km, duration_min } | null,
//     deltas: { distance_km, duration_min } }
// ============================================================

// Decode a Google Maps encoded polyline string into [lat, lng] pairs
function decodePolyline(encoded: string): number[][] {
  const coords: number[][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat * 1e-5, lng * 1e-5]);
  }
  return coords;
}

function getWaypointAddress(delivery: any): string {
  if (delivery.delivery_type === 'supplier_collection') {
    return delivery.pickup_address || '';
  }
  return delivery.delivery_address || '';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { start_lat, start_lng, end_lat, end_lng, driver_staff_id, date } = body;

    if (start_lat == null || start_lng == null || end_lat == null || end_lng == null) {
      return Response.json({ error: 'start_lat, start_lng, end_lat, end_lng are required' }, { status: 400 });
    }

    // Load Google Maps API key
    const mapsConfig = await getAppSettingValue(base44, 'google_maps_config', {});
    const apiKey = mapsConfig.api_key;
    if (!apiKey) {
      return Response.json({ error: 'Google Maps API key not configured. Add it in Settings → Google Maps Platform.' }, { status: 400 });
    }

    const origin = `${start_lat},${start_lng}`;
    const destination = `${end_lat},${end_lng}`;

    // ── 1. Google Maps optimal A→B road route ──
    const optimalUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
    optimalUrl.searchParams.set('origin', origin);
    optimalUrl.searchParams.set('destination', destination);
    optimalUrl.searchParams.set('key', apiKey);

    const optimalRes = await fetch(optimalUrl.toString());
    const optimalData = await optimalRes.json();

    let googleOptimal = null;
    if (optimalData.status === 'OK' && optimalData.routes?.[0]) {
      const route = optimalData.routes[0];
      const polyline = decodePolyline(route.overview_polyline?.points || '');
      const distanceKm = Math.round((route.legs?.[0]?.distance?.value || 0) / 1000 * 10) / 10;
      const durationMin = Math.round((route.legs?.[0]?.duration?.value || 0) / 60);
      googleOptimal = { polyline, distance_km: distanceKm, duration_min: durationMin };
    }

    // ── 2. Optimized delivery stop-order route ──
    let optimizedStops = null;
    if (driver_staff_id && date) {
      const deliveries = await base44.asServiceRole.entities.DeliveryLog.filter({
        driver_staff_id,
        scheduled_date: date,
      });

      const active = deliveries.filter((d: any) => d.status === 'pending' || d.status === 'in_progress' || d.status === 'completed' || d.status === 'delivered');
      const waypoints = active.map((d: any) => ({
        delivery_id: d.id,
        address: getWaypointAddress(d),
        delivery: d,
      })).filter((w: any) => w.address && w.address.trim().length > 0);

      if (waypoints.length >= 2) {
        const stopOrigin = waypoints[0].address;
        const stopDest = waypoints[waypoints.length - 1].address;
        const middleWps = waypoints.slice(1, -1).map((w: any) => w.address);

        const stopsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
        stopsUrl.searchParams.set('origin', stopOrigin);
        stopsUrl.searchParams.set('destination', stopDest);
        stopsUrl.searchParams.set('key', apiKey);
        if (middleWps.length > 0) {
          stopsUrl.searchParams.set('waypoints', `optimize:true|${middleWps.join('|')}`);
        }

        const stopsRes = await fetch(stopsUrl.toString());
        const stopsData = await stopsRes.json();

        if (stopsData.status === 'OK' && stopsData.routes?.[0]) {
          const route = stopsData.routes[0];
          const polyline = decodePolyline(route.overview_polyline?.points || '');
          const waypointOrder = route.waypoint_order || [];
          const orderedIndices = [0];
          for (const wpIdx of waypointOrder) {
            orderedIndices.push(wpIdx + 1);
          }
          orderedIndices.push(waypoints.length - 1);

          const legs = route.legs || [];
          const stops: any[] = [];
          let totalDistanceKm = 0;
          let totalDurationMin = 0;

          for (let i = 0; i < orderedIndices.length; i++) {
            const wp = waypoints[orderedIndices[i]];
            const leg = legs[i];
            const stopLat = leg?.start_location?.lat ?? null;
            const stopLng = leg?.start_location?.lng ?? null;
            stops.push({
              sequence: i + 1,
              address: wp.address,
              job_name: wp.delivery.job_name || null,
              delivery_type: wp.delivery.delivery_type || null,
              lat: stopLat,
              lng: stopLng,
            });
            if (leg) {
              totalDistanceKm += (leg.distance?.value || 0) / 1000;
              totalDurationMin += (leg.duration?.value || 0) / 60;
            }
          }

          optimizedStops = {
            polyline,
            stops,
            distance_km: Math.round(totalDistanceKm * 10) / 10,
            duration_min: Math.round(totalDurationMin),
          };
        }
      }
    }

    // ── 3. Deltas (actual vs google optimal) ──
    const actualDistanceKm = body.actual_distance_km != null ? Number(body.actual_distance_km) : null;
    const actualDurationMin = body.actual_duration_min != null ? Number(body.actual_duration_min) : null;
    const deltas: any = {};
    if (actualDistanceKm != null && googleOptimal) {
      deltas.distance_km = Math.round((actualDistanceKm - googleOptimal.distance_km) * 10) / 10;
    }
    if (actualDurationMin != null && googleOptimal) {
      deltas.duration_min = Math.round(actualDurationMin - googleOptimal.duration_min);
    }

    return Response.json({
      ok: true,
      google_optimal: googleOptimal,
      optimized_stops: optimizedStops,
      deltas,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Failed to fetch route comparison' }, { status: 500 });
  }
}