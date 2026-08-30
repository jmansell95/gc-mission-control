import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertTriangle, FileX, HeartPulse, Award, Siren } from 'lucide-react';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
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

      {/* Safety Summary */}
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={HeartPulse} title="Safety Summary" subtitle="Open incidents and critical alerts across all streams" gradient="from-rose-500 to-red-600" />
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
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
      <div className="insight-card rounded-2xl p-4 sm:p-5">
        <SectionTitle icon={ShieldCheck} title="Compliance by Stream" subtitle="Expired certs, expiring items and open incidents per stream" gradient="from-violet-500 to-purple-600" />
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
                  <StreamStat value={ds.expiredCompliance} label="Expired" color="text-rose-600" />
                  <StreamStat value={ds.expiringCompliance} label="Expiring" color="text-amber-600" />
                  <StreamStat value={ds.openIncidents} label="Incidents" color="text-red-600" />
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

function StreamStat({ value, label, color }) {
  return (
    <div className="text-center">
      <p className={`text-base sm:text-lg font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}