import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Database, Satellite, Radio, Users, Landmark, ShieldAlert, FileUp,
  ShieldCheck, FileSpreadsheet, Cloud, MapPin, MessageCircle, CreditCard,
  Link2, Link2Off, ArrowRight, Webhook, Sparkles, X, CheckSquare,
  Square, Loader2, Calendar, Lock, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

/**
 * Integrations Hub — all external system connections in one place.
 *
 * Uses getSettingsHubStats as the SINGLE source of truth for each
 * integration's status (active / needs_attention / not_configured) and the
 * Coming Soon flags. This is the same store the Coming Soon Manager writes
 * to (AppSetting key `integration_coming_soon`), so the two surfaces always
 * agree.
 *
 * Coming Soon enforcement: a coming-soon integration is greyed out, shows a
 * lock + Coming Soon badge, and cannot be opened — clicking it does nothing.
 * Active integrations are never coming-soon (the backend auto-cleans).
 */
const INTEGRATIONS = [
  { id: 'geotab-sync', name: 'Geotab GPS', category: 'Fleet & Vehicles', icon: Satellite, color: 'bg-blue-100 text-blue-600', desc: 'Live locations + vehicle specs via Geotab API + webhook' },
  { id: 'holman-sync', name: 'Holman Fleet', category: 'Fleet & Vehicles', icon: Radio, color: 'bg-cyan-100 text-cyan-600', desc: 'MOT, service dates & mileage from Holman fleet management' },
  { id: 'asset-panda', name: 'Asset Panda', category: 'Assets & Inventory', icon: Database, color: 'bg-emerald-100 text-emerald-600', desc: 'Live stock levels, warehouse locations & asset matching' },
  { id: 'bob-hr', name: 'Bob HR (Hibob)', category: 'People & HR', icon: Users, color: 'bg-violet-100 text-violet-600', desc: 'Bidirectional time-off sync with Bob HR + webhook receiver' },
  { id: 'concur-sync', name: 'SAP Concur', category: 'Finance', icon: Landmark, color: 'bg-indigo-100 text-indigo-600', desc: 'Push approved expenses & timesheets, pull GL codes' },
  { id: 'safety-culture', name: 'Mitti', category: 'Safety & Compliance', icon: ShieldAlert, color: 'bg-rose-100 text-rose-600', desc: 'Sync site safety audits & inspection forms from Mitti' },
  { id: 'ags-import', name: 'KeyLogBook', category: 'Ground Investigation', icon: FileUp, color: 'bg-amber-100 text-amber-600', desc: 'AGS & borehole data sync — webhook, upload & pull sync' },
  { id: 'cis-verification', name: 'HMRC CIS', category: 'Finance', icon: ShieldCheck, color: 'bg-teal-100 text-teal-600', desc: 'Verify subcontractors against HMRC CIS register' },
  { id: 'payroll-export', name: 'Payroll Export', category: 'Finance', icon: FileSpreadsheet, color: 'bg-slate-100 text-slate-600', desc: 'Export approved weekly timesheets to Sage / Xero / CSV' },
  { id: 'met-office', name: 'Open-Meteo Weather', category: 'Operations', icon: Cloud, color: 'bg-sky-100 text-sky-600', desc: 'Free daily weather forecasts for all active sites' },
  { id: 'google-maps', name: 'Google Maps', category: 'Operations', icon: MapPin, color: 'bg-red-100 text-red-600', desc: 'Geocoding for job sites + travel route optimisation' },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'Communication', icon: MessageCircle, color: 'bg-green-100 text-green-600', desc: 'Push critical alerts to crew via WhatsApp Business API' },
  { id: 'accounting-sync', name: 'Xero / Sage', category: 'Finance', icon: FileSpreadsheet, color: 'bg-purple-100 text-purple-600', desc: 'Push invoices & purchase costs to Xero or Sage accounting' },
  { id: 'payment-gateway', name: 'Stripe Payments', category: 'Finance', icon: CreditCard, color: 'bg-indigo-100 text-indigo-600', desc: 'Accept client invoice payments via Stripe in the client portal' },
  { id: 'microsoft-365', name: 'Microsoft 365', category: 'Communication', icon: Calendar, color: 'bg-blue-100 text-blue-600', desc: 'Unified SSO for Outlook, SharePoint, Teams & OneDrive' },
  { id: 'zapier-webhooks', name: 'Zapier / Make', category: 'Automation', icon: Webhook, color: 'bg-orange-100 text-orange-600', desc: 'Outbound webhooks for no-code automation' },
];

