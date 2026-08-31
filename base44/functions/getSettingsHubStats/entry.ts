import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// getSettingsHubStats — single-call batched stats for the Settings Command Hub.
// Returns every count and integration-status the overview needs in one round
// trip, replacing the ~10 separate entity queries the overview used to fire.
//
// Integration status resolution (the single source of truth for the overview,
// IntegrationsHub and ComingSoonManager):
//   • not_configured  — no credentials saved (slate)
//   • needs_attention — credentials saved but the last cached sync failed /
//                       never ran (amber)
//   • active          — credentials saved AND (no sync mechanism OR the last
//                       cached sync succeeded) (emerald)
// `connected` is kept as a boolean = hasCredentials for backward compatibility
// with the ComingSoonManager toggle lock (you can't mark a configured
// integration as coming-soon).
// ---------------------------------------------------------------------------

const INTEGRATION_SETTING_KEYS = [
  'geotab_config', 'holman_config', 'asset_panda_config', 'bob_hr_config',
  'concur_config', 'safety_culture_config', 'keylogbook_config', 'cis_config',
  'payroll_config', 'met_office_config', 'google_maps_config', 'whatsapp_config',
  'accounting_config', 'stripe_config',
  'microsoft_365_config', 'zapier_config', 'openground_config',
  'integration_coming_soon',
];
const INTEGRATION_CONNECTED_FIELDS: Record<string, string> = {
  geotab_config: 'username', holman_config: 'api_key', asset_panda_config: 'api_token',
  bob_hr_config: 'username', concur_config: 'client_id', safety_culture_config: 'api_token',
  keylogbook_config: 'webhook_secret', cis_config: 'api_key', payroll_config: 'provider',
  met_office_config: 'api_key', google_maps_config: 'api_key', whatsapp_config: 'api_token',
  accounting_config: 'provider', stripe_config: 'secret_key',
  microsoft_365_config: 'client_id', zapier_config: 'webhook_url', openground_config: 'api_key',
};
const INTEGRATION_META: Record<string, { id: string; label: string }> = {
  geotab_config: { id: 'geotab-sync', label: 'Geotab' },
  holman_config: { id: 'holman-sync', label: 'Holman' },
  asset_panda_config: { id: 'asset-panda', label: 'Asset Panda' },
  bob_hr_config: { id: 'bob-hr', label: 'Bob HR' },
  concur_config: { id: 'concur-sync', label: 'Concur' },
  safety_culture_config: { id: 'safety-culture', label: 'SafetyCulture' },
  keylogbook_config: { id: 'ags-import', label: 'KeyLogBook' },
  cis_config: { id: 'cis-verification', label: 'CIS' },
  payroll_config: { id: 'payroll-export', label: 'Payroll' },
  met_office_config: { id: 'met-office', label: 'Met Office' },
  google_maps_config: { id: 'google-maps', label: 'Google Maps' },
  whatsapp_config: { id: 'whatsapp', label: 'WhatsApp' },
  accounting_config: { id: 'accounting-sync', label: 'Accounting' },
  stripe_config: { id: 'payment-gateway', label: 'Payments' },
  microsoft_365_config: { id: 'microsoft-365', label: 'Microsoft 365' },
  zapier_config: { id: 'zapier-webhooks', label: 'Zapier' },
  openground_config: { id: 'openground-sync', label: 'OpenGround' },
};
// Fields on a config record/value that hold a cached sync outcome.
const SYNC_STATUS_FIELDS = ['sync_status', 'last_sync_status', 'last_webhook_status', 'last_sync_status'];
// Integrations that have no scheduled sync / connection test — for these,
// "credentials saved" alone counts as a working connection (there is no cached
// status to check). Everything else is expected to persist a sync status.
const NO_SYNC_MECHANISM = new Set([
  'cis_config', 'google_maps_config', 'whatsapp_config', 'stripe_config',
  'microsoft_365_config', 'zapier_config', 'openground_config',
]);

