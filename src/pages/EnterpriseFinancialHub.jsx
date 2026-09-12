import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, TrendingUp, AlertTriangle, FileText, Wallet, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import KpiSkeleton from '@/components/enterprise/KpiSkeleton';
import SectionTitle from '@/components/enterprise/SectionTitle';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import { useDivision } from '@/contexts/DivisionContext';

const gbp = (n) => n != null ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

export default function EnterpriseFinancialHub() {
  const { permittedDivisions } = useDivision();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['ent-stats'],
    queryFn: async () => { const res = await base44.functions.invoke('getEnterpriseStats'); return res.data; },
    refetchOnMount: true,
  });

  const g = statsData?.globalStats || {};
  const divisionStats = (statsData?.divisionStats || []).filter(ds =>
    permittedDivisions.some(d => d.id === ds.division.id)
  );

  const kpis = [
    { label: 'Revenue', value: gbp(g.totalRevenue), icon: TrendingUp, gradient: 'stat-gradient-emerald' },
    { label: 'Outstanding', value: gbp(g.totalOutstanding), icon: AlertTriangle, gradient: 'stat-gradient-rose' },
    { label: 'Overdue', value: gbp(g.overdueAmount), icon: FileText, gradient: 'stat-gradient-amber' },
    { label: 'Total Invoiced', value: gbp(g.totalInvoiced), icon: PoundSterling, gradient: 'stat-gradient-blue' },
  ];

  return (
    <EnterpriseHubShell
      title="Financial Performance"
      subtitle="Revenue, margins and outstanding across all business streams"
      icon={PoundSterling}
      accent="#10b981"
    >
      {/* KPI Row */}
      {isLoading ? <KpiSkeleton count={4} /> : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
            className={`${k.gradient} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 shadow-lg relative overflow-hidden`}
          >
            <div className="absolute right-0 top-0 opacity-15">
              <k.icon className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <k.icon className="w-4 h-4 text-white" />
            </div>
            <div className="relative min-w-0">
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{k.label}</p>
              <p className="text-base sm:text-lg font-extrabold text-white tabular-nums truncate">{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* Cash Flow */}
      <div className="hub-glass rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={Wallet} title="Cash Flow Overview" subtitle="Projected cash position and outstanding receivables" gradient="from-emerald-500 to-teal-600" />
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <div className="bg-emerald-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <Wallet className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{gbp(g.cashFlowProjected)}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Projected Cash Flow</p>
          </div>
          <div className="bg-rose-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <AlertTriangle className="w-5 h-5 text-rose-600 mb-2" />
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{gbp(g.totalOutstanding)}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Outstanding Invoices</p>
          </div>
        </div>
      </div>

      {/* Per-Stream Financials */}
      <div className="hub-glass rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={BarChart3} title="Financials by Stream" subtitle="Revenue and outstanding per business stream" gradient="from-violet-500 to-purple-600" />
        {isLoading ? (
          <WidgetLoadingState rows={3} variant="list" />
        ) : divisionStats.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No business streams available.</p>
        ) : (
          <div className="space-y-2">
            {divisionStats.map((ds, i) => (
              <motion.div
                key={ds.division.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition border border-slate-100"
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ background: ds.division.color || '#2E5A1A' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{ds.division.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{ds.division.code}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <StreamFinancial value={gbp(ds.revenue)} label="Revenue" color="text-emerald-600" />
                  <StreamFinancial value={gbp(ds.outstanding)} label="Outstanding" color="text-rose-600" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </EnterpriseHubShell>
  );
}

function StreamFinancial({ value, label, color }) {
  return (
    <div className="text-right">
      <p className={`text-sm sm:text-base font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}