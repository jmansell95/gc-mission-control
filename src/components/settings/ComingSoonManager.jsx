import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Satellite, Radio, Database, Users, Landmark, ShieldAlert, ShieldCheck,
  FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard, CalendarDays,
  Webhook, FileUp, Clock, CheckCircle2, Sparkles, Loader2, Info, Lock, Unlock,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

/**
 * Coming Soon Manager — controls which integrations display as "Coming Soon".
 *
 * No toggle, no save button. Each integration has an instant action button:
 * click "Lock as Coming Soon" → writes immediately. Click "Unlock" → writes
 * immediately. Every click persists straight to the AppSetting record and
 * refetches the hub stats so the whole site updates in real time.
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
  const comingSoonMap = stats?.integrationComingSoon || {};
  const connectedIds = useMemo(() => new Set(integrations.filter(i => i.connected).map(i => i.id)), [integrations]);

  const refresh = () => qc.refetchQueries({ queryKey: ['settings-hub-stats'] });

  const setComingSoon = async (id, lock) => {
    if (busyId) return;
    setBusyId(id);
    try {
      // Read the current coming-soon record(s).
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });

      // Build the new map from ALL existing records (merge in case there are
      // duplicates from old saves), then apply the change.
      let merged = {};
      for (const rec of existing) {
        if (rec.value && typeof rec.value === 'object') {
          merged = { ...merged, ...rec.value };
        }
      }
      if (lock) merged[id] = true; else delete merged[id];

      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: merged };

      if (existing.length > 0) {
        // Update the first record, delete any duplicates to prevent split-brain.
        await base44.entities.AppSetting.update(existing[0].id, payload);
        if (existing.length > 1) {
          for (let i = 1; i < existing.length; i++) {
            await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
          }
        }
      } else {
        await base44.entities.AppSetting.create(payload);
      }

      await refresh();
      toast({
        title: lock ? 'Locked as Coming Soon' : 'Unlocked',
        description: lock
          ? 'This integration is now greyed out across the site.'
          : 'This integration can now be opened and configured.',
      });
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const lockAll = async () => {
    if (busyId) return;
    setBusyId('__all');
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
      let merged = {};
      for (const rec of existing) {
        if (rec.value && typeof rec.value === 'object') merged = { ...merged, ...rec.value };
      }
      // Lock every non-connected integration.
      for (const item of INTEGRATIONS) {
        if (!connectedIds.has(item.id)) merged[item.id] = true;
      }
      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: merged };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      await refresh();
      toast({ title: 'All available integrations locked', description: 'Every non-connected integration is now Coming Soon.' });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const unlockAll = async () => {
    if (busyId) return;
    setBusyId('__all');
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: {} };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      }
      await refresh();
      toast({ title: 'All integrations unlocked', description: 'No integrations are marked as Coming Soon.' });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = integrations.filter(i => i.status === 'active').length;
  const comingSoonCount = Object.keys(comingSoonMap).filter(k => !connectedIds.has(k)).length;
  const availableCount = INTEGRATIONS.filter(i => !connectedIds.has(i.id) && !comingSoonMap[i.id]).length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Coming Soon Manager"
        description="Lock integrations as 'Coming Soon' so they're greyed out and cannot be opened anywhere on the site. Click to lock or unlock — changes save instantly."
        icon={Clock}
        actions={
          <>
            <button
              onClick={lockAll}
              disabled={!!busyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50"
            >
              {busyId === '__all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Lock All
            </button>
            <button
              onClick={unlockAll}
              disabled={!!busyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock All
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
            Click <strong>Lock</strong> to grey out an integration across the entire site — it cannot be opened or configured until you click <strong>Unlock</strong>. Active (connected) integrations cannot be locked. Every click saves instantly — there's no save button.
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
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{availableCount}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Available</p>
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
          const isConnected = connectedIds.has(item.id);
          const isComingSoon = !!comingSoonMap[item.id] && !isConnected;
          const isBusy = busyId === item.id;

          return (
            <div key={item.id}
              className={'flex items-center gap-3 px-4 py-3.5 transition ' + (isLast ? '' : 'border-b border-slate-100 ') + (isComingSoon ? 'bg-amber-50/50' : '')}>
              <div className={'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition ' + (
                isConnected ? 'bg-emerald-50' : isComingSoon ? 'bg-amber-100' : 'bg-slate-100'
              )}>
                {isComingSoon ? (
                  <Clock className="w-4 h-4 text-amber-500" />
                ) : (
                  <Icon className={'w-4 h-4 ' + (isConnected ? 'text-emerald-500' : 'text-slate-400')} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={'text-sm font-semibold truncate ' + (isComingSoon ? 'text-slate-500' : 'text-slate-800')}>{item.label}</p>
                <p className="text-xs text-slate-400 truncate">{item.sub}</p>
              </div>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              )}
              <div className="flex-shrink-0">
                {isConnected ? (
                  <span className="text-[10px] font-bold text-emerald-600 px-3">Live</span>
                ) : isComingSoon ? (
                  <button
                    onClick={() => setComingSoon(item.id, false)}
                    disabled={!!busyId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-50 active:scale-95"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                    Unlock
                  </button>
                ) : (
                  <button
                    onClick={() => setComingSoon(item.id, true)}
                    disabled={!!busyId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50 active:scale-95"
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Lock
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