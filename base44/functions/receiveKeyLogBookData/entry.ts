import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { parseRemarks, professionaliseActivities, mergeDuplicateLogs } from '../../shared/keylogbookRemarks.ts';
import { loadJobRateCardItems, resolveJobCharge } from '../../shared/jobRateMatcher.ts';
import { generateKeyLogBookTimesheet } from '../../shared/keylogbookTimesheet.ts';
import { parseCrewNames } from '../../shared/agsCrewAttribution.ts';

// ============================================================
// KeyLogBook Webhook Receiver — Professionalised Site Logs Pipeline
// ============================================================
// Receives real-time borehole log data pushed from KeyLogBook.
//
// Two data streams:
//   1. Structured borehole data (boreholes[], logs[]) → source='ags_import'
//      Read-only technical records shown in the Borehole Data Explorer.
//
//   2. Driller remarks string (e.g. "7:30_8:45 = Start briefing... 8:45_9:00 = ...")
//      → Parsed into individual time-stamped activities, AI-professionalised,
//        and saved as source='keylogbook_remarks' with manager_review_status='pending'.
//        An admin reviews/edits these in the Site Logs tab, then approves them
//        to auto-generate the timesheet via the approveKeyLogBookLogs function.
//
// This endpoint is called by KeyLogBook (no authenticated user), so it uses the
// service role for all database operations and validates the shared secret.

interface WebhookPayload {
  job_reference?: string;
  job_id?: string;
  project_id?: string;
  date?: string;
  lead_driller_name?: string;
  lead_driller_id?: string;
  meterage?: number;
  remarks?: string;
  notes?: string;
  boreholes?: Array<Record<string, any>>;
  logs?: Array<Record<string, any>>;
  [key: string]: any;
}

interface ParsedActivity {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  raw_description: string;
}

// ============================================================
// Shared parsing logic lives in base44/shared/keylogbookRemarks.ts
// (parseRemarks + professionaliseActivities are imported above).
// ============================================================

function londonToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// Parse a date input as a Europe/London calendar date (YYYY-MM-DD).
// Handles bare dates (YYYY-MM-DD), ISO timestamps, and DD/MM/YYYY.
// Returns null if the input can't be parsed.
function londonDateFromInput(input: string): string | null {
  if (!input) return null;
  const s = str(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/London',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    }
  } catch (e) {}
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return null;
}

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function str(v: any): string {
  if (v == null) return '';
  return String(v).trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Fetch the singleton config (service role — no user context) ---
    const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
    const config = configs[0];

    // --- Validate the shared secret ---
    const url = new URL(req.url);
    const providedSecret =
      req.headers.get('x-klb-signature') ||
      req.headers.get('x-keylogbook-signature') ||
      url.searchParams.get('secret') ||
      '';

    if (!config || !config.enabled) {
      return Response.json({ error: 'KeyLogBook sync is not enabled' }, { status: 403 });
    }
    if (!config.webhook_secret) {
      return Response.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }
    if (providedSecret !== config.webhook_secret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    // --- Parse the payload ---
    const body: WebhookPayload = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const jobRef = str(body.job_reference || body.project_id);
    const explicitJobId = str(body.job_id);
    const parsedDate = londonDateFromInput(str(body.date));
    const workDate = parsedDate || londonToday();
    const dateUnconfirmed = !parsedDate;
    const meterage = num(body.meterage);
    const rawRemarks = str(body.remarks || body.notes);

    // --- Match the job ---
    let job: any = null;
    if (explicitJobId) {
      try { job = await base44.asServiceRole.entities.Job.get(explicitJobId); } catch (e) { job = null; }
    }
    if (!job && jobRef) {
      const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
      const lc = jobRef.toLowerCase();
      job =
        jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === lc) ||
        jobs.find((j: any) => j.name && j.name.toLowerCase() === lc) ||
        jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(lc)) ||
        jobs.find((j: any) => j.name && j.name.toLowerCase().includes(lc));
    }

    if (!job) {
      await updateWebhookStatus(base44, config, 'failed', `Job not found for reference "${jobRef || explicitJobId || '—'}"`);
      return Response.json({ error: 'Could not match an existing job. Ensure job_reference matches the Job reference field.' }, { status: 422 });
    }

    // --- Load the job rate card so driller remarks can be auto-priced ---
    // (job-scoped rate cards take precedence over the Master Price List)
    const rateCardItems = await loadJobRateCardItems(base44, job.id);

    // --- Delete previous KeyLogBook-imported data for this job+date (overwrite mode) ---
    let deletedCount = 0;
    try {
      const existingRemarks = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'keylogbook_remarks', date: workDate });
      deletedCount = existingRemarks.length;
      if (deletedCount > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'keylogbook_remarks', date: workDate });
      }
      // Also clear previous ags_import logs for this job (overwrite mode)
      const existingAgs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'ags_import' });
      if (existingAgs.length > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'ags_import' });
        deletedCount += existingAgs.length;
      }
    } catch (e) { /* continue */ }

    // --- Identify the lead driller and full crew (for staff_name on remarks logs) ---
    // Priority: 1) HDPH_LOG / driller name embedded in the payload (actual KLB user)
    //           2) lead_driller_name from the webhook body
    //           No rota fallback — only the real KeyLogBook user is shown.
    // The FULL crew string is kept (not just the first comma-separated name) so
    // multi-person crews are fully attributed. crew_names is parsed from the
    // full string; leadDrillerName is the first name for staff_name display.
    let leadDrillerName = '';
    let leadDrillerId = '';
    let crewNames: string[] = [];

    // 1) Scan the AGS / borehole / log payloads for the actual KeyLogBook user
    //    who logged the data. HDPH_LOG is the primary field (the KLB user who
    //    logged each hole phase, e.g. "Kevin Price, Amir"). HDPH_CREW is the
    //    full crew. We keep the FULL string and parse all names — the first
    //    name becomes the Lead Driller for staff_name, the rest are kept in
    //    crew_names for full attribution.
    const agsNameFields = ['hdph_log', 'hdph_crew', 'driller_name', 'driller', 'logged_by', 'lead_driller', 'klb_user', 'logged_by_user', 'engineer', 'operator', 'recorded_by', 'inspected_by', 'user', 'username', 'account', 'account_name', 'user_name', 'log', 'crew'];
    const scanForCrew = (...arrs: any[][]) => {
      for (const arr of arrs) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          for (const f of agsNameFields) {
            const val = str(item[f]);
            if (val && !/^(unknown|n\/?a|none|test|null)$/i.test(val)) {
              return val; // return the FULL string, not just the first name
            }
          }
        }
      }
      return '';
    };
    const fullCrewStr = scanForCrew(body.boreholes, body.logs, body.remarks_data, body.ags_data, body.data ? [body.data] : []);
    if (fullCrewStr) {
      crewNames = parseCrewNames(fullCrewStr);
      leadDrillerName = crewNames[0] || '';
    }

    // 1b) Scan the top-level webhook body for KLB user/account fields
    if (!leadDrillerName) {
      const bodyUserFields = ['lead_driller_name', 'hdph_log', 'hdph_crew', 'driller_name', 'driller', 'klb_user', 'user', 'username', 'account', 'account_name', 'user_name', 'operator', 'logged_by', 'recorded_by'];
      for (const f of bodyUserFields) {
        const val = str((body as any)[f]);
        if (val && !/^(unknown|n\/?a|none|test|null)$/i.test(val)) {
          crewNames = parseCrewNames(val);
          leadDrillerName = crewNames[0] || '';
          break;
        }
      }
    }

    // 2) Fall back to the webhook body's explicit lead_driller_name
    if (!leadDrillerName) leadDrillerName = str(body.lead_driller_name);

    // NO rota fallback — per project preference, log attribution must use the
    // actual KeyLogBook user account name, ignoring rota-based defaults. If no
    // driller name is found in the payload, staff_name stays blank and the
    // manager can assign the correct driller during review.

    const logs: any[] = [];

    // --- Stream 1: Parse driller remarks into professionalised time-stamped activities ---
    const activities = parseRemarks(rawRemarks);
    let professionalised: string[] = [];
    if (activities.length > 0) {
      professionalised = await professionaliseActivities(base44, activities);
    }
    activities.forEach((activity, i) => {
      const cleanDesc = professionalised[i] || activity.raw_description;
      // Auto-price the activity against the project rate card. Try the cleaned
      // description first, then the raw driller wording (which often matches the
      // rate card terminology more closely, e.g. "bagging spoil").
      const match = resolveJobCharge(cleanDesc, rateCardItems, 1) ||
        resolveJobCharge(activity.raw_description, rateCardItems, 1);
      logs.push({
        job_id: job.id,
        staff_id: leadDrillerId || null,
        staff_name: leadDrillerName || '',
        date: workDate,
        log_type: 'other',
        source: 'keylogbook_remarks',
        logged_by_role: 'driller',
        start_time: activity.start_time,
        end_time: activity.end_time,
        duration_minutes: activity.duration_minutes,
        description: cleanDesc,
        raw_remarks: activity.raw_description,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        crew_names: crewNames,
        manager_review_status: dateUnconfirmed ? 'queried' : 'pending',
        chargeable: !!match,
        billing_status: match ? 'auto' : 'no_charge',
        charge_amount: match ? match.total : null,
        charge_breakdown: match ? JSON.stringify({
          source: 'job_rate_card',
          rate_card_item_id: match.rateCardItem.id,
          rate_card_item: match.rateCardItem.description,
          unit_price: match.unitPrice,
          quantity: match.quantity,
          total: match.total,
        }) : null,
      });
    });

    // Fallback: if remarks exist but didn't parse into activities, store as one entry
    if (activities.length === 0 && rawRemarks) {
      logs.push({
        job_id: job.id,
        staff_id: leadDrillerId || null,
        staff_name: leadDrillerName || '',
        date: workDate,
        log_type: 'other',
        source: 'keylogbook_remarks',
        logged_by_role: 'driller',
        description: rawRemarks,
        raw_remarks: rawRemarks,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        manager_review_status: dateUnconfirmed ? 'queried' : 'pending',
        chargeable: false,
        billing_status: 'no_charge',
      });
    }

    // --- Stream 2: Structured borehole data (AGS import — read-only technical records) ---
    const boreholes = Array.isArray(body.boreholes) ? body.boreholes : [];
    for (const bh of boreholes) {
      const bhRef = str(bh.reference || bh.borehole_ref || bh.id || bh.loca_id);
      const bhRemarks = str(bh.remarks || bh.notes || bh.description);
      const bhDepth = num(bh.final_depth || bh.depth || bh.depth_to);
      const bhMeterage = num(bh.meterage);
      // Parse LOCA_STAT → borehole_status (COMPLETE / INPROG / UNCHECKED)
      const bhStatRaw = str(bh.loca_stat || bh.stat || bh.status).toUpperCase();
      let bhStatus: string = '';
      if (bhStatRaw === 'COMPLETE' || bhStatRaw === 'COMPLETED' || bhStatRaw === 'C') bhStatus = 'complete';
      else if (bhStatRaw === 'INPROG' || bhStatRaw === 'IN_PROGRESS' || bhStatRaw === 'IN-PROG' || bhStatRaw === 'I') bhStatus = 'in_progress';
      else if (bhStatRaw === 'UNCHECKED' || bhStatRaw === 'UNCK' || bhStatRaw === 'U') bhStatus = 'unchecked';

      // Parse LOCA_TYPE → drilling_method (CP / Rotary / Mixed / Unknown)
      const bhTypeRaw = str(bh.loca_type || bh.type || bh.method);
      let bhMethod: string = 'unknown';
      const btUpper = bhTypeRaw.toUpperCase().trim();
      if (btUpper.includes('CP') || btUpper.includes('CABLE') || btUpper.includes('PERCUSSION')) bhMethod = 'cp';
      else if (btUpper.includes('RC') || btUpper.includes('ROT') || btUpper.includes('CORE') || btUpper === 'R') bhMethod = 'rotary';
      else if (btUpper.includes('MIX') || btUpper.includes('BOTH')) bhMethod = 'mixed';

      logs.push({
        job_id: job.id,
        staff_id: null,
        staff_name: leadDrillerName || '',
        date: londonDateFromInput(str(bh.date)) || workDate,
        log_type: 'borehole_progress',
        borehole_ref: bhRef || null,
        borehole_status: bhStatus || undefined,
        drilling_method: bhMethod !== 'unknown' ? bhMethod : undefined,
        depth_to: bhDepth || null,
        description: `Imported from KeyLogBook — borehole ${bhRef || '—'}${bhRemarks ? `: ${bhRemarks}` : ''}`,
        source: 'ags_import',
        logged_by_role: leadDrillerName ? 'driller' : undefined,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        crew_names: crewNames,
        manager_review_status: 'approved',
        chargeable: false,
      });
      if (bhMeterage != null) {
        logs[logs.length - 1].units_completed = bhMeterage;
        logs[logs.length - 1].units_label = 'metres';
      }
    }

    const genericLogs = Array.isArray(body.logs) ? body.logs : [];
    // Log types that represent driller remarks/diary text rather than technical
    // borehole data. Routed to the Site Logs tab (keylogbook_remarks, pending
    // review) so REM/DREM/TREM remark entries show up for manager approval.
    const REMARK_LOG_TYPES = new Set(['rem', 'drem', 'trem', 'remark', 'remarks', 'remark_log', 'diary', 'daily', 'driller_remark', 'note', 'notes']);
    for (const gl of genericLogs) {
      const glType = str(gl.log_type).toLowerCase();
      const isRemarkLog = REMARK_LOG_TYPES.has(glType) || REMARK_LOG_TYPES.has(str(gl.group || gl.source_group).toLowerCase());
      const desc = str(gl.description || gl.remarks || gl.notes) || (isRemarkLog ? 'Driller remark' : 'log entry');
      logs.push({
        job_id: job.id,
        staff_id: isRemarkLog ? (leadDrillerId || null) : null,
        staff_name: isRemarkLog ? (leadDrillerName || '') : '',
        date: londonDateFromInput(str(gl.date)) || workDate,
        log_type: isRemarkLog ? 'other' : (str(gl.log_type) || 'borehole_progress'),
        borehole_ref: str(gl.borehole_ref || gl.reference) || null,
        depth_from: num(gl.depth_from),
        depth_to: num(gl.depth_to),
        start_time: str(gl.start_time) || undefined,
        end_time: str(gl.end_time) || undefined,
        duration_minutes: num(gl.duration_minutes) || undefined,
        description: isRemarkLog ? desc : `Imported from KeyLogBook — ${desc}`,
        source: isRemarkLog ? 'keylogbook_remarks' : 'ags_import',
        logged_by_role: isRemarkLog ? 'driller' : undefined,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        manager_review_status: isRemarkLog ? (dateUnconfirmed ? 'queried' : 'pending') : 'approved',
        chargeable: false,
        billing_status: 'no_charge',
      });
    }

    // Merge duplicate-time keylogbook_remarks activities (same borehole +
    // start_time) into single entries — prevents overlapping records when
    // the structured logs and parsed remarks produce entries at the same time.
    const klbLogs = logs.filter(l => l.source === 'keylogbook_remarks');
    if (klbLogs.length > 1) {
      const nonKlb = logs.filter(l => l.source !== 'keylogbook_remarks');
      const mergedKlb = mergeDuplicateLogs(klbLogs);
      logs.length = 0;
      logs.push(...nonKlb, ...mergedKlb);
    }

    let insertedLogs = 0;
    if (logs.length > 0) {
      for (let i = 0; i < logs.length; i += 500) {
        const batch = logs.slice(i, i + 500);
        await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
        insertedLogs += batch.length;
      }
    }

    // --- Auto-approve site logs and generate the timesheet (fully automatic) ---
    // KeyLogBook remarks are auto-approved and a submitted daily summary
    // timesheet is generated immediately — no manual manager review step.
    // The manager can still edit/reject in the Timesheets tab afterwards.
    let timesheetResult: any = null;
    const remarksCount = logs.filter(l => l.source === 'keylogbook_remarks').length;
    if (remarksCount > 0) {
      try {
        timesheetResult = await generateKeyLogBookTimesheet(base44, job.id, workDate, leadDrillerId || undefined);
      } catch (e) {
        // Timesheet generation failure is non-fatal — logs are still saved
        timesheetResult = { status: 'error', message: String(e.message || e) };
      }
    }

    // --- Update the config with the last webhook status ---
    const agsCount = logs.filter(l => l.source === 'ags_import').length;
    const tsMsg = timesheetResult?.status === 'success'
      ? ` · timesheet auto-generated for ${timesheetResult.staff_name || 'driller'}`
      : timesheetResult?.status === 'no_logs'
        ? ''
        : ' · timesheet generation failed';
    const summary = `Processed ${insertedLogs} log entr${insertedLogs === 1 ? 'y' : 'ies'}${remarksCount > 0 ? ` · ${remarksCount} site log activit${remarksCount === 1 ? 'y' : 'ies'} (auto-approved)` : ''}${agsCount > 0 ? ` · ${agsCount} borehole record${agsCount === 1 ? '' : 's'}` : ''}${tsMsg}`;
    await updateWebhookStatus(base44, config, 'success', summary);

    return Response.json({
      status: 'success',
      job_id: job.id,
      job_name: job.name,
      deleted: deletedCount,
      logs_inserted: insertedLogs,
      remarks_activities: remarksCount,
      borehole_records: agsCount,
      lead_driller: leadDrillerName || '',
      timesheet: timesheetResult,
      summary,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
      if (configs[0]) {
        await updateWebhookStatus(base44, configs[0], 'failed', error.message);
      }
    } catch (e) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function updateWebhookStatus(base44: any, config: any, status: string, summary: string) {
  await base44.asServiceRole.entities.KeyLogBookConfig.update(config.id, {
    last_webhook_at: new Date().toISOString(),
    last_webhook_status: status,
    last_webhook_summary: summary,
  });
}