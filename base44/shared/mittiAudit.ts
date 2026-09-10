// ============================================================
// Shared Mitti (SafetyCulture) audit processing logic
// ============================================================
// Used by both syncMitti (pull) and receiveMittiData (webhook)
// to process a full Mitti audit payload: extract fields, match
// to jobs/staff/contractors, store as SafetyReport, and stamp
// the matching RotaAssignment with verified-check timestamps.

export function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

export function deepGet(obj: any, ...paths: string[]): any {
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

// Classify an audit by its template/title name into one of the
// crew-flow check categories (or 'general').
export function classifyAudit(templateName: string, auditTitle: string): string {
  const hay = `${templateName} ${auditTitle}`.toLowerCase();
  const has = (kw: string[]) => kw.some((k) => hay.includes(k));
  if (has(['vehicle', 'van check', 'daily check', 'walk round', 'walk-round', 'pre-start', 'pre start', 'pre-use', 'pre use', 'driver check'])) return 'vehicle_check';
  if (has(['powra', 'point of work', 'risk assessment', 'risk-assessment', 'rams', 'permit to work', 'ptw', 'dynamic risk'])) return 'powra';
  if (has(['equipment', 'plant', 'machinery', 'rig check', 'lifting gear', 'lolcr', 'puwer', 'pat'])) return 'equipment';
  return 'general';
}

// Extract fields from a full Mitti audit payload (legacy inspection format).
// Returns a partial SafetyReport record (without raw_payload, which the
// caller should add separately to control size).
export function extractAuditFields(audit: any): any {
  const templateId = String(deepGet(audit, 'template_id') || '');
  const templateName = String(deepGet(audit, 'template_data.metadata.name', 'template_data.name', 'template.name', 'template_name') || '');
  const auditTitle = String(deepGet(audit, 'audit_data.name', 'name', 'audit.name', 'audit.title') || '');
  const auditorName = String(deepGet(audit, 'audit_data.authorship.author', 'authorship.author', 'audit_data.authorship.owner', 'authorship.owner', 'audit.author.name', 'author.name') || '');
  const auditorEmail = String(deepGet(audit, 'audit_data.authorship.email', 'authorship.email', 'owner.email', 'audit.author.email', 'author.email') || '');
  const siteName = String(deepGet(audit, 'audit_data.site.name', 'site.name', 'audit_data.site', 'site', 'audit.header_items.site', 'header_items.site', 'location') || '');
  const conductedAt = String(deepGet(audit, 'audit_data.date_started', 'date_started', 'created_at', 'audit.audit_started_at', 'audit_started_at') || '');
  const completedAt = String(deepGet(audit, 'audit_data.date_completed', 'date_completed', 'modified_at', 'audit.audit_completed_at', 'audit_completed_at', 'completed_at') || '');
  const auditId = String(audit.audit_id || audit.id || '');
  const reportUrl = String(deepGet(audit, 'audit_data.report_url', 'report_url', 'pdf_url', 'audit.report_url') || '');
  // Build the Mitti web report URL from the audit_id (Mitti migrated from
  // SafetyCulture — the old app.safetyculture.com URLs show "nothing to see").
  const webReportUrl = auditId ? `https://app.mitti.com/audits/${auditId}` : reportUrl;

  const overallScore = num(deepGet(audit, 'audit_data.score', 'score', 'audit.score'));
  const maxScore = num(deepGet(audit, 'audit_data.total_score', 'total_score', 'max_score', 'audit.max_score'));
  const scorePct = num(deepGet(audit, 'audit_data.score_percentage', 'score_percentage', 'audit.score_percentage'));
  const itemsPassed = num(deepGet(audit, 'audit_data.items_passed', 'items_passed', 'audit.items_passed'));
  const itemsFailed = num(deepGet(audit, 'audit_data.items_failed', 'items_failed', 'audit.items_failed'));
  const passFailRaw = String(deepGet(audit, 'audit_data.pass_fail', 'pass_fail', 'result', 'audit.audit_data.pass_fail') || '').toLowerCase();

  // Action items — best-effort extraction
  const actionItems: any[] = [];
  const rawActions: any = deepGet(audit, 'audit_data.action_items', 'action_items', 'corrective_actions', 'actions', 'audit.action_items');
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

  const auditCategory = classifyAudit(templateName, auditTitle);
  const computedPct = scorePct != null ? scorePct : (overallScore != null && maxScore && maxScore > 0 ? Math.round((overallScore / maxScore) * 10000) / 100 : null);

  // Classify pass/fail: use explicit Mitti field if present, otherwise infer
  // from score percentage and item-level fail counts. Fixes the bug where
  // every audit was left as 'pending' because Mitti doesn't send pass_fail.
  let passFail: string;
  if (passFailRaw === 'pass') {
    passFail = 'pass';
  } else if (passFailRaw === 'fail') {
    passFail = 'fail';
  } else if (itemsFailed != null && itemsFailed > 0) {
    passFail = 'fail';
  } else if (computedPct != null && computedPct >= 80) {
    passFail = 'pass';
  } else if (computedPct != null && computedPct < 50) {
    passFail = 'fail';
  } else {
    passFail = 'pending';
  }

  return {
    audit_category: auditCategory,
    template_id: templateId,
    audit_template_name: templateName,
    audit_title: auditTitle,
    auditor_name: auditorName,
    auditor_email: auditorEmail,
    site_name: siteName,
    conducted_at: conductedAt || null,
    completed_at: completedAt || null,
    overall_score: overallScore,
    max_score: maxScore,
    score_percentage: computedPct,
    pass_fail: passFail,
    audit_report_url: webReportUrl,
    items_failed: itemsFailed || 0,
    items_passed: itemsPassed || 0,
    action_items: actionItems,
    status: actionItems.length > 0 ? 'open' : 'closed',
  };
}

// Match a site name to a job from a preloaded list.
export function matchJob(siteName: string, jobs: any[]): { jobId: string | null; jobName: string } {
  if (!siteName || jobs.length === 0) return { jobId: null, jobName: '' };
  const q = siteName.toLowerCase().trim();
  const match =
    jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === q) ||
    jobs.find((j: any) => j.name && j.name.toLowerCase() === q) ||
    jobs.find((j: any) => j.location && j.location.toLowerCase().includes(q)) ||
    jobs.find((j: any) => j.name && j.name.toLowerCase().includes(q));
  return match ? { jobId: match.id, jobName: match.name } : { jobId: null, jobName: '' };
}

