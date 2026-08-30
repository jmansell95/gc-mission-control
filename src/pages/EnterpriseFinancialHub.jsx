import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, TrendingUp, AlertTriangle, FileText, Wallet, BarChart3 } from 'lucide-react';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import { useDivision } from '@/contexts/DivisionContext';

const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

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
    { label: 'Overdue Invoices', value: g.overdueInvoices || 0, icon: FileText, gradient: 'stat-gradient-amber' },
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {kpis.map(k => (
          <div key={k.label} className={`${k.gradient} rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 shadow-lg`}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <k.icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{k.label}</p>
              <p className="text-base sm:text-lg font-extrabold text-white tabular-nums truncate">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cash Flow */}
      <div className="insight-card rounded-2xl p-4 sm:p-5">
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
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={BarChart3} title="Financials by Stream" subtitle="Revenue and outstanding per business stream" gradient="from-violet-500 to-purple-600" />
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : divisionStats.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No business streams available.</p>
        ) : (
          <div className="space-y-2">
            {divisionStats.map(ds => (
              <div key={ds.division.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ds.division.color || '#2E5A1A' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{ds.division.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{ds.division.code}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <StreamFinancial value={gbp(ds.revenue)} label="Revenue" color="text-emerald-600" />
                  <StreamFinancial value={gbp(ds.outstanding)} label="Outstanding" color="text-rose-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EnterpriseHubShell>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, gradient }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{title}</h2>
        {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
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