import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';

/**
 * MittiVerificationBadge — a polished, animated status card showing whether a
 * Mitti/SafetyCulture check has been verified live.
 *
 * States:
 *  - 'verified'  : green, check icon, timestamp — Mitti confirmed the check
 *  - 'waiting'   : amber, pulsing clock — Mitti is connected, audit not yet received
 *  - 'prompt'    : neutral — Mitti not connected, manual confirmation allowed
 *
 * Props:
 *  - type: 'vehicle' | 'powra' | 'equipment'
 *  - verified: boolean
 *  - isConnected: boolean (Mitti webhook configured)
 *  - verifiedAt: ISO timestamp string | null
 *  - url: link to open Mitti
 *  - label: override title
 */
const TYPE_LABELS = {
  vehicle: 'Vehicle Check',
  powra: 'POWRA',
  equipment: 'Equipment Check',
};

export default function MittiVerificationBadge({ type = 'vehicle', verified, isConnected, verifiedAt, url, label }) {
  const title = label || TYPE_LABELS[type] || 'Safety Check';
  const state = verified ? 'verified' : isConnected ? 'waiting' : 'prompt';

  const timeStr = verifiedAt
    ? new Date(verifiedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (state === 'verified') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl px-4 py-3.5"
      >
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-900">{title} verified by Mitti</p>
          <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            {timeStr ? `Completed at ${timeStr}` : 'Audit received'}
          </p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition active:scale-90">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </motion.div>
    );
  }

  if (state === 'waiting') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-4 py-3.5"
      >
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-md shadow-amber-400/30">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">Waiting for {title} in Mitti</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Complete the check in Mitti — this will update automatically once received.
          </p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold text-amber-800 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 transition active:scale-95">
            Open <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </motion.div>
    );
  }

  // prompt — Mitti not connected, neutral manual state
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
      <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
        <Clock className="w-5 h-5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700">{title} — manual confirmation</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Mitti not connected. Complete the check and confirm manually below.
        </p>
      </div>
    </div>
  );
}