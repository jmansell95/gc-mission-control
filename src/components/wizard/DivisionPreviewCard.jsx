import React from 'react';
import { Building2 } from 'lucide-react';
import { HUB_LABELS } from './divisionWizardData';

/**
 * Live preview card — mirrors the division card shown on the Enterprise
 * Dashboard. Updates in real time as the wizard state changes.
 */
export default function DivisionPreviewCard({ form }) {
  const color = form.color || '#475569';
  const hubs = (form.enabled_hubs || []).slice(0, 6);
  const name = form.name?.trim() || 'Your Business Stream';
  const code = form.code?.toUpperCase() || 'NEW';
  const typeLabel = form.division_type ? form.division_type.charAt(0).toUpperCase() + form.division_type.slice(1) : 'General';

  return (
    <div className="hub-glass relative rounded-2xl overflow-hidden">
      <div className="h-20 px-5 flex items-center justify-between relative overflow-hidden" style={{ background: 'linear-gradient(90deg, ' + color + ', ' + color + '99)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white truncate drop-shadow-sm">{name}</h3>
            <p className="text-[11px] text-white/80 font-semibold uppercase tracking-wide">{typeLabel} {'\u00B7'} {code}</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Setup
        </span>
      </div>
      <div className="p-5">
        {form.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mb-3">{form.tagline}</p>}
        <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
          {hubs.length === 0 ? (
            <span className="text-[10px] text-slate-400 italic">No hubs selected yet</span>
          ) : hubs.map(h => (
            <span key={h} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">{HUB_LABELS[h] || h}</span>
          ))}
          {(form.enabled_hubs || []).length > 6 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{(form.enabled_hubs || []).length - 6}</span>
          )}
        </div>
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Live Preview</span>
        </div>
      </div>
    </div>
  );
}