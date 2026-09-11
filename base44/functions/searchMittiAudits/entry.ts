import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ============================================================
// searchMittiAudits — step 2 of the live sync flow
// ============================================================
// Searches the Mitti API for audit IDs modified since the last sync
// (GET /audits/search with modified_after cursor). Returns the list
// of audit IDs (with template_id) so the frontend can feed them into
// syncMittiAuditBatch in chunks of 10 for real-time progress.
//
// Does NOT fetch full audit data or store anything — just returns
// the search results (audit_id + modified_at + template_id per entry).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
      return Response.json({ error: 'No API token configured.' }, { status: 422 });
    }

    // Determine the modified_after cursor
    const syncWindowDays = config.sync_window_days || 90;
    const modifiedAfter = config.last_pull_sync_at
      ? config.last_pull_sync_at
      : new Date(Date.now() - syncWindowDays * 24 * 60 * 60 * 1000).toISOString();

    // Search for audits modified since the cursor
    const searchUrl = `https://api.mitti.com/audits/search?field=audit_id&field=modified_at&field=template_id&modified_after=${encodeURIComponent(modifiedAfter)}&order=asc&limit=100`;

    const resp = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return Response.json({
        error: `Mitti API returned ${resp.status}`,
        details: errText.slice(0, 500),
      }, { status: 502 });
    }

    const page = await resp.json();
    const auditEntries = Array.isArray(page.audits) ? page.audits : [];

    // The newest modified_at in this batch (order=asc → last entry is newest)
    const latestModified = auditEntries.length > 0
      ? String(auditEntries[auditEntries.length - 1].modified_at || new Date().toISOString())
      : new Date().toISOString();

    return Response.json({
      status: 'success',
      audit_ids: auditEntries.map((e: any) => ({
        audit_id: String(e.audit_id || ''),
        template_id: String(e.template_id || ''),
        modified_at: String(e.modified_at || ''),
      })),
      total_found: auditEntries.length,
      modified_after: modifiedAfter,
      latest_modified: latestModified,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}