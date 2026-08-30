import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Truck, Package, Wrench, MapPin, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import { useDivision } from '@/contexts/DivisionContext';

export default function EnterpriseOperationsHub() {
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
    { label: 'Active Jobs', value: g.activeJobs || 0, icon: Activity, gradient: 'stat-gradient-amber' },
    { label: 'Active Deliveries', value: g.activeDeliveries || 0, icon: Package, gradient: 'stat-gradient-blue' },
    { label: 'Rigs Deployed', value: g.rigsDeployed || 0, icon: Wrench, gradient: 'stat-gradient-brand' },
    { label: 'Fleet Utilisation', value: `${g.fleetUtilisation || 0}%`, icon: TrendingUp, gradient: 'stat-gradient-emerald' },
  ];

  return (
    <EnterpriseHubShell
      title="Operations & Logistics"
      subtitle="Live operational picture across all business streams"
      icon={Activity}
      accent="#0ea5e9"
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
              <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums truncate">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery Status */}
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={Package} title="Delivery Status" subtitle="Live delivery pipeline across all streams" gradient="from-blue-500 to-cyan-600" />
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          <StatusTile label="Active" value={g.activeDeliveries || 0} icon={Clock} color="blue" />
          <StatusTile label="Completed" value={g.completedDeliveries || 0} icon={CheckCircle2} color="emerald" />
          <StatusTile label="Pending TS" value={g.pendingTs || 0} icon={AlertTriangle} color="amber" />
        </div>
      </div>

      {/* Per-Stream Operations */}
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={MapPin} title="Operations by Stream" subtitle="Active jobs, deliveries and rigs per business stream" gradient="from-amber-500 to-orange-600" />
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
                  <p className="text-[11px] text-slate-500 truncate">{ds.division.code} · {ds.division.division_type}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <StreamStat value={ds.activeJobs} label="Jobs" />
                  <StreamStat value={ds.pendingDeliveries} label="Deliveries" />
                  <StreamStat value={ds.rigsDeployed} label="Rigs" />
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

function StatusTile({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${colors[color] || colors.blue}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <p className="text-xl sm:text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function StreamStat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}