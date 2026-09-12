import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Building2, ArrowRight } from 'lucide-react';

/**
 * CreationChoiceModal — two-card picker shown when the user clicks
 * "Add a Business Unit or Business Stream". Picking a card closes this modal and
 * opens the corresponding popup (BU identity form or full Business Stream wizard).
 */
export default function CreationChoiceModal({ onClose, onPickBU, onPickDivision }) {
  return (
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">What would you like to create?</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Choose the type of workspace to set up</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Two cards */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <ChoiceCard
            icon={Layers}
            title="Business Unit"
            description="A top-level container that houses specialist business streams. Start here if you're adding a new operating brand."
            accent="#2E5A1A"
            onClick={onPickBU}
          />
          <ChoiceCard
            icon={Building2}
            title="Business Stream"
            description="A specialist operational workspace inside a business unit, with its own hubs, staff and fleet."
            accent="#0ea5e9"
            onClick={onPickDivision}
          />
        </div>
      </motion.div>
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, description, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="hub-glass relative rounded-2xl p-5 text-left group overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(to right, ${accent}, ${accent}66)` }} />
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-sm" style={{ background: `${accent}15` }}>
        <Icon className="w-6 h-6" style={{ color: accent }} />
      </div>
      <h4 className="text-base font-extrabold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed mb-3">{description}</p>
      <span className="inline-flex items-center gap-1 text-sm font-bold group-hover:gap-2 transition-all" style={{ color: accent }}>
        Create <ArrowRight className="w-4 h-4" />
      </span>
    </button>
  );
}