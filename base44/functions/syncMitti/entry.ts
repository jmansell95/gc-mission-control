import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { processAndStoreAudit } from '../../shared/mittiAudit.ts';

// ============================================================
// Mitti (formerly SafetyCulture / iAuditor) pull-based sync
// ============================================================
// Pulls audits AND templates from the Mitti REST API:
//   1. GET /templates/search  → all form/template definitions
//   2. GET /audits/search     → audit IDs modified since last sync
//   3. GET /audits/{id}       → full audit payload for each
//
// Stores each audit as a SafetyReport with template_id and
// division_id (auto-tagged from the auditor's Staff record).
// Templates are cached in MittiConfig.synced_templates.
//
// Improvements:
//   • Pre-fetch dedup — checks existing SafetyReport records before
//     hitting the Mitti API, skipping already-stored audits.
//   • Parallel fetching — fetches audits in sub-batches of 10
//     concurrently using Promise.allSettled, ~5× faster.
//   • Rate-limit backoff — on 429/503, waits 1s/2s/4s and retries
//     (max 3 retries per audit).
//   • Safe cursor — stores the exact max modified_at string (not
//     +1ms) and uses $gte filtering to avoid skipping audits.
//   • Richer progress payload — returns total_pending, fetched,
//     stored, errors for the frontend progress indicator.

