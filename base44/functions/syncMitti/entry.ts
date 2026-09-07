import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processAndStoreAudit } from '../../shared/mittiAudit.ts';

// ============================================================
// Mitti (formerly SafetyCulture / iAuditor) pull-based sync
// ============================================================
// Pulls recent audits from the Mitti REST API using the stored
// API token (MittiConfig.api_token). Two-step flow:
//   1. GET /audits/search  → list of audit IDs modified recently
//   2. GET /audits/{id}    → full audit payload for each
// Stores each audit as a SafetyReport and stamps RotaAssignments.
//
// Mitti API docs: https://developer.mitti.com/
// Base URL: https://api.mitti.com

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

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

  // ── Step 1: Search for audits modified in the last 24 hours ──
  const modifiedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const searchUrl = `https://api.mitti.com/audits/search?field=audit_id&field=modified_at&field=template_id&modified_after=${encodeURIComponent(modifiedAfter)}&order=desc&limit=100`;

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
    try {
      await base44.asServiceRole.entities.MittiConfig.update(config.id, {
        last_webhook_at: new Date().toISOString(),
        last_webhook_status: 'success',
        last_webhook_summary: 'Pull sync: 0 audits found in last 24h',
      });
    } catch (e) { /* non-fatal */ }
    return Response.json({ status: 'success', pulled: 0, stored: 0, updated: 0, skipped: 0, linked_jobs: 0, errors: [] });
  }

  // ── Step 2: Fetch full audit data for each audit ID ──
  // Cap at 50 individual fetches to avoid timeout
  const MAX_FETCHES = 50;
  const toFetch = auditEntries.slice(0, MAX_FETCHES);
  const errors: string[] = [];
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

  let stored = 0;
  let updated = 0;
  let skipped = 0;
  let linkedJobs = 0;
  let stampedAssignments = 0;

  for (const audit of fullAudits) {
    try {
      const result = await processAndStoreAudit(base44, audit, config, jobs, allStaff);
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

  // Update config status
  const summary = `Pull sync: ${stored} new, ${updated} updated, ${linkedJobs} jobs linked${stampedAssignments > 0 ? `, ${stampedAssignments} checks verified` : ''}${auditEntries.length > MAX_FETCHES ? ` (${auditEntries.length - MAX_FETCHES} more in last 24h)` : ''}`;
  try {
    await base44.asServiceRole.entities.MittiConfig.update(config.id, {
      last_webhook_at: new Date().toISOString(),
      last_webhook_status: 'success',
      last_webhook_summary: summary,
    });
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
    errors: errors.slice(0, 5),
  });
});