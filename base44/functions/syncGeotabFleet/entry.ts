import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decodeVin } from '../../shared/vinDecoder.ts';
import { checkGeofencePresence, loadGeofenceConfig } from '../../shared/geofence.ts';
import { getAppSetting } from '../../shared/appSettings.ts';

// ============================================================
// syncGeotabFleet — pulls live vehicle locations AND full
// vehicle details (make, model, VIN, year, fuel type) from the
// Geotab API. Auto-creates Vehicle records for any Geotab
// device that doesn't match an existing local record, and
// updates the details on matched records.
// ============================================================
// Geotab uses a JSON-RPC API. Authentication:
//   POST https://<server>.geotab.com/apiv1
//   { method: "Authenticate", params: { username, password, database } }
//   → returns credentials { sessionId, userName, database }
//
// Device (typeName: "Device") — the vehicle record in Geotab:
//   { id, name, licensePlate, vehicleIdentificationNumber,
//     serialNumber, comment, vehicleType: {id}, ... }
//
// VehicleType (typeName: "VehicleType") — make/model/year info:
//   { id, name, make, model, year, fuelType, ... }
//
// DeviceStatusInfo — live GPS position for a device.
//
// Config is stored in AppSetting key 'geotab_config'.

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

function normalizeReg(reg: string): string {
  return (reg || '').toString().toUpperCase().replace(/\s+/g, '');
}