const BACKOFF_MS = [1000, 2000, 4000];
const PARALLEL_SIZE = 10;
const MAX_FETCHES = 60;

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 3,
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { headers });
      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, status: resp.status, data };
      }
      if ((resp.status === 429 || resp.status === 503) && attempt < retries) {
        const delay = BACKOFF_MS[attempt] || BACKOFF_MS[BACKOFF_MS.length - 1];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      const errText = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: `API ${resp.status}: ${errText.slice(0, 200)}` };
    } catch (err) {
      if (attempt < retries) {
        const delay = BACKOFF_MS[attempt] || BACKOFF_MS[BACKOFF_MS.length - 1];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { ok: false, status: 0, error: err.message };
    }
  }
  return { ok: false, status: 0, error: 'Max retries exceeded' };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Load config singleton
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.MittiConfig.filter({ key: 'global' });
      config = configs && configs[0];
    } catch (e) { /* entity may not exist yet */ }

    if (!config) {
      return Response.json({ error: 'Mitti not configured.' }, { status: 422 });
    }
    if (!config.api_token) {
      return Response.json({ error: 'No API token configured. Add one in Settings → Mitti.' }, { status: 422 });
    }

    const errors: string[] = [];
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.api_token}`,
      'Accept': 'application/json',
    };

    // ── Step 1: Sync templates (forms list) ──
    let templatesSynced = 0;
    let syncedTemplates: any[] = [];
    try {
      const templateSearchUrl = 'https://api.mitti.com/templates/search?field=template_id&field=name&field=modified_at&field=created_at&archived=both&owner=all&limit=1000';
      const templateResp = await fetchWithRetry(templateSearchUrl, headers);
      if (templateResp.ok) {
        const templatePage = templateResp.data;
        const rawTemplates = Array.isArray(templatePage.templates) ? templatePage.templates : [];
        syncedTemplates = rawTemplates
          .map((t: any) => ({
            template_id: String(t.template_id || ''),
            name: String(t.name || ''),
            modified_at: String(t.modified_at || ''),
            created_at: String(t.created_at || ''),
          }))
          .filter((t: any) => t.template_id);
        templatesSynced = syncedTemplates.length;
      } else {
        errors.push(`Template search: ${templateResp.error || templateResp.status}`);
      }
    } catch (err) {
      errors.push(`Template search: ${err.message}`);
    }

    // ── Step 2: Search for audits ──
    const syncWindowDays = config.sync_window_days || 90;
    const modifiedAfter = config.last_pull_sync_at
      ? config.last_pull_sync_at
      : new Date(Date.now() - syncWindowDays * 24 * 60 * 60 * 1000).toISOString();

    const searchUrl = `https://api.mitti.com/audits/search?field=audit_id&field=modified_at&field=template_id&modified_after=${encodeURIComponent(modifiedAfter)}&order=asc&limit=1000`;

    let auditEntries: any[] = [];
    try {
      const searchResult = await fetchWithRetry(searchUrl, headers);
      if (!searchResult.ok) {
        return Response.json({
          error: 'Failed to search Mitti audits',
          details: searchResult.error,
        }, { status: 502 });
      }
      auditEntries = Array.isArray(searchResult.data.audits) ? searchResult.data.audits : [];
    } catch (err) {
      return Response.json({ error: 'Failed to reach Mitti API', details: err.message }, { status: 502 });
    }

    if (auditEntries.length === 0) {
      const summary = `Pull sync: 0 audits since ${modifiedAfter.slice(0, 10)}${templatesSynced > 0 ? ` · ${templatesSynced} templates synced` : ''}`;
      try {
        const updateData: any = {
          last_webhook_at: new Date().toISOString(),
          last_webhook_status: 'success',
          last_webhook_summary: summary,
          last_pull_sync_at: new Date().toISOString(),
        };
        if (templatesSynced > 0) {
          updateData.synced_templates = syncedTemplates;
          updateData.last_templates_sync_at = new Date().toISOString();
        }
        await base44.asServiceRole.entities.MittiConfig.update(config.id, updateData);
      } catch (e) { /* non-fatal */ }
      return Response.json({
        status: 'success',
        pulled: 0,
        fetched: 0,
        stored: 0,
        updated: 0,
        skipped: 0,
        dedup_skipped: 0,
        linked_jobs: 0,
        total_pending: 0,
        templates_synced: templatesSynced,
        errors: errors.slice(0, 5),
      });
    }

    // ── Pre-fetch dedup: check which audit_ids already exist ──
    const allAuditIds = auditEntries.map((e: any) => String(e.audit_id || '')).filter(Boolean);
    const existingIds = new Set<string>();
    if (allAuditIds.length > 0) {
      try {
        const existing = await base44.asServiceRole.entities.SafetyReport.filter({
          safetyculture_audit_id: { $in: allAuditIds },
        });
        for (const r of existing) {
          if (r.safetyculture_audit_id) existingIds.add(r.safetyculture_audit_id);
        }
      } catch (e) { /* non-fatal */ }
    }

    // Filter out already-stored audits
    const toFetchEntries = auditEntries.filter((e: any) => {
      const aid = String(e.audit_id || '');
      return aid && !existingIds.has(aid);
    });
    const dedupSkipped = auditEntries.length - toFetchEntries.length;

    // Cap at MAX_FETCHES per run
    const toFetch = toFetchEntries.slice(0, MAX_FETCHES);
    const remaining = toFetchEntries.length > MAX_FETCHES ? toFetchEntries.length - MAX_FETCHES : 0;

    // Load jobs and staff once for matching
    let jobs: any[] = [];
    if (config.auto_link_to_jobs) {
      try { jobs = await base44.asServiceRole.entities.Job.list('-created_date', 200); } catch (e) { /* continue */ }
    }
    let allStaff: any[] = [];
    try { allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500); } catch (e) { /* continue */ }

    // Build email → division_id map for auto-tagging
    const emailToDivision: Record<string, string> = {};
    for (const s of allStaff) {
      if (s.email && s.division_id) {
        emailToDivision[s.email.toLowerCase()] = s.division_id;
      }
    }

    // ── Step 3: Parallel fetch in sub-batches of PARALLEL_SIZE ──
    const fetchResults: any[] = [];
    for (let i = 0; i < toFetch.length; i += PARALLEL_SIZE) {
      const subBatch = toFetch.slice(i, i + PARALLEL_SIZE);
      const settled = await Promise.allSettled(
        subBatch.map(async (entry) => {
          const auditId = String(entry.audit_id || '');
          const fetchResult = await fetchWithRetry(
            `https://api.mitti.com/audits/${auditId}`,
            headers,
          );
          return { entry, fetchResult };
        }),
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          fetchResults.push(s.value);
        } else {
          fetchResults.push({
            entry: { audit_id: '', template_id: '' },
            fetchResult: { ok: false, status: 0, error: s.reason?.message || 'Network error' },
          });
        }
      }
    }

    // ── Process fetched audits sequentially (DB writes) ──
    let stored = 0, updated = 0, skipped = 0, linkedJobs = 0, stampedAssignments = 0;

    for (const { entry, fetchResult } of fetchResults) {
      const auditId = String(entry.audit_id || '');
      if (!fetchResult.ok) {
        errors.push(`Audit ${auditId}: ${fetchResult.error || fetchResult.status}`);
        skipped++;
        continue;
      }

      const fullAudit = fetchResult.data;
      if (!fullAudit.template_id && entry.template_id) {
        fullAudit.template_id = entry.template_id;
      }

      try {
        const auditorEmail: string = String(
          fullAudit?.audit_data?.authorship?.email ||
          fullAudit?.authorship?.email ||
          fullAudit?.owner?.email ||
          '',
        );
        const divisionId = auditorEmail
          ? (emailToDivision[auditorEmail.toLowerCase()] || null)
          : null;

        const result = await processAndStoreAudit(base44, fullAudit, config, jobs, allStaff, divisionId);
        if (result.stored) stored++;
        else if (result.updated) updated++;
        else skipped++;
        if (result.jobId) linkedJobs++;
        if (result.stampedAssignments) stampedAssignments += result.stampedAssignments;
      } catch (err) {
        errors.push(`Audit ${auditId}: ${err.message}`);
        skipped++;
      }
    }

    // ── Safe cursor: store the exact max modified_at from FETCHED audits ──
    // Use the raw timestamp string (not +1ms) to avoid skipping audits that
    // share the same modified_at. The next run uses modified_after >= this
    // value and the pre-fetch dedup filters out already-stored IDs.
    let latestModified = new Date().toISOString();
    let maxModifiedDate: Date | null = null;
    for (const { entry } of fetchResults) {
      const modStr = entry?.modified_at;
      if (!modStr) continue;
      const d = new Date(modStr);
      if (!isNaN(d.getTime()) && (!maxModifiedDate || d > maxModifiedDate)) {
        maxModifiedDate = d;
        latestModified = modStr;
      }
    }

    const summary = `Pull sync: ${stored} new, ${updated} updated, ${dedupSkipped} dedup-skipped, ${linkedJobs} jobs linked${stampedAssignments > 0 ? `, ${stampedAssignments} checks verified` : ''}${templatesSynced > 0 ? ` · ${templatesSynced} templates synced` : ''}${remaining > 0 ? ` (${remaining} more pending next run)` : ''}`;

    try {
      const updateData: any = {
        last_webhook_at: new Date().toISOString(),
        last_webhook_status: 'success',
        last_webhook_summary: summary,
        last_pull_sync_at: latestModified,
      };
      if (templatesSynced > 0) {
        updateData.synced_templates = syncedTemplates;
        updateData.last_templates_sync_at = new Date().toISOString();
      }
      await base44.asServiceRole.entities.MittiConfig.update(config.id, updateData);
    } catch (e) { /* non-fatal */ }

    return Response.json({
      status: 'success',
      pulled: auditEntries.length,
      dedup_skipped: dedupSkipped,
      fetched: fetchResults.length,
      stored,
      updated,
      skipped,
      linked_jobs: linkedJobs,
      stamped_assignments: stampedAssignments,
      total_pending: remaining,
      templates_synced: templatesSynced,
      errors: errors.slice(0, 5),
    });
  } catch (topErr) {
    return Response.json({
      error: 'Sync failed',
      details: topErr?.message || String(topErr),
      stack: topErr?.stack?.slice(0, 500),
    }, { status: 500 });
  }
});