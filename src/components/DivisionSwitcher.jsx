import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Check, Layers, Plus } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * DivisionSwitcher — a visual control that shows the active division (or
 * "Enterprise Overview") and lets enterprise admins switch between divisions.
 *
 * Variants:
 *  - 'sidebar' (default): full-width button for the desktop sidebar.
 *  - 'header': compact button for the mobile top header.
 *
 * Access tiers:
 *  - Super Admin: sees all divisions + "Manage Divisions" link
 *  - Director: sees only their managed_division_ids + "Enterprise Overview"
 *  - Standard User: static badge (no switching)
 */
export default function DivisionSwitcher({ variant = 'sidebar' }) {
  const navigate = useNavigate();
  const { permittedDivisions, activeDivision, activeDivisionId, setActiveDivision, isEnterpriseAdmin, isSuperAdmin, isLoading } = useDivision();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [open]);

  const select = (id) => {
    setActiveDivision(id);
    setOpen(false);
    navigate(id ? '/admin' : '/enterprise');
  };

  if (isLoading) {
    return variant === 'header'
      ? <div className="h-8 w-8 rounded-lg bg-white/10 animate-pulse" />
      : <div className="mx-2 my-2 h-12 rounded-xl bg-white/10 animate-pulse" />;
  }

  const dot = activeDivision?.color || '#8DC63F';
  const label = activeDivision ? activeDivision.name : 'Enterprise Overview';
  const Icon = activeDivision ? Building2 : Layers;

  // Non-enterprise users: show a static badge (they can't switch).
  if (!isEnterpriseAdmin) {
    return (
      <div className={variant === 'header'
        ? 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 text-white text-xs font-semibold'
        : 'mx-2 my-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 text-white'}>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        <span className="truncate text-sm font-semibold">{label}</span>
      </div>
    );
  }

  const panelCls = variant === 'header'
    ? 'absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50'
    : 'absolute left-2 right-2 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={variant === 'header'
          ? 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-xs font-semibold max-w-[160px]'
          : 'w-full mx-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition'}
        style={{ width: variant === 'header' ? undefined : 'calc(100% - 1rem)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white/30" style={{ background: dot }} />
        <span className="truncate flex-1 text-left text-sm font-semibold">{label}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={panelCls} onClick={(e) => e.stopPropagation()}>
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Switch Business Stream</p>
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            <button
              onClick={() => select(null)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 transition text-left ${!activeDivisionId ? 'bg-emerald-50' : ''}`}>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
                <Layers className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="flex-1 text-slate-700">Enterprise Overview</span>
              {!activeDivisionId && <Check className="w-4 h-4 text-emerald-600" />}
            </button>
            {permittedDivisions.filter(d => d.is_active !== false).map(d => (
              <button
                key={d.id}
                onClick={() => select(d.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 transition text-left"
                style={activeDivisionId === d.id ? { background: `${d.color || '#2E5A1A'}14` } : undefined}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: d.color || '#2E5A1A' }}>
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 truncate">{d.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{d.code || d.division_type}</p>
                </div>
                {activeDivisionId === d.id && <Check className="w-4 h-4" style={{ color: d.color || '#2E5A1A' }} />}
              </button>
            ))}
          </div>
          {isSuperAdmin && (
            <div className="border-t border-slate-100 py-1">
              <button
                onClick={() => { setOpen(false); navigate('/enterprise'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-[#2E5A1A] hover:bg-slate-50 transition text-left">
                <Plus className="w-4 h-4" />
                Manage Business Streams
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}