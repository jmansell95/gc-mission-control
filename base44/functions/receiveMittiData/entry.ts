import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Mitti (formerly SafetyCulture / iAuditor) webhook receiver
// ============================================================
// Receives audit-completion events from Mitti. Validates the
// shared webhook secret against the MittiConfig singleton,
// then stores each audit as a SafetyReport — auto-matching the auditor's
// email to a Contractor record and the audit site name to a Job.
//
// Also classifies each audit (vehicle_check / powra / equipment / general)
// by keyword matching the template name, matches the auditor's email to a
// Staff record, and stamps the corresponding RotaAssignment's Mitti check
// timestamp so the ShiftWizard shows live verification and gates work.

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// Defensive field extraction — Mitti payload shapes vary by
// template and webhook version, so we try several common paths.
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

// Classify an audit by its template/title name into one of the three
// crew-flow check categories (or 'general'). Keyword lists are deliberately
// broad so variations in template naming still match.
function classifyAudit(templateName: string, auditTitle: string): string {
  const hay = `${templateName} ${auditTitle}`.toLowerCase();
  const has = (kw: string[]) => kw.some((k) => hay.includes(k));
  if (has(['vehicle', 'van check', 'daily check', 'walk round', 'walk-round', 'pre-start', 'pre start', 'pre-use', 'pre use', 'driver check'])) return 'vehicle_check';
  if (has(['powra', 'point of work', 'risk assessment', 'risk-assessment', 'rams', 'permit to work', 'ptw', 'dynamic risk'])) return 'powra';
  if (has(['equipment', 'plant', 'machinery', 'rig check', 'lifting gear', 'lolcr', 'puwer', 'pat'])) return 'equipment';
  return 'general';
}

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
    const rawStr = JSON.stringify(body);

    // Extract common audit fields defensively
    const auditId = String(
      deepGet(body, 'audit_id', 'audit.id', 'id', 'data.audit_id', 'data.id') || ''
    );
    if (!auditId) {
      return Response.json({ error: 'No audit id found in payload.' }, { status: 422 });
    }

    const templateName = String(
      deepGet(body, 'template.name', 'template_name', 'audit.template_name', 'audit_data.template_name', 'data.template_name') || ''
    );
    const auditTitle = String(
      deepGet(body, 'audit.name', 'audit.title', 'name', 'audit_data.name', 'data.name', 'audit.name') || ''
    );
    const auditorName = String(
      deepGet(body, 'audit.author.name', 'author.name', 'auditor.name', 'audit_data.author.name', 'audit.audit_data.author.name') || ''
    );
    const auditorEmail = String(
      deepGet(body, 'audit.author.email', 'author.email', 'auditor.email', 'audit_data.author.email') || ''
    );
    const siteName = String(
      deepGet(body, 'audit.header_items.site', 'header_items.site', 'audit_data.header_items.site', 'site', 'location', 'site_name') || ''
    );
    const conductedAt = String(
      deepGet(body, 'audit.audit_started_at', 'audit_started_at', 'audit_data.audit_started_at', 'created_at', 'audit_date') || ''
    );
    const completedAt = String(
      deepGet(body, 'audit.audit_completed_at', 'audit_completed_at', 'audit_data.audit_completed_at', 'completed_at', 'submitted_at') || ''
    );
    const reportUrl = String(
      deepGet(body, 'audit.report_url', 'report_url', 'audit_data.report_url', 'pdf_url') || ''
    );

    // Scoring — try a few common shapes
    const overallScore = num(deepGet(body, 'audit.score', 'score', 'audit_data.score', 'overall_score'));
    const maxScore = num(deepGet(body, 'audit.max_score', 'max_score', 'audit_data.max_score'));
    const scorePct = num(deepGet(body, 'audit.score_percentage', 'score_percentage'));
    const itemsPassed = num(deepGet(body, 'audit.items_passed', 'items_passed', 'audit_data.items_passed'));
    const itemsFailed = num(deepGet(body, 'audit.items_failed', 'items_failed', 'audit_data.items_failed'));
    const passFailRaw = String(deepGet(body, 'audit.audit_data.pass_fail', 'pass_fail', 'result') || '').toLowerCase();
    const passFail = passFailRaw === 'pass' ? 'pass' : passFailRaw === 'fail' ? 'fail' : 'pending';

    // Action items — best-effort extraction from a common array path
    const actionItems: any[] = [];
    const rawActions: any = deepGet(body, 'audit.action_items', 'action_items', 'audit_data.action_items', 'corrective_actions', 'actions');
    if (Array.isArray(rawActions)) {
      for (const a of rawActions) {
        if (!a || typeof a !== 'object') continue;
        actionItems.push({
          description: String(a.description || a.action || a.text || ''),
          priority: String(a.priority || 'medium').toLowerCase(),
          assignee: String(a.assignee || a.assigned_to || ''),
          due_date: a.due_date ? String(a.due_date).slice(0, 10) : '',
        });
      }
    }

    // De-duplicate — skip if we already have this audit
    let existingId: string | null = null;
    try {
      const existing = await base44.asServiceRole.entities.SafetyReport.filter({ safetyculture_audit_id: auditId });
      if (existing && existing[0]) existingId = existing[0].id;
    } catch (e) { /* continue */ }

    // Auto-match a Contractor by the auditor's email
    let contractorId: string | null = null;
    if (auditorEmail) {
      try {
        const matches = await base44.asServiceRole.entities.Contractor.filter({ safetyculture_email: auditorEmail });
        if (matches && matches[0]) contractorId = matches[0].id;
      } catch (e) { /* continue */ }
    }

    // Auto-match a Job by site name / reference
    let jobId: string | null = null;
    let jobName: string = '';
    if (config.auto_link_to_jobs && siteName) {
      try {
        const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 200);
        const q = siteName.toLowerCase().trim();
        const match =
          jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === q) ||
          jobs.find((j: any) => j.name && j.name.toLowerCase() === q) ||
          jobs.find((j: any) => j.location && j.location.toLowerCase().includes(q)) ||
          jobs.find((j: any) => j.name && j.name.toLowerCase().includes(q));
        if (match) { jobId = match.id; jobName = match.name; }
      } catch (e) { /* continue */ }
    }

    // Match the auditor's email to a Staff record so we can stamp their
    // RotaAssignment with the verified-check timestamp.
    let auditorStaffId: string | null = null;
    if (auditorEmail) {
      try {
        const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
        const lc = auditorEmail.toLowerCase();
        const matched = allStaff.find((s: any) => s.email && s.email.toLowerCase() === lc);
        if (matched) auditorStaffId = matched.id;
      } catch (e) { /* continue */ }
    }

    // Classify the audit type from the template/title name
    const auditCategory = classifyAudit(templateName, auditTitle);

    const computedPct = scorePct != null ? scorePct : (overallScore != null && maxScore && maxScore > 0 ? Math.round((overallScore / maxScore) * 10000) / 100 : null);

    const report: any = {
      safetyculture_audit_id: auditId,
      audit_category: auditCategory,
      audit_template_name: templateName,
      audit_title: auditTitle,
      auditor_name: auditorName,
      auditor_email: auditorEmail,
      auditor_staff_id: auditorStaffId,
      job_id: jobId || null,
      job_name: jobName,
      contractor_id: contractorId,
      site_name: siteName,
      conducted_at: conductedAt || null,
      completed_at: completedAt || null,
      overall_score: overallScore,
      max_score: maxScore,
      score_percentage: computedPct,
      pass_fail: passFail,
      audit_report_url: reportUrl,
      items_failed: itemsFailed || 0,
      items_passed: itemsPassed || 0,
      action_items: actionItems,
      status: actionItems.length > 0 ? 'open' : 'closed',
      raw_payload: rawStr,
    };

    let storedId: string;
    if (existingId) {
      await base44.asServiceRole.entities.SafetyReport.update(existingId, report);
      storedId = existingId;
    } else {
      const created = await base44.asServiceRole.entities.SafetyReport.create(report);
      storedId = created.id;
    }

    // ── Stamp the matching RotaAssignment with the verified check timestamp ──
    // Finds today's (or the audit's conducted-date) job assignment for the
    // auditor and sets the appropriate mitti_*_at field. This is what the
    // ShiftWizard reads to show the live "verified by Mitti" badge and to
    // gate progression when Mitti is connected.
    if (auditorStaffId && auditCategory !== 'general') {
      try {
        // Use the audit's conducted date if available, otherwise today
        let checkDate = new Date().toISOString().slice(0, 10);
        if (conductedAt) {
          const d = new Date(conductedAt);
          if (!isNaN(d.getTime())) checkDate = d.toISOString().slice(0, 10);
        }
        const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
          staff_id: auditorStaffId,
          assigned_date: checkDate,
          assignment_type: 'job',
        });
        const stampField =
          auditCategory === 'vehicle_check' ? 'mitti_vehicle_check_at' :
          auditCategory === 'powra' ? 'mitti_powra_at' :
          auditCategory === 'equipment' ? 'mitti_equipment_check_at' : null;
        if (stampField && assignments && assignments.length > 0) {
          const nowIso = new Date().toISOString();
          for (const a of assignments) {
            // If we matched a job, prefer stamping the assignment for that job;
            // otherwise stamp all of today's job assignments for this staff.
            if (jobId && a.job_id && a.job_id !== jobId) continue;
            try {
              await base44.asServiceRole.entities.RotaAssignment.update(a.id, { [stampField]: nowIso });
            } catch (e) { /* best-effort */ }
          }
        }
      } catch (e) { /* best-effort — never fail the webhook on stamping */ }
    }

    // Update config status
    const summary = `Stored audit ${auditTitle || templateName || auditId}${actionItems.length > 0 ? ` · ${actionItems.length} action item${actionItems.length === 1 ? '' : 's'}` : ''}${jobName ? ` · linked to ${jobName}` : ''}${auditCategory !== 'general' ? ` · ${auditCategory.replace('_', ' ')} verified` : ''}`;
    try {
      await base44.asServiceRole.entities.MittiConfig.update(config.id, {
        last_webhook_at: new Date().toISOString(),
        last_webhook_status: 'success',
        last_webhook_summary: summary,
      });
    } catch (e) { /* non-fatal */ }

    return Response.json({ status: 'success', audit_id: auditId, report_id: storedId, job_matched: !!jobId, contractor_matched: !!contractorId, staff_matched: !!auditorStaffId, audit_category: auditCategory, action_items: actionItems.length });
  } catch (error) {
    // Record failure on the config if we can reach it
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