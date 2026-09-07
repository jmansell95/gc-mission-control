import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processAndStoreAudit, fetchAuditFromApi, extractAuditFields } from '../../shared/mittiAudit.ts';

// ============================================================
// Mitti (formerly SafetyCulture / iAuditor) webhook receiver
// ============================================================
// Receives audit event notifications from Mitti. The new Mitti
// webhook format only sends the audit ID (not the full payload),
// so when an API token is configured we fetch the full audit from
// the Mitti API and process it. Falls back to the legacy format
// (full audit in the payload) if the webhook sends the complete
// audit data.
//
// Validates the shared webhook secret, then stores each audit as
// a SafetyReport — auto-matching the auditor's email to a
// Contractor record and the audit site name to a Job. Also
// classifies each audit (vehicle_check / powra / equipment /
// general) and stamps the matching RotaAssignment's Mitti check
// timestamp so the ShiftWizard shows live verification and gates.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Webhook — no user auth; service-role writes, secret-gated.
    const url = new URL(req.url);
    const secret =
      url.searchParams.get('webhook_secret') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-mitti-secret') ||
      req.headers.get('x-safetyculture-secret') ||
      '';

    // Load config singleton
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.MittiConfig.filter({ key: 'global' });
      config = configs && configs[0];
    } catch (e) { /* entity may not exist yet */ }

    if (!config) {
      return Response.json({ error: 'Mitti not configured.' }, { status: 422 });
    }
    if (!config.enabled) {
      return Response.json({ error: 'Mitti webhook is disabled.' }, { status: 403 });
    }
    if (!secret || secret !== config.webhook_secret) {
      return Response.json({ error: 'Invalid webhook secret.' }, { status: 401 });
    }

    const body = await req.json();

    // ── Extract the audit ID from the webhook payload ──
    // New Mitti format: { resource: { id: "audit_..." }, data: { details: { inspection_id: "audit_..." } } }
    // Legacy format: { audit_id: "...", audit: { ... } }
    const auditId = String(
      body?.resource?.id ||
      body?.data?.details?.inspection_id ||
      body?.audit_id ||
      body?.audit?.id ||
      body?.id ||
      ''
    );

    if (!auditId) {
      return Response.json({ error: 'No audit id found in webhook payload.' }, { status: 422 });
    }

    // ── Fetch the full audit from the API (new Mitti format) or use the payload (legacy) ──
    let fullAudit: any = null;

    // Check if the payload already contains the full audit data (legacy SafetyCulture format)
    const hasFullAudit = !!(body?.audit_data || body?.audit?.audit_data || body?.items || body?.audit?.items);
    if (hasFullAudit) {
      fullAudit = body?.audit || body;
    } else if (config.api_token) {
      // New Mitti format — fetch the full audit from the API
      fullAudit = await fetchAuditFromApi(config.api_token, auditId);
    }

    if (!fullAudit) {
      // No API token and no full audit in payload — store a minimal record
      const minimalReport: any = {
        safetyculture_audit_id: auditId,
        audit_category: 'general',
        audit_template_name: '',
        audit_title: 'Mitti webhook (audit not fetched — no API token)',
        auditor_name: '',
        auditor_email: '',
        site_name: '',
        conducted_at: new Date().toISOString(),
        completed_at: null,
        raw_payload: JSON.stringify(body).slice(0, 5000),
        status: 'closed',
      };
      try {
        await base44.asServiceRole.entities.SafetyReport.create(minimalReport);
      } catch (e) { /* best-effort */ }

      try {
        await base44.asServiceRole.entities.MittiConfig.update(config.id, {
          last_webhook_at: new Date().toISOString(),
          last_webhook_status: 'success',
          last_webhook_summary: `Webhook received for ${auditId} (no API token — audit not fetched)`,
        });
      } catch (e) { /* non-fatal */ }

      return Response.json({ status: 'success', audit_id: auditId, warning: 'No API token — audit not fetched. Add one in Settings for full data.' });
    }

    // Ensure the audit_id is set on the full audit
    if (!fullAudit.audit_id) fullAudit.audit_id = auditId;

    // Load jobs and staff for matching
    let jobs: any[] = [];
    if (config.auto_link_to_jobs) {
      try { jobs = await base44.asServiceRole.entities.Job.list('-created_date', 200); } catch (e) { /* continue */ }
    }
    let allStaff: any[] = [];
    try { allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500); } catch (e) { /* continue */ }

    // Process and store the audit
    const result = await processAndStoreAudit(base44, fullAudit, config, jobs, allStaff);

    // Update config status
    const fields = extractAuditFields(fullAudit);
    const summary = `Webhook: ${result.stored ? 'Stored' : 'Updated'} audit ${fields.audit_title || fields.audit_template_name || auditId}${result.jobName ? ` · linked to ${result.jobName}` : ''}${fields.audit_category !== 'general' ? ` · ${fields.audit_category.replace('_', ' ')} verified` : ''}${result.stampedAssignments > 0 ? ` · ${result.stampedAssignments} assignment(s) stamped` : ''}`;
    try {
      await base44.asServiceRole.entities.MittiConfig.update(config.id, {
        last_webhook_at: new Date().toISOString(),
        last_webhook_status: 'success',
        last_webhook_summary: summary,
      });
    } catch (e) { /* non-fatal */ }

    return Response.json({
      status: 'success',
      audit_id: auditId,
      stored: result.stored,
      updated: result.updated,
      job_matched: !!result.jobId,
      staff_matched: !!result.auditorStaffId,
      audit_category: result.auditCategory,
      action_items: result.actionItemCount,
      stamped_assignments: result.stampedAssignments || 0,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.MittiConfig.filter({ key: 'global' });
      if (configs && configs[0]) {
        await base44.asServiceRole.entities.MittiConfig.update(configs[0].id, {
          last_webhook_at: new Date().toISOString(),
          last_webhook_status: 'failed',
          last_webhook_summary: 'Error: ' + (error.message || 'Unknown'),
        });
      }
    } catch (e) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});