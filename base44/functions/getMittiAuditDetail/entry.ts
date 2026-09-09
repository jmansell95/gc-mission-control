import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAuditFromApi } from '../../shared/mittiAudit.ts';
import { parseAuditItems } from '../../shared/mittiAuditItems.ts';

// ============================================================
// getMittiAuditDetail — fetches the full Mitti audit on demand
// ============================================================
// Accepts a safetyculture_audit_id, loads the MittiConfig to get
// the api_token, fetches the complete audit from api.mitti.com,
// parses the full item/response structure (questions, answers,
// pass/fail per item, photo URLs, GPS, signatures) and returns
// structured JSON for the in-app drill-down detail view.
//
// The raw_payload stored on SafetyReport is truncated to 5000
// chars, so on-demand fetch is required for full item-level
// detail. Falls back to parsing the stored raw_payload if the
// API token is not configured or the fetch fails.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const auditId = String(body?.audit_id || body?.safetyculture_audit_id || '');

    if (!auditId) {
      return Response.json({ error: 'audit_id is required' }, { status: 422 });
    }

    // Load the stored SafetyReport (for fallback raw_payload + stored fields)
    let storedReport: any = null;
    try {
      const reports = await base44.asServiceRole.entities.SafetyReport.filter({ safetyculture_audit_id: auditId });
      if (reports && reports[0]) storedReport = reports[0];
    } catch (e) { /* continue */ }

    // Load MittiConfig for the API token
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.MittiConfig.filter({ key: 'global' });
      config = configs && configs[0];
    } catch (e) { /* continue */ }

    let fullAudit: any = null;
    let fetchSource: string = '';

    // Try fetching the full audit from the Mitti API
    if (config?.api_token) {
      try {
        fullAudit = await fetchAuditFromApi(config.api_token, auditId);
        if (fullAudit) fetchSource = 'api';
      } catch (e) {
        // Fall through to raw_payload fallback
      }
    }

    // Fallback: parse the stored raw_payload (truncated to 5000 chars — may be partial)
    if (!fullAudit && storedReport?.raw_payload) {
      try {
        fullAudit = JSON.parse(storedReport.raw_payload);
        fetchSource = 'stored_payload';
      } catch (e) {
        // raw_payload is not valid JSON — can't parse
      }
    }

    if (!fullAudit) {
      // No full audit available — return the stored summary fields only
      return Response.json({
        audit_id: auditId,
        source: 'summary_only',
        detail: null,
        stored_report: storedReport ? {
          audit_title: storedReport.audit_title,
          audit_template_name: storedReport.audit_template_name,
          template_id: storedReport.template_id,
          audit_category: storedReport.audit_category,
          auditor_name: storedReport.auditor_name,
          auditor_email: storedReport.auditor_email,
          auditor_staff_id: storedReport.auditor_staff_id,
          job_id: storedReport.job_id,
          job_name: storedReport.job_name,
          site_name: storedReport.site_name,
          conducted_at: storedReport.conducted_at,
          completed_at: storedReport.completed_at,
          overall_score: storedReport.overall_score,
          max_score: storedReport.max_score,
          score_percentage: storedReport.score_percentage,
          pass_fail: storedReport.pass_fail,
          items_passed: storedReport.items_passed,
          items_failed: storedReport.items_failed,
          action_items: storedReport.action_items || [],
          audit_report_url: storedReport.audit_report_url,
          status: storedReport.status,
        } : null,
        warning: config?.api_token
          ? 'Mitti API returned no data for this audit ID.'
          : 'No Mitti API token configured. Add one in Settings → Integrations for full item-level detail.',
      });
    }

    // Parse the full audit into structured check items
    const detail = parseAuditItems(fullAudit);

    // Merge with stored report fields (stored fields may have better job/staff links)
    if (storedReport) {
      if (!detail.reportUrl && storedReport.audit_report_url) detail.reportUrl = storedReport.audit_report_url;
    }

    return Response.json({
      audit_id: auditId,
      source: fetchSource,
      detail,
      stored_report: storedReport ? {
        job_id: storedReport.job_id,
        job_name: storedReport.job_name,
        auditor_staff_id: storedReport.auditor_staff_id,
        audit_category: storedReport.audit_category,
        template_id: storedReport.template_id,
        division_id: storedReport.division_id,
      } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}