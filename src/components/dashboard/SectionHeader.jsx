import React from 'react';
import { ChevronDown } from 'lucide-react';

const ACCENTS = {
  green: { bg: 'from-[#2E5A1A] to-[#1c4a12]', ring: 'ring-white/20' },
  blue:  { bg: 'from-[#1e3a8a] to-[#1e40af]', ring: 'ring-white/20' },
  rose:  { bg: 'from-[#9f1239] to-[#881337]', ring: 'ring-white/20' },
};

/**
 * SectionHeader — a sticky, collapsible band that groups dashboard blocks.
 * Operations = green, Financial = blue, Safety & Compliance = rose.
 */
export default function SectionHeader({ title, icon: Icon, accent, collapsed, onToggle, visibleCount }) {
  const a = ACCENTS[accent] || ACCENTS.green;
  return (
    <div className="sticky top-0 z-20 mb-3">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r ${a.bg} text-white shadow-md hover:shadow-lg transition`}
      >
        <div className={`w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 ring-1 ${a.ring}`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h2 className="text-base font-bold tracking-tight leading-tight truncate">{title}</h2>
          <p className="text-[11px] text-white/70 leading-tight">{visibleCount} block{visibleCount !== 1 ? 's' : ''}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-white/70 transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}