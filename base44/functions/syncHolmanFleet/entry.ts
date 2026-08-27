import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSetting } from '../../shared/appSettings.ts';

// ============================================================
// Holman Fleet sync — manual pull & connection test
// ============================================================
// Used by the Holman Sync settings page. Supports two actions:
//   - 'test': validates that the stored API credentials can reach
//     the Holman API endpoint and returns a status message.
//   - 'sync': fetches the fleet vehicle list from Holman and updates
//     MOT/service dates and mileage on matching local Vehicle records.
//
// Holman API shapes vary; this function is intentionally defensive,
// trying several common response field paths.

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function deepGet(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    let ok = true;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object' || !(part in cur)) { ok = false; break; }
      cur = cur[part];
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return '';
}

function toDateStr(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeReg(reg: any): string {
  return String(reg || '').toUpperCase().replace(/\s/g, '');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const action = payload.action || 'test';
    const divisionId = payload.division_id || null;

    // Load Holman config — division-scoped when a division_id is passed.
    const configRec = await getAppSetting(base44, 'holman_config', divisionId);
    if (!configRec) {
      return Response.json({ ok: false, message: 'Holman is not configured. Add your API credentials in Settings first.' });
    }
    const cfg = configRec.value || {};
    if (!cfg.api_key && !cfg.client_id) {
      return Response.json({ ok: false, message: 'No API credentials found. Enter your Holman API key in Settings first.' });
    }
    const baseUrl = (cfg.api_url || 'https://api.holman.com').replace(/\/$/, '');

    // ---- TEST CONNECTION ----
    if (action === 'test') {
      try {
        const testUrl = `${baseUrl}/vehicles?limit=1`;
        const resp = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'x-api-key': cfg.api_key,
            'Accept': 'application/json',
          },
        });

        if (resp.ok) {
          return Response.json({
            ok: true,
            message: `Connected to Holman API at ${baseUrl}.`,
            status_code: resp.status,
          });
        }
        // 401/403 — credentials invalid
        if (resp.status === 401 || resp.status === 403) {
          return Response.json({ ok: false, message: `Authentication failed (HTTP ${resp.status}). Check your API key.` });
        }
        // Other status codes — endpoint may differ but Holman responded
        return Response.json({
          ok: true,
          message: `Holman API responded (HTTP ${resp.status}). Connection is live — verify the endpoint URL matches your Holman portal.`,
          status_code: resp.status,
        });
      } catch (e) {
        return Response.json({ ok: false, message: `Could not reach Holman API: ${e.message}` });
      }
    }

    // ---- SYNC VEHICLES ----
    if (action === 'sync') {
      let fleetData: any[] = [];

      try {
        const syncUrl = `${baseUrl}/vehicles`;
        const resp = await fetch(syncUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'x-api-key': cfg.api_key,
            'Accept': 'application/json',
          },
        });

        if (!resp.ok) {
          return Response.json({ ok: false, message: `Holman API returned HTTP ${resp.status}. Check credentials and endpoint URL.` });
        }

        const json = await resp.json();
        // Defensive: Holman may wrap the list in various keys
        fleetData = Array.isArray(json) ? json
          : Array.isArray(json.vehicles) ? json.vehicles
          : Array.isArray(json.data) ? json.data
          : Array.isArray(json.results) ? json.results
          : [];
      } catch (e) {
        return Response.json({ ok: false, message: `Failed to fetch fleet data: ${e.message}` });
      }

      if (fleetData.length === 0) {
        return Response.json({ ok: false, message: 'Holman API returned no vehicles. Check your Holman account has fleet data available.' });
      }

      // Load all local vehicles for matching
      const localVehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
      let synced = 0;
      let unmatched = 0;

      // Permanently blacklisted registrations — never synced from Holman
      const BLACKLISTED_REGS = ['GJ69SWX'];

      for (const fv of fleetData) {
        const reg = normalizeReg(deepGet(fv, 'registration', 'registration_number', 'vrn', 'license_plate'));
        const holmanId = String(deepGet(fv, 'id', 'vehicle_id', 'fleet_id', 'asset_id') || '');
        const vin = String(deepGet(fv, 'vin', 'chassis_number') || '');

        // Skip blacklisted vehicles entirely
        if (BLACKLISTED_REGS.includes(reg)) continue;

        let match: any = null;
        if (reg) match = localVehicles.find((v: any) => normalizeReg(v.registration_number) === reg);
        if (!match && holmanId) match = localVehicles.find((v: any) => v.holman_vehicle_id === holmanId);
        if (!match && vin) match = localVehicles.find((v: any) => v.vin === vin);

        if (!match) { unmatched++; continue; }

        const update: any = {
          last_holman_sync: new Date().toISOString(),
          holman_sync_status: 'synced',
        };
        if (holmanId) update.holman_vehicle_id = holmanId;
        if (vin) update.vin = vin;

        const motExpiry = toDateStr(deepGet(fv, 'mot_expiry', 'mot_expiry_date', 'next_mot_date', 'mot.due_date'));
        const serviceDue = toDateStr(deepGet(fv, 'service_due', 'service_due_date', 'next_service_date', 'service.next_due'));
        const lastService = toDateStr(deepGet(fv, 'last_service_date', 'last_service', 'service.last_completed'));
        const mileage = num(deepGet(fv, 'mileage', 'odometer', 'current_mileage'));

        if (motExpiry) {
          update.mot_expiry = motExpiry;
          // Derive mot_status from the expiry date so stale DVLA-era values
          // don't contradict the current Holman MOT data.
          const today = new Date().toISOString().slice(0, 10);
          update.mot_status = motExpiry >= today ? 'valid' : 'not_valid';
        }
        if (serviceDue) update.service_due_date = serviceDue;
        if (lastService) update.last_service_date = lastService;
        if (mileage != null) update.current_mileage = mileage;

        await base44.asServiceRole.entities.Vehicle.update(match.id, update);
        synced++;
      }

      // Update config status
      try {
        await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
          value: {
            ...cfg,
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_summary: `${synced} vehicle(s) synced, ${unmatched} unmatched from ${fleetData.length} total.`,
          },
        });
      } catch (e) { /* non-fatal */ }

      return Response.json({
        ok: true,
        message: `Sync complete — ${synced} vehicle(s) updated, ${unmatched} unmatched.`,
        synced,
        unmatched,
        total: fleetData.length,
      });
    }

    // ---- SYNC FUEL CARD TRANSACTIONS ----
    // Fetches fuel card transactions from Holman and:
    //   1. Creates VehicleMaintenanceBooking records (booking_type='fuel_card')
    //      for each transaction matched to a local vehicle by reg/VIN.
    //   2. Matches each transaction to the JOB the vehicle was assigned to
    //      on that date (via RotaAssignment) and creates a DailyCost record
    //      (category='fuel') so fuel spend is attributed to the correct job
    //      for profitability / cost tracking.
    if (action === 'sync_fuel') {
      let fuelData: any[] = [];
      try {
        const fuelUrl = `${baseUrl}/fuel/transactions`;
        const resp = await fetch(fuelUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'x-api-key': cfg.api_key,
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) {
          return Response.json({ ok: false, message: `Holman fuel API returned HTTP ${resp.status}. Check credentials and endpoint URL.` });
        }
        const json = await resp.json();
        fuelData = Array.isArray(json) ? json
          : Array.isArray(json.transactions) ? json.transactions
          : Array.isArray(json.data) ? json.data
          : Array.isArray(json.results) ? json.results
          : [];
      } catch (e) {
        return Response.json({ ok: false, message: `Failed to fetch fuel data: ${e.message}` });
      }

      if (fuelData.length === 0) {
        return Response.json({ ok: true, message: 'No fuel card transactions found.', imported: 0 });
      }

      // Load local vehicles for matching
      const localVehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
      // Load existing fuel card bookings to dedupe by transaction reference
      const existingBookings = await base44.asServiceRole.entities.VehicleMaintenanceBooking.filter({ booking_type: 'fuel_card' }, '-created_date', 500);
      const seenRefs = new Set();
      for (const b of existingBookings) {
        if (b.notes) {
          // Extract transaction ref from notes (stored as "Holman ref: XXX")
          const m = b.notes.match(/Holman ref:\s*(\S+)/);
          if (m) seenRefs.add(m[1]);
        }
      }
      // Load existing DailyCost fuel records to dedupe by Holman transaction ref
      const existingFuelCosts = await base44.asServiceRole.entities.DailyCost.filter({ category: 'fuel' }, '-created_date', 500);
      const seenCostRefs = new Set();
      for (const c of existingFuelCosts) {
        if (c.notes) {
          const m = c.notes.match(/Holman ref:\s*(\S+)/);
          if (m) seenCostRefs.add(m[1]);
        }
      }

      // Collect all transaction dates so we can batch-load rota assignments
      const txDates = new Set<string>();
      for (const tx of fuelData) {
        const d = toDateStr(deepGet(tx, 'date', 'transaction_date', 'fuel_date', 'posted_date'));
        if (d) txDates.add(d);
      }
      // Load rota assignments for the transaction dates — we'll match by
      // vehicle_id + assigned_date to find which job the vehicle was on.
      const dateList = Array.from(txDates);
      const rotaByDate: Record<string, any[]> = {};
      if (dateList.length > 0) {
        const allRota = await base44.asServiceRole.entities.RotaAssignment.filter(
          { assigned_date: { $in: dateList }, assignment_type: 'job' },
          '-created_date', 500
        );
        for (const r of allRota) {
          const d = r.assigned_date;
          if (!rotaByDate[d]) rotaByDate[d] = [];
          rotaByDate[d].push(r);
        }
      }
      // Load jobs for job-name lookup
      const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
      const jobMap: Record<string, any> = {};
      for (const j of allJobs) jobMap[j.id] = j;

      let imported = 0;
      let unmatched = 0;
      let duplicate = 0;
      let jobMatched = 0;
      let jobUnmatched = 0;

      for (const tx of fuelData) {
        const reg = normalizeReg(deepGet(tx, 'registration', 'registration_number', 'vrn', 'vehicle_registration'));
        const vin = String(deepGet(tx, 'vin', 'chassis_number') || '');
        const txRef = String(deepGet(tx, 'id', 'transaction_id', 'reference', 'transaction_reference') || '');
        const txDate = toDateStr(deepGet(tx, 'date', 'transaction_date', 'fuel_date', 'posted_date'));
        const litres = num(deepGet(tx, 'litres', 'volume', 'quantity'));
        const cost = num(deepGet(tx, 'amount', 'cost', 'value', 'total_amount'));
        const fuelType = String(deepGet(tx, 'fuel_type', 'product', 'product_description') || '').toLowerCase();
        const siteName = String(deepGet(tx, 'site_name', 'station', 'location', 'merchant_name') || '');
        const odometer = num(deepGet(tx, 'odometer', 'mileage', 'odometer_reading'));
        const pencePerLitre = num(deepGet(tx, 'unit_price', 'price_per_litre', 'pp_litre', 'unit_cost'));

        // Dedupe by transaction reference (maintenance bookings)
        if (txRef && seenRefs.has(txRef)) { duplicate++; continue; }
        if (txRef) seenRefs.add(txRef);

        // Match to local vehicle
        let match: any = null;
        if (reg) match = localVehicles.find((v: any) => normalizeReg(v.registration_number) === reg);
        if (!match && vin) match = localVehicles.find((v: any) => v.vin === vin);

        if (!match) { unmatched++; continue; }

        const vehicleName = match.name || match.registration_number || '';
        const notesParts = [`Holman ref: ${txRef || 'N/A'}`];
        if (litres != null) notesParts.push(`${litres}L ${fuelType || 'fuel'}`);
        if (siteName) notesParts.push(`@ ${siteName}`);
        if (odometer != null) notesParts.push(`ODO: ${odometer.toLocaleString()} mi`);

        await base44.asServiceRole.entities.VehicleMaintenanceBooking.create({
          vehicle_id: match.id,
          vehicle_name: vehicleName,
          booking_type: 'fuel_card',
          status: 'completed',
          booking_date: txDate || new Date().toISOString().slice(0, 10),
          supplier_name: 'Holman Fuel Card',
          cost: cost || undefined,
          notes: notesParts.join(' · '),
          report_source: 'holman_sync',
          completed_at: txDate ? new Date(txDate + 'T12:00:00Z').toISOString() : undefined,
        });
        imported++;

        // Update vehicle mileage if odometer is higher than current
        if (odometer != null && (!match.current_mileage || odometer > match.current_mileage)) {
          await base44.asServiceRole.entities.Vehicle.update(match.id, {
            current_mileage: odometer,
            last_holman_sync: new Date().toISOString(),
            holman_sync_status: 'synced',
          });
        }

        // ── Job cost matching ──
        // Find the RotaAssignment for this vehicle on the transaction date.
        // The assignment's job_id tells us which job to attribute the fuel cost to.
        // Skip if we already have a DailyCost for this transaction ref.
        if (txRef && seenCostRefs.has(txRef)) continue;
        if (txRef) seenCostRefs.add(txRef);

        let matchedJobId: string | null = null;
        let matchedAssignmentId: string | null = null;
        if (txDate && rotaByDate[txDate]) {
          const assignments = rotaByDate[txDate];
          // Match by vehicle_id
          const byVehicle = assignments.find((r: any) => r.vehicle_id === match.id);
          if (byVehicle) {
            matchedJobId = byVehicle.job_id || null;
            matchedAssignmentId = byVehicle.id || null;
          }
        }

        if (matchedJobId) {
          jobMatched++;
          // Calculate VAT — Holman fuel amounts are typically gross (incl. VAT).
          // Assume 20% VAT rate (UK standard). Net = gross / 1.2, VAT = gross - net.
          const vatRate = 20;
          const gross = cost || 0;
          const net = gross > 0 ? +(gross / (1 + vatRate / 100)).toFixed(2) : 0;
          const vat = +(gross - net).toFixed(2);

          const costNotes = [`Holman ref: ${txRef || 'N/A'}`, `Vehicle: ${match.registration_number || vehicleName}`];
          if (litres != null) costNotes.push(`${litres}L ${fuelType || 'fuel'}`);
          if (pencePerLitre != null) costNotes.push(`${pencePerLitre}p/L`);
          if (siteName) costNotes.push(`@ ${siteName}`);

          // Find the staff member assigned to this vehicle on that date
          let staffId = '';
          let staffName = '';
          if (rotaByDate[txDate]) {
            const assignment = rotaByDate[txDate].find((r: any) => r.vehicle_id === match.id);
            if (assignment) {
              staffId = assignment.staff_id || '';
              // staff_name is denormalised on RotaAssignment? No — we need to look up Staff
            }
          }

          try {
            await base44.asServiceRole.entities.DailyCost.create({
              job_id: matchedJobId,
              assignment_id: matchedAssignmentId || undefined,
              staff_id: staffId || undefined,
              date: txDate,
              category: 'fuel',
              description: `Fuel card: ${match.registration_number || vehicleName}${litres != null ? ` — ${litres}L ${fuelType || 'fuel'}` : ''}${siteName ? ` @ ${siteName}` : ''}`,
              amount_net: net,
              amount_vat: vat,
              amount_gross: gross,
              vat_rate: vatRate,
              supplier_name: 'Holman Fuel Card',
              status: 'submitted',
              notes: costNotes.join(' · '),
            });
          } catch (e) {
            // Non-fatal — maintenance booking was still created
          }
        } else {
          jobUnmatched++;
        }
      }

      // Update config status
      try {
        await base44.asServiceRole.entities.AppSetting.update(configRec.id, {
          value: {
            ...cfg,
            last_fuel_sync_at: new Date().toISOString(),
            last_fuel_sync_status: 'success',
            last_fuel_sync_summary: `${imported} fuel transaction(s) imported, ${jobMatched} matched to jobs, ${jobUnmatched} no job assignment, ${duplicate} duplicate(s) skipped, ${unmatched} unmatched vehicle.`,
          },
        });
      } catch (e) { /* non-fatal */ }

      return Response.json({
        ok: true,
        message: `Fuel sync complete — ${imported} transaction(s) imported, ${jobMatched} matched to jobs, ${jobUnmatched} no job assignment, ${duplicate} duplicate(s) skipped, ${unmatched} unmatched vehicle.`,
        imported,
        jobMatched,
        jobUnmatched,
        duplicate,
        unmatched,
        total: fuelData.length,
      });
    }

    return Response.json({ ok: false, message: `Unknown action: ${action}` });
  } catch (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}