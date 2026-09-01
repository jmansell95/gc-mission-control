import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon, CheckCircle2, Clock, Webhook,
  Search, X, ChevronRight, ExternalLink, Link2, Link2Off, Lock, Unlock,
  Sparkles, Loader2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';
import { useToast } from '@/components/ui/use-toast';

// Item IDs that belong to the Integrations section
const INTEGRATION_IDS = new Set([
  'geotab-sync', 'holman-sync', 'asset-panda', 'bob-hr', 'concur-sync',
  'safety-culture', 'cis-verification', 'payroll-export',
  'met-office', 'google-maps', 'whatsapp', 'accounting-sync', 'payment-gateway',
  'microsoft-365', 'zapier-webhooks', 'ags-import', 'openground-sync',
]);

// Item IDs that belong to the Planning & Briefing section (external routes)
const PLANNING_IDS = new Set(['azure-migration', 'presentation-pack']);

export default function SettingsHubOverview({ onNavigate, items }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [manageMode, setManageMode] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrations = stats?.integrations || [];
  const activeCount = integrations.filter(i => i.status === 'active').length;
  const notConfiguredCount = integrations.filter(i => i.status === 'not_configured').length;
  const comingSoonMap = stats?.integrationComingSoon || {};
  const comingSoonCount = Object.keys(comingSoonMap).length;

  const setComingSoon = async (id, lock) => {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
      let merged = {};
      for (const rec of existing) {
        if (rec.value && typeof rec.value === 'object') merged = { ...merged, ...rec.value };
      }
      if (lock) merged[id] = true; else delete merged[id];
      const payload = { key: 'integration_coming_soon', label: 'Integration Coming Soon Flags', value: merged };
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, payload);
        for (let i = 1; i < existing.length; i++) {
          await base44.entities.AppSetting.delete(existing[i].id).catch(() => {});
        }
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      await qc.refetchQueries({ queryKey: ['settings-hub-stats'] });
      toast({
        title: lock ? 'Locked as Coming Soon' : 'Unlocked',
        description: lock
          ? 'This integration is now greyed out across the site.'
          : 'This integration can now be opened and configured.',
      });
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));
  const allItems = settingsGroups
    .flatMap(g => g.items)
    .filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id));

  // Build a status lookup from the backend integration stats
  const integrationStatusById = useMemo(() => {
    const m = {};
    for (const i of (integrations || [])) m[i.id] = i;
    return m;
  }, [integrations]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(i =>
      i.label?.toLowerCase().includes(q) ||
      i.desc?.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  const integrationItems = filtered.filter(i => INTEGRATION_IDS.has(i.id));
  const planningItems = filtered.filter(i => PLANNING_IDS.has(i.id));
  const systemItems = filtered.filter(i => !INTEGRATION_IDS.has(i.id) && !PLANNING_IDS.has(i.id));

  const statsTiles = [
    { icon: CheckCircle2, label: 'Active', value: activeCount, tone: 'emerald' },
    { icon: Link2Off, label: 'Not configured', value: notConfiguredCount, tone: 'slate' },
    { icon: Clock, label: 'Coming soon', value: comingSoonCount, tone: 'amber' },
    { icon: Webhook, label: 'Integrations', value: integrations.length, tone: 'blue' },
  ];

  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
    blue: 'bg-blue-50 text-blue-600',
  };

  const renderStatusBadge = (item) => {
    const isCs = !!comingSoonMap[item.id] && integrationStatusById[item.id]?.status !== 'active';
    if (isCs) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
          <Lock className="w-2.5 h-2.5" /> Coming Soon
        </span>
      );
    }
    const st = integrationStatusById[item.id]?.status;
    if (st === 'active') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
          <Link2 className="w-2.5 h-2.5" /> Active
        </span>
      );
    }
    if (INTEGRATION_IDS.has(item.id)) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
          <Link2Off className="w-2.5 h-2.5" /> Not configured
        </span>
      );
    }
    return null;
  };

  const renderItem = (item) => {
    const Icon = item.icon;
    const isActive = integrationStatusById[item.id]?.status === 'active';
    const isCs = !!comingSoonMap[item.id] && !isActive;
    const isExternal = !!item.external;
    const isIntegration = INTEGRATION_IDS.has(item.id);
    const isBusy = busyId === item.id;

    // In manage mode, integration items show lock/unlock buttons instead of
    // navigation. Active integrations cannot be locked.
    if (manageMode && isIntegration) {
      return (
        <div
          key={item.id}
          className={`insight-card rounded-xl p-3.5 flex items-center gap-3 transition ${
            isCs ? 'bg-amber-50/60 border-amber-200' : ''
          } ${isActive ? 'opacity-60' : ''}`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isCs ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Icon className={`w-4 h-4 ${isCs ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${isCs ? 'text-slate-500' : 'text-slate-800'}`}>
              {item.label}
            </p>
            {isActive ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                <Link2 className="w-2.5 h-2.5" /> Active — cannot lock
              </span>
            ) : isCs ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                <Lock className="w-2.5 h-2.5" /> Coming Soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                <Link2Off className="w-2.5 h-2.5" /> Not configured
              </span>
            )}
          </div>
          <div className="flex-shrink-0">
            {isActive ? (
              <span className="text-[10px] font-bold text-emerald-600 px-3">Live</span>
            ) : isCs ? (
              <button
                onClick={() => setComingSoon(item.id, false)}
                disabled={busyId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-50 active:scale-95"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                Unlock
              </button>
            ) : (
              <button
                onClick={() => setComingSoon(item.id, true)}
                disabled={busyId === item.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50 active:scale-95"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Lock
              </button>
            )}
          </div>
        </div>
      );
    }

    const handleClick = () => {
      if (isExternal) {
        navigate(item.external);
      } else {
        onNavigate?.(item.id);
      }
    };
    return (
      <button
        key={item.id}
        onClick={handleClick}
        disabled={isCs}
        className={`insight-card rounded-xl p-3.5 flex items-center gap-3 text-left transition hover:shadow-md ${
          isCs ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCs ? 'bg-slate-100' : 'bg-[#2E5A1A]/10'
        }`}>
          <Icon className={`w-4 h-4 ${isCs ? 'text-slate-400' : 'text-[#2E5A1A]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isCs ? 'text-slate-400' : 'text-slate-800'}`}>
            {item.label}
          </p>
          {renderStatusBadge(item)}
        </div>
        {isExternal
          ? <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
      </button>
    );
  };

  const renderSection = (title, sectionItems) => {
    if (sectionItems.length === 0) return null;
    return (
      <div>
        <p className="px-1 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sectionItems.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Full control of your site — manage everything from one place."
        actions={
          <button
            onClick={() => { setManageMode(m => !m); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
              manageMode
                ? 'bg-[#2E5A1A] text-white hover:bg-[#244715]'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-[#2E5A1A] hover:text-[#2E5A1A]'
            }`}
          >
            {manageMode ? <><Sparkles className="w-4 h-4" /> Done</> : <><Clock className="w-4 h-4" /> Manage Coming Soon</>}
          </button>
        }
      />

      {/* Single stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsTiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="insight-card rounded-2xl p-4 flex items-center gap-3">
              <div className={'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ' + toneClasses[t.tone]}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{t.value}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate">{t.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage mode banner */}
      {manageMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Manage Coming Soon</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Click <strong>Lock</strong> to grey out an integration across the site — it cannot be opened until you click <strong>Unlock</strong>. Active integrations cannot be locked.
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings..."
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Two sections */}
      {query.trim() && filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500">No settings found for "{query}"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection('Integrations', integrationItems)}
          {renderSection('Planning & Briefing', planningItems)}
          {renderSection('System Configuration', systemItems)}
        </div>
      )}
    </div>
  );
}