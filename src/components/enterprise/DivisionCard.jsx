import React from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { STATUS_STYLES } from './enterpriseConstants';
import { DIVISION_TYPE_LABELS } from '@/components/wizard/divisionWizardData';

/**
 * DivisionCard — compact Level-2 card for a business stream (operating entity).
 * Visually lighter than BusinessUnitCard: smaller gradient header with
 * "Business Stream" label, compact 4-tile stat grid (crew, active jobs, fleet,
 * outstanding £). The distinct counter style reinforces the BU ≠ Stream hierarchy.
 */
export default function DivisionCard({ ds, onEnter }) {
  const d = ds.division;
  const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
  const divColor = d.color || '#2E5A1A';
  const headerGradient = `linear-gradient(135deg, ${divColor}, ${divColor}cc)`;
  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

  return (
    <button
      onClick={() => onEnter(d)}
      className="hub-glass relative rounded-2xl overflow-hidden text-left group w-full"
    >
      {/* Compact gradient header — lighter than BU card */}
      <div className="h-14 sm:h-16 px-4 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-white/30">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] text-white/60 font-bold uppercase tracking-widest leading-none mb-0.5">Business Stream</p>
            <h3 className="text-sm sm:text-base font-extrabold text-white truncate drop-shadow-sm leading-tight">{d.name}</h3>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body — compact stat tiles, distinct from BU card's staff hero */}
      <div className="p-3 sm:p-3.5">
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          <StatTile value={ds.activeStaff} label="Crew" />
          <StatTile value={ds.activeJobs} label="Active" />
          <StatTile value={ds.vehiclesCount} label="Fleet" />
          <StatTile value={gbp(ds.outstanding)} label="Outstanding" small />
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} · {d.code}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
            Enter <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function StatTile({ value, label, small }) {
  return (
    <div className="bg-slate-50 rounded-lg p-1.5 text-center">
      <p className={`font-extrabold text-slate-900 tabular-nums truncate ${small ? 'text-[10px] sm:text-xs' : 'text-sm sm:text-base'}`}>{value}</p>
      <p className="text-[8px] text-slate-400 uppercase font-bold mt-0.5">{label}</p>
    </div>
  );
}