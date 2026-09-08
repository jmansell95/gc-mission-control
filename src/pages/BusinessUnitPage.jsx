import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Layers, Users, Briefcase, Truck, PoundSterling,
  ArrowRight, Building2, CheckCircle2, Activity, ChevronRight,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import DivisionLoadingScreen from '@/components/divisionLoading/DivisionLoadingScreen';
import { STATUS_STYLES } from '@/components/enterprise/enterpriseConstants';
import { DIVISION_TYPE_LABELS } from '@/components/wizard/divisionWizardData';

export default function BusinessUnitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { divisions, permittedDivisions, setActiveDivision } = useDivision();
  const [enteringDivision, setEnteringDivision] = useState(null);

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['ent-stats'],
    queryFn: async () => { const res = await base44.functions.invoke('getEnterpriseStats'); return res.data; },
    refetchOnMount: true,
  });

  const bu = useMemo(() => permittedDivisions.find(d => d.id === id), [permittedDivisions, id]);

  const childDivisions = useMemo(
    () => permittedDivisions.filter(d => d.parent_division_id === id),
    [permittedDivisions, id]
  );

  const divisionStats = useMemo(() => {
    const all = statsData?.divisionStats || [];
    return childDivisions.map(d => {
      const s = all.find(x => x.division.id === d.id);
      return s
        ? { division: d, staffCount: s.staffCount, activeStaff: s.activeStaff, jobsCount: s.jobsCount, activeJobs: s.activeJobs, vehiclesCount: s.vehiclesCount, outstanding: s.outstanding }
        : { division: d, staffCount: 0, activeStaff: 0, jobsCount: 0, activeJobs: 0, vehiclesCount: 0, outstanding: 0 };
    });
  }, [childDivisions, statsData]);

  // Aggregated BU stats = sum of all child divisions
  const buStats = useMemo(() => ({
    staff: divisionStats.reduce((s, d) => s + d.staffCount, 0),
    activeStaff: divisionStats.reduce((s, d) => s + d.activeStaff, 0),
    activeJobs: divisionStats.reduce((s, d) => s + d.activeJobs, 0),
    jobs: divisionStats.reduce((s, d) => s + d.jobsCount, 0),
    vehicles: divisionStats.reduce((s, d) => s + d.vehiclesCount, 0),
    outstanding: divisionStats.reduce((s, d) => s + (d.outstanding || 0), 0),
    divisionCount: childDivisions.length,
  }), [divisionStats, childDivisions]);

  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';
  const divColor = bu?.color || '#2E5A1A';

  const enterDivision = (d) => setEnteringDivision(d);

  const handleLoadingComplete = () => {
    if (enteringDivision) {
      const d = enteringDivision;
      setEnteringDivision(null);
      setActiveDivision(d.id);
      navigate(d.landing_page || '/admin', { state: { section: 'overview' } });
    }
  };

  if (isLoading) {
    const buName = bu?.name || 'Business Unit';
    const buColor = bu?.color || '#2E5A1A';
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: `${buColor}33`, borderTopColor: buColor }} />
        <p className="text-sm font-bold text-slate-500">Loading {buName}</p>
      </div>
    );
  }

  if (!bu) {
    return (
      <div className="min-h-screen page-bg-vibrant flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-semibold">Business unit not found.</p>
          <button onClick={() => navigate('/enterprise')} className="mt-3 text-sm font-bold text-[#2E5A1A]">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* ─── BU Hero ─── */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${divColor} 0%, ${divColor}dd 50%, #0a120a 100%)` }} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(141,198,63,0.4) 0%, transparent 50%)' }} />
        <div className="relative px-4 lg:px-6 pt-4 lg:pt-6 pb-5 lg:pb-6 safe-area-top">
          <div className="max-w-7xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => {
                const state = window.history.state;
                const hasHistory = state && typeof state.idx === 'number' && state.idx > 0;
                navigate(hasHistory ? -1 : '/enterprise');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Ground Control
            </button>

            {/* BU title */}
            <div className="flex items-center gap-3 sm:gap-4 mb-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/20">
                <Layers className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-white/60 font-bold uppercase tracking-widest mb-0.5">Business Unit</p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-none truncate">{bu.name}</h1>
                {bu.tagline && <p className="text-xs sm:text-sm text-white/70 font-semibold mt-1 truncate">{bu.tagline}</p>}
              </div>
            </div>

            {/* Aggregated BU KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {[
                { label: 'Total Crew', value: buStats.staff, sub: `${buStats.activeStaff} active`, icon: Users, gradient: 'stat-gradient-blue' },
                { label: 'Active Jobs', value: buStats.activeJobs, sub: `${buStats.jobs} total`, icon: Briefcase, gradient: 'stat-gradient-amber' },
                { label: 'Fleet', value: buStats.vehicles, sub: 'vehicles', icon: Truck, gradient: 'stat-gradient-teal' },
                { label: 'Outstanding', value: gbp(buStats.outstanding), sub: 'invoices', icon: PoundSterling, gradient: 'stat-gradient-rose' },
              ].map(m => (
                <div key={m.label} className={`${m.gradient} rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-lg`}>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <m.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{m.label}</p>
                      <p className="text-base sm:text-xl font-extrabold text-white tabular-nums truncate">{m.value}</p>
                    </div>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-white/70 mt-1.5 ml-1 truncate">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Division Breakdown ─── */}
      <div className="px-4 lg:px-6 pb-24 xl:pb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 mt-6 sm:mt-8 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Business Streams</h2>
            <p className="text-xs text-slate-500">{buStats.divisionCount} specialist business streams within {bu.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {divisionStats.map((ds, i) => {
            const d = ds.division;
            const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
            const dColor = d.color || '#2E5A1A';
            return (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
                onClick={() => enterDivision(d)}
                className="insight-card relative rounded-2xl overflow-hidden text-left group w-full"
              >
                {/* Color accent bar */}
                <div className="h-1.5" style={{ background: `linear-gradient(to right, ${dColor}, ${dColor}88)` }} />

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: `${dColor}18` }}>
                        <Building2 className="w-5 h-5" style={{ color: dColor }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{d.name}</h3>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide truncate">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} · {d.code}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${st.bg} ${st.text} ring-1 ${st.ring} flex-shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                    </span>
                  </div>

                  {d.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mb-3">{d.tagline}</p>}

                  {/* Staff highlighted per the PRD */}
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    <div className="col-span-2 rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${dColor}, ${dColor}cc)` }}>
                      <p className="text-[9px] font-bold text-white/80 uppercase tracking-wide">Staff</p>
                      <p className="text-xl font-extrabold tabular-nums leading-tight">{ds.staffCount}</p>
                      <p className="text-[9px] text-white/70">{ds.activeStaff} active</p>
                    </div>
                    <MiniStat value={ds.activeJobs} label="Jobs" />
                    <MiniStat value={ds.vehiclesCount} label="Fleet" />
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
                    <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
                      Enter Business Stream <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {enteringDivision && (
          <DivisionLoadingScreen division={enteringDivision} onComplete={handleLoadingComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
      <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{value}</p>
      <p className="text-[8px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}