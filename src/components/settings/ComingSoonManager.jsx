import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Satellite, Radio, Database, Users, Landmark, ShieldAlert, ShieldCheck,
  FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard, CalendarDays,
  Webhook, FileUp, Clock, CheckCircle2, Sparkles, Save, Loader2, Info,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

/**
 * Coming Soon Manager — controls which integrations display as "Coming Soon"
 * across the site. A Coming Soon integration is greyed out and cannot be opened
 * or configured until the flag is removed.
 *
 * The flag is stored in a single AppSetting record keyed `integration_coming_soon`
 * as a map of { integrationId: true }.
 *
 * Active (working) integrations cannot be marked coming-soon — the backend
 * auto-cleans them and the toggle is disabled here.
 */
const INTEGRATIONS = [
  { id: 'geotab-sync', icon: Satellite, label: 'Geotab GPS', sub: 'Live vehicle locations + specs' },
  { id: 'holman-sync', icon: Radio, label: 'Holman Fleet', sub: 'MOT, service dates & mileage' },
  { id: 'asset-panda', icon: Database, label: 'Asset Panda', sub: 'Live stock levels & asset matching' },
  { id: 'bob-hr', icon: Users, label: 'Bob HR (Hibob)', sub: 'Bidirectional time-off sync' },
  { id: 'concur-sync', icon: Landmark, label: 'SAP Concur', sub: 'Expenses & GL code sync' },
  { id: 'safety-culture', icon: ShieldAlert, label: 'Mitti', sub: 'Site safety audit sync' },
  { id: 'ags-import', icon: FileUp, label: 'KeyLogBook', sub: 'AGS & borehole data sync' },
  { id: 'cis-verification', icon: ShieldCheck, label: 'HMRC CIS', sub: 'Subcontractor verification' },
  { id: 'payroll-export', icon: FileSpreadsheet, label: 'Payroll Export', sub: 'Sage / Xero / CSV export' },
  { id: 'met-office', icon: Cloud, label: 'Open-Meteo Weather', sub: 'Daily site weather forecasts' },
  { id: 'google-maps', icon: MapPin, label: 'Google Maps', sub: 'Geocoding & route optimisation' },
  { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Business', sub: 'Crew alert push' },
  { id: 'accounting-sync', icon: FileSpreadsheet, label: 'Xero / Sage', sub: 'Invoice & cost push' },
  { id: 'payment-gateway', icon: CreditCard, label: 'Stripe Payments', sub: 'Client invoice payments' },
  { id: 'microsoft-365', icon: CalendarDays, label: 'Microsoft 365', sub: 'SSO for Outlook, Teams, OneDrive' },
  { id: 'zapier-webhooks', icon: Webhook, label: 'Zapier / Make', sub: 'Outbound webhook automation' },
];

export default function ComingSoonManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [localMap, setLocalMap] = useState(null); // null = not yet synced from server
  const [settingId, setSettingId] = useState(null); // cached AppSetting record ID

  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrations = stats?.integrations || [];
  const serverComingSoon = stats?.integrationComingSoon || {};

  // Sync local state from server ONCE when data first arrives (or after save).
  // Using null sentinel so we don't fight the user's edits on every render.
  React.useEffect(() => {
    if (localMap === null && stats) {
      setLocalMap({ ...serverComingSoon });
    }
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache the AppSetting record ID so we don't re-filter on every save.
  React.useEffect(() => {
    if (settingId === null && stats) {
      base44.entities.AppSetting.filter({ key: 'integration_coming_soon' })
        .then(recs => { if (recs[0]) setSettingId(recs[0].id); })
        .catch(() => {});
    }
  }, [stats, settingId]);

  const connectedIds = useMemo(() => new Set(integrations.filter(i => i.connected).map(i => i.id)), [integrations]);

  const toggle = useCallback((id) => {
    if (connectedIds.has(id)) return;
    setLocalMap(prev => {
      const next = { ...(prev || {}) };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }, [connectedIds]);

  const currentMap = localMap || {};
  const hasChanges = localMap !== null && JSON.stringify(currentMap) !== JSON.stringify(serverComingSoon);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: currentMap };

      // Use cached ID if available; otherwise filter for the record.
      let id = settingId;
      if (!id) {
        const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
        id = existing[0]?.id;
      }

      if (id) {
        await base44.entities.AppSetting.update(id, payload);
        setSettingId(id);
      } else {
        const created = await base44.entities.AppSetting.create(payload);
        setSettingId(created.id);
      }

      // Force an immediate refetch (not just invalidation) so every component
      // reading 'settings-hub-stats' updates right away.
      await qc.refetchQueries({ queryKey: ['settings-hub-stats'] });
      toast({ title: 'Coming Soon flags saved', description: 'The Settings overview has been updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const activeCount = integrations.filter(i => i.status === 'active').length;
  const comingSoonCount = Object.keys(currentMap).filter(k => !connectedIds.has(k)).length;
  const notSetUpCount = integrations.filter(i => i.status !== 'active' && !currentMap[i.id]).length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Coming Soon Manager"
        description="Control which integrations are locked as 'Coming Soon'. A Coming Soon integration is greyed out across the site and cannot be opened or configured until the flag is removed. Active (working) integrations cannot be marked as coming soon."
        icon={Clock}
      />

      {/* Info banner */}
      <div className="insight-card rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">How this works</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Toggle an integration ON to lock it as "Coming Soon" — it will be greyed out and cannot be opened or configured anywhere on the site until you toggle it back off. Active integrations (credentials saved + working connection) cannot be marked coming soon.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="insight-card rounded-xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{activeCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Active</p>
        </div>
        <div className="insight-card rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{comingSoonCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Coming Soon</p>
        </div>
        <div className="insight-card rounded-xl p-3 text-center">
          <Sparkles className="w-5 h-5 text-slate-400 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{notSetUpCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Not Set Up</p>
        </div>
      </div>

      {/* Integration list */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {INTEGRATIONS.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === INTEGRATIONS.length - 1;
          const isConnected = connectedIds.has(item.id);
          const isComingSoon = !!currentMap[item.id] && !isConnected;

          return (
            <div key={item.id}
              className={'flex items-center gap-3 px-4 py-3.5 ' + (isLast ? '' : 'border-b border-slate-100 ') + (isComingSoon ? 'bg-slate-50/60' : '')}>
              <Icon className={'w-5 h-5 flex-shrink-0 ' + (isConnected ? 'text-emerald-500' : isComingSoon ? 'text-slate-300' : 'text-slate-400')} />
              <div className="min-w-0 flex-1">
                <p className={'text-sm font-semibold truncate ' + (isComingSoon ? 'text-slate-400' : 'text-slate-800')}>{item.label}</p>
                <p className="text-xs text-slate-400 truncate">{item.sub}</p>
              </div>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={'text-[10px] font-bold ' + (isComingSoon ? 'text-amber-600' : isConnected ? 'text-emerald-600' : 'text-slate-400')}>
                  {isComingSoon ? 'Coming Soon' : isConnected ? 'Live' : 'Available'}
                </span>
                <Switch
                  checked={isComingSoon}
                  disabled={isConnected}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Mark ${item.label} as coming soon`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10">
          <div className="insight-card rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg">
            <p className="text-sm font-semibold text-slate-700 pl-2">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setLocalMap({ ...serverComingSoon })}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-100 transition">
                Discard
              </button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#2E5A1A] hover:bg-[#1c4a12] transition disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}