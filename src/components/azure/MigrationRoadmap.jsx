import React from 'react';
import {
  TrendingUp, ShieldCheck, Server, Database, PoundSterling,
  AlertTriangle, CheckCircle2, Calendar, Target, Zap,
} from 'lucide-react';

const ROADMAP_WEEKS = 13;

const PHASES = [
  { id: 0, name: 'Prerequisites & Setup', start: 0, end: 1, color: '#64748b' },
  { id: 1, name: 'Export Source Code', start: 1, end: 2, color: '#3b82f6' },
  { id: 2, name: 'Provision Azure Infra', start: 2, end: 4, color: '#8b5cf6' },
  { id: 3, name: 'Data Layer (SQL + SDK)', start: 4, end: 7, color: '#2E5A1A' },
  { id: 4, name: 'Auth (Entra ID)', start: 6, end: 9, color: '#0891b2' },
  { id: 5, name: 'Functions & Automations', start: 8, end: 11, color: '#d97706' },
  { id: 6, name: 'Deploy & Cutover', start: 11, end: 12, color: '#dc2626' },
  { id: 'stab', name: 'Stabilization & Sign-off', start: 12, end: 13, color: '#059669' },
];

const MILESTONES = [
  { week: 2, label: 'Azure infra live', icon: Server },
  { week: 7, label: 'Data + Auth migrated', icon: Database },
  { week: 11, label: 'Functions deployed', icon: Zap },
  { week: 13, label: 'Go-live & sign-off', icon: CheckCircle2 },
];

const BENEFITS = [
  { icon: ShieldCheck, title: 'Full data sovereignty', desc: 'UK-region Azure SQL, Entra ID auth, Key Vault secrets — enterprise-owned and auditable.' },
  { icon: TrendingUp, title: 'No vendor lock-in', desc: 'Source code in your GitHub, deployable to any Azure subscription. You own everything.' },
  { icon: Server, title: 'Native Azure ecosystem', desc: 'Power BI, Logic Apps, Service Bus, Event Grid — first-class integration with your M365 estate.' },
  { icon: PoundSterling, title: 'Cost predictability', desc: '~£220–300/mo Azure consumption vs the current platform subscription. Scales with usage.' },
];

const RISKS = [
  { risk: 'Data migration accuracy', severity: 'Medium', mitigation: 'Record-count verification per entity; Base44 kept read-only as fallback during trial.' },
  { risk: 'RLS security parity', severity: 'High', mitigation: 'Security predicates tested per table; SESSION_CONTEXT set on every connection.' },
  { risk: '180+ functions to port', severity: 'Medium', mitigation: 'Batched by domain (billing, logistics, safety…); logic unchanged, only the runtime wrapper.' },
  { risk: 'Auth cutover disruption', severity: 'Medium', mitigation: 'Entra ID + Base44 run in parallel; DNS rollback is instant.' },
];

const COSTS = [
  { item: 'Azure SQL (S1 tier)', cost: '£60/mo' },
  { item: 'Functions (EP1 Premium)', cost: '£150/mo' },
  { item: 'Static Web Apps', cost: '£7/mo' },
  { item: 'Blob Storage', cost: '£5/mo' },
  { item: 'Key Vault + Entra ID', cost: 'Included with M365' },
  { item: 'Total running cost', cost: '~£220–300/mo', highlight: true },
  { item: 'Migration duration', cost: '13 weeks (3 months)' },
];

function StatTile({ icon: Icon, value, label, gradient }) {
  return (
    <div className={`rounded-2xl p-4 text-white ${gradient} shadow-lg`}>
      <Icon className="w-5 h-5 mb-2 opacity-90" />
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-medium opacity-90 mt-1">{label}</p>
    </div>
  );
}

