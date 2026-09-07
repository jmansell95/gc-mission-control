import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, PoundSterling, GitBranch, Clock, CheckCircle2,
  AlertTriangle, FileText, Layers, ArrowRight,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

const CATEGORY_META = {
  drilling: { label: 'Drilling', color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  plant_hire: { label: 'Plant Hire', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  labour: { label: 'Labour', color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  subcontractor: { label: 'Subcontractor', color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  materials: { label: 'Materials', color: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  mobilisation: { label: 'Mobilisation', color: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  delivery: { label: 'Delivery', color: 'from-slate-500 to-gray-600', bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
  other: { label: 'Other', color: 'from-slate-400 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
};

/**
 * AFPSummaryHeader — a stunning visual dashboard header for the AFP Builder.
 * Replaces the plain card header with a gradient hero showing:
 *   • Claimed vs Assessed vs Agreed totals as animated stat tiles
 *   • A visual progress bar showing claimed vs assessed
 *   • Category breakdown chips with proportional bars
 *   • Dispute status indicator with pulse animation
 *   • Item count + source freshness pills
 */
export default function AFPSummaryHeader({ afp, job, totals, lineItems, categoryCounts, freshness }) {
  const { original, disputed, agreed, claimed, assessed, balance } = totals;
  const itemCount = lineItems.length;
  const disputePct = original > 0 ? Math.round((disputed / original) * 100) : 0;
  const assessedPct = claimed > 0 ? Math.min(100, Math.round((assessed / claimed) * 100)) : 0;
  const agreedPct = claimed > 0 ? Math.min(100, Math.round((agreed / claimed) * 100)) : 0;

  // Category breakdown for the visual bar
  const categoryBreakdown = Object.entries(categoryCounts || {})
    .map(([cat, count]) => ({
      cat,
      count,
      meta: CATEGORY_META[cat] || CATEGORY_META.other,
      pct: itemCount > 0 ? (count / itemCount) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Gradient hero strip */}
      <div className="relative h-1.5 bg-gradient-to-r from-[#2E5A1A] via-[#5A8C1E] to-[#8DC63F]" />

      {/* Main header area */}
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        {/* Decorative mesh */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 10% 20%, #2E5A1A 0%, transparent 40%), radial-gradient(circle at 90% 80%, #8DC63F 0%, transparent 40%)',
        }} />

        {/* Top row: AFP identity + status */}
        <div className="relative flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-lg flex-shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                AFP {afp.afp_number} <span className="text-slate-400 font-bold">·</span> <span className="text-slate-700">{job.name}</span>
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  afp.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  afp.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  afp.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                  afp.status === 'invoiced' ? 'bg-violet-100 text-violet-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    afp.status === 'approved' ? 'bg-emerald-500' :
                    afp.status === 'submitted' ? 'bg-blue-500' :
                    afp.status === 'pending_review' ? 'bg-amber-500' :
                    afp.status === 'invoiced' ? 'bg-violet-500' :
                    'bg-slate-400'
                  }`} />
                  {afp.status === 'draft' ? 'Draft' : afp.status === 'pending_review' ? 'Pending Review' : afp.status === 'submitted' ? 'Submitted' : afp.status === 'approved' ? 'Approved' : afp.status === 'invoiced' ? 'Invoiced' : 'Draft'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Clock className="w-3 h-3" />
                  {fmtDate(afp.period_start_date)} → {fmtDate(afp.period_end_date)}
                </span>
                {afp.final_payment_notice_date && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                    <PoundSterling className="w-2.5 h-2.5" /> Pay by {fmtDate(afp.final_payment_notice_date)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Visual stat tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-4">
          <StatTile label="Claimed" value={fmt(claimed)} icon={TrendingUp} gradient="stat-gradient-blue" delay={0} />
          <StatTile label="Assessed" value={fmt(assessed)} icon={CheckCircle2} gradient="stat-gradient-emerald" delay={0.05} />
          <StatTile label="Agreed" value={fmt(agreed)} icon={PoundSterling} gradient="stat-gradient-brand" delay={0.1} />
          <StatTile label="Balance" value={fmt(balance)} icon={AlertTriangle} gradient="stat-gradient-amber" delay={0.15} />
        </div>

        {/* ── Progress bar: Claimed vs Assessed vs Agreed ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Client Assessment Progress</span>
            <span className="text-[11px] font-bold text-slate-700 tabular-nums">{assessedPct}%</span>
          </div>
          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${agreedPct}%` }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${assessedPct}%` }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-300 to-emerald-400 rounded-full opacity-40"
            />
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#2E5A1A]" /> Agreed ({agreedPct}%)
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400 opacity-60" /> Assessed ({assessedPct}%)
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> Claimed: {fmt(claimed)}
            </span>
          </div>
        </div>

        {/* ── Category breakdown bar ── */}
        {categoryBreakdown.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Category Breakdown</span>
              <span className="text-[11px] text-slate-400">{itemCount} items</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
              {categoryBreakdown.map((c, i) => (
                <motion.div
                  key={c.cat}
                  initial={{ width: 0 }}
                  animate={{ width: `${c.pct}%` }}
                  transition={{ duration: 0.5, delay: 0.1 * i, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${c.meta.color}`}
                  title={`${c.meta.label}: ${c.count} items`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {categoryBreakdown.map(c => (
                <span key={c.cat} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.meta.bg} ${c.meta.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.meta.dot}`} />
                  {c.meta.label} · {c.count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Dispute indicator + source freshness ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {disputed > 0 ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="text-xs font-bold text-rose-700">{fmt(disputed)} disputed</span>
              <span className="text-[10px] text-rose-500">({disputePct}% of claimed)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">No disputes</span>
            </div>
          )}

          {freshness && Object.keys(freshness).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(freshness).slice(0, 4).map(([source, count]) => (
                <span key={source} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-100">
                  <Layers className="w-2.5 h-2.5" />
                  {source === 'driller_log' ? 'Driller' : source === 'delivery' ? 'Delivery' : source === 'timesheet' ? 'Timesheet' : source === 'subcontractor' ? 'Subcon' : source === 'manual' ? 'Manual' : source === 'afp_upload' ? 'Upload' : source}
                  <span className="font-bold text-slate-700">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {afp.variation_count > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
            <GitBranch className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-bold text-violet-700">{afp.variation_count} Variation{afp.variation_count !== 1 ? 's' : ''}</span>
            <ArrowRight className="w-3 h-3 text-violet-400" />
            <span className="text-xs text-violet-600">See Variations tab</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, gradient, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={`${gradient} rounded-xl p-2.5 sm:p-3 flex items-center gap-2 shadow-md`}
    >
      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{label}</p>
        <p className="text-sm sm:text-base font-extrabold text-white tabular-nums truncate">{value}</p>
      </div>
    </motion.div>
  );
}