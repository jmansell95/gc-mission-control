import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, Mail, Palette, Zap, ListChecks, ShieldCheck, ChevronRight, BookOpen,
  Search, Lock, Database, Webhook, Layers, FileSpreadsheet, Briefcase,
  Satellite, Radio, Landmark, ShieldAlert, Cloud, MapPin, MessageCircle, CreditCard,
  Gift, FileUp, CalendarDays, ClipboardCheck, Receipt, Settings as SettingsIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import IntegrationsOverviewList from '@/components/settings/IntegrationsOverviewList';

/**
 * Settings Command Hub — rebuilt onto the shared hub shell (PageHeader +
 * hub tokens) so Settings is visually identical to every other hub.
 * Keeps the search hero, grouped flat lists, and integration status.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const toggleComingSoon = useMutation({
    mutationFn: async ({ id, comingSoon }) => {
      const existing = await base44.entities.AppSetting.filter({ key: 'integration_coming_soon' });
      const map = (existing[0]?.value) || {};
      const next = { ...map };
      if (comingSoon) next[id] = true; else delete next[id];
      if (existing[0]) {
        await base44.entities.AppSetting.update(existing[0].id, { value: next });
      } else {
        await base44.entities.AppSetting.create({ key: 'integration_coming_soon', value: next });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-hub-stats'] }),
  });

  const integrationList = stats?.integrations || [];
  const integrationConnectedCount = stats?.integrationConnectedCount || 0;
  const activeStaff = stats?.activeStaff || 0;
  const activeJobs = stats?.activeJobs || 0;
  const planningJobs = stats?.planningJobs || 0;

  const groups = [
    { group: 'Ground Investigation', items: [
      { id: 'ags-import', icon: FileUp, label: 'KeyLogBook', value: '—', sub: 'AGS & borehole data sync — webhook, manual upload & pull sync' },
      { id: 'openground-sync', icon: Database, label: 'OpenGround', value: '—', sub: 'Push approved borehole logs to Bentley OpenGround' },
    ]},
    { group: 'Integrations', items: [
      { id: 'geotab-sync', icon: Satellite, label: 'Geotab GPS', value: '—', sub: 'Live vehicle locations + specs via Geotab API' },
      { id: 'holman-sync', icon: Radio, label: 'Holman Fleet', value: '—', sub: 'MOT, service dates & mileage from Holman' },
      { id: 'asset-panda', icon: Database, label: 'Asset Panda', value: '—', sub: 'Live stock levels & asset matching' },
      { id: 'bob-hr', icon: Users, label: 'Bob HR (Hibob)', value: '—', sub: 'Bidirectional time-off sync with Bob HR' },
      { id: 'concur-sync', icon: Landmark, label: 'SAP Concur', value: '—', sub: 'Push approved expenses & pull GL codes' },
      { id: 'safety-culture', icon: ShieldAlert, label: 'Mitti', value: '—', sub: 'Sync site safety audits from Mitti' },
      { id: 'cis-verification', icon: ShieldCheck, label: 'HMRC CIS', value: '—', sub: 'Verify subcontractors against HMRC CIS' },
      { id: 'payroll-export', icon: FileSpreadsheet, label: 'Payroll Export', value: '—', sub: 'Export timesheets to Sage / Xero / CSV' },
      { id: 'met-office', icon: Cloud, label: 'Open-Meteo Weather', value: '—', sub: 'Daily weather forecasts for active sites' },
      { id: 'google-maps', icon: MapPin, label: 'Google Maps', value: '—', sub: 'Geocoding + travel route optimisation' },
      { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp Business', value: '—', sub: 'Push critical alerts to crew via WhatsApp' },
      { id: 'accounting-sync', icon: FileSpreadsheet, label: 'Xero / Sage', value: '—', sub: 'Push invoices & costs to accounting' },
      { id: 'payment-gateway', icon: CreditCard, label: 'Stripe Payments', value: '—', sub: 'Accept client invoice payments via Stripe' },
      { id: 'microsoft-365', icon: CalendarDays, label: 'Microsoft 365', value: '—', sub: 'SSO for Outlook, SharePoint, Teams, OneDrive' },
      { id: 'zapier-webhooks', icon: Webhook, label: 'Zapier / Make', value: '—', sub: 'Outbound webhooks for no-code automation' },
    ]},
    { group: 'System Configuration', items: [
      { id: 'daily-checklists', icon: ClipboardCheck, label: 'Daily Checklists', value: '—', sub: 'Pre-work checklist per crew type — vehicle, plant, PPE' },
      { id: 'dropdowns', icon: ListChecks, label: 'Dropdown Manager', value: '—', sub: 'Edit every dropdown' },
      { id: 'global-branding', icon: Palette, label: 'Global Branding', value: '—', sub: 'Email colours & banners' },
      { id: 'login-branding', icon: Lock, label: 'Login Page Customiser', value: '—', sub: 'Login & reset screen branding' },
      { id: 'portal-branding', icon: Palette, label: 'Portal Branding Editor', value: '—', sub: 'Client & subcontractor portal' },
      { id: 'email-templates', icon: Mail, label: 'Email Templates', value: '—', sub: 'Branded email templates' },
      { id: 'email-alerts', icon: Mail, label: 'Email Alerts', value: '—', sub: 'Templates & timing' },
      { id: 'automations', icon: Zap, label: 'Automations', value: '—', sub: 'Background automations & alerts' },
      { id: 'planner-import', icon: FileSpreadsheet, label: 'Planner Import', value: '—', sub: 'Upload weekly rota spreadsheet' },
      { id: 'incremental-import', icon: Layers, label: 'Incremental Import', value: '—', sub: 'Non-destructive smart imports' },
      { id: 'system-guide', icon: BookOpen, label: 'System Logic Guide', value: 'PDF', sub: 'Every stat & rule explained' },
      { id: 'rewards', icon: Gift, label: 'Rewards Manager', value: '—', sub: 'Gift cards, points catalogue & redemptions' },
      { id: 'expense-defaults', icon: Receipt, label: 'Expense Defaults', value: '—', sub: 'Default amounts & VAT rates per expense category' },
    ]},
  ];

  const q = search.toLowerCase().trim();
  const filteredGroups = q
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups;

  const integrationStatusMap = {};
  (stats?.integrations || []).forEach(i => {
    integrationStatusMap[i.id] = {
      connected: !!i.connected,
      comingSoon: !!(stats?.integrationComingSoon || {})[i.id],
    };
  });

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Full control of your site — manage everything from one place."
        stats={[
          { icon: Webhook, label: 'Integrations', value: `${integrationConnectedCount}/${integrationList.length}` },
          { icon: Users, label: 'Active Staff', value: activeStaff },
          { icon: Briefcase, label: 'Active Jobs', value: activeJobs },
          { icon: Layers, label: 'In Planning', value: planningJobs },
        ]}
      />

      {/* Search hero */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search settings..."
          className="w-full h-14 pl-12 pr-16 sm:pr-20 bg-white border border-slate-200 rounded-2xl text-base font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 shadow-sm transition"
        />
        <kbd className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-400 pointer-events-none">
          ⌘K
        </kbd>
      </div>

      {/* No results */}
      {q && filteredGroups.length === 0 && (
        <div className="insight-card rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">No settings match "{search}"</p>
        </div>
      )}

      {/* Category sections as flat lists */}
      {filteredGroups.map(group => {
        if (group.group === 'Integrations') {
          return (
            <section key={group.group}>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{group.group}</h2>
              <IntegrationsOverviewList
                items={group.items}
                statusMap={integrationStatusMap}
                onToggle={(id, comingSoon) => toggleComingSoon.mutate({ id, comingSoon })}
                onNavigate={onNavigate}
              />
            </section>
          );
        }
        return (
          <section key={group.group}>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{group.group}</h2>
            <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const isLast = idx === group.items.length - 1;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={'w-full flex items-center gap-3 px-4 py-3.5 text-left transition group ' +
                      (isLast ? '' : 'border-b border-slate-100 ') +
                      'hover:bg-slate-50'}
                  >
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-[#2E5A1A] transition flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                    </div>
                    {item.value !== '—' && item.value !== undefined && (
                      <span className="text-sm font-bold text-slate-400 tabular-nums flex-shrink-0">{item.value}</span>
                    )}
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