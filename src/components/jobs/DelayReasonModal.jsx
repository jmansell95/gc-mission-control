import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, ShieldCheck, Loader2, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Popup that records the reason for approving or rejecting a delay,
// then offers a link through to the Compliance Hub.
export default function DelayReasonModal({ open, log, action, onClose, onConfirm }) {
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const isApprove = action === 'approve';

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  const goToCompliance = () => {
    onClose?.();
    navigate('/compliance');
  };

  return (
    <AnimatePresence>
      {open && log && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className={`px-5 py-4 flex items-center gap-3 ${isApprove ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50' : 'bg-gradient-to-r from-red-50 to-red-100/50'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isApprove ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {isApprove ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{isApprove ? 'Approve Delay' : 'Reject Delay'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Record a reason for audit & compliance</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Delay</p>
                <p className="text-sm text-slate-700">{log.description || 'No description'}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {log.impacted_days ? `${log.impacted_days} day(s)` : ''} {log.impacted_hours ? `${log.impacted_hours}h` : ''}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Reason {isApprove ? 'for approval' : 'for rejection'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder={isApprove ? 'e.g. Verified with site agent — ground conditions confirmed, rota shifted accordingly.' : 'e.g. Delay was avoidable — crew did not follow the agreed access route.'}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 space-y-2.5">
              <button
                onClick={handleConfirm}
                disabled={!reason.trim() || busy}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isApprove ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25' : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25'
                }`}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (isApprove ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
                {isApprove ? 'Approve & Record Reason' : 'Reject & Record Reason'}
              </button>
              <button
                onClick={goToCompliance}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition"
              >
                <ShieldCheck className="w-4 h-4" /> Go to Compliance Hub <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}