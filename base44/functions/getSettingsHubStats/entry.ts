import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// getSettingsHubStats — single-call batched stats for the Settings Command Hub.
//
// Integration status resolution (single source of truth for the overview):
//   • configured     — credentials saved (green)
//   • not_configured — no credentials saved (grey)
//
// Each integration's "configured" check uses the SAME credential fields its
// own settings page checks, so the overview badge never disagrees with the
// settings page header. Fields are matched per-integration with a mode:
//   'all'  — every field must be present (e.g. Geotab: username + password + database)
//   'any'  — at least one field must be present (e.g. Holman: api_key OR client_id)
//   'custom' — handled by a dedicated function (e.g. Accounting: provider + xero OR sage)
//
// Hide/show: the 'integration_hidden' AppSetting key stores a map of
// integration id → true. The overview filters hidden integrations out of the
// normal grid; manage mode shows them greyed so they can be unhidden.
// ---------------------------------------------------------------------------

const INTEGRATION_SETTING_KEYS = [
  'geotab_config', 'holman_config', 'asset_panda_config', 'bob_hr_config',
  'concur_config', 'safety_culture_config', 'keylogbook_config', 'cis_config',
  'payroll_config', 'met_office_config', 'google_maps_config', 'whatsapp_config',
  'accounting_config', 'stripe_config',
  'microsoft_365_config', 'zapier_config', 'openground_config',
  'integration_hidden', 'integration_coming_soon',
];

// Per-integration credential definition. 'mode' controls how fields combine.
const INTEGRATION_CONNECTED_FIELDS: Record<string, { fields: string[]; mode: 'all' | 'any' | 'custom' }> = {
  geotab_config: { fields: ['username', 'password', 'database'], mode: 'all' },
  holman_config: { fields: ['api_key', 'client_id'], mode: 'any' },
  asset_panda_config: { fields: ['api_token'], mode: 'any' },
  bob_hr_config: { fields: ['username'], mode: 'any' },
  concur_config: { fields: ['client_id'], mode: 'any' },
  safety_culture_config: { fields: ['api_token'], mode: 'any' },
  keylogbook_config: { fields: ['webhook_secret'], mode: 'any' },
  cis_config: { fields: ['api_key'], mode: 'any' },
  payroll_config: { fields: ['provider'], mode: 'any' },
  met_office_config: { fields: ['api_key'], mode: 'any' },
  google_maps_config: { fields: ['api_key'], mode: 'any' },
  whatsapp_config: { fields: ['api_token', 'phone_number_id', 'webhook_secret'], mode: 'all' },
  accounting_config: { fields: ['provider', 'xero_client_id', 'sage_client_id'], mode: 'custom' },
  stripe_config: { fields: ['secret_key'], mode: 'any' },
  microsoft_365_config: { fields: ['client_id'], mode: 'any' },
  zapier_config: { fields: ['webhook_url'], mode: 'any' },
  openground_config: { fields: ['api_key'], mode: 'any' },
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

// Check whether a single config value object satisfies the credential def.
function matchesDef(v: any, def: { fields: string[]; mode: 'all' | 'any' | 'custom' }): boolean {
  if (!v || typeof v !== 'object') return false;
  if (def.mode === 'all') return def.fields.every(f => !!v[f]);
  if (def.mode === 'any') return def.fields.some(f => !!v[f]);
  // custom: accounting — provider + (xero_client_id OR sage_client_id)
  if (def.mode === 'custom') {
    return !!v.provider && (!!v.xero_client_id || !!v.sage_client_id);
  }
  return false;
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
      const def = INTEGRATION_CONNECTED_FIELDS[k];
      if (!def) return false;
      const records = settingsByKey[k] || [];
      return records.some(v => matchesDef(v, def));
    };

    // Dedicated config entities (not stored in AppSetting).
    const assetPandaHasCreds = (assetPandaConfigs || []).some(c => !!(c.email || c.api_token));
    const mittiHasCreds = (mittiConfigs || []).some(c => !!(c.enabled || c.webhook_secret || c.api_token));
    const klbHasCreds = (klbConfigs || []).some(c => !!(c.enabled || c.ags_sync_enabled || c.webhook_secret || c.api_key));

    const integrations = Object.keys(INTEGRATION_CONNECTED_FIELDS).map(k => {
      const meta = INTEGRATION_META[k];
      let hasCredentials = false;
      if (k === 'asset_panda_config') hasCredentials = assetPandaHasCreds;
      else if (k === 'safety_culture_config') hasCredentials = mittiHasCreds;
      else if (k === 'keylogbook_config') hasCredentials = klbHasCreds;
      else hasCredentials = hasAppSettingCredentials(k);
      const status = hasCredentials ? 'configured' : 'not_configured';
      return { id: meta.id, label: meta.label, connected: hasCredentials, hasCredentials, status };
    });

    const configuredCount = integrations.filter(i => i.status === 'configured').length;
    const notConfiguredCount = integrations.filter(i => i.status === 'not_configured').length;

    // Merge ALL integration_hidden records (there may be duplicates from old
    // saves) so the flag is never lost due to a split-brain record.
    const integrationHidden: Record<string, boolean> = {};
    for (const recValue of (settingsByKey['integration_hidden'] || [])) {
      if (recValue && typeof recValue === 'object') {
        for (const [id, val] of Object.entries(recValue)) {
          if (val) integrationHidden[id] = true;
        }
      }
    }
    // Backward compatibility: migrate any old 'integration_coming_soon' flags
    // into integration_hidden on first load, then ignore the old key going
    // forward.
    for (const recValue of (settingsByKey['integration_coming_soon'] || [])) {
      if (recValue && typeof recValue === 'object') {
        for (const [id, val] of Object.entries(recValue)) {
          if (val) integrationHidden[id] = true;
        }
      }
    }
    const hiddenCount = Object.keys(integrationHidden).length;

    return Response.json({
      staffCount: (staff || []).length,
      activeStaff: (staff || []).filter(s => s.is_active !== false).length,
      jobsCount: (jobs || []).length,
      activeJobs: (jobs || []).filter(j => (j.status || 'planning') === 'in_progress').length,
      planningJobs: (jobs || []).filter(j => (j.status || 'planning') === 'planning').length,
      vehiclesCount: (vehicles || []).length,
      clientsCount: (clients || []).length,
      rateItemsCount: (rateItems || []).length,
      teamsCount: (teams || []).length,
      billingRulesCount: (billingRules || []).length,
      complianceItemsCount: (complianceItems || []).length,
      permissionGroupsCount: (permissionGroups || []).length,
      integrations,
      integrationConfiguredCount: configuredCount,
      integrationNotConfiguredCount: notConfiguredCount,
      integrationHidden,
      integrationHiddenCount: hiddenCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}