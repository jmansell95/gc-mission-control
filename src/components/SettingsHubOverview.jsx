import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, Mail, Palette, Zap, ListChecks, ShieldCheck, ChevronRight, BookOpen,
  Search, Lock, Database, Webhook, Layers, FileSpreadsheet, Briefcase,
  Satellite, Radio, Landmark, ShieldAlert, Cloud, MapPin, MessageCircle, CreditCard,
  Gift, FileUp, CalendarDays, ClipboardCheck, Receipt, Settings as SettingsIcon,
  CheckCircle2, Clock, FileBarChart, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import IntegrationsOverviewList from '@/components/settings/IntegrationsOverviewList';

/**
 * Settings Command Hub — redesigned overview with accurate active vs
 * coming-soon counters. Every group header shows its own active/coming-soon
 * count, and the top banner shows the grand total. Email Templates (now the
 * Email Builder) and the new Report Builder live in System Configuration.
 * Planner Import has been removed entirely.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const [search, setSearch] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrationList = stats?.integrations || [];
  const integrationConnectedCount = stats?.integrationConnectedCount || 0;
  const activeStaff = stats?.activeStaff || 0;
  const activeJobs = stats?.activeJobs || 0;
  const planningJobs = stats?.planningJobs || 0;

  // Build the coming-soon map from stats
  const comingSoonMap = (stats?.integrationComingSoon) || {};

  // All settings items with their group, for counting
  const groups = useMemo(() => [
    { group: 'Ground Investigation', items: [
      { id: 'ags-import', icon: FileUp, label: 'KeyLogBook', sub: 'AGS & borehole data sync — webhook, manual upload & pull sync', isIntegration: true, intId: 'ags-import' },
      { id: 'openground-sync', icon: Database, label: 'OpenGround', sub: 'Push approved borehole logs to Bentley OpenGround', isIntegration: true, intId: 'openground-sync' },
    ]},
    { group: 'Integrations', items: [
      { id: 'geotab-sync', icon: Satellite, label: 'Geotab GPS', sub: 'Live vehicle locations + specs via Geotab API', isIntegration: true, intId: 'geotab-sync' },
      { id: 'holman-sync', icon: Radio, label: 'Holman Fleet', sub: 'MOT, service dates & mileage from Holman', isIntegration: true, intId: 'holman-sync' },
      { id: 'asset-panda', icon: Database, label: 'Asset Panda', sub: 'Live stock levels & asset matching', isIntegration: true, intId: 'asset-panda' },
      { id: 'bob-hr', icon: Users, label: 'Bob HR (Hibob)', sub: 'Bidirectional time-off sync with Bob HR', isIntegration: true, intId: 'bob-hr' },
      { id: 'concur-sync', icon: Landmark, label: 'SAP Concur', sub: 'Push approved expenses & pull GL codes', isIntegration: true, intId: 'concur-sync' },
      { id: 'safety-culture', icon: ShieldAlert, label: 'Mitti', sub: 'Sync site safety audits from Mitti', isIntegration: true, intId: 'safety-culture' },
      { id: 'cis-verification', icon: ShieldCheck, label: 'HMRC CIS', sub: 'Verify subcontractors against HMRC CIS', isIntegration: true, intId: 'cis-verification' },
      { id: 'payroll-export', icon: FileSpreadsheet, label: 'Payroll Export', sub: 'Export timesheets to Sage / Xero / CSV', isIntegration: true, intId: 'payroll-export' },
      { id: 'met-office', icon: Cloud, label: 'Open-Meteo Weather', sub: 'Daily weather forecasts for active sites', isIntegration: true, intId: 'met-office' },
      { id: 'google-maps', icon: MapPin, label: 'Google Maps', sub: 'Geocoding + travel route optimisation', isIntegration: true, intId: 'google-maps' },
      { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Business', sub: 'Push critical alerts to crew via WhatsApp', isIntegration: true, intId: 'whatsapp' },
      { id: 'accounting-sync', icon: FileSpreadsheet, label: 'Xero / Sage', sub: 'Push invoices & costs to accounting', isIntegration: true, intId: 'accounting-sync' },
      { id: 'payment-gateway', icon: CreditCard, label: 'Stripe Payments', sub: 'Accept client invoice payments via Stripe', isIntegration: true, intId: 'payment-gateway' },
      { id: 'microsoft-365', icon: CalendarDays, label: 'Microsoft 365', sub: 'SSO for Outlook, SharePoint, Teams, OneDrive', isIntegration: true, intId: 'microsoft-365' },
      { id: 'zapier-webhooks', icon: Webhook, label: 'Zapier / Make', sub: 'Outbound webhooks for no-code automation', isIntegration: true, intId: 'zapier-webhooks' },
    ]},
    { group: 'System Configuration', items: [
      { id: 'daily-checklists', icon: ClipboardCheck, label: 'Daily Checklists', sub: 'Pre-work checklist per crew type — vehicle, plant, PPE' },
      { id: 'dropdowns', icon: ListChecks, label: 'Dropdown Manager', sub: 'Edit every dropdown' },
      { id: 'global-branding', icon: Palette, label: 'Global Branding', sub: 'Email colours & banners' },
      { id: 'login-branding', icon: Lock, label: 'Login Page Customiser', sub: 'Login & reset screen branding' },
      { id: 'portal-branding', icon: Palette, label: 'Portal Branding Editor', sub: 'Client & subcontractor portal' },
      { id: 'email-templates', icon: Mail, label: 'Email Builder', sub: 'Modern branded email template builder with live preview' },
      { id: 'report-templates', icon: FileBarChart, label: 'Report Builder', sub: 'Modern report template builder — mirrors the Email Builder' },
      { id: 'email-alerts', icon: Mail, label: 'Email Alerts', sub: 'Templates & timing' },
      { id: 'automations', icon: Zap, label: 'Automations', sub: 'Background automations & alerts' },
      { id: 'incremental-import', icon: Layers, label: 'Incremental Import', sub: 'Non-destructive smart imports' },
      { id: 'system-guide', icon: BookOpen, label: 'System Logic Guide', sub: 'Every stat & rule explained' },
      { id: 'rewards', icon: Gift, label: 'Rewards Manager', sub: 'Gift cards, points catalogue & redemptions' },
      { id: 'expense-defaults', icon: Receipt, label: 'Expense Defaults', sub: 'Default amounts & VAT rates per expense category' },
    ]},
  ], []);

  // Count active vs coming-soon across ALL items
  const totalCounts = useMemo(() => {
    let active = 0, comingSoon = 0, connected = 0;
    for (const g of groups) {
      for (const item of g.items) {
        if (item.isIntegration) {
          const intItem = integrationList.find(i => i.id === item.intId);
          const isConnected = !!intItem?.connected;
          if (isConnected) { connected++; active++; }
          else if (comingSoonMap[item.intId]) comingSoon++;
          else active++;
        } else {
          active++;
        }
      }
    }
    return { active, comingSoon, connected, total: active + comingSoon };
  }, [groups, integrationList, comingSoonMap]);

  const q = search.toLowerCase().trim();
  const filteredGroups = q
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups;

  // Connected integrations are never "coming soon" — enforced here as a
  // frontend safety net (the backend auto-cleans this too).
  const integrationStatusMap = {};
  integrationList.forEach(i => {
    integrationStatusMap[i.id] = { connected: !!i.connected, comingSoon: !!comingSoonMap[i.id] && !i.connected };
  });

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Full control of your site — manage everything from one place."
        stats={[
          { icon: CheckCircle2, label: 'Active', value: totalCounts.active },
          { icon: Clock, label: 'Coming Soon', value: totalCounts.comingSoon },
          { icon: Webhook, label: 'Connected', value: `${integrationConnectedCount}/${integrationList.length}` },
          { icon: Briefcase, label: 'Active Jobs', value: activeJobs },
        ]}
      />

      {/* Active vs Coming Soon summary banner */}
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{totalCounts.active}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Active features</p>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{totalCounts.comingSoon}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Coming soon</p>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{integrationConnectedCount}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Integrations connected</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">{Math.round((totalCounts.active / Math.max(totalCounts.total, 1)) * 100)}% live</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search settings..."
          className="w-full h-14 pl-12 pr-16 sm:pr-20 bg-white border border-slate-200 rounded-2xl text-base font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 shadow-sm transition" />
      </div>

      {q && filteredGroups.length === 0 && (
        <div className="insight-card rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">No settings match "{search}"</p>
        </div>
      )}

      {/* Group sections */}
      {filteredGroups.map(group => {
        // Per-group active/coming-soon counts (connected = active, never coming-soon)
        const gComingSoon = group.items.filter(i => {
          if (!i.isIntegration) return false;
          const intItem = integrationList.find(int => int.id === i.intId);
          return !intItem?.connected && comingSoonMap[i.intId];
        }).length;
        const gActive = group.items.length - gComingSoon;

        if (group.group === 'Integrations') {
          return (
            <section key={group.group}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.group}</h2>
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <span className="text-emerald-600">{gActive} active</span>
                  {gComingSoon > 0 && <span className="text-amber-600">· {gComingSoon} soon</span>}
                </div>
              </div>
              <IntegrationsOverviewList
                items={group.items}
                statusMap={integrationStatusMap}
                onNavigate={onNavigate}
              />
              {/* Coming Soon Manager link */}
              <div className="mt-2 px-1">
                <button onClick={() => onNavigate('coming-soon-manager')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition">
                  <Clock className="w-3.5 h-3.5" />
                  Manage Coming Soon flags
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </section>
          );
        }
        return (
          <section key={group.group}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.group}</h2>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className="text-emerald-600">{gActive} active</span>
                {gComingSoon > 0 && <span className="text-amber-600">· {gComingSoon} soon</span>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const isLast = idx === group.items.length - 1;
                const isConnected = item.isIntegration && integrationStatusMap[item.intId]?.connected;
                const isComingSoon = item.isIntegration && !isConnected && comingSoonMap[item.intId];
                return (
                  <button key={item.id} onClick={() => onNavigate(item.id)}
                    className={'w-full flex items-center gap-3 px-4 py-3.5 text-left transition group ' +
                      (isLast ? '' : 'border-b border-slate-100 ') +
                      (isComingSoon ? 'bg-slate-50/60 ' : 'hover:bg-slate-50')}>
                    <Icon className={'w-5 h-5 flex-shrink-0 ' + (isConnected ? 'text-emerald-500' : isComingSoon ? 'text-slate-300' : 'text-slate-400 group-hover:text-[#2E5A1A] transition')} />
                    <div className="min-w-0 flex-1">
                      <p className={'text-sm font-semibold truncate ' + (isComingSoon ? 'text-slate-400' : 'text-slate-800')}>{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                    </div>
                    {isConnected && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Connected</span>}
                    {isComingSoon && <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex-shrink-0">Coming Soon</span>}
                    {!isComingSoon && !isConnected && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-bold flex-shrink-0"><Sparkles className="w-3 h-3" />Active</span>}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}