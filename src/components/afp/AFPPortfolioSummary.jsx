import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, CheckCircle2, PoundSterling, AlertTriangle,
  FileText, Clock, ArrowRight, Layers, Receipt,
} from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

const STATUS_META = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  pending_review: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  invoiced: { label: 'Invoiced', color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
};

/**
 * AFPPortfolioSummary — combined overview of ALL AFPs for a job.
 * Sits at the top of the Financials tab. Auto-calculates combined totals
 * (claimed, assessed, agreed, balance remaining, contract value) from live
 * AFP + AFPLineItem data. Clicking an AFP card drills into it below.
 */
export default function AFPPortfolioSummary({ job, onSelectAfp }) {
  const { data: afps = [], isLoading } = useQuery({
    queryKey: ['afp', job?.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50),
    enabled: !!job?.id,
  });

  // Fetch line items for ALL AFPs to calculate accurate combined balances
  const afpIds = useMemo(() => afps.map(a => a.id), [afps]);
  const { data: allLineItems = [] } = useQuery({
    queryKey: ['afp-portfolio-line-items', job?.id],
    queryFn: async () => {
      if (!afpIds.length) return [];
      const results = await Promise.all(
        afpIds.map(id => base44.entities.AFPLineItem.filter({ afp_id: id }, 'source_date', 500))
      );
      return results.flat();
    },
    enabled: afpIds.length > 0,
  });

  // Combined totals across all AFPs
  const portfolioTotals = useMemo(() => {
    let totalClaimed = 0, totalAssessed = 0, totalAgreed = 0, totalDisputed = 0, totalBalance = 0;
    for (const afp of afps) {
      totalClaimed += Number(afp.total_claimed) || 0;
      totalAgreed += Number(afp.agreed_total) || 0;
      totalDisputed += Number(afp.disputed_total) || 0;
    }
    // Balance from line items (contracted amount - gross applied)
    for (const li of allLineItems) {
      const balance = Number(li.balance_value) || Math.max(0, (Number(li.amount) || 0) - (Number(li.gross_applied) || 0));
      totalBalance += balance;
      totalAssessed += Number(li.assessed_in_period) || Number(li.agreed_amount) || 0;
    }
    const contractValue = Number(job?.budget_amount) || afps.reduce((s, a) => s + (Number(a.contract_value) || 0), 0);
    return { totalClaimed, totalAssessed, totalAgreed, totalDisputed, totalBalance, contractValue };
  }, [afps, allLineItems, job]);

  const claimedPct = portfolioTotals.contractValue > 0
    ? Math.min(100, Math.round((portfolioTotals.totalClaimed / portfolioTotals.contractValue) * 100))
    : 0;
  const agreedPct = portfolioTotals.totalClaimed > 0
    ? Math.min(100, Math.round((portfolioTotals.totalAgreed / portfolioTotals.totalClaimed) * 100))
    : 0;
  const assessedPct = portfolioTotals.totalClaimed > 0
    ? Math.min(100, Math.round((portfolioTotals.totalAssessed / portfolioTotals.totalClaimed) * 100))
    : 0;

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-6">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (afps.length === 0) {
    return null; // AFPBuilder shows the empty/create state
  }

  return (
    <div className="space-y-3">
      {/* ── Portfolio Hero ── */}
      <div className="insight-card rounded-2xl overflow-hidden">
        {/* Gradient strip */}
        <div className="relative h-2 bg-gradient-to-r from-[#2E5A1A] via-[#5A8C1E] to-[#8DC63F]" />

        <div className="relative px-4 py-4 sm:px-5 sm:py-5">
          {/* Decorative mesh */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 10% 20%, #2E5A1A 0%, transparent 40%), radial-gradient(circle at 90% 80%, #8DC63F 0%, transparent 40%)',
          }} />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-lg flex-shrink-0">
                <Layers className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  AFP Portfolio <span className="text-slate-400 font-bold">·</span> <span className="text-slate-700">{job.name}</span>
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                    <FileText className="w-3 h-3" /> {afps.length} AFP{afps.length !== 1 ? 's' : ''}
                  </span>
                  {portfolioTotals.contractValue > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-bold">
                      <Receipt className="w-3 h-3" /> Contract {fmt(portfolioTotals.contractValue)}
                    </span>
                  )}
                  {portfolioTotals.totalDisputed > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" /> {fmt(portfolioTotals.totalDisputed)} disputed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Large Stat Tiles ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
            <PortfolioStatTile label="Total Claimed" value={portfolioTotals.totalClaimed} icon={TrendingUp} gradient="stat-gradient-blue" delay={0} />
            <PortfolioStatTile label="Client Assessed" value={portfolioTotals.totalAssessed} icon={CheckCircle2} gradient="stat-gradient-emerald" delay={0.05} />
            <PortfolioStatTile label="Agreed" value={portfolioTotals.totalAgreed} icon={PoundSterling} gradient="stat-gradient-brand" delay={0.1} />
            <PortfolioStatTile label="Balance Remaining" value={portfolioTotals.totalBalance} icon={AlertTriangle} gradient="stat-gradient-amber" delay={0.15} />
          </div>

          {/* ── Combined Progress Bar ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Overall Financial Progress</span>
              <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                {fmt(portfolioTotals.totalClaimed)} of {fmt(portfolioTotals.contractValue)} ({claimedPct}%)
              </span>
            </div>
            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
              {/* Claimed (full bar) */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${claimedPct}%` }}
                transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full opacity-50"
              />
              {/* Assessed (overlaid) */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${assessedPct}%` }}
                transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-300 to-emerald-400 rounded-full opacity-50"
              />
              {/* Agreed (top layer) */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${agreedPct}%` }}
                transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full"
              />
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2E5A1A]" /> Agreed ({agreedPct}%)
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60" /> Assessed ({assessedPct}%)
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-300 opacity-50" /> Claimed ({claimedPct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Individual AFP Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {afps.map((afp, i) => {
          const meta = STATUS_META[afp.status] || STATUS_META.draft;
          const claimed = Number(afp.total_claimed) || 0;
          const agreed = Number(afp.agreed_total) || 0;
          const disputed = Number(afp.disputed_total) || 0;
          const afpAgreedPct = claimed > 0 ? Math.min(100, Math.round((agreed / claimed) * 100)) : 0;
          return (
            <motion.button
              key={afp.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: 'easeOut' }}
              onClick={() => onSelectAfp?.(afp.id)}
              className="insight-card rounded-2xl p-3.5 text-left hover:shadow-lg transition-all active:scale-[0.98] group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${meta.dot} flex-shrink-0`} />
                  <span className="text-sm font-extrabold text-slate-900">AFP {afp.afp_number}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${meta.bg} ${meta.color} flex-shrink-0`}>
                  {meta.label}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2.5">
                <Clock className="w-3 h-3" />
                {fmtDate(afp.period_start_date)} → {fmtDate(afp.period_end_date)}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Claimed</p>
                  <p className="text-sm font-extrabold text-slate-800 tabular-nums">{fmt(claimed)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Agreed</p>
                  <p className="text-sm font-extrabold text-slate-800 tabular-nums">{fmt(agreed)}</p>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${afpAgreedPct}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.04, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full"
                />
              </div>
              {disputed > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[9px] font-bold">
                  <AlertTriangle className="w-2.5 h-2.5" /> {fmt(disputed)} disputed
                </div>
              )}
              <div className="mt-2 flex items-center gap-1 text-[10px] text-[#2E5A1A] font-bold opacity-0 group-hover:opacity-100 transition">
                Open AFP <ArrowRight className="w-3 h-3" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function PortfolioStatTile({ label, value, icon: Icon, gradient, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={`${gradient} rounded-xl p-3 sm:p-3.5 flex items-center gap-2.5 shadow-md`}
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{label}</p>
        <p className="text-base sm:text-lg font-extrabold text-white tabular-nums truncate">
          <AnimatedNumber value={value} format={(v) => fmt(v)} />
        </p>
      </div>
    </motion.div>
  );
}