function mapFuelType(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return 'unknown';
  const s = String(raw).toLowerCase();
  if (s.includes('diesel')) return 'diesel';
  if (s.includes('petrol') || s.includes('gasoline')) return 'petrol';
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('electric') || s.includes('ev')) return 'electric';
  if (s.includes('lpg')) return 'lpg';
  if (s.includes('cng')) return 'cng';
  return 'unknown';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync';
    const divisionId = body.division_id || null;

    // Load config — division-scoped when a division_id is passed (manual sync
    // from the settings page), global fallback for scheduled automations.
    const configRec = await getAppSetting(base44, 'geotab_config', divisionId);
    const cfg = configRec?.value || {};

    if (action === 'scheduled' && cfg.auto_sync_enabled === false) {
      return Response.json({ ok: true, skipped: true, reason: 'geotab auto-sync disabled' });
    }

    if (!cfg.username || !cfg.password || !cfg.database) {
      return Response.json({ ok: false, error: 'Geotab credentials not configured. Add them in Settings → Geotab GPS Sync.' });
    }

    const server = cfg.server || 'my.geotab.com';
    const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;

    // ── Authenticate with Geotab ──
    // Geotab's API uses "userName" (camelCase), NOT "username".
    // The server can be auto-discovered: if authentication against the default
    // server fails with IncorrectServerException, Geotab returns the correct
    // server name in the error data. We retry against that server automatically.
    const serverHint = cfg.server || 'my.geotab.com';

    async function authenticate(server: string): Promise<{ creds?: GeotabCredentials; error?: string; redirectServer?: string }> {
      const url = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: {
            userName: cfg.username,
            password: cfg.password,
            database: cfg.database,
          },
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        const errText = res ? await res.text().catch(() => '') : 'Network error';
        return { error: `Geotab authentication failed: ${errText.slice(0, 200)}` };
      }

      const json = await res.json().catch(() => null);
      if (json?.error) {
        const errMsg = json.error.message || JSON.stringify(json.error);
        // IncorrectServerException → Geotab tells us the correct server
        if (json.error.data?.errors?.some((e: any) => e.name === 'IncorrectServerException') || /IncorrectServer/i.test(errMsg)) {
          // The correct server is sometimes in the error message or data
          const redirect = json.error.data?.path || '';
          if (redirect) return { error: errMsg, redirectServer: redirect };
        }
        return { error: errMsg };
      }
      // Geotab's Authenticate returns a LoginResult: { credentials: { sessionId, database, userName }, path }
      // The "credentials" nested object is what we pass to subsequent API calls.
      const loginResult = json?.result;
      const creds: GeotabCredentials | null = loginResult?.credentials || null;
      if (!creds || !creds.sessionId) {
        return { error: 'Authentication returned no session. Check username, password and database.' };
      }
      return { creds };
    }

    let authResult = await authenticate(serverHint);

    // If the server was wrong and Geotab returned a redirect, retry on the correct server
    if (!authResult.creds && authResult.redirectServer && authResult.redirectServer !== serverHint) {
      authResult = await authenticate(authResult.redirectServer);
      // If the redirect worked, persist the correct server so future syncs skip the redirect
      if (authResult.creds && configRec) {
        try {
          await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
            value: { ...cfg, server: authResult.redirectServer },
          });
        } catch (_) {}
      }
    }

    if (!authResult.creds) {
      return Response.json({ ok: false, error: authResult.error || 'Geotab authentication failed' });
    }
    const creds: GeotabCredentials = authResult.creds;

    if (action === 'test') {
      return Response.json({ ok: true, message: `Connected to Geotab (${cfg.database}) as ${creds.userName}. Session active.` });
    }

    // ── List Geotab groups — used by the settings UI to pick which group to sync ──
    if (action === 'list_groups') {
      const groupRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: { typeName: 'Group', credentials: creds, resultsLimit: 500 },
        }),
      }).catch(() => null);
      const groupJson = groupRes ? await groupRes.json().catch(() => null) : null;
      const groups: any[] = Array.isArray(groupJson?.result) ? groupJson.result : [];
      return Response.json({
        ok: true,
        groups: groups.map((g: any) => ({ id: g.id, name: g.name, color: g.color || '' }))
          .filter((g: any) => g.name)
          .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')),
      });
    }

    // ── Diagnostic mode — returns raw API responses to find where driver
    //    assignments are stored in the Geotab account ──
    if (action === 'diagnose') {
      async function rawGet(typeName: string, search?: any, limit = 5): Promise<any> {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'Get', params: { typeName, credentials: creds, search, resultsLimit: limit } }),
        }).catch(() => null);
        if (!res) return { error: 'Network error' };
        const json = await res.json().catch(() => null);
        if (json?.error) return { error: json.error.message || JSON.stringify(json.error) };
        return { count: Array.isArray(json?.result) ? json.result.length : 0, samples: (json?.result || []).slice(0, 3) };
      }
      const [driverRaw, statusRaw, tripRaw, deviceRaw] = await Promise.all([
        rawGet('User', undefined, 10),
        rawGet('DeviceStatusInfo', undefined, 5),
        rawGet('Trip', { fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }, 5),
        rawGet('Device', undefined, 3),
      ]);
      return Response.json({ ok: true, diagnose: { driver: driverRaw, deviceStatusInfo: statusRaw, trip: tripRaw, device: deviceRaw } });
    }

    // ── Fetch all data from Geotab in parallel ──
    // All 6 calls are independent (they only need credentials, not each other's
    // results), so we fire them all at once via Promise.all. This cuts total sync
    // time from ~10s (sequential) to ~3-4s (parallel), avoiding frontend timeouts.
    const groupFilterIds: string[] = []
      .concat(cfg.group_filter_ids || [])
      .concat(cfg.group_filter_id ? [cfg.group_filter_id] : [])
      .filter((id: string, i: number, arr: string[]) => id && arr.indexOf(id) === i);

    const tripFromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const safetyFromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    async function geotabGet(typeName: string, search?: any, resultsLimit = 1000): Promise<any[]> {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: { typeName, credentials: creds, search, resultsLimit },
        }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      return Array.isArray(json?.result) ? json.result : [];
    }

    // Trimmed from 7 calls to 6: dropped Rule (categorise exceptions by name
    // from the ExceptionEvent's embedded rule name), reduced Trip to 500 and
    // ExceptionEvent to 2000 for faster sync. Added Group for Drilling auto-detection.
    const [allDevices, vehicleTypeList, statuses, allTrips, exceptions, driverList, allGroups] = await Promise.all([
      geotabGet('Device', undefined, 1000),
      geotabGet('VehicleType', undefined, 1000),
      geotabGet('DeviceStatusInfo', undefined, 1000),
      geotabGet('Trip', { fromDate: tripFromDate }, 500),
      geotabGet('ExceptionEvent', { fromDate: safetyFromDate }, 2000),
      geotabGet('User', undefined, 1000),
      geotabGet('Group', undefined, 500),
    ]);

    // Build driver name lookup + keeper map from User entities.
    // Geotab uses 'User' (not 'Driver') — the API rejects typeName 'Driver'.
    // User.defaultDevice links a driver to their primary vehicle (the keeper).
    // driverNameById resolves the driver ID objects in DeviceStatusInfo/Trip
    // to human-readable names.
    // Convert Geotab User to a display name — prefer firstName + lastName,
    // fall back to converting the email (name field) to a readable name
    // (e.g. "richard.mason@ground-control.co.uk" → "Richard Mason").
    function userDisplayName(user: any): string {
      const firstLast = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      if (firstLast) return firstLast;
      if (user.name && user.name.includes('@')) {
        return user.name.split('@')[0].split(/[._-]+/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
      }
      return user.name || '';
    }

    const driverNameById: Record<string, string> = {};
    const keeperByDevice: Record<string, string> = {};
    for (const user of driverList) {
      const name = userDisplayName(user);
      if (user.id && name) driverNameById[user.id] = name;
      const devId = user.defaultDevice?.id;
      if (devId && name) keeperByDevice[devId] = name;
    }

    // ── Auto-detect the Drilling group ──
    // Fetch all Geotab Group entities and find the one whose name matches
    // "drilling" (case-insensitive). Only devices in this group are synced.
    // The detected group ID is persisted to config so future syncs skip detection.
    let drillingGroupId = '';
    let drillingGroupName = '';
    const drillingGroup = allGroups.find((g: any) => /drilling/i.test(g.name || ''));
    if (drillingGroup) {
      drillingGroupId = drillingGroup.id;
      drillingGroupName = drillingGroup.name;
      // Persist the detected group so future syncs use it directly
      if (configRec) {
        try {
          await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
            value: { ...cfg, group_filter_id: drillingGroupId, group_filter_ids: [drillingGroupId], drilling_group_name: drillingGroupName },
          });
        } catch (_) {}
      }
    } else if (groupFilterIds.length > 0) {
      // Fall back to manually configured group filter
      drillingGroupId = groupFilterIds[0];
    }

    // Filter devices to only the Drilling group
    let devices: any[];
    if (drillingGroupId) {
      devices = allDevices.filter((d: any) =>
        (d.groups || []).some((g: any) => (g.id || g) === drillingGroupId)
      );
    } else {
      devices = allDevices;
    }

    // Build vehicle type lookup map
    const vehicleTypeMap: Record<string, any> = {};
    for (const vt of vehicleTypeList) {
      vehicleTypeMap[vt.id] = vt;
    }

    // Build map: device_id → latest odometer + last driver from the most recent trip
    const latestOdometerByDevice: Record<string, number> = {};
    const latestTripStartByDevice: Record<string, string> = {};
    const latestDriverByDevice: Record<string, string> = {};
    for (const trip of allTrips) {
      const devId = trip.device?.id;
      if (!devId) continue;
      const tripStart = trip.start || '';
      if (!latestTripStartByDevice[devId] || tripStart > latestTripStartByDevice[devId]) {
        if (trip.odometer != null) {
          const odo = Number(trip.odometer);
          if (!isNaN(odo)) latestOdometerByDevice[devId] = odo;
        }
        latestTripStartByDevice[devId] = tripStart;
        const tripDriverRaw: any = trip.driver;
        let tripDriver = '';
        if (typeof tripDriverRaw === 'string' && tripDriverRaw !== 'UnknownDriverId') {
          tripDriver = tripDriverRaw;
        } else if (tripDriverRaw?.id) {
          tripDriver = driverNameById[tripDriverRaw.id] || '';
        }
        if (tripDriver) latestDriverByDevice[devId] = tripDriver;
      }
    }

    // Rule lookup removed — ExceptionEvent.rule includes the rule name directly
    // in most Geotab accounts, so we categorise by name without a separate Rule fetch.

    // Load staff for best-effort keeper → Staff record name matching
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffByName: Record<string, string> = {};
    for (const s of allStaff) {
      if (s.name) staffByName[s.name.toLowerCase().trim()] = s.id;
    }

    // Aggregate safety events per device
    interface SafetyStats {
      harsh_braking: number;
      speeding: number;
      harsh_accel: number;
      harsh_cornering: number;
      total: number;
      driver_name: string;
    }
    const safetyByDevice: Record<string, SafetyStats> = {};
    for (const ex of exceptions) {
      const devId = ex.device?.id;
      if (!devId) continue;
      if (!safetyByDevice[devId]) {
        safetyByDevice[devId] = { harsh_braking: 0, speeding: 0, harsh_accel: 0, harsh_cornering: 0, total: 0, driver_name: '' };
      }
      const stats = safetyByDevice[devId];
      stats.total++;
      const ruleName = (ex.rule?.name || '').toLowerCase();
      if (ruleName.includes('brak')) stats.harsh_braking++;
      else if (ruleName.includes('speed')) stats.speeding++;
      else if (ruleName.includes('accel')) stats.harsh_accel++;
      else if (ruleName.includes('corner') || ruleName.includes('turn')) stats.harsh_cornering++;
      // Capture driver name from the exception if available (resolve ID to name)
      if (!stats.driver_name) {
        const exDriver = ex.driver;
        if (typeof exDriver === 'string' && exDriver !== 'UnknownDriverId') {
          stats.driver_name = exDriver;
        } else if (exDriver?.id && driverNameById[exDriver.id]) {
          stats.driver_name = driverNameById[exDriver.id];
        }
      }
    }

    // Build engine hours map from DeviceStatusInfo (workTimeHours field)
    const engineHoursByDevice: Record<string, number> = {};
    for (const st of statuses) {
      const devId = st.device?.id || st.deviceId;
      if (!devId) continue;
      if (st.workTimeHours != null) {
        const hrs = Number(st.workTimeHours);
        if (!isNaN(hrs) && hrs > 0) engineHoursByDevice[devId] = Math.round(hrs * 10) / 10;
      }
    }

    // ── Load local vehicles and build lookup maps ──
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const regMap: Record<string, any> = {};
    const geotabIdMap: Record<string, any> = {};
    const vinMap: Record<string, any> = {};
    for (const v of vehicles) {
      if (v.registration_number) regMap[normalizeReg(v.registration_number)] = v;
      if (v.geotab_device_id) geotabIdMap[v.geotab_device_id] = v;
      if (v.vin) vinMap[v.vin.toUpperCase()] = v;
    }

    const now = new Date().toISOString();
    let vehiclesCreated = 0;
    let vehiclesUpdated = 0;
    const deviceRegMap: Record<string, string> = {};
    const deviceVehicleMap: Record<string, any> = {};

    // ── Permanently blacklisted registrations — these vehicles are never
    // created or updated by sync. They are permanently excluded from the
    // fleet regardless of what Geotab/Holman reports.
    const BLACKLISTED_REGS = ['GJ69SWX'];
    const isBlacklisted = (reg: string) => BLACKLISTED_REGS.includes(normalizeReg(reg));

    // ── Sync vehicle details (create/update Vehicle records) ──
    for (const d of devices) {
      const deviceId = d.id;
      // Geotab often stores the reg plate as the device name when licensePlate is empty.
      // Fall back to the device name if it looks like a UK reg (alphanumeric, 4-10 chars).
      let reg = normalizeReg(d.licensePlate || d.licenseNumber || '');
      if (!reg && d.name) {
        const nameClean = d.name.replace(/\s+/g, '').toUpperCase();
        if (/^[A-Z0-9]{4,10}$/.test(nameClean) && /\d/.test(nameClean) && /[A-Z]/.test(nameClean)) {
          reg = nameClean;
        }
      }
      const vin = (d.vehicleIdentificationNumber || '').toString().trim();
      const vt = d.vehicleType?.id ? vehicleTypeMap[d.vehicleType.id] : null;

      // Skip blacklisted vehicles entirely — never create or update them
      if (isBlacklisted(reg)) continue;

      deviceRegMap[deviceId] = reg;

      // Try to match: by geotab_device_id, then by reg, then by VIN
      let vehicle = geotabIdMap[deviceId] || (reg ? regMap[reg] : null) || (vin ? vinMap[vin.toUpperCase()] : null);

      const detailUpdate: any = {
        geotab_device_id: deviceId,
        geotab_device_serial: d.serialNumber || '',
        geotab_sync_status: 'synced',
        last_geotab_sync: now,
      };

      // Pull details from Geotab Device + VehicleType. Only fill make/model
      // if the vehicle doesn't already have them — the LLM spec sync
      // (syncVehicleSpecs) is the authority for make/model, so we don't
      // overwrite verified data here. Year and fuel_type always refresh.
      if (vt) {
        // Geotab is the authoritative source for make, model, year, fuel type
        // and vehicle type — always overwrite from Geotab when available.
        if (vt.make) detailUpdate.make = vt.make;
        if (vt.model) detailUpdate.model = vt.model;
        if (vt.year) detailUpdate.year = Number(vt.year) || undefined;
        if (vt.fuelType !== undefined && vt.fuelType !== null) detailUpdate.fuel_type = mapFuelType(vt.fuelType);
        if (vt.name) detailUpdate.vehicle_type = vt.name;
        // Colour from Geotab comment is a fallback only — DVLA is authoritative
        if (vt.comment && (!vehicle || !vehicle.color) && !detailUpdate.color) {
          const colourMatch = vt.comment.match(/colou?r[:\s]+([a-zA-Z]+)/i);
          if (colourMatch) detailUpdate.color = colourMatch[1].charAt(0).toUpperCase() + colourMatch[1].slice(1).toLowerCase();
        }
      }
      if (vin) detailUpdate.vin = vin;
      // Engine hours from DeviceStatusInfo
      if (engineHoursByDevice[deviceId] != null) {
        detailUpdate.engine_hours = engineHoursByDevice[deviceId];
      }

      // Fallback: decode make and year from the VIN WMI (manufacturer) and
      // 10th-character year code. Only fill if the vehicle doesn't already
      // have a make — the LLM spec sync is the authority and may overwrite
      // this later. Year always refreshes from VIN.
      if (vin && (!vt?.make || !vt?.year)) {
        const decoded = decodeVin(vin);
        if (decoded.make && !detailUpdate.make) detailUpdate.make = decoded.make;
        if (decoded.year && !detailUpdate.year) detailUpdate.year = decoded.year;
      }
      // Infer fuel type from the VehicleType name if fuelType is still unknown
      if (detailUpdate.fuel_type === 'unknown' || !detailUpdate.fuel_type) {
        const nameLower = (vt?.name || d.name || '').toLowerCase();
        if (nameLower.includes('diesel')) detailUpdate.fuel_type = 'diesel';
        else if (nameLower.includes('petrol')) detailUpdate.fuel_type = 'petrol';
        else if (nameLower.includes('electric') || nameLower.includes('ev')) detailUpdate.fuel_type = 'electric';
        else if (nameLower.includes('hybrid')) detailUpdate.fuel_type = 'hybrid';
      }

      // Use Geotab device name as the vehicle name if local name is empty or generic
      if (d.name && (!vehicle || !vehicle.name || vehicle.name === vehicle.registration_number)) {
        detailUpdate.name = d.name;
      }
      // If reg is present on Geotab but missing locally, fill it
      if (reg && (!vehicle || !vehicle.registration_number)) {
        detailUpdate.registration_number = reg;
      }
      // Pull comment/notes from the Geotab device record
      if (d.comment) detailUpdate.notes = d.comment;
      // Try to extract colour from the comment field (Geotab has no native colour field)
      if (d.comment && (!vehicle || !vehicle.color)) {
        const colourMatch = d.comment.match(/colou?r[:\s]+([a-zA-Z]+)/i);
        if (colourMatch) detailUpdate.color = colourMatch[1].charAt(0).toUpperCase() + colourMatch[1].slice(1).toLowerCase();
      }
      // Try to extract model from the device name if neither VehicleType nor
      // the existing record provided it (e.g. "Ford Transit Custom" → model =
      // "Transit Custom" when make = "Ford"). Don't overwrite existing model.
      if (!detailUpdate.model && d.name) {
        const nameParts = d.name.trim().split(/\s+/);
        const makeLower = (detailUpdate.make || vehicle?.make || '').toLowerCase();
        if (makeLower && nameParts[0]?.toLowerCase() === makeLower && nameParts.length > 1) {
          detailUpdate.model = nameParts.slice(1).join(' ');
        }
      }

      // Set the Geotab keeper (fixed assignment) — from Driver.defaultDevice
      const keeperName = keeperByDevice[deviceId];
      if (keeperName) {
        detailUpdate.geotab_keeper_name = keeperName;
        const matchedStaffId = staffByName[keeperName.toLowerCase().trim()];
        if (matchedStaffId) detailUpdate.geotab_keeper_staff_id = matchedStaffId;
      }

      // Merge safety telemetry stats into the update payload
      const safety = safetyByDevice[deviceId];
      if (safety) {
        detailUpdate.safety_harsh_braking_count = safety.harsh_braking;
        detailUpdate.safety_speeding_count = safety.speeding;
        detailUpdate.safety_harsh_accel_count = safety.harsh_accel;
        detailUpdate.safety_harsh_cornering_count = safety.harsh_cornering;
        detailUpdate.safety_event_count = safety.total;
        // Risk score: 100 = safest (0 events), 0 = worst (20+ events). Linear scale.
        detailUpdate.driver_risk_score = Math.max(0, Math.round(100 - (safety.total / 20) * 100));
        detailUpdate.safety_events_last_sync = now;
        if (safety.driver_name) detailUpdate.geotab_driver_name = safety.driver_name;
      }
      // Fallback: set geotab_driver_name from the most recent trip driver
      if (!detailUpdate.geotab_driver_name && latestDriverByDevice[deviceId]) {
        detailUpdate.geotab_driver_name = latestDriverByDevice[deviceId];
      }

      if (!vehicle) {
        // Auto-create a new Vehicle record from this Geotab device
        const createPayload: any = {
          name: d.name || reg || `Geotab Vehicle ${deviceId.slice(0, 8)}`,
          registration_number: reg || d.licensePlate || d.licenseNumber || '',
          geotab_device_id: deviceId,
          geotab_device_serial: d.serialNumber || '',
          geotab_sync_status: 'synced',
          last_geotab_sync: now,
        };
        if (vin) createPayload.vin = vin;
        if (vt) {
          if (vt.make) createPayload.make = vt.make;
          if (vt.model) createPayload.model = vt.model;
          if (vt.year) createPayload.year = Number(vt.year) || undefined;
          if (vt.fuelType !== undefined) createPayload.fuel_type = mapFuelType(vt.fuelType);
          if (vt.name) createPayload.vehicle_type = vt.name;
        }
        if (d.comment) createPayload.notes = d.comment;
        // Try to extract colour from comment
        if (d.comment) {
          const colourMatch = d.comment.match(/colou?r[:\s]+([a-zA-Z]+)/i);
          if (colourMatch) createPayload.color = colourMatch[1].charAt(0).toUpperCase() + colourMatch[1].slice(1).toLowerCase();
        }
        // Set the Geotab keeper (fixed assignment) on auto-created vehicles
        const keeperName = keeperByDevice[deviceId];
        if (keeperName) {
          createPayload.geotab_keeper_name = keeperName;
          const matchedStaffId = staffByName[keeperName.toLowerCase().trim()];
          if (matchedStaffId) createPayload.geotab_keeper_staff_id = matchedStaffId;
        }
        // Fallback: decode make and year from the VIN WMI + year code
        if (vin && (!vt?.make || !vt?.year)) {
          const decoded = decodeVin(vin);
          if (decoded.make && !createPayload.make) createPayload.make = decoded.make;
          if (decoded.year && !createPayload.year) createPayload.year = decoded.year;
        }
        try {
          const created = await base44.entities.Vehicle.create(createPayload);
          if (created) {
            geotabIdMap[deviceId] = created;
            if (reg) regMap[reg] = created;
            deviceVehicleMap[deviceId] = created;
            vehiclesCreated++;
          }
        } catch (_) {
          // skip creation failure
        }
      } else {
        // Update existing record with latest Geotab details
        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, detailUpdate);
          // refresh maps so location sync below uses updated record
          if (reg) regMap[reg] = vehicle;
          geotabIdMap[deviceId] = vehicle;
          deviceVehicleMap[deviceId] = vehicle;
          vehiclesUpdated++;
        } catch (_) {}
      }
    }

    // ── Second pass: update safety stats for ALL vehicles with a Geotab device ──
    // The group filter above may exclude some devices from the main loop, but
    // safety events are fetched for ALL devices. This pass ensures every local
    // vehicle with a geotab_device_id gets up-to-date safety telemetry — even
    // if its device was filtered out by the group filter.
    for (const v of vehicles) {
      if (!v.geotab_device_id) continue;
      if (deviceVehicleMap[v.geotab_device_id]) continue; // already updated above
      const safety = safetyByDevice[v.geotab_device_id];
      const safetyUpdate: any = {
        geotab_sync_status: 'synced',
        last_geotab_sync: now,
      };
      if (safety) {
        safetyUpdate.safety_harsh_braking_count = safety.harsh_braking;
        safetyUpdate.safety_speeding_count = safety.speeding;
        safetyUpdate.safety_harsh_accel_count = safety.harsh_accel;
        safetyUpdate.safety_harsh_cornering_count = safety.harsh_cornering;
        safetyUpdate.safety_event_count = safety.total;
        safetyUpdate.driver_risk_score = Math.max(0, Math.round(100 - (safety.total / 20) * 100));
        safetyUpdate.safety_events_last_sync = now;
        if (safety.driver_name) safetyUpdate.geotab_driver_name = safety.driver_name;
      } else {
        // No events for this device in the last 30 days — reset to safe
        safetyUpdate.safety_harsh_braking_count = 0;
        safetyUpdate.safety_speeding_count = 0;
        safetyUpdate.safety_harsh_accel_count = 0;
        safetyUpdate.safety_harsh_cornering_count = 0;
        safetyUpdate.safety_event_count = 0;
        safetyUpdate.driver_risk_score = 100;
        safetyUpdate.safety_events_last_sync = now;
      }
      // Fallback: set geotab_driver_name from the most recent trip driver
      if (!safetyUpdate.geotab_driver_name && latestDriverByDevice[v.geotab_device_id]) {
        safetyUpdate.geotab_driver_name = latestDriverByDevice[v.geotab_device_id];
      }
      try {
        await base44.asServiceRole.entities.Vehicle.update(v.id, safetyUpdate);
        vehiclesUpdated++;
      } catch (_) {}
    }

    // ── Cleanup: delete Vehicle records not in the Drilling group ──
    // The user wants ONLY Drilling group vehicles. Any local Vehicle whose
    // geotab_device_id is not in the Drilling device set is deleted, along
    // with non-Geotab vehicles (no geotab_device_id).
    let vehiclesDeleted = 0;
    if (drillingGroupId && devices.length > 0) {
      const drillingDeviceIds = new Set(devices.map((d: any) => d.id));
      for (const v of vehicles) {
        // Skip vehicles that were just created/updated in this sync
        if (v.geotab_device_id && deviceVehicleMap[v.geotab_device_id]) continue;
        // Delete if the Geotab device is not in the Drilling group
        if (v.geotab_device_id && !drillingDeviceIds.has(v.geotab_device_id)) {
          try { await base44.asServiceRole.entities.Vehicle.delete(v.id); vehiclesDeleted++; } catch (_) {}
        }
        // Delete non-Geotab vehicles (user wants only Drilling group)
        else if (!v.geotab_device_id) {
          try { await base44.asServiceRole.entities.Vehicle.delete(v.id); vehiclesDeleted++; } catch (_) {}
        }
      }
    }

    // ── Store live location logs ──
    let stored = 0;
    let unmatched = 0;

    // Load geofence config + preload shared data for geofence checks
    const { config: geofenceConfig } = await loadGeofenceConfig(base44);
    const geofencePreload = geofenceConfig.enabled
      ? {
          suppliers: await base44.asServiceRole.entities.Supplier.list('-created_date', 500),
          jobs: await base44.asServiceRole.entities.Job.list('-created_date', 500),
        }
      : null;
    let totalGeofenceArrivals = 0;
    let totalGeofenceDepartures = 0;
    let totalAutoArrivals = 0;

    for (const st of statuses) {
      const deviceId = st.device?.id || st.deviceId;
      const reg = deviceRegMap[deviceId] || '';
      const vehicle = deviceVehicleMap[deviceId] || geotabIdMap[deviceId] || (reg ? regMap[reg] : null);

      const lat = Number(st.latitude ?? st.lat);
      const lng = Number(st.longitude ?? st.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      if (!vehicle) {
        unmatched++;
        continue;
      }

      // Odometer comes from the latest Trip (DeviceStatusInfo has no odometer field).
      // Trip.odometer is in meters → convert to km.
      const rawTripOdo = latestOdometerByDevice[deviceId];
      const odometerKm = rawTripOdo != null ? Number(rawTripOdo) / 1000 : 0;

      await base44.asServiceRole.entities.VehicleLocationLog.create({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number || reg || vehicle.name || '',
        vehicle_name: vehicle.name,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        speed_kph: Number(st.speed) || 0,
        heading: Number(st.bearing ?? st.heading) || 0,
        ignition_on: st.isDriving || st.ignitionOn || false,
        odometer_km: odometerKm,
        driver_name: (() => {
          const d = st.driver;
          if (typeof d === 'string') return d !== 'UnknownDriverId' ? d : '';
          if (d?.id) return driverNameById[d.id] || '';
          return st.driverName || '';
        })(),
        timestamp: st.dateTime || now,
        source: 'geotab_sync',
        geotab_device_id: deviceId || '',
      });

      // Update current_mileage + live driver on the vehicle record
      const liveDriver = (() => {
        const d = st.driver;
        if (typeof d === 'string') return d !== 'UnknownDriverId' ? d : '';
        if (d?.id) return driverNameById[d.id] || '';
        return st.driverName || '';
      })();
      const mileageUpdate: any = {};
      if (odometerKm > 0) mileageUpdate.current_mileage = Math.round(odometerKm * 0.621371);
      if (liveDriver) mileageUpdate.geotab_driver_name = liveDriver;
      if (Object.keys(mileageUpdate).length > 0) {
        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, mileageUpdate);
        } catch (_) {}
      }

      // ── Geofence check — detect arrival/departure at job sites & supplier yards ──
      if (geofencePreload) {
        try {
          const geoResult = await checkGeofencePresence(
            base44,
            vehicle.id,
            vehicle.name,
            vehicle.registration_number || reg || '',
            lat,
            lng,
            st.dateTime || now,
            geofenceConfig,
            geofencePreload,
          );
          totalGeofenceArrivals += geoResult.arrivals;
          totalGeofenceDepartures += geoResult.departures;
          totalAutoArrivals += geoResult.autoArrivals;
        } catch (_) {
          // geofence check failure should not break the sync
        }
      }

      stored++;
    }

    // Update sync metadata
    if (configRec) {
      try {
        await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
          value: {
            ...cfg,
            last_sync_at: now,
            last_sync_status: 'ok',
            last_sync_summary: `${stored} locations synced · ${vehiclesCreated} vehicles created · ${vehiclesUpdated} updated`,
          },
        });
      } catch (_) {}
    }

    // Build diagnostic info about what VehicleType data Geotab provided
    const vtDiag = devices.slice(0, 3).map((d: any) => {
      const vt = d.vehicleType?.id ? vehicleTypeMap[d.vehicleType.id] : null;
      return {
        device_id: d.id,
        device_name: d.name,
        license_plate: d.licensePlate || d.licenseNumber || '',
        vin: d.vehicleIdentificationNumber || '',
        comment: d.comment || '',
        has_vehicle_type: !!d.vehicleType?.id,
        vehicle_type_id: d.vehicleType?.id || '',
        vt_make: vt?.make || null,
        vt_model: vt?.model || null,
        vt_year: vt?.year || null,
        vt_fuel_type: vt?.fuelType ?? null,
        vt_name: vt?.name || null,
        vt_comment: vt?.comment || null,
        vt_all_keys: vt ? Object.keys(vt).slice(0, 20) : [],
      };
    });

    // Driver diagnostics — show what Geotab returned for Driver entities
    const driverDiag = driverList.slice(0, 5).map((d: any) => ({
      id: d.id,
      name: d.name || [d.firstName, d.lastName].filter(Boolean).join(' '),
      has_default_device: !!d.defaultDevice?.id,
      default_device_id: d.defaultDevice?.id || null,
    }));

    return Response.json({
      ok: true,
      message: `Synced ${stored} location${stored === 1 ? '' : 's'} from Geotab · ${vehiclesCreated} new vehicle${vehiclesCreated === 1 ? '' : 's'} created · ${vehiclesUpdated} updated${vehiclesDeleted > 0 ? ` · ${vehiclesDeleted} removed (not in Drilling group)` : ''}.`,
      synced: stored,
      unmatched,
      vehicles_created: vehiclesCreated,
      vehicles_updated: vehiclesUpdated,
      vehicles_deleted: vehiclesDeleted,
      total_devices: devices.length,
      total_statuses: statuses.length,
      total_drivers: driverList.length,
      drilling_group: drillingGroupId ? { id: drillingGroupId, name: drillingGroupName } : null,
      keepers_found: Object.keys(keeperByDevice).length,
      trip_drivers_found: Object.keys(latestDriverByDevice).length,
      vehicle_type_count: Object.keys(vehicleTypeMap).length,
      geofence: {
        arrivals: totalGeofenceArrivals,
        departures: totalGeofenceDepartures,
        auto_arrivals: totalAutoArrivals,
      },
      diagnostics: vtDiag,
      driver_diagnostics: driverDiag,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}