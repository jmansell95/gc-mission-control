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

    // Search for audits modified since the cursor — paginate with limit=1000
    // and order=asc, looping until a page returns <1000 entries (caught up).
    // The cursor advances to the last entry's modified_at + 1ms to break the
    // inclusive-modified_after pin that previously stuck the sync at 19th June.
    const PAGE_LIMIT = 1000;
    const MAX_PAGES = 10; // safety cap (10,000 audits per sync)
    let allEntries: any[] = [];
    let cursor = modifiedAfter;
    let pageCount = 0;

    while (pageCount < MAX_PAGES) {
      const searchUrl = `https://api.mitti.com/audits/search?field=audit_id&field=modified_at&field=template_id&modified_after=${encodeURIComponent(cursor)}&order=asc&limit=${PAGE_LIMIT}`;
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
      const entries = Array.isArray(page.audits) ? page.audits : [];
      allEntries = allEntries.concat(entries);
      pageCount++;
      if (entries.length < PAGE_LIMIT) break; // caught up
      // Advance cursor to the last entry's modified_at to fetch the next page
      const lastMod = entries[entries.length - 1]?.modified_at;
      if (!lastMod) break;
      cursor = lastMod;
    }

    // Deduplicate by audit_id (pages may overlap at the cursor boundary)
    const seen = new Set<string>();
    const auditEntries = allEntries.filter((e: any) => {
      const id = String(e.audit_id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Advance cursor +1ms to break the inclusive modified_after pin
    let latestModified = new Date().toISOString();
    if (auditEntries.length > 0) {
      const lastMod = auditEntries[auditEntries.length - 1].modified_at;
      if (lastMod) {
        const d = new Date(lastMod);
        if (!isNaN(d.getTime())) {
          latestModified = new Date(d.getTime() + 1).toISOString();
        }
      }
    }

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