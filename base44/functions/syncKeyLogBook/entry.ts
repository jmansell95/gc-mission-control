import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { parseRemarks, professionaliseActivities } from '../../shared/keylogbookRemarks.ts';
import { loadJobRateCardItems, resolveJobCharge } from '../../shared/jobRateMatcher.ts';
import { generateKeyLogBookTimesheet } from '../../shared/keylogbookTimesheet.ts';

// ============================================================
// KeyLogBook Pull Sync — backfill + incremental sync from the
// KeyLogBook REST API. Complements the real-time webhook
// (receiveKeyLogBookData) by fetching historical data and
// catching any webhook misses on a 30-minute schedule.
//
// KeyLogBook's API is not publicly documented — the endpoint
// paths below are best-effort assumptions. Adjust the ENDPOINTS
// map once the real API shape is confirmed.
// ============================================================

const REQUEST_DELAY_MS = 1500; // pace to avoid rate limiting
const MAX_RETRIES = 3;

// KeyLogBook API endpoint paths — adjust once the real API is confirmed
const ENDPOINTS = {
  projects: '/projects',
  boreholes: (pid: string) => `/projects/${pid}/boreholes`,
  remarks: (pid: string) => `/projects/${pid}/remarks`,
};

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function klbFetch(baseUrl: string, path: string, apiKey: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(baseUrl.replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  let lastErr: any;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      });
      if (res.status === 429 || res.status >= 500) {
        await delay(REQUEST_DELAY_MS * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`KeyLogBook API ${res.status}: ${text || res.statusText}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_RETRIES - 1) await delay(REQUEST_DELAY_MS);
    }
  }
  throw lastErr;
}

// Extract array from common REST API response wrappers
function extractArray(resp: any): any[] {
  if (Array.isArray(resp)) return resp;
  if (!resp) return [];
  return resp.data || resp.results || resp.items || resp.projects || resp.boreholes || resp.remarks || [];
}

// Extract next-page cursor/token from common pagination wrappers
function extractNextPage(resp: any): any {
  if (!resp) return null;
  return resp.next_page_token || resp.next_cursor || resp.cursor || resp.next || resp.pagination?.next || null;
}

function str(v: any): string { return v == null ? '' : String(v).trim(); }
function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// Idempotent upsert: if a log with this external_klb_id exists, update it;
// otherwise create a new one. Returns true if a new record was created.
async function upsertLog(base44: any, logData: Record<string, any>, externalKlbId: string): Promise<boolean> {
  if (externalKlbId) {
    const existing = await base44.asServiceRole.entities.InvestigationLog.filter({ external_klb_id: externalKlbId });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.InvestigationLog.update(existing[0].id, logData);
      return false;
    }
  }
  await base44.asServiceRole.entities.InvestigationLog.create({
    ...logData,
    ...(externalKlbId ? { external_klb_id: externalKlbId } : {}),
  });
  return true;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Manual invocation requires admin; scheduled runs have no user context
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (e) { /* scheduled run — no user context, proceed */ }

    // --- Load config ---
    const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
    const config = configs?.[0];
    if (!config || !config.api_base_url || !config.api_key) {
      // Graceful skip — don't rack up consecutive failures while credentials
      // are unconfigured. Returns 200 so the scheduled automation stays healthy.
      const reason = !config
        ? 'KeyLogBook config not found — configure it in Settings first'
        : 'KeyLogBook API base URL and API key not configured — set them in Settings → KeyLogBook → API details';
      return Response.json({ status: 'skipped', reason }, { status: 200 });
    }

    const baseUrl: string = config.api_base_url;
    const apiKey: string = config.api_key;
    const lastSync: string | null = config.last_pull_sync_at || null;
    const syncParams = lastSync ? { modified_since: lastSync } : {};

    // --- Fetch all projects (paginated) ---
    const allProjects: any[] = [];
    let pageParam: Record<string, any> = {};
    let pageCount = 0;
    while (pageCount < 100) {
      const resp = await klbFetch(baseUrl, ENDPOINTS.projects, apiKey, pageParam);
      const items = extractArray(resp);
      allProjects.push(...items);
      const next = extractNextPage(resp);
      if (!next || items.length === 0) break;
      pageParam = typeof next === 'object' ? next : { page: next };
      pageCount++;
      await delay(REQUEST_DELAY_MS);
    }

    // --- Load all jobs once for matching ---
    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const matchJob = (ref: string, name: string) => {
      const lcRef = (ref || '').toLowerCase();
      const lcName = (name || '').toLowerCase();
      if (!lcRef && !lcName) return null;
      return allJobs.find((j: any) => j.job_reference?.toLowerCase() === lcRef) ||
             allJobs.find((j: any) => j.name?.toLowerCase() === lcName) ||
             (lcRef ? allJobs.find((j: any) => j.job_reference?.toLowerCase().includes(lcRef)) : null) ||
             (lcName ? allJobs.find((j: any) => j.name?.toLowerCase().includes(lcName)) : null);
    };

    let projectsProcessed = 0, boreholesImported = 0, remarksImported = 0, timesheetsGenerated = 0;
    const errors: string[] = [];

    // --- Process each project ---
    for (const project of allProjects) {
      const pid = str(project.id || project.project_id || project.uuid);
      const pname = str(project.name || project.project_name || project.title);
      const pref = str(project.reference || project.project_ref || project.project_number || project.code);
      if (!pid) continue;

      const job = matchJob(pref, pname);
      if (!job) {
        errors.push(`Project "${pref || pname || pid}" — no matching job found`);
        continue;
      }
      projectsProcessed++;

      // --- Boreholes for this project ---
      try {
        const bhResp = await klbFetch(baseUrl, ENDPOINTS.boreholes(pid), apiKey, syncParams);
        for (const bh of extractArray(bhResp)) {
          const bhId = str(bh.id || bh.borehole_id || bh.uuid);
          const extId = bhId ? `klb_bh_${bhId}` : '';
          const bhRef = str(bh.reference || bh.borehole_ref || bh.loca_id || bh.id);
          const bhRemarks = str(bh.remarks || bh.notes || bh.description);
          const bhDepth = num(bh.final_depth || bh.depth || bh.depth_to);
          const bhMeterage = num(bh.meterage);
          const bhDate = str(bh.date || bh.log_date) || new Date().toISOString().slice(0, 10);

          await upsertLog(base44, {
            job_id: job.id, staff_id: null, date: bhDate,
            log_type: 'borehole_progress',
            borehole_ref: bhRef || null,
            depth_to: bhDepth || null,
            description: `Imported from KeyLogBook — borehole ${bhRef || '—'}${bhRemarks ? `: ${bhRemarks}` : ''}`,
            source: 'ags_import',
            completed_by_type: 'internal_staff',
            completed_by_name: 'KeyLogBook Pull Sync',
            manager_review_status: 'approved',
            chargeable: false,
            ...(bhMeterage != null ? { units_completed: bhMeterage, units_label: 'metres' } : {}),
          }, extId);
          boreholesImported++;
        }
        await delay(REQUEST_DELAY_MS);
      } catch (e: any) {
        errors.push(`Boreholes for "${pref || pname}": ${e.message}`);
      }

      // --- Remarks/diary for this project ---
      try {
        const remResp = await klbFetch(baseUrl, ENDPOINTS.remarks(pid), apiKey, syncParams);
        const rateCardItems = await loadJobRateCardItems(base44, job.id);
        const remarks = extractArray(remResp);

        for (const rem of remarks) {
          const rid = str(rem.id || rem.remark_id || rem.uuid);
          const rawRemarks = str(rem.remarks || rem.notes || rem.text || rem.diary);
          const workDate = str(rem.date || rem.log_date) || new Date().toISOString().slice(0, 10);
          const drillerName = str(rem.driller_name || rem.lead_driller_name || rem.logged_by);

          let activities = parseRemarks(rawRemarks);

          // If inline parsing found no activities but the API object has
          // structured time fields, build activities from those instead so
          // site logs get real clock times rather than null.
          if (activities.length === 0) {
            const remStart = str(rem.start_time);
            const remEnd = str(rem.end_time);
            const remDuration = num(rem.duration_minutes);
            if (remStart || remEnd || remDuration != null) {
              activities = [{
                start_time: remStart,
                end_time: remEnd,
                duration_minutes: remDuration || 0,
                raw_description: rawRemarks || str(rem.description || rem.activity || 'Driller activity'),
              }];
            }
            // Also check for an activities array on the remark object
            if (activities.length === 0 && Array.isArray(rem.activities)) {
              activities = rem.activities
                .filter((a: any) => str(a.start_time) || str(a.end_time) || num(a.duration_minutes) != null)
                .map((a: any) => ({
                  start_time: str(a.start_time),
                  end_time: str(a.end_time),
                  duration_minutes: num(a.duration_minutes) || 0,
                  raw_description: str(a.description || a.text || a.activity || 'Driller activity'),
                }));
            }
          }

          const professionalised = activities.length > 0 ? await professionaliseActivities(base44, activities) : [];

          // Fallback: raw remarks that didn't parse into activities
          if (activities.length === 0 && rawRemarks) {
            const extId = rid ? `klb_rem_${rid}` : '';
            await upsertLog(base44, {
              job_id: job.id, staff_id: null, staff_name: drillerName || '',
              date: workDate, log_type: 'other', source: 'keylogbook_remarks',
              logged_by_role: 'driller', description: rawRemarks,
              completed_by_type: 'internal_staff', completed_by_name: drillerName || 'KeyLogBook Pull Sync',
              manager_review_status: 'pending', chargeable: false, billing_status: 'no_charge',
            }, extId);
            remarksImported++;
          }

          // Each parsed activity → its own InvestigationLog entry
          for (let i = 0; i < activities.length; i++) {
            const a = activities[i];
            const cleanDesc = professionalised[i] || a.raw_description;
            const match = resolveJobCharge(cleanDesc, rateCardItems, 1) ||
              resolveJobCharge(a.raw_description, rateCardItems, 1);
            const extId = rid ? `klb_rem_${rid}_${i}` : '';

            await upsertLog(base44, {
              job_id: job.id, staff_id: null, staff_name: drillerName || '',
              date: workDate, log_type: 'other', source: 'keylogbook_remarks',
              logged_by_role: 'driller', start_time: a.start_time, end_time: a.end_time,
              duration_minutes: a.duration_minutes, description: cleanDesc,
              completed_by_type: 'internal_staff', completed_by_name: drillerName || 'KeyLogBook Pull Sync',
              manager_review_status: 'pending',
              chargeable: !!match, billing_status: match ? 'auto' : 'no_charge',
              charge_amount: match ? match.total : null,
              charge_breakdown: match ? JSON.stringify({
                source: 'job_rate_card', rate_card_item_id: match.rateCardItem.id,
                rate_card_item: match.rateCardItem.description, unit_price: match.unitPrice,
                quantity: match.quantity, total: match.total,
              }) : null,
            }, extId);
            remarksImported++;
          }

          // Auto-generate timesheet for this date's remarks
          if (activities.length > 0 || rawRemarks) {
            try {
              const ts = await generateKeyLogBookTimesheet(base44, job.id, workDate);
              if (ts?.status === 'success') timesheetsGenerated++;
            } catch (e) { /* non-fatal */ }
          }
        }
        await delay(REQUEST_DELAY_MS);
      } catch (e: any) {
        errors.push(`Remarks for "${pref || pname}": ${e.message}`);
      }
    }

    // --- Update config with sync status ---
    const summary = `Pulled ${projectsProcessed} project(s) · ${boreholesImported} borehole record(s) · ${remarksImported} remark activit(ies)${timesheetsGenerated > 0 ? ` · ${timesheetsGenerated} timesheet(s) generated` : ''}${errors.length > 0 ? ` · ${errors.length} error(s)` : ''}`;
    await base44.asServiceRole.entities.KeyLogBookConfig.update(config.id, {
      last_pull_sync_at: new Date().toISOString(),
      last_pull_sync_status: projectsProcessed === 0 && errors.length > 0 ? 'failed' : 'success',
      last_pull_sync_summary: summary,
    });

    return Response.json({
      status: 'success',
      projects_total: allProjects.length,
      projects_processed: projectsProcessed,
      boreholes_imported: boreholesImported,
      remarks_imported: remarksImported,
      timesheets_generated: timesheetsGenerated,
      errors: errors.slice(0, 10),
      summary,
    });
  } catch (error: any) {
    // Log failure to config so the status panel surfaces it
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
      if (configs?.[0]) {
        await base44.asServiceRole.entities.KeyLogBookConfig.update(configs[0].id, {
          last_pull_sync_at: new Date().toISOString(),
          last_pull_sync_status: 'failed',
          last_pull_sync_summary: error.message,
        });
      }
    } catch (e) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
}