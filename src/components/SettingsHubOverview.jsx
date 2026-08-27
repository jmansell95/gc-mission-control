import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, Mail, Palette, Zap, ListChecks, ShieldCheck, ChevronRight, BookOpen,
  Search, Lock, Database, Webhook, Layers, FileSpreadsheet,
  Satellite, Radio, Landmark, ShieldAlert, Cloud, MapPin, MessageCircle, CreditCard,
  Gift, KeyRound, FileUp, CalendarDays,
} from 'lucide-react';

const INTEGRATION_SETTING_KEYS = [
  'geotab_config', 'holman_config', 'asset_panda_config', 'bob_hr_config',
  'concur_config', 'safety_culture_config', 'keylogbook_config', 'cis_config',
  'payroll_config', 'met_office_config', 'google_maps_config', 'whatsapp_config',
  'accounting_config', 'stripe_config',
];
const INTEGRATION_CONNECTED_FIELDS = {
  geotab_config: 'username', holman_config: 'api_key', asset_panda_config: 'token',
  bob_hr_config: 'username', concur_config: 'client_id', safety_culture_config: 'api_token',
  keylogbook_config: 'webhook_secret', cis_config: 'api_key', payroll_config: 'provider',
  met_office_config: 'api_key', google_maps_config: 'api_key', whatsapp_config: 'api_token',
  accounting_config: 'provider', stripe_config: 'secret_key',
};
const INTEGRATION_META = {
  geotab_config: { id: 'geotab-sync', label: 'Geotab' },
  holman_config: { id: 'holman-sync', label: 'Holman' },
  asset_panda_config: { id: 'asset-panda', label: 'Asset Panda' },
  bob_hr_config: { id: 'bob-hr', label: 'Bob HR' },
  concur_config: { id: 'concur-sync', label: 'Concur' },
  safety_culture_config: { id: 'safety-culture', label: 'SafetyCulture' },
  keylogbook_config: { id: 'ags-import', label: 'KeyLogBook' },
  cis_config: { id: 'cis-verification', label: 'CIS' },
  payroll_config: { id: 'payroll-export', label: 'Payroll' },
  met_office_config: { id: 'met-office', label: 'Met Office' },
  google_maps_config: { id: 'google-maps', label: 'Google Maps' },
  whatsapp_config: { id: 'whatsapp', label: 'WhatsApp' },
  accounting_config: { id: 'accounting-sync', label: 'Accounting' },
  stripe_config: { id: 'payment-gateway', label: 'Payments' },
};

/**
 * Settings Command Hub — Clean Canvas overview.
 * Ultra-light, borderless, typography-led, centered single column with an
 * oversized search hero, a flat metric row, a slim status strip, and flat
 * hover-highlighted list rows grouped by category.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const [search, setSearch] = useState('');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: rateItems = [] } = useQuery({ queryKey: ['rate-card-items'], queryFn: () => base44.entities.RateCardItem.list('-created_date', 500) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: billingRules = [] } = useQuery({ queryKey: ['billing-rules'], queryFn: () => base44.entities.BillingRule.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-hub'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500) });
  const { data: permissionGroups = [] } = useQuery({ queryKey: ['permission-groups'], queryFn: () => base44.entities.PermissionGroup.list('-created_date', 200) });
  const { data: allSettings = [] } = useQuery({
    queryKey: ['all-integration-configs'],
    queryFn: () => base44.entities.AppSetting.filter({ key: { $in: INTEGRATION_SETTING_KEYS } }, '-created_date', 50),
  });

  const cfgMap = useMemo(() => {
    const m = {};
    for (const s of allSettings) m[s.key] = s.value || {};
    return m;
  }, [allSettings]);

  const integrationList = useMemo(() => INTEGRATION_SETTING_KEYS.map(k => {
    const meta = INTEGRATION_META[k];
    const field = INTEGRATION_CONNECTED_FIELDS[k];
    return { id: meta.id, label: meta.label, connected: !!(cfgMap[k] && cfgMap[k][field]) };
  }), [cfgMap]);

  const integrationConnectedCount = integrationList.filter(i => i.connected).length;

  const activeStaff = staff.filter(s => s.is_active !== false).length;
  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
  const planningJobs = jobs.filter(j => (j.status || 'planning') === 'planning').length;

  const checks = [
    { id: 'staff', label: 'Add staff & crews', done: staff.length > 0 },
    { id: 'teams', label: 'Configure crew types', done: teams.length > 0 },
    { id: 'access-levels', label: 'Set up access groups', done: permissionGroups.length > 0 },
    { id: 'clients', label: 'Add clients', done: clients.length > 0 },
    { id: 'vehicles', label: 'Add vehicles', done: vehicles.length > 0 },
    { id: 'rate-card', label: 'Upload price list', done: rateItems.length > 0 },
    { id: 'billing', label: 'Configure billing rules', done: billingRules.length > 0 },
    { id: 'compliance', label: 'Track compliance items', done: complianceItems.length > 0 },
    { id: 'integrations', label: 'Connect integrations', done: integrationConnectedCount > 0 },
  ];
  const doneCount = checks.filter(c => c.done).length;

  const groups = [
    { group: 'Security & Access', items: [
      { id: 'access-levels', icon: KeyRound, label: 'Access Levels', value: permissionGroups.length, sub: 'Permission groups & lockdowns per stream' },
    ]},
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
    ]},
  ];

  const heroStats = [
    { label: 'Crew', value: activeStaff },
    { label: 'Active Jobs', value: activeJobs },
    { label: 'Planning', value: planningJobs },
    { label: 'Vehicles', value: vehicles.length },
    { label: 'Clients', value: clients.length },
  ];

  const q = search.toLowerCase().trim();
  const filteredGroups = q
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups;

  return (
    <div className="min-h-full bg-[#FAFAF9]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: "'Inter Tight', Inter, sans-serif" }}>
            Settings
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Full control of your site — manage everything from one place.</p>
        </div>

        {/* Search hero */}
        <div className="relative mb-8">
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

        {/* Metric row */}
        <div className="grid grid-cols-5 gap-2 sm:gap-4 mb-8 pb-8 border-b border-slate-200/70">
          {heroStats.map(s => (
            <div key={s.label} className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums leading-none">{s.value}</p>
              <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Slim status strip */}
        {!q && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-10 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{doneCount}/{checks.length}</span>
              <span>setup complete</span>
            </span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${integrationConnectedCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="font-semibold text-slate-700">{integrationConnectedCount}/{integrationList.length}</span>
              <span>integrations connected</span>
            </span>
          </div>
        )}

        {/* No results */}
        {q && filteredGroups.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-400">No settings match "{search}"</p>
          </div>
        )}

        {/* Category sections as flat lists */}
        {filteredGroups.map(group => (
          <section key={group.group} className="mb-10">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{group.group}</h2>
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
        ))}
      </div>
    </div>
  );
}