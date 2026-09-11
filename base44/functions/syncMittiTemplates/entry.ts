import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ============================================================
// syncMittiTemplates — step 1 of the live sync flow
// ============================================================
// Fetches all audit templates from the Mitti API (GET /templates/search)
// and stores them in MittiConfig.synced_templates. Returns the template
// list so the frontend can show "Synced X templates" in the progress UI.
//
// This is a standalone step so the frontend can run it first and show
// real-time progress before the longer audit search/fetch steps.

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
      return Response.json({ error: 'No API token configured. Add one in Settings → Mitti.' }, { status: 422 });
    }

    // Fetch all templates from Mitti
    const templateSearchUrl = 'https://api.mitti.com/templates/search?field=template_id&field=name&field=modified_at&field=created_at&archived=both&owner=all&limit=1000';
    const templateResp = await fetch(templateSearchUrl, {
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Accept': 'application/json',
      },
    });

    if (!templateResp.ok) {
      return Response.json({
        error: `Mitti template API returned ${templateResp.status}`,
        details: await templateResp.text().catch(() => ''),
      }, { status: 502 });
    }

    const templatePage = await templateResp.json();
    const rawTemplates = Array.isArray(templatePage.templates) ? templatePage.templates : [];
    const syncedTemplates = rawTemplates
      .map((t: any) => ({
        template_id: String(t.template_id || ''),
        name: String(t.name || ''),
        modified_at: String(t.modified_at || ''),
        created_at: String(t.created_at || ''),
      }))
      .filter((t: any) => t.template_id);

    // Update MittiConfig with the synced templates
    await base44.asServiceRole.entities.MittiConfig.update(config.id, {
      synced_templates: syncedTemplates,
      last_templates_sync_at: new Date().toISOString(),
    });

    return Response.json({
      status: 'success',
      templates_synced: syncedTemplates.length,
      templates: syncedTemplates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}