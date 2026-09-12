import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import {
  Link2, Link2Off, Check, Database, Satellite, Radio, Users,
  Landmark, ShieldAlert, ShieldCheck, FileSpreadsheet, Cloud, MapPin,
  MessageCircle, CreditCard, Webhook, FileUp, Calendar,
} from 'lucide-react';

/**
 * Enterprise Integrations Overview — cross-division view showing every
 * integration, its global connection status, and which divisions have it
 * enabled. Shown on the Enterprise Dashboard (no division context).
 */

const INTEGRATIONS = [
  { id: 'geotab', name: 'Geotab GPS', icon: Satellite, color: 'bg-blue-100 text-blue-600', settingKey: 'geotab_config', connectedField: 'username', divisionSetting: 'enable_geotab_tracking', category: 'Fleet & Vehicles' },
  { id: 'holman', name: 'Holman Fleet', icon: Radio, color: 'bg-cyan-100 text-cyan-600', settingKey: 'holman_config', connectedField: 'api_key', category: 'Fleet & Vehicles' },
  { id: 'asset-panda', name: 'Asset Panda', icon: Database, color: 'bg-emerald-100 text-emerald-600', settingKey: 'asset_panda_config', connectedField: 'token', divisionSetting: 'enable_asset_panda', category: 'Assets & Inventory' },
  { id: 'ags-import', name: 'KeyLogBook', icon: FileUp, color: 'bg-amber-100 text-amber-600', settingKey: 'keylogbook_config', connectedField: 'webhook_secret', divisionSetting: 'enable_keylogbook', geotechOnly: true, category: 'Geotechnical Data' },
  { id: 'openground', name: 'OpenGround', icon: Database, color: 'bg-blue-100 text-blue-600', settingKey: 'openground_config', connectedField: 'client_id', divisionSetting: 'enable_open_ground', geotechOnly: true, category: 'Geotechnical Data' },
  { id: 'bob-hr', name: 'Bob HR (Hibob)', icon: Users, color: 'bg-violet-100 text-violet-600', settingKey: 'bob_hr_config', connectedField: 'username', category: 'People & HR' },
  { id: 'concur', name: 'SAP Concur', icon: Landmark, color: 'bg-indigo-100 text-indigo-600', settingKey: 'concur_config', connectedField: 'client_id', category: 'Finance' },
  { id: 'safety-culture', name: 'SafetyCulture', icon: ShieldAlert, color: 'bg-rose-100 text-rose-600', settingKey: 'safety_culture_config', connectedField: 'api_token', divisionSetting: 'enable_safetyculture', category: 'Safety & Compliance' },
  { id: 'cis', name: 'HMRC CIS', icon: ShieldCheck, color: 'bg-teal-100 text-teal-600', settingKey: 'cis_config', connectedField: 'api_key', category: 'Finance' },
  { id: 'payroll', name: 'Payroll Export', icon: FileSpreadsheet, color: 'bg-slate-100 text-slate-600', settingKey: 'payroll_config', connectedField: 'provider', category: 'Finance' },
  { id: 'met-office', name: 'Met Office', icon: Cloud, color: 'bg-sky-100 text-sky-600', settingKey: 'met_office_config', connectedField: 'api_key', category: 'Operations' },
  { id: 'google-maps', name: 'Google Maps', icon: MapPin, color: 'bg-red-100 text-red-600', settingKey: 'google_maps_config', connectedField: 'api_key', category: 'Operations' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'bg-green-100 text-green-600', settingKey: 'whatsapp_config', connectedField: 'api_token', category: 'Communication' },
  { id: 'accounting', name: 'Xero / Sage', icon: FileSpreadsheet, color: 'bg-purple-100 text-purple-600', settingKey: 'accounting_config', connectedField: 'provider', category: 'Finance' },
  { id: 'stripe', name: 'Stripe Payments', icon: CreditCard, color: 'bg-indigo-100 text-indigo-600', settingKey: 'stripe_config', connectedField: 'secret_key', category: 'Finance' },
  { id: 'm365', name: 'Microsoft 365', icon: Calendar, color: 'bg-blue-100 text-blue-600', settingKey: 'm365_config', connectedField: 'tenant_id', category: 'Communication' },
  { id: 'zapier', name: 'Zapier / Make', icon: Webhook, color: 'bg-orange-100 text-orange-600', settingKey: 'zapier_config', connectedField: 'webhook_url', category: 'Automation' },
];

