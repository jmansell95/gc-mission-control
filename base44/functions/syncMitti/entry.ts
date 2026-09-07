import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
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
// Mitti API docs: https://developer.mitti.com/
// Base URL: https://api.mitti.com

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

  // ── Step 1: Sync templates (forms list) ──
  let templatesSynced = 0;
  let syncedTemplates: any[] = [];
  try {
    const templateSearchUrl = 'https://api.mitti.com/templates/search?field=template_id&field=name&field=modified_at&field=created_at&archived=both&owner=all&limit=1000';
    const templateResp = await fetch(templateSearchUrl, {
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Accept': 'application/json',
      },
    });
    if (templateResp.ok) {
      const templatePage = await templateResp.json();
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
      errors.push(`Template search: API returned ${templateResp.status}`);
    }
  } catch (err) {
    errors.push(`Template search: ${err.message}`);
  }

  // ── Step 2: Search for audits ──
  // Incremental sync: modified_after = last_pull_sync_at || (now - sync_window_days)
  const syncWindowDays = config.sync_window_days || 90;
  const modifiedAfter = config.last_pull_sync_at
    ? config.last_pull_sync_at
    : new Date(Date.now() - syncWindowDays * 24 * 60 * 60 * 1000).toISOString();

  const searchUrl = `https://api.mitti.com/audits/search?field=audit_id&field=modified_at&field=template_id&modified_after=${encodeURIComponent(modifiedAfter)}&order=asc&limit=100`;

  let auditEntries: any[] = [];
  try {
    const resp = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({
        error: `Mitti API returned ${resp.status}`,
        details: errText.slice(0, 500),
      }, { status: 502 });
    }

    const page = await resp.json();
    auditEntries = Array.isArray(page.audits) ? page.audits : [];
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
      stored: 0,
      updated: 0,
      skipped: 0,
      linked_jobs: 0,
      templates_synced: templatesSynced,
      errors: errors.slice(0, 5),
    });
  }

  // ── Step 3: Fetch full audit data ──
  // Cap individual fetches to avoid timeout (each fetch ~0.7s)
  const MAX_FETCHES = 50;
  const toFetch = auditEntries.slice(0, MAX_FETCHES);
  const fullAudits: any[] = [];

  for (const entry of toFetch) {
    const auditId = String(entry.audit_id || '');
    if (!auditId) continue;
    try {
      const auditResp = await fetch(`https://api.mitti.com/audits/${auditId}`, {
        headers: {
          'Authorization': `Bearer ${config.api_token}`,
          'Accept': 'application/json',
        },
      });
      if (!auditResp.ok) {
        errors.push(`Audit ${auditId}: API returned ${auditResp.status}`);
        continue;
      }
      const fullAudit = await auditResp.json();
      // Attach template_id from search result if not in the full payload
      if (!fullAudit.template_id && entry.template_id) {
        fullAudit.template_id = entry.template_id;
      }
      fullAudits.push(fullAudit);
    } catch (err) {
      errors.push(`Audit ${auditId}: ${err.message}`);
    }
  }

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

  let stored = 0;
  let updated = 0;
  let skipped = 0;
  let linkedJobs = 0;
  let stampedAssignments = 0;

  for (const audit of fullAudits) {
    try {
      // Determine division_id from auditor's email → Staff → division_id
      const auditorEmail: string = String(
        audit?.audit_data?.authorship?.email ||
        audit?.authorship?.email ||
        audit?.owner?.email ||
        ''
      );
      const divisionId = auditorEmail
        ? (emailToDivision[auditorEmail.toLowerCase()] || null)
        : null;

      const result = await processAndStoreAudit(base44, audit, config, jobs, allStaff, divisionId);
      if (result.stored) stored++;
      else if (result.updated) updated++;
      else skipped++;
      if (result.jobId) linkedJobs++;
      if (result.stampedAssignments) stampedAssignments += result.stampedAssignments;
    } catch (err) {
      errors.push(`Audit ${audit.audit_id || '?'}: ${err.message}`);
      skipped++;
    }
  }

  // Advance the sync cursor to the newest modified_at in this batch
  // (order=asc means the last entry has the newest timestamp)
  let latestModified = new Date().toISOString();
  if (auditEntries.length > 0) {
    const lastEntry = auditEntries[auditEntries.length - 1];
    if (lastEntry?.modified_at) {
      latestModified = lastEntry.modified_at;
    }
  }

  const remaining = auditEntries.length > MAX_FETCHES ? auditEntries.length - MAX_FETCHES : 0;
  const summary = `Pull sync: ${stored} new, ${updated} updated, ${linkedJobs} jobs linked${stampedAssignments > 0 ? `, ${stampedAssignments} checks verified` : ''}${templatesSynced > 0 ? ` · ${templatesSynced} templates synced` : ''}${remaining > 0 ? ` (${remaining} more pending next run)` : ''}`;

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
    fetched: fullAudits.length,
    stored,
    updated,
    skipped,
    linked_jobs: linkedJobs,
    stamped_assignments: stampedAssignments,
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