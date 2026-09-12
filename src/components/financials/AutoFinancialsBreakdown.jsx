import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, TrendingUp, Percent, Calculator, AlertTriangle,
  Loader2, RefreshCw, Mountain, ChevronDown, ChevronRight, User,
  CheckCircle2, XCircle, Target, Gauge, Truck, Save, Check, Ruler,
  HardHat, Users, ArrowRightLeft, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BoreholeRevenueTable from '@/components/financials/BoreholeRevenueTable';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm";

// Map billing-setup warning text to a deep-link route so the user can jump
// straight to the settings area that fixes the warning.
const warningLink = (w) => {
  if (/Asset Panda/i.test(w)) return '/enterprise/settings';
  if (/Rate Cards|Our Rate Card|Master Price List|markup/i.test(w)) return '/billing';
  return null;
};

const ROLE_LABELS = {
  driller: { label: 'Driller', color: 'bg-amber-100 text-amber-700' },
  engineer: { label: 'Engineer', color: 'bg-blue-100 text-blue-700' },
  groundworker: { label: 'Groundworker', color: 'bg-emerald-100 text-emerald-700' },
  enabling_crew: { label: 'Enabling Crew', color: 'bg-violet-100 text-violet-700' },
  supervisor: { label: 'Supervisor', color: 'bg-indigo-100 text-indigo-700' },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-100 text-orange-700' },
  client: { label: 'Client', color: 'bg-slate-100 text-slate-700' },
  contractor: { label: 'Contractor', color: 'bg-slate-100 text-slate-700' },
  ags_import: { label: 'AGS Import', color: 'bg-slate-100 text-slate-500' },
  unspecified: { label: 'No name entered', color: 'bg-red-100 text-red-600' },
};

