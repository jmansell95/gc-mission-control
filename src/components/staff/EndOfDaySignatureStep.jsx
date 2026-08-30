import React, { useState, useRef } from 'react';
import { ShieldCheck, Clock, Car, MapPin, CheckCircle2, Loader2, FileSignature, Send } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

/**
 * EndOfDaySignatureStep — the final step of the EndOfShiftWizard.
 *
 * Shows a summary of the day's tracked data (on-site hours, travel-to,
 * travel-from, inter-site) and requires a drawn signature before the
 * timesheet can be submitted. The signature confirms the tracked data
 * is accurate and serves as a digital declaration.
 *
 * Calls onSigned(signatureDataUrl) when the user draws and confirms.
 */
export default function EndOfDaySignatureStep({ summary, onSigned, saving }) {
  const [signature, setSignature] = useState(null);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!signature) { setError('Please draw your signature to confirm your hours.'); return; }
    setError('');
    onSigned(signature);
  };

  const rows = [
    { icon: Clock, label: 'On-site work', value: fmtDur(summary.onSiteMinutes), color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { icon: Car, label: 'Travel to site', value: fmtDur(summary.travelToMinutes), color: 'text-blue-600', bg: 'bg-blue-100' },
    { icon: Car, label: 'Travel home', value: fmtDur(summary.travelFromMinutes), color: 'text-blue-600', bg: 'bg-blue-100' },
    ...(summary.interSiteMinutes > 0 ? [{ icon: MapPin, label: 'Inter-site travel', value: fmtDur(summary.interSiteMinutes), color: 'text-amber-600', bg: 'bg-amber-100' }] : []),
    { icon: Clock, label: 'Total hours', value: fmtDur(summary.totalMinutes), color: 'text-slate-700', bg: 'bg-slate-100', bold: true },
  ];

  return (
    <div className="space-y-4">
      {/* Declaration header */}
      <div className="flex items-start gap-3 bg-[#2E5A1A]/5 rounded-2xl p-4">
        <div className="w-10 h-10 rounded-xl bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
          <FileSignature className="w-5 h-5 text-[#2E5A1A]" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">End-of-Day Declaration</p>
          <p className="text-xs text-slate-500 mt-0.5">Review your tracked hours below and sign to confirm they are accurate. Your signature submits your timesheet to your manager.</p>
        </div>
      </div>

      {/* Tracked summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's tracked hours</p>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${r.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${r.color}`} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <p className={`text-sm ${r.bold ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>{r.label}</p>
                <p className={`text-sm tabular-nums ${r.bold ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* GPS badge */}
      {summary.gpsTracked && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="w-4 h-4" /> GPS-verified arrival & departure times
        </div>
      )}

      {/* Signature */}
      <div>
        <p className="text-sm font-bold text-slate-800 mb-1.5">Sign to confirm</p>
        <p className="text-xs text-slate-500 mb-3">
          I confirm that the hours and travel times recorded above are accurate to the best of my knowledge.
        </p>
        <SignaturePad onChange={setSignature} />
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* Submit */}
      <button
        onClick={handleConfirm}
        disabled={!signature || saving}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-[#2E5A1A] text-white rounded-2xl hover:bg-[#1c4a12] active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        {saving ? 'Submitting…' : 'Sign & Submit Shift'}
      </button>
    </div>
  );
}