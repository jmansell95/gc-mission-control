import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database, Satellite, Radio, Users, Landmark, ShieldAlert, FileUp,
  ShieldCheck, FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard,
  Link2, Link2Off, ArrowRight, Search, Webhook, Sparkles, X, CheckSquare,
  Square, Loader2, Calendar,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

// All integrations in the platform — existing + new. Each links to its
// dedicated settings page where the admin enters API keys & webhooks.
const INTEGRATIONS = [
  // --- Core (active by default) ---
  { id: 'geotab-sync', name: 'Geotab GPS', category: 'Fleet & Vehicles', icon: Satellite, color: 'bg-blue-100 text-blue-600', settingKey: 'geotab_config', connectedField: 'username', desc: 'Live locations + vehicle specs (make, model, year, fuel type) via Geotab API + webhook' },
  { id: 'holman-sync', name: 'Holman Fleet', category: 'Fleet & Vehicles', icon: Radio, color: 'bg-cyan-100 text-cyan-600', settingKey: 'holman_config', connectedField: 'api_key', desc: 'MOT, service dates & mileage from Holman fleet management' },
  { id: 'asset-panda', name: 'Asset Panda', category: 'Assets & Inventory', icon: Database, color: 'bg-emerald-100 text-emerald-600', settingKey: 'asset_panda_config', connectedField: 'token', desc: 'Live stock levels, warehouse locations & asset matching' },

  // --- Secondary (Coming Soon by default until connected) ---
  { id: 'bob-hr', name: 'Bob HR (Hibob)', category: 'People & HR', icon: Users, color: 'bg-violet-100 text-violet-600', settingKey: 'bob_hr_config', connectedField: 'username', desc: 'Bidirectional time-off sync with Bob HR + webhook receiver', defaultComingSoon: true },
  { id: 'concur-sync', name: 'SAP Concur', category: 'Finance', icon: Landmark, color: 'bg-indigo-100 text-indigo-600', settingKey: 'concur_config', connectedField: 'client_id', desc: 'Push approved expenses & timesheets, pull GL codes, lock synced records', defaultComingSoon: true },
  { id: 'safety-culture', name: 'Mitti', category: 'Safety & Compliance', icon: ShieldAlert, color: 'bg-rose-100 text-rose-600', settingKey: 'safety_culture_config', connectedField: 'api_token', desc: 'Sync site safety audits & inspection forms from Mitti', defaultComingSoon: true },
  { id: 'cis-verification', name: 'HMRC CIS', category: 'Finance', icon: ShieldCheck, color: 'bg-teal-100 text-teal-600', settingKey: 'cis_config', connectedField: 'api_key', desc: 'Verify subcontractors against HMRC CIS register', defaultComingSoon: true },
  { id: 'payroll-export', name: 'Payroll Export', category: 'Finance', icon: FileSpreadsheet, color: 'bg-slate-100 text-slate-600', settingKey: 'payroll_config', connectedField: 'provider', desc: 'Export approved weekly timesheets to Sage / Xero / CSV', defaultComingSoon: true },
  { id: 'zapier-webhooks', name: 'Zapier / Make Webhooks', category: 'Automation', icon: Webhook, color: 'bg-orange-100 text-orange-600', settingKey: 'zapier_config', connectedField: 'webhook_url', desc: 'Register outbound webhook URLs to receive system events for no-code automation', defaultComingSoon: true },
  { id: 'met-office', name: 'Open-Meteo Weather', category: 'Operations', icon: Cloud, color: 'bg-sky-100 text-sky-600', settingKey: 'met_office_config', connectedField: 'last_sync_at', desc: 'Free daily weather forecasts for all active sites — no API key needed, multi-model accuracy', defaultComingSoon: false },
  { id: 'google-maps', name: 'Google Maps', category: 'Operations', icon: MapPin, color: 'bg-red-100 text-red-600', settingKey: 'google_maps_config', connectedField: 'api_key', desc: 'Geocoding for job sites + travel route optimisation', defaultComingSoon: true },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Communication', icon: MessageCircle, color: 'bg-green-100 text-green-600', settingKey: 'whatsapp_config', connectedField: 'api_token', desc: 'Push critical alerts to crew via WhatsApp Business API', defaultComingSoon: true },
  { id: 'accounting-sync', name: 'Xero / Sage', category: 'Finance', icon: FileSpreadsheet, color: 'bg-purple-100 text-purple-600', settingKey: 'accounting_config', connectedField: 'provider', desc: 'Push invoices & purchase costs to Xero or Sage accounting', defaultComingSoon: true },
  { id: 'payment-gateway', name: 'Stripe Payments', category: 'Finance', icon: CreditCard, color: 'bg-indigo-100 text-indigo-600', settingKey: 'stripe_config', connectedField: 'secret_key', desc: 'Accept client invoice payments via Stripe in the client portal', defaultComingSoon: true },
  { id: 'microsoft-365', name: 'Microsoft 365', category: 'Communication', icon: Calendar, color: 'bg-blue-100 text-blue-600', settingKey: 'm365_config', connectedField: 'tenant_id', desc: 'Unified SSO for Outlook Calendar, SharePoint Documents, Teams Notifications & OneDrive Files', defaultComingSoon: true },
];

