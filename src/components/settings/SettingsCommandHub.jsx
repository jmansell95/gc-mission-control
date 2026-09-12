import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon, CheckCircle2, EyeOff, Search, X,
  ChevronRight, ExternalLink, Link2, Link2Off, Eye, Loader2, SlidersHorizontal,
  Settings2, Database, FileText,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';
import { useToast } from '@/components/ui/use-toast';

const INTEGRATION_IDS = new Set([
  'geotab-sync', 'holman-sync', 'asset-panda', 'bob-hr', 'concur-sync',
  'safety-culture', 'cis-verification', 'payroll-export',
  'met-office', 'google-maps', 'whatsapp', 'accounting-sync', 'payment-gateway',
  'microsoft-365', 'zapier-webhooks', 'ags-import', 'openground-sync',
]);

// Category metadata (icon + description) keyed by settingsGroups label.
// The item membership is derived dynamically from settingsGroups so new items
// added to SettingsNav automatically appear here without manual edits.
const CATEGORY_META = {
  'Autopilot': { icon: Settings2, description: 'Autonomous agents & automations', sortKey: 3 },
  'Ground Investigation': { icon: Link2, description: 'KeyLogBook & OpenGround sync', sortKey: 1 },
  'Integrations': { icon: Link2, description: 'Connect external services to this business stream', sortKey: 0 },
  'Data & Migration': { icon: Database, description: 'Power Apps & Azure migration tools, build hub & roadmap', sortKey: 6 },
  'Planning & Briefing': { icon: FileText, description: 'Team briefing pack & presentation tools', sortKey: 7 },
  'System Configuration': { icon: Settings2, description: 'Access, branding, checklists, dropdowns & more', sortKey: 4 },
};

// Fallback category for items whose settingsGroups label isn't in CATEGORY_META
const DEFAULT_CATEGORY = { icon: Settings2, description: 'General settings', sortKey: 5 };

// Build categories dynamically from settingsGroups, excluding migrated items
// and the 'hub' overview item (which is the command hub itself).
function buildCategories() {
  const groups = settingsGroups
    .filter(g => g.label !== '_hidden_migrated' && g.label !== 'Overview')
    .map(g => {
      const meta = CATEGORY_META[g.label] || DEFAULT_CATEGORY;
      const items = g.items.filter(i =>
        !HUB_MIGRATED_ITEMS.has(i.id) && i.id !== 'hub'
      );
      return {
        label: g.label,
        icon: meta.icon,
        description: meta.description,
        sortKey: meta.sortKey,
        items,
      };
    })
    .filter(g => g.items.length > 0)
    .sort((a, b) => (a.sortKey || 99) - (b.sortKey || 99));

  // Remap labels to the user-facing category names where they differ
  const labelMap = {
    'Ground Investigation': 'Integrations',
    'Integrations': 'Integrations',
    'Autopilot': 'Operations',
    'System Configuration': 'System Configuration',
    'Planning & Briefing': 'Data & Migration',
  };

  // Merge groups that map to the same display label (e.g. Ground Investigation
  // and Integrations both go under "Integrations")
  const merged = {};
  for (const g of groups) {
    const displayLabel = labelMap[g.label] || g.label;
    if (!merged[displayLabel]) {
      merged[displayLabel] = { ...g, label: displayLabel, items: [...g.items] };
    } else {
      merged[displayLabel].items.push(...g.items);
    }
  }

  return Object.values(merged).sort((a, b) => (a.sortKey || 99) - (b.sortKey || 99));
}

const SETTINGS_CATEGORIES = buildCategories();