export default function IntegrationsHub({ onNavigate }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrationStats = stats?.integrations || [];
  const comingSoonMap = stats?.integrationComingSoon || {};

  // Build a lookup of status by integration id.
  const statusById = useMemo(() => {
    const m = {};
    for (const i of integrationStats) m[i.id] = i;
    return m;
  }, [integrationStats]);

  const isComingSoon = (id) => !!comingSoonMap[id] && statusById[id]?.status !== 'active';
  const comingSoonIds = useMemo(() => new Set(INTEGRATIONS.filter(i => isComingSoon(i.id)).map(i => i.id)), [comingSoonMap, statusById]);

  const activeCount = integrationStats.filter(i => i.status === 'active').length;
  const notConfiguredCount = integrationStats.filter(i => i.status === 'not_configured').length;

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

  const saveComingSoon = async (idsToMark) => {
    setSaving(true);
    try {
      // Write to the unified `integration_coming_soon` map (same store the
      // Coming Soon Manager uses) so both surfaces stay in sync.
      const map = {};
      for (const id of idsToMark) map[id] = true;
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: map };
      if (existing[0]) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      await qc.invalidateQueries({ queryKey: ['settings-hub-stats'] });
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
  const handleClearAll = () => saveComingSoon(new Set());

  const statusBadge = (integ) => {
    const st = statusById[integ.id]?.status;
    if (isComingSoon(integ.id)) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <Lock className="w-3 h-3" /> Coming Soon
        </span>
      );
    }
    if (st === 'active') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
          <Link2 className="w-3 h-3" /> Active
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
        <Link2Off className="w-3 h-3" /> Not configured
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Link2}
        title="Integrations Hub"
        description={`All external system connections in one place. ${activeCount} of ${INTEGRATIONS.length} active, ${INTEGRATIONS.length - activeCount} not configured. An integration is Active when it has saved credentials or is receiving data.`}
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

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="insight-card rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{activeCount}</p><p className="text-[10px] text-slate-500 font-semibold">Active</p></div>
        </div>
        <div className="insight-card rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Link2Off className="w-5 h-5 text-slate-500" /></div>
          <div><p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{notConfiguredCount}</p><p className="text-[10px] text-slate-500 font-semibold">Not configured</p></div>
        </div>
        <div className="insight-card rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><Lock className="w-5 h-5 text-slate-500" /></div>
          <div><p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{comingSoonIds.size}</p><p className="text-[10px] text-slate-500 font-semibold">Coming soon</p></div>
        </div>
        <div className="insight-card rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Webhook className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{INTEGRATIONS.length}</p><p className="text-[10px] text-slate-500 font-semibold">Total</p></div>
        </div>
      </div>

      {/* Manage mode banner */}
      {manageMode && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2E5A1A]" />
            <p className="text-sm font-semibold text-slate-800">
              Select integrations to mark as <span className="text-amber-600">Coming Soon</span> — they'll be greyed out and locked.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSelected(new Set(comingSoonIds))}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
              Select current ({comingSoonIds.size})
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
              disabled={saving || comingSoonIds.size === 0}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition disabled:opacity-50">
              Clear All Badges
            </button>
            <button onClick={handleApply}
              disabled={saving || selected.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2E5A1A] hover:bg-[#244715] rounded-lg transition disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              Apply ({selected.size})
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
              const comingSoon = isComingSoon(integ.id);
              const isSelected = selected.has(integ.id);
              const blocked = comingSoon && !manageMode;
              return (
                <button
                  key={integ.id}
                  onClick={() => manageMode ? toggleSelect(integ.id) : (blocked ? null : onNavigate?.(integ.id))}
                  className={`relative bg-white border rounded-xl p-4 text-left transition group overflow-hidden ${
                    manageMode
                      ? isSelected
                        ? 'border-[#2E5A1A] ring-2 ring-[#2E5A1A]/20 hover:shadow-md'
                        : 'border-slate-200 hover:border-[#2E5A1A]/50 hover:shadow-md'
                      : blocked
                        ? 'border-slate-200 cursor-not-allowed'
                        : 'border-slate-200 hover:border-[#2E5A1A] hover:shadow-md'
                  }`}
                >
                  {comingSoon && !manageMode && (
                    <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full uppercase">
                      <Lock className="w-2.5 h-2.5" /> Coming Soon
                    </span>
                  )}
                  {manageMode && (
                    <span className="absolute top-2 right-2 z-10">
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-[#2E5A1A]" />
                        : <Square className="w-5 h-5 text-slate-300" />}
                    </span>
                  )}
                  <div className={`flex items-start gap-3 ${blocked ? 'opacity-40 grayscale' : ''}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${integ.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{integ.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{integ.desc}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {statusBadge(integ)}
                        {!manageMode && !blocked && (
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