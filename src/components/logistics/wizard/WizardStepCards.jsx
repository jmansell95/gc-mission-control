import React from 'react';
import { Package, ShoppingCart, PencilLine, Layers, Upload, Truck, HardHat, UserCheck, ChevronRight } from 'lucide-react';

/**
 * WizardStepCards — reusable large tappable card grid for wizard selection steps.
 * Used by the Splash (Single/Multiple), Method (Manual/Rate Cards), and
 * Source (Purchased/Hired/Client Supplied) screens.
 *
 * Props:
 *  - options: [{ id, label, description, icon, disabled?, badge? }]
 *  - onSelect: (id) => void
 */
export default function WizardStepCards({ options, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
      {options.map(opt => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => !opt.disabled && onSelect(opt.id)}
            disabled={opt.disabled}
            className={`group relative text-left rounded-2xl border-2 p-5 transition-all animate-slide-up ${
              opt.disabled
                ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-md active:scale-[0.98]'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                opt.disabled ? 'bg-slate-200' : 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] shadow-md'
              }`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{opt.label}</h3>
                  {opt.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{opt.badge}</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-snug">{opt.description}</p>
              </div>
              {!opt.disabled && (
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition flex-shrink-0 mt-1" />
              )}
            </div>
            {opt.disabled && (
              <p className="text-[11px] text-slate-400 mt-2 italic">Not available for this method</p>
            )}
          </button>
        );
      })}
    </div>
  );
}