const COMING_SOON_SETTING_KEY = 'integration_coming_soon_ids';

export default function IntegrationsHub({ onNavigate }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [configStatus, setConfigStatus] = useState({});
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Batch-fetch all AppSetting records to determine connection status
  const { data: allSettings = [] } = useQuery({
    queryKey: ['all-integration-configs'],
    queryFn: () => base44.entities.AppSetting.filter({
      key: { $in: [...INTEGRATIONS.map(i => i.settingKey), COMING_SOON_SETTING_KEY] },
    }, '-created_date', 50),
  });

  // Asset Panda stores its credentials in a dedicated entity (not AppSetting),
  // so fetch it separately to determine its connection status.
  const { data: pandaConfigs = [] } = useQuery({
    queryKey: ['asset-panda-config'],
    queryFn: () => base44.entities.AssetPandaConfig.filter({ key: 'global' }, '-created_date', 1),
  });
  const pandaConfig = pandaConfigs[0];

  useEffect(() => {
    const status = {};
    for (const setting of allSettings) {
      status[setting.key] = setting.value || {};
    }
    setConfigStatus(status);
  }, [allSettings]);

  const comingSoonIds = useMemo(() => {
    const rec = allSettings.find(s => s.key === COMING_SOON_SETTING_KEY);
    if (!rec) return new Set();
    const val = rec.value;
    if (Array.isArray(val)) return new Set(val);
    if (val && Array.isArray(val.ids)) return new Set(val.ids);
    return new Set();
  }, [allSettings]);

  const isConnected = (integ) => {
    // Asset Panda credentials live in a dedicated entity — check email/api_token.
    if (integ.id === 'asset-panda') {
      return !!(pandaConfig && (pandaConfig.email || pandaConfig.api_token));
    }
    const cfg = configStatus[integ.settingKey];
    if (!cfg) return false;
    return !!(cfg[integ.connectedField]);
  };

  const connectedCount = INTEGRATIONS.filter(isConnected).length;
  const comingSoonCount = comingSoonIds.size;

  // Group by category
  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];
  const grouped = categories.map(cat => ({
    category: cat,
    items: INTEGRATIONS.filter(i => i.category === cat),
  }));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllComingSoon = () => setSelected(new Set(comingSoonIds));

  const saveComingSoon = async (idsToMark) => {
    setSaving(true);
    try {
      const existing = allSettings.find(s => s.key === COMING_SOON_SETTING_KEY);
      const value = { ids: [...idsToMark] };
      if (existing) {
        await base44.entities.AppSetting.update(existing.id, { key: COMING_SOON_SETTING_KEY, value });
      } else {
        await base44.entities.AppSetting.create({ key: COMING_SOON_SETTING_KEY, value });
      }
      await queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      toast({
        title: 'Coming Soon badges updated',
        description: `${idsToMark.size} integration${idsToMark.size === 1 ? '' : 's'} marked as Coming Soon.`,
      });
      setManageMode(false);
      setSelected(new Set());
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = () => saveComingSoon(new Set(selected));
  const handleClearAll = async () => saveComingSoon(new Set());

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Link2}
        title="Integrations Hub"
        description={`All external system connections in one place. ${connectedCount} of ${INTEGRATIONS.length} integrations configured. Enter API keys and webhook details when you're ready to link each service — nothing syncs until you save credentials and hit the sync button.`}
        actions={
          <button
            onClick={() => { setManageMode(m => !m); setSelected(new Set()); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
              manageMode
                ? 'bg-[#2E5A1A] text-white hover:bg-[#244715]'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-[#2E5A1A] hover:text-[#2E5A1A]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {manageMode ? 'Exit Manage Mode' : 'Manage Coming Soon'}
          </button>
        }
      />

      {/* Manage mode banner */}
      {manageMode && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2E5A1A]" />
            <p className="text-sm font-semibold text-slate-800">
              Select integrations to mark as <span className="text-amber-600">Coming Soon</span> — they'll be greyed out and show a badge.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={selectAllComingSoon}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Select current Coming Soon ({comingSoonIds.size})
            </button>
            <button onClick={() => setSelected(new Set(INTEGRATIONS.map(i => i.id)))}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Select All
            </button>
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Clear selection
            </button>
            <span className="text-xs text-slate-400 ml-1">{selected.size} selected</span>
            <div className="flex-1" />
            <button onClick={handleClearAll}
              disabled={saving || comingSoonCount === 0}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition disabled:opacity-50">
              Clear All Badges
            </button>
            <button onClick={handleApply}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2E5A1A] hover:bg-[#244715] rounded-lg transition disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              Apply Coming Soon ({selected.size})
            </button>
          </div>
        </div>
      )}

      {/* Integration cards grouped by category */}
      {grouped.map(group => (
        <div key={group.category}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">{group.category}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map(integ => {
              const Icon = integ.icon;
              const connected = isConnected(integ);
              const isComingSoon = comingSoonIds.has(integ.id);
              const isSelected = selected.has(integ.id);
              return (
                <button
                  key={integ.id}
                  onClick={() => manageMode ? toggleSelect(integ.id) : (isComingSoon ? null : onNavigate?.(integ.id))}
                  className={`relative bg-white border rounded-xl p-4 text-left transition group overflow-hidden ${
                    manageMode
                      ? isSelected
                        ? 'border-[#2E5A1A] ring-2 ring-[#2E5A1A]/20 hover:shadow-md'
                        : 'border-slate-200 hover:border-[#2E5A1A]/50 hover:shadow-md'
                      : isComingSoon
                        ? 'border-slate-200 cursor-default'
                        : 'border-slate-200 hover:border-[#2E5A1A] hover:shadow-md'
                  }`}
                >
                  {isComingSoon && !manageMode && (
                    <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                      <Sparkles className="w-2.5 h-2.5" /> Coming Soon
                    </span>
                  )}
                  {manageMode && (
                    <span className="absolute top-2 right-2 z-10">
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-[#2E5A1A]" />
                        : <Square className="w-5 h-5 text-slate-300" />}
                    </span>
                  )}
                  <div className={`flex items-start gap-3 ${isComingSoon && !manageMode ? 'opacity-40 grayscale' : ''}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${integ.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-800 truncate">{integ.name}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{integ.desc}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {connected ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <Link2 className="w-3 h-3" /> Configured
                          </span>
                        ) : isComingSoon ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <Sparkles className="w-3 h-3" /> Coming Soon
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Link2Off className="w-3 h-3" /> Not Connected
                          </span>
                        )}
                        {!manageMode && !isComingSoon && (
                          <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#2E5A1A] ml-auto transition" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}