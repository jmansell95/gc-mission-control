import React from 'react';
import { CheckCircle2, Circle, AlertTriangle, Wrench, Truck, Users, Calendar, ShieldCheck, FileBarChart, Settings, Package, ClipboardList, DollarSign } from 'lucide-react';

/**
 * HubOverhaulPlan — readiness checklist for every admin hub.
 * A documented plan to bring every hub to the same finished, consistent
 * standard as the Tracking Hub overhaul.
 */

const HUBS = [
  {
    name: 'Overview / Command Centre',
    icon: ClipboardList,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Customisable widget grid with drag-and-drop sections' },
      { done: true, text: 'Division-scoped KPI tiles and live data' },
      { done: true, text: 'Standardized PageHeader + HubQuickLinks + KPI strip — this overhaul' },
      { done: true, text: 'Stat tiles replaced with HubStatsBar format (matches all hubs) — this overhaul' },
      { done: false, text: 'Mobile layout — key widgets missing or cramped on phones' },
      { done: false, text: 'Widget load performance — some widgets fire redundant queries' },
      { done: true, text: 'Consistent empty/loading states across all widgets — this overhaul' },
    ],
  },
  {
    name: 'Jobs / Projects Hub',
    icon: Calendar,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Multi-discipline project model (drilling, groundworks, depot)' },
      { done: true, text: 'Job detail with tabs, financials, schedule, logistics' },
      { done: true, text: 'Decommissioning workflow' },
      { done: false, text: 'Job list filters — no saved-view / quick-filter presets' },
      { done: false, text: 'Dependency manager UX — warning banner easy to miss' },
      { done: false, text: 'Mobile job detail — tabs overflow on small screens' },
    ],
  },
  {
    name: 'Scheduling Hub',
    icon: Calendar,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Unified rota builder with crew-rig pairing' },
      { done: true, text: 'Live driver badges and vehicle/crew toggle' },
      { done: true, text: 'Permanent crew sync and template week copy' },
      { done: false, text: 'Concurrent leave request handling — known bug' },
      { done: false, text: 'Rota PDF export — formatting breaks on long crew names' },
      { done: false, text: 'Weekend toggle discoverability — users miss it' },
    ],
  },
  {
    name: 'Staff Hub',
    icon: Users,
    status: 'needs-work',
    items: [
      { done: true, text: 'People directory with team/crew drill-down' },
      { done: true, text: 'Training matrix and compliance wallet' },
      { done: true, text: 'Timesheet approvals and cost analytics' },
      { done: false, text: 'Subcontractor crew pairing — add/edit flow is clunky' },
      { done: false, text: 'Market Dojo onboarding — manual tick, no API verify' },
      { done: false, text: 'Bulk invite — two-email flow fragile, no retry on failure' },
      { done: false, text: 'Staff list — no saved filters or column customisation' },
    ],
  },
  {
    name: 'Logistics / Driver Hub',
    icon: Truck,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Delivery board, driver day planner, route optimisation' },
      { done: true, text: 'Pick/load/driver-check signature pipeline' },
      { done: true, text: 'Goods-in and site collection scanner' },
      { done: false, text: 'Weight capacity — override audit trail not surfaced in UI' },
      { done: false, text: 'Trailer pairing — no bulk assign for multi-stop runs' },
      { done: false, text: 'Mobile driver hub — offline queue retry needs visibility' },
    ],
  },
  {
    name: 'Assets Hub',
    icon: Package,
    status: 'needs-work',
    items: [
      { done: true, text: 'Asset inventory grid with utilisation trends' },
      { done: true, text: 'Rig hub with compliance, fleet sync, depreciation' },
      { done: true, text: 'PAT testing console and certificate vault' },
      { done: false, text: 'Certification / recertification upload & tracking — missing' },
      { done: false, text: 'Asset Panda sync — field mapper UX is technical' },
      { done: false, text: 'Scrap pile — no disposal audit export' },
      { done: false, text: 'Mobile asset scanner — some modes crash on low-end Android' },
    ],
  },
  {
    name: 'Tracking / Vehicles Hub',
    icon: Truck,
    status: 'in-progress',
    items: [
      { done: true, text: 'Live tracking map with vehicle + staff overlay' },
      { done: true, text: 'Vehicle proxy for staff without phone GPS' },
      { done: true, text: 'Trip history playback and safety events' },
      { done: true, text: 'Inline KPI strip (map removed from header) — this overhaul' },
      { done: true, text: 'Vehicle vs staff legend on map — this overhaul' },
      { done: true, text: 'Crew presence strip (who has app open) — this overhaul' },
      { done: true, text: 'Maintenance matrix planner (months × drivers) — this overhaul' },
      { done: true, text: 'Tab renamed Fleet → Vehicles — this overhaul' },
      { done: false, text: 'Background tracking — needs Capacitor native build' },
      { done: false, text: "Live map filter hides crew not on today's shift — known bug" },
      { done: false, text: 'Geotab sync reliability — intermittent auth failures' },
    ],
  },
  {
    name: 'Investigation Hub',
    icon: ClipboardList,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Borehole card grid with crew chips and device metadata' },
      { done: true, text: 'AGS / KeyLogBook import and review pipeline' },
      { done: true, text: 'Geotech sample management with lab chain-of-custody' },
      { done: false, text: 'KeyLogBook API docs — integration relies on inferred paths' },
      { done: false, text: 'Site log attribution — "no name entered" still common' },
      { done: false, text: 'Bulk approve — no undo / no diff preview' },
    ],
  },
  {
    name: 'Compliance Hub',
    icon: ShieldCheck,
    status: 'needs-work',
    items: [
      { done: true, text: 'Audits, incidents, toolbox talks, environmental' },
      { done: true, text: 'Crew shift status widget and compliance calendar' },
      { done: true, text: 'RIDDOR stats and safety culture gate' },
      { done: false, text: 'Row-level security missing for SafetyCultureConfig entity' },
      { done: false, text: 'Incident auto-analysis — AI suggestions not always relevant' },
      { done: false, text: 'Compliance reports — no scheduled export to email' },
      { done: false, text: 'Mobile — key hubs missing from mobile nav' },
    ],
  },
  {
    name: 'Billing / Financial Hub',
    icon: DollarSign,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'AFP/CVR pipeline, invoicing, cost tracking' },
      { done: true, text: 'Rate card manager and keyword mapping' },
      { done: true, text: 'Aged debtors and margin guard' },
      { done: true, text: 'Hub-level KPI strip (AFP claimed, agreed, outstanding, overdue) — this overhaul' },
      { done: true, text: 'POA price lock expiry warnings (badge + stat tile) — this overhaul' },
      { done: true, text: 'Draft invoice approval queue with expandable line items — this overhaul' },
      { done: false, text: 'Financial figure discrepancies — fragile rate-card matching' },
      { done: false, text: 'MPL / markup rules — lockable to admin but UX unclear' },
      ],
  },
  {
    name: 'Reports Hub',
    icon: FileBarChart,
    status: 'mostly-ready',
    items: [
      { done: true, text: 'Custom report builder with native + Power BI sections' },
      { done: true, text: 'Scheduled reports and template library' },
      { done: true, text: 'Crew and rig performance reports' },
      { done: false, text: 'Report rendering — large reports freeze the browser' },
      { done: false, text: 'No CSV/Excel export from the report viewer' },
      { done: false, text: 'Saved filters — not shared across users' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    status: 'needs-work',
    items: [
      { done: true, text: 'Integrations hub, dropdown manager, access levels' },
      { done: true, text: 'Email template builder and branding' },
      { done: true, text: 'Division manager and backup/restore' },
      { done: false, text: 'Settings nav — 40+ sections, no search or grouping' },
      { done: false, text: 'Audit logging — not every edit is logged' },
      { done: false, text: 'Coming soon manager vs integrations hub — state conflicts' },
      { done: false, text: "Mobile — settings pages don't adapt to small screens" },
    ],
  },
];

const STATUS_STYLES = {
  'ready': { color: 'bg-emerald-100 text-emerald-700', label: 'Ready', icon: CheckCircle2 },
  'mostly-ready': { color: 'bg-blue-100 text-blue-700', label: 'Mostly Ready', icon: Circle },
  'in-progress': { color: 'bg-amber-100 text-amber-700', label: 'In Progress', icon: Wrench },
  'needs-work': { color: 'bg-rose-100 text-rose-700', label: 'Needs Work', icon: AlertTriangle },
};

export default function HubOverhaulPlan() {
  const totalItems = HUBS.reduce((sum, h) => sum + h.items.length, 0);
  const doneItems = HUBS.reduce((sum, h) => sum + h.items.filter(i => i.done).length, 0);
  const pct = Math.round((doneItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-50/50 page-bg-vibrant">
      <div className="max-w-6xl mx-auto px-4 py-8 print-area">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl stat-gradient-brand flex items-center justify-center icon-tile-glow">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Full Hub Overhaul Plan</h1>
              <p className="text-sm text-slate-500">Readiness checklist for every admin hub · {doneItems}/{totalItems} items done ({pct}%)</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full stat-gradient-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Hub cards */}
        <div className="space-y-4">
          {HUBS.map(hub => {
            const StatusIcon = STATUS_STYLES[hub.status].icon;
            const hubDone = hub.items.filter(i => i.done).length;
            const hubPct = Math.round((hubDone / hub.items.length) * 100);
            return (
              <div key={hub.name} className="insight-card rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <hub.icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-900">{hub.name}</h2>
                    <p className="text-[11px] text-slate-400">{hubDone}/{hub.items.length} complete · {hubPct}%</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_STYLES[hub.status].color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {STATUS_STYLES[hub.status].label}
                  </span>
                </div>
                {/* Mini progress */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full stat-gradient-emerald rounded-full" style={{ width: `${hubPct}%` }} />
                </div>
                {/* Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {hub.items.map((item, i) => (
                    <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm ${item.done ? 'bg-emerald-50/50' : 'bg-white border border-slate-100'}`}>
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={item.done ? 'text-slate-600 line-through opacity-70' : 'text-slate-700'}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Priority order */}
        <div className="insight-card rounded-2xl p-6 mt-6">
          <h2 className="text-base font-bold text-slate-900 mb-3">Priority Order</h2>
          <ol className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">1.</span> Tracking Hub — finish background tracking (Capacitor build) + fix live map filter bug</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">2.</span> Compliance Hub — add RLS to SafetyCultureConfig + mobile nav parity</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">3.</span> Billing Hub — fix rate-card matching discrepancies + invoice approval gate</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">4.</span> Assets Hub — build certification/recertification upload & tracking</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">5.</span> Settings — add search/grouping to the 40+ section nav</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">6.</span> Staff Hub — fix concurrent leave bug + streamline subcontractor crew pairing</li>
            <li className="flex gap-2"><span className="font-bold text-[#2E5A1A]">7.</span> Mobile parity across all hubs (Overview, Jobs, Settings)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}