const METHOD_LABELS = {
  cp: { label: 'CP', full: 'Cable Percussion', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  rotary: { label: 'Rotary', full: 'Rotary Core', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  mixed: { label: 'Mixed', full: 'Mixed Methods', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  not_applicable: { label: 'N/A', full: 'Non-Drilling', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export function RoleBadge({ role }) {
  const r = ROLE_LABELS[role] || ROLE_LABELS.unspecified;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.color}`}>
      <User className="w-2.5 h-2.5" />
      {r.label}
    </span>
  );
}

function MethodBadge({ method }) {
  const m = METHOD_LABELS[method] || METHOD_LABELS.not_applicable;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.color}`}>
      <HardHat className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

/**
 * AutoFinancialsBreakdown — the unified financial dashboard.
 * Calls calculateJobFinancials to get drilling method detection,
 * per-borehole revenue by method, rig/crew profitability, and
 * billing setup warnings.
 */
export default function AutoFinancialsBreakdown({ job }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showMatched, setShowMatched] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showBoreholes, setShowBoreholes] = useState(false);
  const [showRigs, setShowRigs] = useState(false);
  const [showCrew, setShowCrew] = useState(false);

  const [billing, setBilling] = useState({
    meterage_rate: job.meterage_rate ?? '',
    meterage_target: job.meterage_target ?? '',
    budget_amount: job.budget_amount ?? '',
    drilling_method: job.drilling_method || 'not_applicable',
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  useEffect(() => {
    setBilling({
      meterage_rate: job.meterage_rate ?? '',
      meterage_target: job.meterage_target ?? '',
      budget_amount: job.budget_amount ?? '',
      drilling_method: job.drilling_method || 'not_applicable',
    });
  }, [job.id, job.meterage_rate, job.meterage_target, job.budget_amount, job.drilling_method]);

  const billingDirty = (Number(job.meterage_rate) || 0) !== (parseFloat(billing.meterage_rate) || 0) ||
                       (Number(job.meterage_target) || 0) !== (parseFloat(billing.meterage_target) || 0) ||
                       (Number(job.budget_amount) || 0) !== (parseFloat(billing.budget_amount) || 0) ||
                       (job.drilling_method || 'not_applicable') !== billing.drilling_method;

  const saveBilling = async () => {
    setSavingBilling(true);
    try {
      await base44.entities.Job.update(job.id, {
        meterage_rate: parseFloat(billing.meterage_rate) || 0,
        meterage_target: parseFloat(billing.meterage_target) || 0,
        budget_amount: parseFloat(billing.budget_amount) || 0,
        drilling_method: billing.drilling_method,
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      setBillingSaved(true);
      setTimeout(() => setBillingSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSavingBilling(false);
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['auto-job-financials', job.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id });
      return res.data;
    },
    enabled: !!job.id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="ml-2 text-sm text-slate-500">Calculating financials from logged activities…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-bold text-red-800">Couldn't load financials</h3>
          <button onClick={() => refetch()} disabled={isFetching} className="ml-auto p-1 text-red-500 hover:text-red-700 transition">
            <RefreshCw className={'w-4 h-4 ' + (isFetching ? 'animate-spin' : '')} />
          </button>
        </div>
        <p className="text-xs text-red-700">{error.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const dp = data.drilling_performance || {};
  const cb = data.cost_breakdown || {};
  const bs = data.billing_setup || {};
  const dm = data.drilling_method || {};
  const hasData = s.matched_count > 0 || s.total_cost_net > 0 || dp.total_metres > 0;
  const profitColor = s.profit >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose';
  const isDrilling = dp.total_metres > 0 || (data.rig_profitability && data.rig_profitability.length > 0);
  const budget = Number(job.budget_amount) || 0;
  const overBudget = budget > 0 && s.total_cost_net > budget;

  return (
    <div className="space-y-4">
      {/* === BILLING SETUP WARNING === */}
      {bs.warnings && bs.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">Billing Setup Needs Attention</h3>
          </div>
          <div className="space-y-1.5">
            {bs.warnings.map((w, i) => {
              const link = warningLink(w);
              return (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 flex-1">{w}</p>
                  {link && (
                    <button onClick={() => navigate(link)} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-md transition flex-shrink-0">
                      Fix <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === REVENUE RECONCILIATION CHECK === */}
      {(() => {
        const componentSum = (s.meterage_revenue || 0) + (s.sor_revenue || 0) + (s.additional_charges || 0) + (s.hire_client_charge_net || 0) + (s.subcon_client_charge_net || 0) + (s.owned_items_revenue || 0);
        const total = s.total_revenue_net || 0;
        const diff = Math.abs(componentSum - total);
        if (diff < 1) return null;
        return (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-800">Revenue Reconciliation Mismatch</h3>
            </div>
            <p className="text-xs text-red-700">
              The sum of displayed revenue components (£{componentSum.toLocaleString('en-GB', { minimumFractionDigits: 2 })}) doesn't match the total revenue net (£{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}). This usually means a rate card match is missing or a billing method isn't fully set — check the warnings above.
            </p>
          </div>
        );
      })()}

      {/* === Rate card status strip === */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${bs.has_project ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-slate-600">{bs.has_job_rate_card ? 'Job Rate Card' : 'Global Only'}</span>
        </div>
        <span className="text-slate-200">|</span>
        <div className="flex items-center gap-1.5">
          <MethodBadge method={dm.job_method || 'not_applicable'} />
          <span className="text-xs text-slate-500">{METHOD_LABELS[dm.job_method]?.full || 'Not set'}</span>
        </div>
        {dm.cp_per_metre_rate && (
          <>
            <span className="text-slate-200">|</span>
            <span className="text-xs text-slate-600">CP: <strong className="text-slate-800">{fmt(dm.cp_per_metre_rate.price)}/m</strong></span>
          </>
        )}
        {dm.rotary_per_metre_rate && (
          <>
            <span className="text-slate-200">|</span>
            <span className="text-xs text-slate-600">Rotary: <strong className="text-slate-800">{fmt(dm.rotary_per_metre_rate.price)}/m</strong></span>
          </>
        )}
        <span className="ml-auto text-xs text-slate-400">{data.rate_card_levels?.job_rates_found || 0} job · {data.rate_card_levels?.global_rates_found || 0} global rates</span>
      </div>

      {/* === HERO: Total Revenue === */}
      <div className="hero-gradient rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-white/70" />
          <span className="text-xs font-medium text-white/80">Total Revenue</span>
          {s.revenue_method && (
            <span className="ml-2 text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
              {s.revenue_method_label || s.revenue_method}
            </span>
          )}
          <button onClick={() => refetch()} disabled={isFetching} className="ml-auto text-white/60 hover:text-white transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-3xl font-bold">{fmt(s.total_revenue_gross)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/80">
          <span>Net: {fmt(s.total_revenue_net)}</span>
          <span>VAT: {fmt(s.total_revenue_vat)}</span>
          {dp.total_metres > 0 && <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {dp.total_metres.toFixed(1)}m drilled</span>}
        </div>
        {/* Revenue component reconciliation — components sum to total_revenue_net */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {s.meterage_revenue > 0 && <RevComponent label="Meterage" value={s.meterage_revenue} />}
          {s.sor_revenue > 0 && <RevComponent label="SOR lines" value={s.sor_revenue} />}
          {s.additional_charges > 0 && <RevComponent label="Delivery/Task" value={s.additional_charges} />}
          {s.subcon_client_charge_net > 0 && <RevComponent label="Sub-con sell" value={s.subcon_client_charge_net} />}
          {s.hire_client_charge_net > 0 && <RevComponent label="Plant hire" value={s.hire_client_charge_net} />}
          {s.owned_items_revenue > 0 && s.revenue_method !== 'flat_fee' && <RevComponent label="Rig & equipment" value={s.owned_items_revenue} />}
          {s.revenue_method === 'flat_fee' && <RevComponent label="Flat fee" value={Number(job.client_charge) || 0} />}
        </div>
      </div>

      {/* === Summary Stats === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat icon={PoundSterling} value={fmt(s.total_revenue_net)} label="Revenue (net)" gradient="stat-gradient-brand" />
        <SummaryStat icon={Calculator} value={fmt(s.total_cost_net)} label="Cost (net)" gradient="stat-gradient-amber" />
        <SummaryStat icon={TrendingUp} value={fmt(s.profit)} label="Profit" gradient={profitColor} />
        <SummaryStat icon={Percent} value={`${s.margin_pct.toFixed(1)}%`} label="Margin" gradient="stat-gradient-violet" />
      </div>

      {/* === DRILLING PERFORMANCE (main focus) === */}
      {isDrilling && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg stat-gradient-brand flex items-center justify-center">
              <Mountain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Drilling Performance</h3>
              <p className="text-[11px] text-slate-400">Rig cost vs metre revenue · {METHOD_LABELS[dm.job_method]?.full || 'Auto-detected'}</p>
            </div>
          </div>

          {/* Performance stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <PerfStat icon={Gauge} value={`${(dp.total_metres || 0).toFixed(1)}m`} label="Total Drilled" sub={dp.working_days ? `${dp.working_days} working days` : undefined} gradient="stat-gradient-blue" />
            <PerfStat icon={PoundSterling} value={dp.meterage_rate > 0 ? fmt(dp.meterage_rate) : (dm.cp_per_metre_rate || dm.rotary_per_metre_rate) ? fmt((dm.cp_per_metre_rate || dm.rotary_per_metre_rate).price) : '—'} label="Rate / metre" sub={dp.meterage_rate > 0 ? 'job metre rate' : 'from rate card'} gradient="stat-gradient-emerald" />
            <PerfStat icon={TrendingUp} value={fmt(dp.meterage_revenue > 0 ? dp.meterage_revenue : s.total_revenue_net)} label={dp.meterage_revenue > 0 ? 'Metre Revenue' : 'Matched Revenue'} sub={dp.meterage_revenue > 0 ? `${dp.total_metres?.toFixed(1)}m drilled` : `${s.matched_count} activities`} gradient="stat-gradient-brand" />
            <PerfStat icon={Truck} value={fmt(dp.rig_cost)} label="Rig & Crew Cost" sub={data.rig_profitability?.length ? `${data.rig_profitability.length} rig(s)` : 'no rigs assigned'} gradient="stat-gradient-amber" />
          </div>

          {/* Per-metre metrics */}
          {dp.total_metres > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MiniMetric label="Cost / metre" value={fmt(dp.cost_per_metre)} tone="amber" />
              <MiniMetric label="Revenue / metre" value={fmt(dp.revenue_per_metre)} tone="emerald" />
              <MiniMetric label="Profit / metre" value={fmt(dp.profit_per_metre)} tone={dp.profit_per_metre >= 0 ? 'emerald' : 'rose'} />
            </div>
          )}

          {/* Revenue by method */}
          {(dp.cp_revenue > 0 || dp.rotary_revenue > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-blue-700">CP Revenue</span>
                </div>
                <p className="text-lg font-bold text-blue-900 tabular-nums">{fmt(dp.cp_revenue)}</p>
                {dm.cp_per_metre_rate && <p className="text-[10px] text-blue-500">@ {fmt(dm.cp_per_metre_rate.price)}/m</p>}
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs font-semibold text-orange-700">Rotary Revenue</span>
                </div>
                <p className="text-lg font-bold text-orange-900 tabular-nums">{fmt(dp.rotary_revenue)}</p>
                {dm.rotary_per_metre_rate && <p className="text-[10px] text-orange-500">@ {fmt(dm.rotary_per_metre_rate.price)}/m</p>}
              </div>
            </div>
          )}

          {/* Target progress */}
          {dp.target_metres > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium flex items-center gap-1"><Target className="w-3 h-3" /> Progress vs target</span>
                <span className="text-slate-600 font-semibold">{dp.target_pct}% · {(dp.total_metres || 0).toFixed(1)}m / {dp.target_metres}m</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${dp.target_pct}%` }} />
              </div>
            </div>
          )}

          {/* Rig profitability table */}
          {data.rig_profitability?.length > 0 && (
            <div className="space-y-2">
              <button onClick={() => setShowRigs(!showRigs)} className="w-full flex items-center gap-2 text-left">
                {showRigs ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <Truck className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-slate-700">Rig & Crew Profitability</p>
                <span className="ml-auto text-xs text-slate-400">{data.rig_profitability.length} rig(s)</span>
              </button>
              {showRigs && (
                <div className="space-y-1.5">
                  {data.rig_profitability.map((r, i) => (
                    <div key={i} className={`rounded-lg border px-3 py-2.5 ${r.status === 'assigned' ? 'bg-amber-50 border-amber-200' : r.profit < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-700 truncate">{r.rig_name}</p>
                        <MethodBadge method={r.method} />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.status === 'on_site' ? 'bg-blue-100 text-blue-700' : r.status === 'returned' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                          {r.status === 'on_site' ? 'On Site' : r.status === 'returned' ? 'Returned' : 'Not on site'}
                        </span>
                      </div>
                      {r.arrived_on_site_date && (
                        <p className="text-[10px] text-slate-500 mb-1.5">On site from {r.arrived_on_site_date}{r.returned_date ? ` → returned ${r.returned_date}` : ''}</p>
                      )}
                      {r.status === 'assigned' && (
                        <p className="text-[10px] text-amber-600 mb-1.5">No costs yet — rig not delivered to site</p>
                      )}
                      <div className="grid grid-cols-6 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Charge Out</p>
                          <p className="font-semibold text-slate-700">{fmt(r.day_rate)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-amber-500 uppercase">Int. Cost/day</p>
                          <p className="font-semibold text-amber-700">{fmt(r.day_cost)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-emerald-500 uppercase">Day Rate Rev</p>
                          <p className="font-semibold text-emerald-700">{fmt(r.day_rate_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Metres</p>
                          <p className="font-semibold text-slate-700">{r.metres_drilled.toFixed(1)}m</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Metre Rev</p>
                          <p className="font-semibold text-emerald-700">{fmt(r.meterage_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Profit</p>
                          <p className={`font-bold ${r.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(r.profit)}</p>
                        </div>
                      </div>
                      {r.boreholes.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1">Boreholes: {r.boreholes.join(', ')}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.rate_description} · {fmt(r.day_cost)}/day cost × {r.working_days}d on site = {fmt(r.total_cost)} cost · {fmt(r.day_rate)}/day charge-out × {r.working_days}d = {fmt(r.day_rate_revenue)} revenue</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === BILLING SETUP (inline editor) === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-slate-800">Billing Setup</h3>
          <span className="ml-auto text-xs text-slate-400">Drilling method · per-metre rate · target · budget</span>
        </div>
        {/* Drilling method */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Drilling Method</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 'cp', label: 'CP', desc: 'Cable Percussion' },
              { val: 'rotary', label: 'Rotary', desc: 'Rotary Core' },
              { val: 'mixed', label: 'Mixed', desc: 'Both Methods' },
              { val: 'not_applicable', label: 'N/A', desc: 'Non-drilling' },
            ].map(m => (
              <button key={m.val} onClick={() => setBilling({ ...billing, drilling_method: m.val })}
                className={`px-2 py-2 rounded-lg border text-center transition ${billing.drilling_method === m.val ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                <span className="block text-xs font-bold">{m.label}</span>
                <span className="block text-[9px] opacity-70">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <PoundSterling className="w-3.5 h-3.5 text-emerald-700" /> Metre rate (£/m)
            </label>
            <input type="number" min="0" step="0.01" value={billing.meterage_rate} onChange={e => setBilling({ ...billing, meterage_rate: e.target.value })} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Target className="w-3.5 h-3.5 text-amber-600" /> Target (m)
            </label>
            <input type="number" min="0" step="0.1" value={billing.meterage_target} onChange={e => setBilling({ ...billing, meterage_target: e.target.value })} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Calculator className="w-3.5 h-3.5 text-slate-500" /> Budget (£)
            </label>
            <input type="number" min="0" step="0.01" value={billing.budget_amount} onChange={e => setBilling({ ...billing, budget_amount: e.target.value })} placeholder="0.00" className={inputCls} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={saveBilling} disabled={savingBilling || !billingDirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50">
            {savingBilling ? <span>Saving…</span> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
          {billingSaved && <span className="text-xs text-primary font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {!billingDirty && !billingSaved && <span className="text-xs text-slate-400">Leave metre rate blank to auto-price from rate cards</span>}
        </div>
      </div>

      {/* === Per-Borehole Depth-Banded Revenue === */}
      {data.borehole_revenue?.length > 0 && (
        <BoreholeRevenueTable
          boreholeRevenue={data.borehole_revenue}
          drillingRateCard={data.drilling_rate_card}
          totalMetres={dp.total_metres}
          meterageRevenue={s.meterage_revenue}
        />
      )}

      {/* === Budget vs Cost === */}
      {budget > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Cost vs Budget</span>
            <span className={overBudget ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              {fmt(s.total_cost_net)} / {fmt(budget)}
              {overBudget ? ` · ${fmt(s.total_cost_net - budget)} over` : ` · ${fmt(budget - s.total_cost_net)} remaining`}
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${budget > 0 ? Math.min((s.total_cost_net / budget) * 100, 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* === Cost Breakdown === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-slate-800">Cost Breakdown</h3>
          <span className="ml-auto text-xs text-slate-400">Net</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MiniStat label="Equipment" value={cb.equipment_net} sub="hire & purchased" />
          <MiniStat label="Rigs" value={cb.rig_cost} sub={data.rig_profitability?.length ? `${data.rig_profitability.length} rig(s)` : undefined} />
          <MiniStat label="Crew (rota)" value={cb.crew_cost} sub={cb.crew_rows?.length ? `${cb.crew_rows.length} crew` : 'from rota'} />
          {cb.labour_items_net > 0 && <MiniStat label="Crew (billable)" value={cb.labour_items_net} sub="rate card items" />}
          <MiniStat label="Accommodation" value={cb.hotel_net} sub={cb.hotel_rows?.length > 0 ? `${cb.hotel_rows.length} booking(s)` : undefined} />
          <MiniStat label="Crew Expenses" value={cb.daily_costs_net} sub={data.daily_costs?.length ? `${data.daily_costs.length} item(s)` : undefined} />
          <MiniStat label="Sub-Con (Buy)" value={cb.subcon_purchase_net} sub={data.subcontractor_logs?.length ? `${data.subcontractor_logs.length} log(s)` : undefined} />
        </div>
        {/* Reconciliation total — sum of the components above equals total_cost_net */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-600">Total Cost (net)</span>
          <span className="font-bold text-slate-900 tabular-nums">{fmt(s.total_cost_net)}</span>
        </div>
        {/* Delivery & task charges are revenue (billed to client), not internal cost — shown for reference */}
        {(cb.delivery_charges > 0 || cb.task_charges > 0) && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            Delivery ({fmt(cb.delivery_charges)}) and task ({fmt(cb.task_charges)}) charges are client revenue, included in the total revenue above — not internal cost.
          </p>
        )}
      </div>

      {/* === Subcontractor Margin Summary === */}
      {cb.subcon_client_charge_net > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-semibold text-slate-800">Subcontractor Margin</h3>
            <span className="ml-auto text-xs text-slate-400">{data.subcontractor_logs?.length || 0} log(s)</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-medium">Buy (Cost)</p>
              <p className="text-base font-bold text-slate-800 tabular-nums">{fmt(cb.subcon_purchase_net)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-3 text-center">
              <p className="text-[10px] text-emerald-600 uppercase font-medium">Sell (Revenue)</p>
              <p className="text-base font-bold text-emerald-700 tabular-nums">{fmt(cb.subcon_client_charge_net)}</p>
            </div>
            <div className="bg-primary/5 rounded-lg border border-primary/15 p-3 text-center">
              <p className="text-[10px] text-primary uppercase font-medium">Margin</p>
              <p className="text-base font-bold text-primary tabular-nums">{fmt(cb.subcon_margin_net)}</p>
              <p className="text-[10px] text-slate-400">{cb.subcon_client_charge_net > 0 ? `${((cb.subcon_margin_net / cb.subcon_client_charge_net) * 100).toFixed(1)}%` : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* === Crew labour breakdown === */}
      {cb.crew_rows?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowCrew(!showCrew)} className="w-full px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-left hover:bg-slate-50/50 transition">
            {showCrew ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Crew Labour ({cb.crew_rows.length})</h3>
            <span className="ml-auto text-xs text-slate-400">{fmt(cb.crew_cost)}</span>
          </button>
          {showCrew && (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {cb.crew_rows.map((r, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{r.staff_name}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.day_cost != null && r.day_cost > 0
                        ? `${fmt(r.day_cost)}/day cost × ${r.standard_days} day(s)`
                        : r.day_rate > 0
                          ? `${fmt(r.day_rate)}/day × ${r.standard_days} day(s)`
                          : 'No day rate found'}
                      {r.overtime_days > 0 && ` · ${r.overtime_days} OT @ ${r.overtime_multiplier}×`}
                    </p>
                    {r.rate_source === 'no_rate_found' && (
                      <p className="text-[10px] text-amber-600">Add a personal rate card in Settings → Rate Cards</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{fmt(r.total_cost)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Unmatched activities alert === */}
      {s.unmatched_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <button onClick={() => setShowUnmatched(!showUnmatched)} className="w-full flex items-center gap-2 text-left">
            {showUnmatched ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">{s.unmatched_count} activities with no rate card match</h3>
            <span className="ml-auto text-xs text-amber-600 font-medium">Click to review</span>
          </button>
          {showUnmatched && (
            <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
              {data.unmatched_entries.map((e, i) => (
                <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <XCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 font-medium truncate">{e.description || e.log_type}</p>
                    <p className="text-[10px] text-slate-400">{e.date} · {e.borehole_ref || 'no ref'} · {e.log_type}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-amber-700 pt-1 px-2">Add matching rate card items in Settings → Rate Cards to price these activities automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* === Matched SOR activities === */}
      {s.matched_count > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowMatched(!showMatched)} className="w-full px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-left hover:bg-slate-50/50 transition">
            {showMatched ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-800">Matched SOR Activities ({s.matched_count})</h3>
            <span className="ml-auto text-xs text-slate-400">{fmt(s.sor_revenue)} revenue</span>
          </button>
          {showMatched && (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {data.matched_entries.map((m, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{m.date}</span>
                      {m.borehole_ref && <span className="text-[10px] text-slate-500">{m.borehole_ref}</span>}
                      <RoleBadge role={m.logged_by_role} />
                      {m.staff_name && <span className="text-[10px] text-slate-500">{m.staff_name}</span>}
                    </div>
                    <p className="text-xs text-slate-700 truncate">{m.description}</p>
                    <p className="text-[10px] text-primary font-medium mt-0.5">
                      → {m.rate_card_description} ({m.rate_source} rate)
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(m.line_total)}</p>
                    <p className="text-[10px] text-slate-400">{m.quantity} {m.unit} × {fmt(m.unit_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasData && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
          <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No financial data yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload an AGS file or log site activities to see auto-calculated revenue and costs here.</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ icon: Icon, value, label, gradient }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase font-medium truncate">{label}</p>
        <p className="text-base font-bold text-slate-900 tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

function PerfStat({ icon: Icon, value, label, sub, gradient }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-[10px] text-slate-400 uppercase font-medium truncate">{label}</p>
      </div>
      <p className="text-base font-bold text-slate-900 tabular-nums truncate">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniMetric({ label, value, tone }) {
  const tones = { amber: 'text-amber-700', emerald: 'text-emerald-700', rose: 'text-rose-600' };
  return (
    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2.5">
      <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tones[tone] || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2.5">
      <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(value)}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

function RevComponent({ label, value }) {
  return (
    <div className="bg-white/10 rounded-lg px-2.5 py-1.5 border border-white/15">
      <p className="text-[9px] text-white/60 uppercase font-medium truncate">{label}</p>
      <p className="text-xs font-bold text-white tabular-nums truncate">{fmt(value)}</p>
    </div>
  );
}