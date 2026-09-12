import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, FileX, HeartPulse, Award, Siren, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import KpiSkeleton from '@/components/enterprise/KpiSkeleton';
import SectionTitle from '@/components/enterprise/SectionTitle';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import { useDivision } from '@/contexts/DivisionContext';

export default function EnterpriseComplianceHub() {
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
    { label: 'Pass Rate', value: `${g.compliancePassRate || 100}%`, icon: Award, gradient: 'stat-gradient-emerald' },
    { label: 'Expired', value: g.openCompliance || 0, icon: FileX, gradient: 'stat-gradient-rose' },
    { label: 'Expiring Soon', value: g.expiringCompliance || 0, icon: AlertTriangle, gradient: 'stat-gradient-amber' },
    { label: 'Open Incidents', value: g.openIncidents || 0, icon: Siren, gradient: 'stat-gradient-orange' },
  ];

  return (
    <EnterpriseHubShell
      title="Compliance & Safety"
      subtitle="Enterprise-wide compliance status, incidents and safety scores"
      icon={ShieldCheck}
      accent="#7c3aed"
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

      {/* Safety Summary */}
      <div className="hub-glass rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={HeartPulse} title="Safety Summary" subtitle="Open incidents and critical alerts across all streams" gradient="from-rose-500 to-red-600" />
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {/* Compliance pass rate ring */}
          <div className="flex flex-col items-center justify-center bg-emerald-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#d1d5db" strokeWidth="3" />
                <motion.circle
                  cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(g.compliancePassRate || 100) * 0.942} 100`}
                  initial={{ strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${(g.compliancePassRate || 100) * 0.942} 100` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm sm:text-base font-extrabold text-emerald-700 tabular-nums">{g.compliancePassRate || 100}%</span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1.5 text-center">Pass Rate</p>
          </div>
          <div className="bg-rose-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <Siren className="w-5 h-5 text-rose-600 mb-2" />
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{g.openIncidents || 0}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Open Incidents</p>
          </div>
          <div className="bg-red-100 rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <AlertTriangle className="w-5 h-5 text-red-700 mb-2" />
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">{g.criticalIncidents || 0}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Critical Alerts</p>
          </div>
        </div>
      </div>

      {/* Per-Stream Compliance */}
      <div className="hub-glass rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={ShieldCheck} title="Compliance by Stream" subtitle="Expired certs, expiring items and open incidents per stream" gradient="from-violet-500 to-purple-600" />
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
                  <StreamStat value={ds.expiredCompliance} label="Expired" color="text-rose-600" />
                  <StreamStat value={ds.expiringCompliance} label="Expiring" color="text-amber-600" />
                  <StreamStat value={ds.openIncidents} label="Incidents" color="text-red-600" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </EnterpriseHubShell>
  );
}

function StreamStat({ value, label, color }) {
  return (
    <div className="text-center">
      <p className={`text-base sm:text-lg font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}