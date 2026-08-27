import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePandaToken } from '../../shared/assetPandaClient.ts';

// ---------------------------------------------------------------------------
// testAssetPandaConnection — lightweight credential check.
// Verifies the saved API token by hitting GET /v3/users/me (or /v3/settings as
// a fallback) and reports whether Asset Panda returns 200. Lets the admin
// confirm their token works before running a full sync.
//
// Admin only. Returns { ok: boolean, status: number, message: string }.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const divisionId = body.division_id || null;
    const configFilter = divisionId ? { key: 'global', division_id: divisionId } : { key: 'global', division_id: null };
    let configs = await base44.asServiceRole.entities.AssetPandaConfig.filter(configFilter);
    let config = configs && configs[0];
    if (!config && divisionId) {
      configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
      config = configs && configs[0];
    }
    if (!config) {
      return Response.json({ ok: false, status: 0, message: 'No Asset Panda configuration found. Save your token first.' });
    }

    const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
    const { token, error: tokenError, skipped } = await resolvePandaToken(config, baseUrl);
    if (skipped || tokenError || !token) {
      return Response.json({ ok: false, status: 0, message: tokenError || 'No API token configured.' });
    }

    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Try /v3/users/me first; fall back to /v3/settings.
    let res = await fetch(`${baseUrl}/v3/users/me`, { headers: authHeaders });
    if (!res.ok && res.status !== 401) {
      // Try the settings endpoint as a fallback
      res = await fetch(`${baseUrl}/v3/settings`, { headers: authHeaders });
    }

    if (res.ok) {
      return Response.json({ ok: true, status: 200, message: 'Connected — your Asset Panda token is valid.' });
    }
    if (res.status === 401 || res.status === 403) {
      return Response.json({ ok: false, status: res.status, message: 'Authentication failed — your token was rejected. Check it is correct and not expired.' });
    }
    const errBody = await res.text().catch(() => '');
    return Response.json({ ok: false, status: res.status, message: `Asset Panda returned HTTP ${res.status}. ${errBody.slice(0, 160)}` });
  } catch (error) {
    return Response.json({ ok: false, status: 0, message: error.message }, { status: 500 });
  }
}