// Match an auditor email to a Staff record from a preloaded list.
export function matchStaffByEmail(email: string, allStaff: any[]): string | null {
  if (!email || allStaff.length === 0) return null;
  const lc = email.toLowerCase();
  const matched = allStaff.find((s: any) => s.email && s.email.toLowerCase() === lc);
  return matched ? matched.id : null;
}

// Match an auditor name to a Staff record (fallback when email is unavailable).
// The Mitti API often returns only the author's display name, not their email.
export function matchStaffByName(name: string, allStaff: any[]): { staffId: string | null; divisionId: string | null } {
  if (!name || allStaff.length === 0) return { staffId: null, divisionId: null };
  const lc = name.toLowerCase().trim();
  const exact = allStaff.find((s: any) => s.name && s.name.toLowerCase() === lc);
  if (exact) return { staffId: exact.id, divisionId: exact.division_id || null };
  // Partial match — last resort
  const partial = allStaff.find((s: any) => s.name && (s.name.toLowerCase().includes(lc) || lc.includes(s.name.toLowerCase())));
  return partial ? { staffId: partial.id, divisionId: partial.division_id || null } : { staffId: null, divisionId: null };
}

// Detect whether a Mitti audit is a toolbox talk by template/title keywords.
export function isToolboxTalk(templateName: string, auditTitle: string): boolean {
  const hay = `${templateName} ${auditTitle}`.toLowerCase();
  return ['toolbox talk', 'tool box talk', 'toolbox', 'tool box', 'toolbox meeting', 'weekly toolbox', 'tbt'].some(k => hay.includes(k));
}

