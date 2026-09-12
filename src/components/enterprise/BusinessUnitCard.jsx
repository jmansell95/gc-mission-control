import React from 'react';
import { ArrowRight, Layers, Users, Briefcase, PoundSterling, ChevronRight } from 'lucide-react';
import { STATUS_STYLES } from './enterpriseConstants';

/**
 * BusinessUnitCard — prominent Level-1 card for a top-level business unit
 * (holding group). Visually heavier than DivisionCard: large gradient header
 * with "Business Unit" label, stream-count badge, and a row of rolled-up
 * aggregate counters (streams, staff, active jobs, outstanding £) that are
 * distinct from the per-stream operating counters on DivisionCard.
 */
export default function BusinessUnitCard({ unit, childStats, onEnter }) {
  const d = unit;
  const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
  const divColor = d.color || '#2E5A1A';
  const headerGradient = `linear-gradient(135deg, ${divColor}, ${divColor}dd)`;
  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

  const totalStaff = childStats.reduce((s, c) => s + (c.staffCount || 0), 0);
  const totalActive = childStats.reduce((s, c) => s + (c.activeStaff || 0), 0);
  const totalActiveJobs = childStats.reduce((s, c) => s + (c.activeJobs || 0), 0);
  const totalOutstanding = childStats.reduce((s, c) => s + (c.outstanding || 0), 0);
  const childCount = childStats.length;

  return (
    <button
      onClick={() => onEnter(d)}
      className="hub-glass relative rounded-3xl overflow-hidden text-left group w-full"
    >
      {/* Gradient header — large, with BU label and stream count */}
      <div className="h-20 sm:h-24 px-5 sm:px-6 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />
        <div className="absolute right-3 top-3 opacity-15">
          <Layers className="w-14 h-14 text-white" />
        </div>
        <div className="relative flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Layers className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-widest">Business Unit</p>
            <h3 className="text-base sm:text-xl font-extrabold text-white truncate drop-shadow-sm leading-tight">{d.name}</h3>
            <p className="text-[10px] sm:text-xs text-white/80 font-semibold truncate mt-0.5">{childCount} business streams housed</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {d.tagline && <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mb-3 sm:mb-4">{d.tagline}</p>}

        {/* Rolled-up aggregate counters — BU-level, distinct from stream stat tiles */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <AggCounter value={childCount} label="Streams" icon={Layers} color={divColor} />
          <AggCounter value={totalStaff} label="Crew" icon={Users} color={divColor} />
          <AggCounter value={totalActiveJobs} label="Jobs" icon={Briefcase} color={divColor} />
          <AggCounter value={gbp(totalOutstanding)} label="Outstanding" icon={PoundSterling} color={divColor} small />
        </div>

        {/* Active staff highlight */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-slate-500 font-semibold">Active crew:</span>
          <span className="text-sm font-extrabold text-emerald-600 tabular-nums">{totalActive}</span>
          <span className="text-[11px] text-slate-400">of {totalStaff}</span>
        </div>

        {/* Division preview strip */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Business Streams</p>
          {childStats.slice(0, 4).map((c) => (
            <div key={c.division.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 group-hover:bg-white transition">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.division.color || divColor }} />
                <span className="text-xs font-semibold text-slate-700 truncate">{c.division.name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-extrabold text-slate-900 tabular-nums">{c.staffCount}</span>
                <span className="text-[10px] text-slate-400">crew</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">View all business streams</span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
            Drill Down <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function AggCounter({ value, label, icon: Icon, color, small }) {
  return (
    <div className="flex flex-col items-center text-center p-2 rounded-xl" style={{ background: `${color}08` }}>
      <Icon className="w-3.5 h-3.5 mb-1 opacity-50" style={{ color }} />
      <p className={`font-extrabold text-slate-900 tabular-nums leading-none truncate w-full ${small ? 'text-[10px] sm:text-xs' : 'text-sm sm:text-lg'}`}>{value}</p>
      <p className="text-[8px] sm:text-[9px] text-slate-500 uppercase font-bold mt-1">{label}</p>
    </div>
  );
}