export default function MigrationRoadmap() {
  return (
    <div className="space-y-5">
      {/* Executive summary hero */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="hero-gradient px-5 sm:px-7 py-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest opacity-90">Executive Summary</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Azure-Native Migration
          </h2>
          <p className="text-sm sm:text-base text-white/85 leading-relaxed max-w-2xl">
            Move GC Mission Control off Base44 onto a fully enterprise-owned Microsoft Azure stack —
            keeping every feature already built. The React frontend is retained; only the data, auth,
            and backend layers move to Azure SQL, Entra ID, and Azure Functions.
          </p>
        </div>
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile icon={Calendar} value="13 wks" label="Realistic timeline" gradient="stat-gradient-blue" />
            <StatTile icon={Server} value="7" label="Azure resources" gradient="stat-gradient-violet" />
            <StatTile icon={Database} value="90+" label="Entities → SQL tables" gradient="stat-gradient-brand" />
            <StatTile icon={Zap} value="180+" label="Functions to port" gradient="stat-gradient-amber" />
          </div>
        </div>
      </div>

      {/* Why migrate / benefits */}
      <div className="insight-card rounded-2xl p-5 sm:p-7">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#2E5A1A]" />
          Why migrate to Azure
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {BENEFITS.map(b => (
            <div key={b.title} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                <b.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{b.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap timeline */}
      <div className="insight-card rounded-2xl p-5 sm:p-7">
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2E5A1A]" />
          Migration Roadmap — 13 Weeks
        </h3>
        <p className="text-xs text-slate-500 mb-5">3-month continuous-phase timeline with a 1-week stabilization buffer before Base44 decommission.</p>

        {/* Week header */}
        <div className="hidden sm:grid grid-cols-13 gap-0.5 mb-2 px-1">
          {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(w => (
            <div key={w} className="text-center text-[10px] font-bold text-slate-400">W{w}</div>
          ))}
        </div>

        {/* Phase bars */}
        <div className="space-y-2">
          {PHASES.map(p => {
            const leftPct = (p.start / ROADMAP_WEEKS) * 100;
            const widthPct = ((p.end - p.start) / ROADMAP_WEEKS) * 100;
            return (
              <div key={p.id} className="flex items-center gap-2 sm:gap-3">
                <div className="w-36 sm:w-44 flex-shrink-0 text-[11px] sm:text-xs font-semibold text-slate-600 truncate text-right">
                  {p.name}
                </div>
                <div className="flex-1 relative h-7 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 rounded-lg flex items-center px-2 text-[10px] font-bold text-white truncate"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: p.color }}
                  >
                    <span className="truncate">{p.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Milestones */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Key Milestones</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MILESTONES.map(m => (
              <div key={m.week} className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <m.icon className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400">Week {Math.ceil(m.week)}</p>
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Costs + Risks */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Costs */}
        <div className="insight-card rounded-2xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PoundSterling className="w-5 h-5 text-[#2E5A1A]" />
            Indicative Monthly Cost
          </h3>
          <div className="space-y-1.5">
            {COSTS.map(c => (
              <div key={c.item} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                c.highlight ? 'bg-[#2E5A1A] text-white font-bold' : 'bg-slate-50 text-slate-700'
              }`}>
                <span className="text-sm">{c.item}</span>
                <span className="text-sm font-semibold tabular-nums">{c.cost}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            Consumption-based. Scales with usage — the S1 SQL tier can be upgraded as data grows.
          </p>
        </div>

        {/* Risks */}
        <div className="insight-card rounded-2xl p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Risk & Mitigation
          </h3>
          <div className="space-y-2">
            {RISKS.map(r => (
              <div key={r.risk} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-slate-800">{r.risk}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    r.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{r.severity}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture table */}
      <div className="insight-card rounded-2xl p-5 sm:p-7">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-[#2E5A1A]" />
          Target Architecture
        </h3>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Layer</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Today (Base44)</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Target (Azure)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Frontend', 'Base44 CDN', 'Azure Static Web Apps'],
                ['Database', 'Base44 entities (MongoDB)', 'Azure SQL Database'],
                ['API / backend', 'base44/functions', 'Azure Functions (Premium)'],
                ['Auth', 'Base44 Auth (email/OTP)', 'Microsoft Entra ID (MSAL)'],
                ['Scheduled jobs', 'Base44 automations', 'Functions timer triggers'],
                ['Webhooks', 'Base44 connector automations', 'Functions HTTP triggers'],
                ['Secrets', 'Base44 secrets', 'Azure Key Vault'],
                ['File storage', 'Base44 files', 'Azure Blob Storage'],
              ].map(row => (
                <tr key={row[0]}>
                  <td className="py-2 px-3 font-semibold text-slate-700">{row[0]}</td>
                  <td className="py-2 px-3 text-slate-500">{row[1]}</td>
                  <td className="py-2 px-3 font-semibold text-[#2E5A1A]">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}