import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Truck, Package, Wrench, MapPin, Clock, CheckCircle2, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import KpiSkeleton from '@/components/enterprise/KpiSkeleton';
import SectionTitle from '@/components/enterprise/SectionTitle';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
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
  // Drilling/rigs is exclusive to the Geotechnical business stream — other
  // streams and BUs do not deploy rigs, so rig-related KPIs and per-stream
  // stats are only surfaced when at least one permitted division is geotechnical.
  const hasGeotechnical = permittedDivisions.some(d => d.division_type === 'geotechnical');

  const kpis = [
    { label: 'Active Jobs', value: g.activeJobs || 0, icon: Activity, gradient: 'stat-gradient-amber' },
    { label: 'Active Deliveries', value: g.activeDeliveries || 0, icon: Package, gradient: 'stat-gradient-blue' },
    ...(hasGeotechnical ? [{ label: 'Rigs Deployed', value: g.rigsDeployed || 0, icon: Wrench, gradient: 'stat-gradient-brand' }] : []),
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
              <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums truncate">{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
      )}

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
                  <p className="text-[11px] text-slate-500 truncate">{ds.division.code} · {ds.division.division_type}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <StreamStat value={ds.activeJobs} label="Jobs" />
                  <StreamStat value={ds.pendingDeliveries} label="Deliveries" />
                  {ds.division.division_type === 'geotechnical' && <StreamStat value={ds.rigsDeployed} label="Rigs" />}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </EnterpriseHubShell>
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