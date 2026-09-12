import React from 'react';
import { Building2, Check, Sparkles, Loader2 } from 'lucide-react';
import { DIVISION_TYPE_LABELS } from './divisionWizardData';

/**
 * Template picker — replaces the old static division-type grid.
 * Lets the user pick an existing division to copy all configuration from
 * (hubs, nav, settings, type, colour), or start from scratch with defaults.
 */
export default function TemplatePicker({ divisions, selectedId, onSelect, isLoading }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Start from Scratch */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={'relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition ' + (!selectedId ? 'border-primary bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}
        >
          {!selectedId && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-sm font-bold text-slate-800 mt-1">Start from Scratch</p>
          <p className="text-[10px] text-slate-400 leading-tight">Blank division with default settings</p>
        </button>

        {/* Existing divisions as copy templates */}
        {isLoading
          ? [0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-start gap-1 p-3 rounded-xl border-2 border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-3 w-20 bg-slate-100 rounded animate-pulse mt-1" />
                <div className="h-2 w-16 bg-slate-50 rounded animate-pulse" />
              </div>
            ))
          : divisions.map(d => {
            const active = selectedId === d.id;
            const divColor = d.color || '#2E5A1A';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d)}
                className={'relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition ' + (active ? 'border-primary bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}
              >
                {active && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, ' + divColor + ', ' + divColor + 'cc)' }}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold text-slate-800 mt-1 truncate w-full">{d.name}</p>
                <p className="text-[10px] text-slate-400 leading-tight truncate w-full">
                  {DIVISION_TYPE_LABELS[d.division_type] || d.division_type || 'General'} {'\u00B7'} {(d.enabled_hubs || []).length} hubs
                </p>
              </button>
            );
          })}
      </div>
      {!isLoading && divisions.length === 0 && (
        <p className="text-[11px] text-slate-400 mt-2">No existing divisions yet — start from scratch and your next division will appear here as a template.</p>
      )}
    </div>
  );
}