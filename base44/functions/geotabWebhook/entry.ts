import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkGeofencePresence, loadGeofenceConfig } from '../../shared/geofence.ts';

// ============================================================
// geotabWebhook — receives real-time vehicle location events
// pushed from Geotab (or a middleware bridge).
// ============================================================
// Validates the shared webhook secret, matches the incoming
// registration_number to a local Vehicle record, and stores a
// VehicleLocationLog entry. This enables live fleet tracking
// on the Vehicles page without polling.
//
// The webhook secret is stored in AppSetting key 'geotab_config'
// under `webhook_secret`. It can be passed as:
//   - query param: ?webhook_secret=xxx
//   - header: x-webhook-secret: xxx
//
// Expected JSON body (flexible — adapts to common Geotab push formats):
//   { registration_number, lat, lng, speed_kph, heading, ignition_on,
//     odometer_km, driver_name, timestamp, device_id }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // ── Authenticate the webhook ──
    const url = new URL(req.url);
    const headerSecret = req.headers.get('x-webhook-secret') || req.headers.get('X-Webhook-Secret');
    const querySecret = url.searchParams.get('webhook_secret');
    const providedSecret = headerSecret || querySecret;

    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
    const cfg = settings[0]?.value || {};
    const expectedSecret = cfg.webhook_secret;

    // Reject all requests when the webhook secret is unconfigured — an empty
    // secret must never be treated as "no auth required" (open door).
    if (!expectedSecret) {
      return Response.json({ error: 'Webhook secret not configured — set geotab_config.webhook_secret before accepting events' }, { status: 503 });
    }
    if (providedSecret !== expectedSecret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    // ── Parse the payload ──
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 });

    // Support both single-event and batch (array) payloads
    const events = Array.isArray(body) ? body : [body];
    const stored: any[] = [];
    const unmatched: any[] = [];

    // Load all vehicles once for registration matching
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const regMap: Record<string, any> = {};
    for (const v of vehicles) {
      if (v.registration_number) {
        regMap[v.registration_number.toUpperCase().replace(/\s+/g, '')] = v;
      }
    }

    // Load geofence config once — used for all events in this batch
    const { config: geofenceConfig } = await loadGeofenceConfig(base44);
    let totalGeofenceArrivals = 0;
    let totalGeofenceDepartures = 0;
    let totalAutoArrivals = 0;

    for (const evt of events) {
      const reg = (evt.registration_number || evt.plate || evt.vehicle || '').toString().toUpperCase().replace(/\s+/g, '');
      const lat = Number(evt.lat || evt.latitude);
      const lng = Number(evt.lng || evt.longitude || evt.lon || evt.longitude);
      const ts = evt.timestamp || evt.dateTime || evt.deviceTime || new Date().toISOString();

      if (!reg || isNaN(lat) || isNaN(lng)) {
        unmatched.push({ reason: 'missing_fields', registration: reg });
        continue;
      }

      const vehicle = regMap[reg];
      if (!vehicle) {
        unmatched.push({ reason: 'no_vehicle_match', registration: reg });
        continue;
      }

      const log = await base44.asServiceRole.entities.VehicleLocationLog.create({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        vehicle_name: vehicle.name,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        speed_kph: Number(evt.speed_kph || evt.speed) || 0,
        heading: Number(evt.heading || evt.bearing) || 0,
        ignition_on: evt.ignition_on !== undefined ? !!evt.ignition_on : (evt.ignition !== undefined ? !!evt.ignition : false),
        odometer_km: Number(evt.odometer_km || evt.odometer) || 0,
        driver_name: evt.driver_name || evt.driver || '',
        timestamp: ts,
        source: 'geotab_webhook',
        geotab_device_id: evt.device_id || evt.geotab_device_id || '',
      });
      stored.push(log.id);

      // ── Geofence check — detect arrival/departure at job sites & supplier yards ──
      try {
        const geoResult = await checkGeofencePresence(
          base44,
          vehicle.id,
          vehicle.name,
          vehicle.registration_number || '',
          lat,
          lng,
          ts,
          geofenceConfig,
        );
        totalGeofenceArrivals += geoResult.arrivals;
        totalGeofenceDepartures += geoResult.departures;
        totalAutoArrivals += geoResult.autoArrivals;
      } catch (_) {
        // geofence check failure should not break the webhook
      }
    }

    // Update last-webhook metadata on the config
    if (settings[0]) {
      try {
        await base44.asServiceRole.entities.AppSetting.update(settings[0].id, {
          value: {
            ...cfg,
            last_webhook_at: new Date().toISOString(),
            last_webhook_status: 'ok',
            last_webhook_summary: `${stored.length} location(s) stored, ${unmatched.length} unmatched`,
          },
        });
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      received: events.length,
      stored: stored.length,
      unmatched: unmatched.length,
      unmatched_details: unmatched.slice(0, 10),
      geofence: {
        arrivals: totalGeofenceArrivals,
        departures: totalGeofenceDepartures,
        auto_arrivals: totalAutoArrivals,
      },
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}