export default function SettingsCommandHub({ onNavigate, items }) {
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
  const hiddenMap = stats?.integrationHidden || {};
  const configuredCount = integrations.filter(i => i.status === 'configured').length;
  const notConfiguredCount = integrations.filter(i => i.status === 'not_configured').length;
  const hiddenCount = Object.keys(hiddenMap).filter(k => INTEGRATION_IDS.has(k)).length;

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
      await qc.refetchQueries({ queryKey: ['settings-hub-stats'] });
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));

  const integrationStatusById = useMemo(() => {
    const m = {};
    for (const i of (integrations || [])) m[i.id] = i;
    return m;
  }, [integrations]);

  // Build categorized items — filter by access, migration, search, and hidden state
  const categories = useMemo(() => {
    const q = query.toLowerCase().trim();
    return SETTINGS_CATEGORIES.map(cat => {
      const catItems = cat.items
        .filter(i => i && itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id));

      const searched = q
        ? catItems.filter(i =>
            i.label?.toLowerCase().includes(q) ||
            i.desc?.toLowerCase().includes(q)
          )
        : catItems;

      const visible = manageMode
        ? searched
        : searched.filter(i => !(INTEGRATION_IDS.has(i.id) && hiddenMap[i.id]));

      return { ...cat, items: visible };
    });
  }, [items, query, hiddenMap, manageMode]);

  const totalVisible = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  const renderStatusBadge = (item) => {
    const isConfigured = integrationStatusById[item.id]?.status === 'configured';
    if (isConfigured) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
          <Link2 className="w-2.5 h-2.5" /> Configured
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
    const isConfigured = integrationStatusById[item.id]?.status === 'configured';
    const isHidden = !!hiddenMap[item.id];
    const isExternal = !!item.external;
    const isIntegration = INTEGRATION_IDS.has(item.id);
    const isBusy = busyId === item.id;

    if (manageMode && isIntegration) {
      return (
        <div
          key={item.id}
          className={`hub-glass rounded-xl p-3.5 flex items-center gap-3 transition ${
            isHidden ? 'bg-amber-50/60 border-amber-200' : ''
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isHidden ? 'bg-amber-100' : isConfigured ? 'bg-emerald-50' : 'bg-slate-100'
          }`}>
            <Icon className={`w-4 h-4 ${isHidden ? 'text-amber-500' : isConfigured ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${isHidden ? 'text-slate-500' : 'text-slate-800'}`}>{item.label}</p>
            {isConfigured ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                <Link2 className="w-2.5 h-2.5" /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                <Link2Off className="w-2.5 h-2.5" /> Not configured
              </span>
            )}
          </div>
          <div className="flex-shrink-0">
            {isHidden ? (
              <button
                onClick={() => setHidden(item.id, false)}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-50 active:scale-95"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Show
              </button>
            ) : (
              <button
                onClick={() => setHidden(item.id, true)}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50 active:scale-95"
              >
                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />} Hide
              </button>
            )}
          </div>
        </div>
      );
    }

    const handleClick = () => {
      if (isExternal) navigate(item.external);
      else onNavigate?.(item.id);
    };
    return (
      <button
        key={item.id}
        onClick={handleClick}
        className={`hub-glass rounded-xl p-3.5 flex items-center gap-3 text-left transition hover:shadow-md hover:-translate-y-0.5 ${
          isHidden ? 'opacity-50' : ''
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isConfigured ? 'bg-emerald-50' : 'bg-[#2E5A1A]/10'
        }`}>
          <Icon className={`w-4 h-4 ${isConfigured ? 'text-emerald-600' : 'text-[#2E5A1A]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-slate-800">{item.label}</p>
          {renderStatusBadge(item)}
        </div>
        {isExternal
          ? <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
      </button>
    );
  };

  const renderCategory = (cat) => {
    if (cat.items.length === 0) return null;
    const CatIcon = cat.icon;
    return (
      <div key={cat.label}>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
            <CatIcon className="w-3.5 h-3.5 text-[#2E5A1A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">{cat.label}</h3>
            <p className="text-[11px] text-slate-400 leading-tight">{cat.description}</p>
          </div>
          <span className="ml-auto text-[11px] font-bold text-slate-300">{cat.items.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {cat.items.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <HubShell
      hubKey="settings"
      icon={SettingsIcon}
      eyebrow="Settings"
      title="Settings Command Hub"
      subtitle="Full control of your site — every setting in one organised place."
      breadcrumbs={[{ label: 'Settings' }]}
      stats={[
        { icon: CheckCircle2, label: 'Configured', value: configuredCount, color: 'emerald' },
        { icon: Link2Off, label: 'Not configured', value: notConfiguredCount, color: 'slate' },
        { icon: EyeOff, label: 'Hidden', value: hiddenCount, color: 'amber' },
        { icon: SlidersHorizontal, label: 'Total', value: totalVisible, color: 'blue' },
      ]}
      help={{
        title: 'Settings Command Hub — how it works',
        topics: [
          { title: 'Command Hub', summary: 'At-a-glance overview of every settings area.', body: 'Search all settings, see which integrations are configured, and manage hidden integrations. Click any card to jump to that settings page.' },
          { title: 'Integrations', summary: 'Connect external services to this business stream.', body: 'Each integration (Geotab, Holman, Asset Panda, Mitti, etc.) connects per-division. Use Manage mode to hide integrations you don\u2019t use.' },
          { title: 'System Configuration', summary: 'Core platform settings and templates.', body: 'Configure daily checklists, dropdown options, email templates, branding, automations, and rewards. Each page has its own help guide.' },
        ],
      }}
      onboarding={{
        title: 'Welcome to the Settings Command Hub',
        description: 'One place to manage integrations, branding, automations, and system configuration for this business stream.',
        steps: ['Connect your integrations (Geotab, Mitti, etc.)', 'Configure branding and email templates', 'Set up automations and daily checklists', 'Manage dropdowns and system rules'],
      }}
      actions={
        <button
          onClick={() => setManageMode(m => !m)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
            manageMode
              ? 'bg-[#2E5A1A] text-white hover:bg-[#244715]'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#2E5A1A] hover:text-[#2E5A1A]'
          }`}
        >
          {manageMode ? <><SlidersHorizontal className="w-4 h-4" /> Done</> : <><SlidersHorizontal className="w-4 h-4" /> Manage</>}
        </button>
      }
    >
      {manageMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <EyeOff className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Manage hidden integrations</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Click <strong>Hide</strong> to remove an integration from the grid — it won't appear until you click <strong>Show</strong>. Configured integrations can still be hidden if you don't use them.
            </p>
          </div>
        </div>
      )}

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

      {query.trim() && totalVisible === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500">No settings found for "{query}"</p>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(renderCategory)}
        </div>
      )}
    </HubShell>
  );
}