// Sync a Mitti toolbox-talk audit into the in-app ToolboxTalk entity (upsert by source_audit_id).
export async function syncToolboxTalk(
  base44: any,
  audit: any,
  fields: any,
  auditorStaffId: string | null,
  jobId: string | null,
  jobName: string,
): Promise<boolean> {
  const auditId = String(audit.audit_id || audit.id || '');
  if (!auditId) return false;
  try {
    const existing = await base44.asServiceRole.entities.ToolboxTalk.filter({ source_audit_id: auditId });
    const talkData: any = {
      title: fields.audit_template_name || fields.audit_title || 'Toolbox Talk (Mitti)',
      topic_category: 'general_safety',
      description: fields.audit_title || '',
      scheduled_date: fields.conducted_at ? new Date(fields.conducted_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      delivered_by_name: fields.auditor_name || '',
      delivered_by_id: auditorStaffId || null,
      status: 'delivered',
      source: 'mitti_sync',
      source_audit_id: auditId,
      job_id: jobId || null,
      job_name: jobName || '',
    };
    if (existing && existing[0]) {
      await base44.asServiceRole.entities.ToolboxTalk.update(existing[0].id, talkData);
    } else {
      await base44.asServiceRole.entities.ToolboxTalk.create(talkData);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Process a full Mitti audit: extract fields, match to jobs/staff/contractors,
// store as SafetyReport (upsert by safetyculture_audit_id), and stamp the
// matching RotaAssignment with the verified-check timestamp.
//
// Returns { stored: boolean, updated: boolean, jobId, auditorStaffId, auditCategory, actionItemCount }.
export async function processAndStoreAudit(
  base44: any,
  audit: any,
  config: any,
  jobs: any[],
  allStaff: any[],
  divisionId?: string | null,
): Promise<any> {
  const auditId = String(audit.audit_id || audit.id || '');
  if (!auditId) return { stored: false, updated: false, error: 'No audit ID' };

  // Check if we already have this audit
  let existingId: string | null = null;
  try {
    const existing = await base44.asServiceRole.entities.SafetyReport.filter({ safetyculture_audit_id: auditId });
    if (existing && existing[0]) existingId = existing[0].id;
  } catch (e) { /* continue */ }

  const fields = extractAuditFields(audit);

  // Match Contractor by email
  let contractorId: string | null = null;
  if (fields.auditor_email) {
    try {
      const matches = await base44.asServiceRole.entities.Contractor.filter({ safetyculture_email: fields.auditor_email });
      if (matches && matches[0]) contractorId = matches[0].id;
    } catch (e) { /* continue */ }
  }

  // Match Job by site name
  let { jobId, jobName } = config.auto_link_to_jobs
    ? matchJob(fields.site_name, jobs)
    : { jobId: null, jobName: '' };

  // Match auditor to Staff — try email first, then name as fallback
  // (Mitti often returns only the author's display name, not their email)
  let auditorStaffId = matchStaffByEmail(fields.auditor_email, allStaff);
  let resolvedDivisionId = divisionId || null;
  if (!auditorStaffId && fields.auditor_name) {
    const nameMatch = matchStaffByName(fields.auditor_name, allStaff);
    if (nameMatch.staffId) {
      auditorStaffId = nameMatch.staffId;
      if (!resolvedDivisionId && nameMatch.divisionId) {
        resolvedDivisionId = nameMatch.divisionId;
      }
    }
  }

  // Fallback: if site-name matching failed but the auditor is a known staff
  // member, use their RotaAssignment for the audit date to infer the job.
  // This catches audits where the site field is blank or uses a different
  // name than the job name (the most common auto-link failure).
  if (!jobId && auditorStaffId && config.auto_link_to_jobs && fields.conducted_at) {
    try {
      let checkDate = new Date().toISOString().slice(0, 10);
      const d = new Date(fields.conducted_at);
      if (!isNaN(d.getTime())) checkDate = d.toISOString().slice(0, 10);
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
        staff_id: auditorStaffId,
        assigned_date: checkDate,
        assignment_type: 'job',
      });
      if (assignments && assignments.length > 0) {
        const jobAssignment = assignments[0];
        const matchedJob = jobs.find((j: any) => j.id === jobAssignment.job_id);
        if (matchedJob) {
          jobId = matchedJob.id;
          jobName = matchedJob.name;
        }
      }
    } catch (e) { /* best-effort fallback */ }
  }

  const report: any = {
    safetyculture_audit_id: auditId,
    ...fields,
    auditor_staff_id: auditorStaffId,
    division_id: resolvedDivisionId,
    job_id: jobId || null,
    job_name: jobName,
    contractor_id: contractorId,
    // Truncate raw payload — full Mitti audits can be hundreds of KB
    raw_payload: JSON.stringify(audit).slice(0, 5000),
  };

  if (existingId) {
    await base44.asServiceRole.entities.SafetyReport.update(existingId, report);
  } else {
    await base44.asServiceRole.entities.SafetyReport.create(report);
  }

  // Stamp the matching RotaAssignment with the verified check timestamp
  let stampedAssignments = 0;
  if (auditorStaffId && fields.audit_category !== 'general') {
    try {
      let checkDate = new Date().toISOString().slice(0, 10);
      if (fields.conducted_at) {
        const d = new Date(fields.conducted_at);
        if (!isNaN(d.getTime())) checkDate = d.toISOString().slice(0, 10);
      }
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
        staff_id: auditorStaffId,
        assigned_date: checkDate,
        assignment_type: 'job',
      });
      const stampField =
        fields.audit_category === 'vehicle_check' ? 'mitti_vehicle_check_at' :
        fields.audit_category === 'powra' ? 'mitti_powra_at' :
        fields.audit_category === 'equipment' ? 'mitti_equipment_check_at' : null;
      if (stampField && assignments && assignments.length > 0) {
        const nowIso = new Date().toISOString();
        for (const a of assignments) {
          if (jobId && a.job_id && a.job_id !== jobId) continue;
          try {
            await base44.asServiceRole.entities.RotaAssignment.update(a.id, { [stampField]: nowIso });
            stampedAssignments++;
          } catch (e) { /* best-effort */ }
        }
      }
    } catch (e) { /* best-effort */ }
  }

  // Sync toolbox talk if the template matches toolbox-talk keywords
  let toolboxTalkSynced = false;
  if (isToolboxTalk(fields.audit_template_name, fields.audit_title)) {
    toolboxTalkSynced = await syncToolboxTalk(base44, audit, fields, auditorStaffId, jobId, jobName);
  }

  return {
    stored: !existingId,
    updated: !!existingId,
    jobId,
    jobName,
    auditorStaffId,
    auditCategory: fields.audit_category,
    actionItemCount: fields.action_items.length,
    stampedAssignments,
    toolboxTalkSynced,
  };
}

// Fetch a full audit from the Mitti API by ID.
export async function fetchAuditFromApi(apiToken: string, auditId: string): Promise<any | null> {
  try {
    const resp = await fetch(`https://api.mitti.com/audits/${auditId}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}