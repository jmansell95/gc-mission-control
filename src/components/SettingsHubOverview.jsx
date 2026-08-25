import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, Briefcase, Truck, Building2, Receipt, Package, HardHat, Boxes, Mail,
  Palette, Zap, Timer, Banknote, ListChecks, ShieldCheck, FileText,
  Scale, ArrowRight, Activity, BookOpen,
  Sparkles, QrCode, ArrowUpDown, TrendingUp, FileSpreadsheet, ScrollText,
  History, Gauge, Link2, Search, ChevronRight, GitBranch, Lock, AlertTriangle,
  Database, Webhook, Bell, Settings2, Coins, Wrench, FileUp, Layers,
  Satellite, Radio, Landmark, ShieldAlert, Cloud, MapPin, MessageCircle, CreditCard,
  Gift,
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

// All settings items are active — no "Coming Soon" grey-outs.

/**
 * Settings Command Hub — bold, in-your-face overview of everything configurable.
 * Big hero, prominent alerts, large visual cards grouped by domain.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const [search, setSearch] = useState('');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: rateItems = [] } = useQuery({ queryKey: ['rate-card-items'], queryFn: () => base44.entities.RateCardItem.list('-created_date', 500) });
  const { data: costPresets = [] } = useQuery({ queryKey: ['cost-presets-hub'], queryFn: () => base44.entities.CostPreset.list('-created_date', 500) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: billingRules = [] } = useQuery({ queryKey: ['billing-rules'], queryFn: () => base44.entities.BillingRule.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-hub'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500) });
  const { data: invLogs = [] } = useQuery({ queryKey: ['inv-logs-hub'], queryFn: () => base44.entities.InvestigationLog.list('-created_date', 200) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-hub'], queryFn: () => base44.entities.Timesheet.list('-created_date', 200) });
  const { data: allSettings = [] } = useQuery({
    queryKey: ['all-integration-configs'],
    queryFn: () => base44.entities.AppSetting.filter({ key: { $in: INTEGRATION_SETTING_KEYS } }, '-created_date', 50),
  });

  const ourRateItems = rateItems.filter(r => r.rate_card_source !== 'supplier').length;
  const pendingReviewLogs = invLogs.filter(l => l.manager_review_status === 'pending').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;
  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
  const planningJobs = jobs.filter(j => (j.status || 'planning') === 'planning').length;

  const integrationConnectedCount = useMemo(() => {
    const cfgMap = {};
    for (const s of allSettings) cfgMap[s.key] = s.value || {};
    return INTEGRATION_SETTING_KEYS.filter(k => {
      const field = INTEGRATION_CONNECTED_FIELDS[k];
      return cfgMap[k] && cfgMap[k][field];
    }).length;
  }, [allSettings]);

  const groups = [
    { group: 'System Configuration', icon: Sparkles, accent: 'from-slate-500 to-slate-700', items: [
      { id: 'dropdowns', icon: ListChecks, label: 'Dropdown Manager', value: '—', sub: 'Edit every dropdown', color: 'violet' },
      { id: 'global-branding', icon: Palette, label: 'Global Branding', value: '—', sub: 'Email colours & banners', color: 'violet' },
      { id: 'login-branding', icon: Lock, label: 'Login Page Customiser', value: '—', sub: 'Login & reset screen branding', color: 'blue' },
      { id: 'portal-branding', icon: Palette, label: 'Portal Branding Editor', value: '—', sub: 'Client & subcontractor portal', color: 'violet' },
      { id: 'email-templates', icon: Mail, label: 'Email Templates', value: '—', sub: 'Branded email templates', color: 'blue' },
      { id: 'email-alerts', icon: Mail, label: 'Email Alerts', value: '—', sub: 'Templates & timing', color: 'blue' },
      { id: 'automations', icon: Zap, label: 'Automations', value: '—', sub: 'Background automations & alerts', color: 'amber' },
      { id: 'planner-import', icon: FileSpreadsheet, label: 'Planner Import', value: '—', sub: 'Upload weekly rota spreadsheet', color: 'blue' },
      { id: 'incremental-import', icon: Layers, label: 'Incremental Import', value: '—', sub: 'Non-destructive smart imports', color: 'violet' },
      { id: 'system-guide', icon: BookOpen, label: 'System Logic Guide', value: 'PDF', sub: 'Every stat & rule explained', color: 'emerald' },
      { id: 'rewards', icon: Gift, label: 'Rewards Manager', value: '—', sub: 'Gift cards, points catalogue & redemptions', color: 'amber' },
    ]},
    { group: 'Geotechnical', icon: FileUp, accent: 'from-amber-500 to-orange-600', items: [
      { id: 'ags-import', icon: FileUp, label: 'KeyLogBook', value: '—', sub: 'AGS & borehole data sync', color: 'amber' },
      { id: 'openground-sync', icon: Database, label: 'OpenGround', value: '—', sub: 'Push logs to Bentley OpenGround', color: 'blue' },
    ]},
  ];

  const accent = {
    emerald: { stripe: 'from-emerald-400 to-emerald-600', tile: 'bg-gradient-to-br from-emerald-400 to-emerald-600', glow: 'shadow-emerald-200' },
    blue: { stripe: 'from-blue-400 to-blue-600', tile: 'bg-gradient-to-br from-blue-400 to-blue-600', glow: 'shadow-blue-200' },
    amber: { stripe: 'from-amber-400 to-orange-500', tile: 'bg-gradient-to-br from-amber-400 to-orange-500', glow: 'shadow-amber-200' },
    rose: { stripe: 'from-rose-400 to-pink-600', tile: 'bg-gradient-to-br from-rose-400 to-pink-600', glow: 'shadow-rose-200' },
    slate: { stripe: 'from-slate-400 to-slate-600', tile: 'bg-gradient-to-br from-slate-400 to-slate-600', glow: 'shadow-slate-200' },
    violet: { stripe: 'from-violet-400 to-purple-600', tile: 'bg-gradient-to-br from-violet-400 to-purple-600', glow: 'shadow-violet-200' },
    cyan: { stripe: 'from-cyan-400 to-sky-600', tile: 'bg-gradient-to-br from-cyan-400 to-sky-600', glow: 'shadow-cyan-200' },
    indigo: { stripe: 'from-indigo-400 to-blue-600', tile: 'bg-gradient-to-br from-indigo-400 to-blue-600', glow: 'shadow-indigo-200' },
  };

  // Needs-attention alerts — only for items that remain in Settings.
  // Operational alerts (log-qc, timesheets, compliance) are now on their
  // own dedicated pages and surfaced by the dashboard's Exception Monitor.
  const alerts = [];

  const heroStats = [
    { label: 'Crew', value: activeStaff, icon: Users, gradient: 'from-emerald-400 to-teal-500' },
    { label: 'Active Jobs', value: activeJobs, icon: Briefcase, gradient: 'from-blue-400 to-cyan-500' },
    { label: 'Planning', value: planningJobs, icon: Activity, gradient: 'from-amber-400 to-orange-500' },
    { label: 'Vehicles', value: vehicles.length, icon: Truck, gradient: 'from-violet-400 to-purple-500' },
    { label: 'Clients', value: clients.length, icon: Building2, gradient: 'from-indigo-400 to-blue-500' },
  ];

  const q = search.toLowerCase().trim();
  const filteredGroups = q
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups;

  return (
    <div className="space-y-5">
      {/* ── Hero — big, bold, in-your-face ── */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
        <div className="relative z-10 px-5 py-5 md:px-7 md:py-6 pl-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Settings Command Hub</h2>
              <p className="text-slate-500 text-sm font-medium">Full control of your site — manage everything from one place.</p>
            </div>
          </div>
          {/* Big stat tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {heroStats.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-slate-50 rounded-2xl px-3 py-3 border border-slate-100 hover:bg-slate-100 transition">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-1.5 shadow-sm`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5 tabular-nums">{s.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Search — prominent ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search settings..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 shadow-md"
        />
      </div>

      {/* ── Enterprise Settings redirect — Divisions, Integrations, Backup & Restore
           are now managed centrally from the Enterprise Dashboard ── */}
      {!q && (
        <div className="insight-card relative rounded-3xl p-5 overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-extrabold text-slate-900">Enterprise-Level Settings</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Business Streams, Integrations, Backup &amp; Restore, and Access Levels are now managed centrally from
                the <span className="font-semibold text-[#2E5A1A]">Enterprise Dashboard → Settings</span>.
                This ensures every business stream shares the same configuration.
              </p>
              <a
                href="/enterprise/settings"
                className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-2 rounded-xl command-gradient text-white text-xs font-bold shadow-md hover:shadow-lg transition"
              >
                Go to Enterprise Settings
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Needs Attention — big, bold, colorful ── */}
      {!q && alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">Needs Attention</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(a => {
              const Icon = a.icon;
              return (
                <button key={a.id} onClick={() => onNavigate(a.id)}
                  className={`text-left rounded-2xl p-4 transition flex items-center gap-4 group bg-gradient-to-br ${a.bg} text-white shadow-lg hover:shadow-xl hover:scale-[1.02]`}>
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-bold flex-1">{a.label}</p>
                  <ArrowRight className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {q && filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No settings match "{search}"</p>
        </div>
      )}

      {/* ── Grouped cards — big, bold, colorful ── */}
      {filteredGroups.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.group}>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${group.accent} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <GroupIcon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-wide">{group.group}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(item => {
                const Icon = item.icon;
                const a = accent[item.color] || accent.slate;
                return (
                  <button key={item.id} onClick={() => onNavigate(item.id)} className="insight-card relative rounded-2xl p-4 text-left group overflow-hidden">
                    <span className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${a.stripe}`}></span>
                    <div className="flex items-center gap-3 pl-2">
                      <div className={`w-12 h-12 rounded-xl ${a.tile} flex items-center justify-center flex-shrink-0 shadow-lg ${a.glow}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{item.label}</p>
                        <p className="text-xs text-slate-500 truncate">{item.sub}</p>
                      </div>
                      {item.value !== '—' && (
                        <span className="text-2xl font-extrabold text-slate-800 tabular-nums">{item.value}</span>
                      )}
                      <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}