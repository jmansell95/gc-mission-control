import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// getSettingsHubStats — single-call batched stats for the Settings Command Hub.
// Returns every count and integration-status the overview needs in one round
// trip, replacing the ~10 separate entity queries the overview used to fire.
// ---------------------------------------------------------------------------

const INTEGRATION_SETTING_KEYS = [
  'geotab_config', 'holman_config', 'asset_panda_config', 'bob_hr_config',
  'concur_config', 'safety_culture_config', 'keylogbook_config', 'cis_config',
  'payroll_config', 'met_office_config', 'google_maps_config', 'whatsapp_config',
  'accounting_config', 'stripe_config',
  'integration_coming_soon',
];
const INTEGRATION_CONNECTED_FIELDS: Record<string, string> = {
  geotab_config: 'username', holman_config: 'api_key', asset_panda_config: 'api_token',
  bob_hr_config: 'username', concur_config: 'client_id', safety_culture_config: 'api_token',
  keylogbook_config: 'webhook_secret', cis_config: 'api_key', payroll_config: 'provider',
  met_office_config: 'api_key', google_maps_config: 'api_key', whatsapp_config: 'api_token',
  accounting_config: 'provider', stripe_config: 'secret_key',
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
};

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

    // Aggregate AppSetting configs across all divisions — a key is "connected"
    // if ANY record with that key (any division) has the connected field set.
    const settingsByKey: Record<string, any[]> = {};
    for (const s of allSettings || []) {
      const k = s.key;
      if (!settingsByKey[k]) settingsByKey[k] = [];
      settingsByKey[k].push(s.value || {});
    }
    const isAppSettingConnected = (k: string) => {
      const field = INTEGRATION_CONNECTED_FIELDS[k];
      if (!field) return false;
      return (settingsByKey[k] || []).some(v => !!(v && v[field]));
    };
    // Dedicated config entities (not stored in AppSetting) — read directly.
    const assetPandaConnected = (assetPandaConfigs || []).some(c => !!(c.email || c.api_token));
    const mittiConnected = (mittiConfigs || []).some(c => !!(c.enabled || c.webhook_secret || c.api_token));
    const klbConnected = (klbConfigs || []).some(c => !!(c.enabled || c.ags_sync_enabled || c.webhook_secret || c.api_key));

    const integrations = INTEGRATION_SETTING_KEYS.filter(k => k !== 'integration_coming_soon').map(k => {
      const meta = INTEGRATION_META[k];
      let connected = false;
      if (k === 'asset_panda_config') connected = assetPandaConnected;
      else if (k === 'safety_culture_config') connected = mittiConnected;
      else if (k === 'keylogbook_config') connected = klbConnected;
      else connected = isAppSettingConnected(k);
      return { id: meta.id, label: meta.label, connected };
    });

    const activeStaff = (staff || []).filter(s => s.is_active !== false).length;
    const activeJobs = (jobs || []).filter(j => (j.status || 'planning') === 'in_progress').length;
    const planningJobs = (jobs || []).filter(j => (j.status || 'planning') === 'planning').length;
    const integrationConnectedCount = integrations.filter(i => i.connected).length;

    const comingSoonRaw = (settingsByKey['integration_coming_soon'] || [{}])[0] || {};
    const integrationComingSoon: Record<string, boolean> = {};
    if (comingSoonRaw && typeof comingSoonRaw === 'object') {
      for (const [id, val] of Object.entries(comingSoonRaw)) {
        if (val) integrationComingSoon[id] = true;
      }
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
        integrationComingSoon,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}