import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Satellite, Radio, Database, Users, Landmark, ShieldAlert, ShieldCheck,
  FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard, CalendarDays,
  Webhook, FileUp, EyeOff, Eye, CheckCircle2, Sparkles, Loader2, Info, SlidersHorizontal,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

/**
 * Hidden Integrations Manager — controls which integrations are hidden from
 * the Settings overview grid. Hide an integration you don't use and it won't
 * clutter the grid; click Show to bring it back. Every click persists
 * instantly to the integration_hidden AppSetting record and refetches the hub
 * stats so the whole site updates in real time.
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
  const [busyId, setBusyId] = useState(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrations = stats?.integrations || [];
  const hiddenMap = stats?.integrationHidden || {};
  const configuredIds = useMemo(() => new Set(integrations.filter(i => i.status === 'configured').map(i => i.id)), [integrations]);

  const refresh = () => qc.refetchQueries({ queryKey: ['settings-hub-stats'] });

  const setHidden = async (id, hide) => {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_hidden' });
      let merged = {};
      for (const rec of existing) {
        if (rec.value && typeof rec.value === 'object') merged = { ...merged, ...rec.value };
      }
      if (hide) merged[id] = true; else delete merged[id];
      const payload = { key: 'integration_hidden', label: 'Hidden Integration Flags', value: merged };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      await refresh();
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const hideAll = async () => {
    if (busyId) return;
    setBusyId('__all');
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_hidden' });
      let merged = {};
      for (const rec of existing) {
        if (rec.value && typeof rec.value === 'object') merged = { ...merged, ...rec.value };
      }
      for (const item of INTEGRATIONS) {
        merged[item.id] = true;
      }
      const payload = { key: 'integration_hidden', label: 'Hidden Integration Flags', value: merged };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      await refresh();
      toast({ title: 'All integrations hidden', description: 'Every integration is now hidden from the overview.' });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const showAll = async () => {
    if (busyId) return;
    setBusyId('__all');
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_hidden' });
      const payload = { key: 'integration_hidden', label: 'Hidden Integration Flags', value: {} };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      }
      await refresh();
      toast({ title: 'All integrations shown', description: 'No integrations are hidden.' });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const configuredCount = integrations.filter(i => i.status === 'configured').length;
  const hiddenCount = Object.keys(hiddenMap).filter(k => INTEGRATIONS.some(i => i.id === k)).length;
  const availableCount = INTEGRATIONS.filter(i => !hiddenMap[i.id]).length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Hidden Integrations"
        description="Hide integrations you don't use so they don't clutter the Settings overview. Click to hide or show — changes save instantly."
        icon={EyeOff}
        actions={
          <>
            <button
              onClick={hideAll}
              disabled={!!busyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50"
            >
              {busyId === '__all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
              Hide All
            </button>
            <button
              onClick={showAll}
              disabled={!!busyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Show All
            </button>
          </>
        }
      />

      {/* Info banner */}
      <div className="insight-card rounded-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">How this works</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Click <strong>Hide</strong> to remove an integration from the Settings overview — it won't appear until you click <strong>Show</strong>. Every click saves instantly — there's no save button.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="insight-card rounded-xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{configuredCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Configured</p>
        </div>
        <div className="insight-card rounded-xl p-3 text-center">
          <EyeOff className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{hiddenCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Hidden</p>
        </div>
        <div className="insight-card rounded-xl p-3 text-center">
          <Sparkles className="w-5 h-5 text-slate-400 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{availableCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Visible</p>
        </div>
      </div>

      {/* Integration list */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}
        {INTEGRATIONS.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === INTEGRATIONS.length - 1;
          const isConfigured = configuredIds.has(item.id);
          const isHidden = !!hiddenMap[item.id];
          const isBusy = busyId === item.id;

          return (
            <div key={item.id}
              className={'flex items-center gap-3 px-4 py-3.5 transition ' + (isLast ? '' : 'border-b border-slate-100 ') + (isHidden ? 'bg-amber-50/50' : '')}>
              <div className={'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition ' + (
                isConfigured ? 'bg-emerald-50' : isHidden ? 'bg-amber-100' : 'bg-slate-100'
              )}>
                {isHidden ? (
                  <EyeOff className="w-4 h-4 text-amber-500" />
                ) : (
                  <Icon className={'w-4 h-4 ' + (isConfigured ? 'text-emerald-500' : 'text-slate-400')} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={'text-sm font-semibold truncate ' + (isHidden ? 'text-slate-500' : 'text-slate-800')}>{item.label}</p>
                <p className="text-xs text-slate-400 truncate">{item.sub}</p>
              </div>
              {isConfigured && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Configured
                </span>
              )}
              <div className="flex-shrink-0">
                {isHidden ? (
                  <button
                    onClick={() => setHidden(item.id, false)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-50 active:scale-95"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    Show
                  </button>
                ) : (
                  <button
                    onClick={() => setHidden(item.id, true)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50 active:scale-95"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                    Hide
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}