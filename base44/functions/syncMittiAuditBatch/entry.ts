import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { processAndStoreAudit } from '../../shared/mittiAudit.ts';

// ============================================================
// syncMittiAuditBatch — step 3 of the live sync flow
// ============================================================
// Accepts an array of audit IDs (max 10 per call), fetches each
// audit's full payload from GET /audits/{id}, and stores it as a
// SafetyReport via processAndStoreAudit. Returns per-audit results
// so the frontend can show "Stored: <title>", "Updated: <title>",
// or "Error: <message>" for each audit in real time.
//
// The frontend calls this in a loop, 10 audits at a time, updating
// the progress bar after each batch.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const auditEntries: any[] = Array.isArray(body?.audit_entries) ? body.audit_entries : [];

    if (auditEntries.length === 0) {
      return Response.json({ error: 'audit_entries array is required' }, { status: 422 });
    }

    // Cap at 10 per call to avoid timeout
    const batch = auditEntries.slice(0, 10);

    // Load config
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.MittiConfig.filter({ key: 'global' });
      config = configs && configs[0];
    } catch (e) { /* continue */ }

    if (!config) {
      return Response.json({ error: 'Mitti not configured.' }, { status: 422 });
    }
    if (!config.api_token) {
      return Response.json({ error: 'No API token configured.' }, { status: 422 });
    }

    // Preload jobs and staff for matching (once per batch)
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

    const results: any[] = [];
    let stored = 0, updated = 0, skipped = 0, linkedJobs = 0, errors = 0;

    for (const entry of batch) {
      const auditId = String(entry.audit_id || '');
      if (!auditId) {
        results.push({ audit_id: '', status: 'error', error: 'No audit_id', title: '' });
        errors++;
        continue;
      }

      try {
        // Fetch the full audit from Mitti
        const auditResp = await fetch(`https://api.mitti.com/audits/${auditId}`, {
          headers: {
            'Authorization': `Bearer ${config.api_token}`,
            'Accept': 'application/json',
          },
        });

        if (!auditResp.ok) {
          results.push({ audit_id: auditId, status: 'error', error: `API returned ${auditResp.status}`, title: '' });
          errors++;
          continue;
        }

        const fullAudit = await auditResp.json();
        // Attach template_id from search result if not in the full payload
        if (!fullAudit.template_id && entry.template_id) {
          fullAudit.template_id = entry.template_id;
        }

        // Determine division_id from auditor's email
        const auditorEmail: string = String(
          fullAudit?.audit_data?.authorship?.email ||
          fullAudit?.authorship?.email ||
          fullAudit?.owner?.email ||
          ''
        );
        const divisionId = auditorEmail
          ? (emailToDivision[auditorEmail.toLowerCase()] || null)
          : null;

        // Process and store
        const result = await processAndStoreAudit(base44, fullAudit, config, jobs, allStaff, divisionId);

        // Extract a display title for the progress log
        const title = String(fullAudit?.audit_data?.name || fullAudit?.name || auditId);

        if (result.stored) {
          stored++;
          results.push({ audit_id: auditId, status: 'stored', title, job_id: result.jobId });
        } else if (result.updated) {
          updated++;
          results.push({ audit_id: auditId, status: 'updated', title, job_id: result.jobId });
        } else {
          skipped++;
          results.push({ audit_id: auditId, status: 'skipped', title });
        }
        if (result.jobId) linkedJobs++;
      } catch (err) {
        results.push({ audit_id: auditId, status: 'error', error: err.message, title: '' });
        errors++;
      }
    }

    return Response.json({
      status: 'success',
      batch_size: batch.length,
      results,
      stored,
      updated,
      skipped,
      errors,
      linked_jobs: linkedJobs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}