function resolveSyncStatus(values: any[]): string | null {
  for (const v of values) {
    if (!v || typeof v !== 'object') continue;
    for (const k of SYNC_STATUS_FIELDS) {
      if (v[k]) return String(v[k]).toLowerCase();
    }
  }
  return null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'director') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const sr = base44.asServiceRole.entities;

    const [staff, jobs, vehicles, clients, rateItems, teams, billingRules, complianceItems, permissionGroups, allSettings, assetPandaConfigs, mittiConfigs, klbConfigs] = await Promise.all([
      sr.Staff.list('-created_date', 500),
      sr.Job.list('-created_date', 500),
      sr.Vehicle.list(),
      sr.Client.list(),
      sr.RateCardItem.list('-created_date', 500),
      sr.Team.list(),
      sr.BillingRule.list(),
      sr.ComplianceItem.list('-created_date', 500),
      sr.PermissionGroup.list('-created_date', 200),
      sr.AppSetting.filter({ key: { $in: INTEGRATION_SETTING_KEYS } }, '-created_date', 50),
      sr.AssetPandaConfig.list('-created_date', 50),
      sr.MittiConfig.list('-created_date', 50),
      sr.KeyLogBookConfig.list('-created_date', 50),
    ]);

    // Aggregate AppSetting configs across all divisions.
    const settingsByKey: Record<string, any[]> = {};
    for (const s of allSettings || []) {
      const k = s.key;
      if (!settingsByKey[k]) settingsByKey[k] = [];
      settingsByKey[k].push(s.value || {});
    }
    const hasAppSettingCredentials = (k: string) => {
      const field = INTEGRATION_CONNECTED_FIELDS[k];
      if (!field) return false;
      return (settingsByKey[k] || []).some(v => !!(v && v[field]));
    };
    const appSettingSyncStatus = (k: string) => resolveSyncStatus(settingsByKey[k] || []);

    // Dedicated config entities (not stored in AppSetting).
    const assetPandaHasCreds = (assetPandaConfigs || []).some(c => !!(c.email || c.api_token));
    const assetPandaSync = (assetPandaConfigs || []).map(c => c.last_sync_status).find(Boolean) || null;
    const mittiHasCreds = (mittiConfigs || []).some(c => !!(c.enabled || c.webhook_secret || c.api_token));
    const mittiSync = (mittiConfigs || []).map(c => c.last_webhook_status).find(Boolean) || null;
    const klbHasCreds = (klbConfigs || []).some(c => !!(c.enabled || c.ags_sync_enabled || c.webhook_secret || c.api_key));
    const klbSync = (klbConfigs || []).map(c => c.last_sync_status || c.sync_status).find(Boolean) || null;

    const integrations = INTEGRATION_SETTING_KEYS.filter(k => k !== 'integration_coming_soon').map(k => {
      const meta = INTEGRATION_META[k];
      let hasCredentials = false;
      let syncStatus: string | null = null;
      if (k === 'asset_panda_config') { hasCredentials = assetPandaHasCreds; syncStatus = assetPandaSync; }
      else if (k === 'safety_culture_config') { hasCredentials = mittiHasCreds; syncStatus = mittiSync; }
      else if (k === 'keylogbook_config') { hasCredentials = klbHasCreds; syncStatus = klbSync; }
      else { hasCredentials = hasAppSettingCredentials(k); syncStatus = appSettingSyncStatus(k); }

      // Resolve the displayed status.
      let status: string;
      if (!hasCredentials) {
        status = 'not_configured';
      } else if (NO_SYNC_MECHANISM.has(k)) {
        status = 'active'; // credentials saved = working (no sync to verify)
      } else if (syncStatus === 'success' || syncStatus === 'synced') {
        status = 'active';
      } else if (syncStatus === 'failed' || syncStatus === 'error' || syncStatus === 'never') {
        status = 'needs_attention';
      } else {
        // Credentials saved but no cached sync status recorded yet — treat as
        // active (optimistic; the first scheduled sync will refine this).
        status = 'active';
      }
      return { id: meta.id, label: meta.label, connected: hasCredentials, hasCredentials, status };
    });

    const activeStaff = (staff || []).filter(s => s.is_active !== false).length;
    const activeJobs = (jobs || []).filter(j => (j.status || 'planning') === 'in_progress').length;
    const planningJobs = (jobs || []).filter(j => (j.status || 'planning') === 'planning').length;
    const integrationConnectedCount = integrations.filter(i => i.status === 'active').length;
    const integrationNeedsAttention = integrations.filter(i => i.status === 'needs_attention').length;

    // Merge ALL integration_coming_soon records (there may be duplicates from
    // old saves) so the flag is never lost due to a split-brain record.
    const integrationComingSoon: Record<string, boolean> = {};
    for (const recValue of (settingsByKey['integration_coming_soon'] || [])) {
      if (recValue && typeof recValue === 'object') {
        for (const [id, val] of Object.entries(recValue)) {
          if (val) integrationComingSoon[id] = true;
        }
      }
    }
    // Auto-clean: an active (working) integration is never "coming soon".
    for (const int of integrations) {
      if (int.status === 'active') delete integrationComingSoon[int.id];
    }

    return Response.json({
      data: {
        staffCount: (staff || []).length,
        activeStaff,
        jobsCount: (jobs || []).length,
        activeJobs,
        planningJobs,
        vehiclesCount: (vehicles || []).length,
        clientsCount: (clients || []).length,
        rateItemsCount: (rateItems || []).length,
        teamsCount: (teams || []).length,
        billingRulesCount: (billingRules || []).length,
        complianceItemsCount: (complianceItems || []).length,
        permissionGroupsCount: (permissionGroups || []).length,
        integrations,
        integrationConnectedCount,
        integrationNeedsAttention,
        integrationComingSoon,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}