export default function EnterpriseIntegrationsOverview() {
  const { permittedDivisions } = useDivision();

  const { data: allSettings = [] } = useQuery({
    queryKey: ['ent-integration-configs'],
    queryFn: () => base44.entities.AppSetting.filter({
      key: { $in: INTEGRATIONS.map(i => i.settingKey) },
    }, '-created_date', 50),
  });

  // Asset Panda stores its credentials in a dedicated entity (not AppSetting),
  // so fetch it separately to determine its connection status.
  const { data: pandaConfigs = [] } = useQuery({
    queryKey: ['asset-panda-config'],
    queryFn: () => base44.entities.AssetPandaConfig.filter({ key: 'global' }, '-created_date', 1),
  });
  const pandaConfig = pandaConfigs[0];

  const configMap = useMemo(() => {
    const m = {};
    for (const s of allSettings) m[s.key] = s.value || {};
    return m;
  }, [allSettings]);

  const isConnected = (integ) => {
    // Asset Panda credentials live in a dedicated entity — check email/api_token.
    if (integ.id === 'asset-panda') {
      return !!(pandaConfig && (pandaConfig.email || pandaConfig.api_token));
    }
    const cfg = configMap[integ.settingKey];
    if (!cfg) return false;
    return !!(cfg[integ.connectedField]);
  };

  const connectedCount = INTEGRATIONS.filter(isConnected).length;
  const totalCount = INTEGRATIONS.length;

  const getDivisionStatus = (integ) => {
    if (!integ.divisionSetting) return null;
    return permittedDivisions.map(d => {
      if (integ.geotechOnly && d.division_type !== 'geotechnical') return { division: d, enabled: false, applicable: false };
      const enabled = !!(d.settings && d.settings[integ.divisionSetting]);
      return { division: d, enabled, applicable: true };
    }).filter(Boolean);
  };

  return (
    <section className="hub-glass rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
          <Link2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-extrabold text-slate-900">Integrations Overview</h2>
          <p className="text-xs text-slate-500">{connectedCount} of {totalCount} connected globally {'\u00B7'} per-division enablement shown below</p>
        </div>
        <span className={'text-xs font-bold px-2.5 py-1 rounded-full ' + (connectedCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
          {connectedCount} Active
        </span>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: (connectedCount / totalCount * 100) + '%' }} />
        </div>
        <span className="text-xs font-bold text-slate-500 tabular-nums">{Math.round(connectedCount / totalCount * 100)}%</span>
      </div>

      {/* Integration rows */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto -mx-1 px-1">
        {INTEGRATIONS.map(integ => {
          const Icon = integ.icon;
          const connected = isConnected(integ);
          const divStatuses = getDivisionStatus(integ);
          return (
            <div key={integ.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
              <div className={'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ' + integ.color}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-800 truncate">{integ.name}</p>
                  {integ.geotechOnly && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Geo</span>}
                </div>
                <p className="text-[10px] text-slate-400">{integ.category}</p>
              </div>
              {/* Global connection status */}
              <div className="flex-shrink-0">
                {connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                    <Link2Off className="w-3 h-3" /> Not Connected
                  </span>
                )}
              </div>
              {/* Per-division enablement dots */}
              {divStatuses && divStatuses.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  {divStatuses.map(ds => (
                    <div key={ds.division.id}
                      title={ds.division.name + ': ' + (ds.applicable ? (ds.enabled ? 'Enabled' : 'Disabled') : 'N/A')}
                      className={'w-2.5 h-2.5 rounded-full transition ' + (!ds.applicable ? 'bg-slate-200' : ds.enabled ? 'bg-emerald-500' : 'bg-slate-300')}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Division legend */}
      {permittedDivisions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Business Streams:</span>
          {permittedDivisions.map(d => (
            <span key={d.id} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
              {d.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}