import React, { useState } from 'react';
import { X, ArrowRightLeft, Loader2, Check } from 'lucide-react';

/**
 * LoanResourceDrawer — mobile-friendly bottom-sheet drawer for loaning a
 * resource (rig/vehicle/staff) to another division. Replaces the cramped
 * inline <select> on the full resource pool page.
 */
export default function LoanResourceDrawer({ resource, resourceType, divisions, currentDivisionId, onLoan, onClose }) {
  const [targetId, setTargetId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!resource) return null;

  const name = resource.name || resource.fleet_number || `${resource.make || ''} ${resource.model || ''}`.trim() || 'Unknown';
  const currentDiv = divisions.find(d => d.id === currentDivisionId);
  const targetDiv = divisions.find(d => d.id === targetId);
  const otherDivisions = divisions.filter(d => d.id !== currentDivisionId);

  const handleConfirm = async () => {
    if (!targetId) return;
    setSubmitting(true);
    try {
      await onLoan(resource.id, resourceType, currentDivisionId, targetId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85dvh] overflow-y-auto safe-area-bottom"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-3 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">Loan Resource</h3>
              <p className="text-xs text-slate-500 truncate">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Current division */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Current Division</p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: currentDiv?.color || '#94a3b8' }} />
              <span className="text-sm font-semibold text-slate-700">{currentDiv?.name || 'Unassigned'}</span>
            </div>
          </div>

          {/* Target picker */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Loan To</p>
            <div className="space-y-1.5">
              {otherDivisions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No other divisions available.</p>
              ) : (
                otherDivisions.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setTargetId(d.id)}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-xl border transition text-left ${
                      targetId === d.id
                        ? 'border-primary bg-emerald-50 ring-1 ring-primary/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color || '#2E5A1A' }} />
                    <span className="text-sm font-semibold text-slate-700 flex-1 min-w-0 truncate">{d.name}</span>
                    {targetId === d.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-5 pb-5 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            onClick={handleConfirm}
            disabled={!targetId || submitting}
            className="w-full command-gradient text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition glow-brand"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Transferring…</>
            ) : (
              <>Loan to {targetDiv?.name || 'Division'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}