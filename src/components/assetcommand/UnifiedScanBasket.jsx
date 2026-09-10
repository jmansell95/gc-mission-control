import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, X, Trash2, ChevronUp, ChevronDown, ShieldCheck,
  Undo2, ArrowRightLeft, CheckCircle2, AlertTriangle, Loader2,
  Truck, Weight,
} from 'lucide-react';
import { COMPLIANCE_META } from '@/utils/rigRollup';
import TrailerPicker from '@/components/logistics/TrailerPicker';

const TYPE_ICON = { rig: '🛠️', machinery: '🔧', trailer: '📦', vehicle: '🚚', lifting: '⚓', portable_appliance: '🔌' };

/**
 * Unified sticky basket — docked at the bottom of the scanner. Handles both
 * book-out (Sign Out) and book-in (Return to Yard) with a direction toggle.
 * Collapsed: glass bar with count pill + expand chevron.
 * Expanded: full sheet with item list, job selector, and commit button.
 *
 * Props:
 *   items, onRemove, onClear, direction, onToggleDirection,
 *   onCommit, committing, jobs, selectedJobId, onSelectJob
 */
export default function UnifiedScanBasket({
  items, onRemove, onClear, direction, onToggleDirection,
  onCommit, committing, jobs = [], selectedJobId, onSelectJob,
  vehicles = [], selectedVehicleId, onSelectVehicle,
  trailers = [], selectedTrailerId, onSelectTrailer,
}) {
  const [expanded, setExpanded] = useState(false);
  const count = items.length;

  // Capacity calculation — sums weight/volume across basket items
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const totalWeight = useMemo(() => items.reduce((s, a) => s + (Number(a.weight_kg) || 0), 0), [items]);
  const totalVolume = useMemo(() => items.reduce((s, a) => s + (Number(a.volume_m3) || 0), 0), [items]);

  if (count === 0) return null;

  const isSignOut = direction === 'signout';
  const weightPct = selectedVehicle?.max_weight_kg ? Math.min((totalWeight / selectedVehicle.max_weight_kg) * 100, 100) : 0;
  const volumePct = selectedVehicle?.max_volume_m3 ? Math.min((totalVolume / selectedVehicle.max_volume_m3) * 100, 100) : 0;
  const overWeight = selectedVehicle?.max_weight_kg && totalWeight > selectedVehicle.max_weight_kg;
  const overVolume = selectedVehicle?.max_volume_m3 && totalVolume > selectedVehicle.max_volume_m3;
  const hasCapacityData = selectedVehicle && (selectedVehicle.max_weight_kg || selectedVehicle.max_volume_m3);
  const accentColor = isSignOut ? '#2E5A1A' : '#0369a1';
  const accentBg = isSignOut ? 'bg-emerald-600' : 'bg-sky-600';
  const accentText = isSignOut ? 'text-emerald-700' : 'text-sky-700';
  const accentTint = isSignOut ? 'bg-emerald-50 border-emerald-200' : 'bg-sky-50 border-sky-200';
  const DirectionIcon = isSignOut ? ShieldCheck : Undo2;
  const actionLabel = isSignOut ? 'Sign Out All' : 'Return All';

  const nonCompliant = items.filter(a => a.compliance_status === 'expired');

  return (
    <>
      {/* Expanded backdrop */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Expanded sheet */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col safe-area-bottom"
          >
            {/* Drag handle */}
            <div className="pt-2 pb-1 flex justify-center flex-shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSignOut ? 'bg-emerald-100' : 'bg-sky-100'}`}>
                  <DirectionIcon className={`w-5 h-5 ${accentText}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{actionLabel}</h3>
                  <p className="text-xs text-slate-400">{count} item{count !== 1 ? 's' : ''} in basket</p>
                </div>
              </div>
              <button onClick={() => setExpanded(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Direction toggle */}
            <div className="px-5 py-3 flex-shrink-0">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => onToggleDirection('signout')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${isSignOut ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  <ShieldCheck className="w-4 h-4" /> Sign Out to Job
                </button>
                <button
                  onClick={() => onToggleDirection('return')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${!isSignOut ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`}
                >
                  <Undo2 className="w-4 h-4" /> Return to Yard
                </button>
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
              <div className="space-y-2">
                {items.map(a => {
                  const meta = COMPLIANCE_META[a.compliance_status || 'unknown'];
                  const emoji = TYPE_ICON[a.asset_type] || '📦';
                  const photo = a.panda_image_urls?.[0];
                  const photoUrl = photo?.thumb || photo?.medium || photo?.url;
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 animate-pop-in">
                      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                        {photoUrl ? <img src={photoUrl} alt={a.name} className="w-full h-full object-cover" /> : emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a._qty > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex-shrink-0">×{a._qty}</span>
                          )}
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          <span className="text-[11px] text-slate-500 font-medium">{meta.label}</span>
                          {a.serial_number && <span className="text-[11px] text-slate-400 font-mono truncate">· {a.serial_number}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(a.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Non-compliant warning */}
              {isSignOut && nonCompliant.length > 0 && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 font-medium leading-relaxed">
                    {nonCompliant.length} item{nonCompliant.length > 1 ? 's have' : ' has'} expired compliance. You can still proceed, but the yard manager will be notified.
                  </p>
                </div>
              )}
            </div>

            {/* Job selector + commit */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex-shrink-0">
            {isSignOut ? (
              <>
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sign Out to Job</label>
                {jobs.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-amber-800 font-medium">No active jobs today. Ask your manager to assign you to a job first.</p>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {jobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => onSelectJob(job.id)}
                        className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition active:scale-95 ${
                          selectedJobId === job.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {job.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle selector + capacity bars */}
              <div className="mb-3">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <Truck className="w-3 h-3" /> Load onto Vehicle
                </label>
                <select
                  value={selectedVehicleId || ''}
                  onChange={e => onSelectVehicle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="">Select a vehicle…</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.registration_number ? ` (${v.registration_number})` : ''}{v.max_weight_kg ? ` · ${v.max_weight_kg}kg` : ''}{v.max_volume_m3 ? ` / ${v.max_volume_m3}m³` : ''}
                    </option>
                  ))}
                </select>

                {hasCapacityData && (
                  <div className="mt-2 space-y-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide flex items-center gap-1">
                      <Weight className="w-3 h-3" /> Vehicle Capacity Check
                    </p>
                    {selectedVehicle.max_weight_kg && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-500 font-medium">Weight</span>
                          <span className={overWeight ? 'text-red-600 font-bold' : 'text-slate-600'}>{Math.round(totalWeight)} / {Math.round(selectedVehicle.max_weight_kg)} kg</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${overWeight ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${weightPct}%` }} />
                        </div>
                      </div>
                    )}
                    {selectedVehicle.max_volume_m3 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-slate-500 font-medium">Volume</span>
                          <span className={overVolume ? 'text-red-600 font-bold' : 'text-slate-600'}>{totalVolume.toFixed(2)} / {selectedVehicle.max_volume_m3.toFixed(1)} m³</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${overVolume ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${volumePct}%` }} />
                        </div>
                      </div>
                    )}
                    {(overWeight || overVolume) && (
                      <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Capacity exceeded — consider a larger vehicle or split the load.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trailer selector (optional) */}
              <div className="mb-3">
                <TrailerPicker trailers={trailers} value={selectedTrailerId} onChange={(id) => onSelectTrailer(id)} />
              </div>
              </>
            ) : (
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Return from Job</label>
                  {jobs.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-amber-800 font-medium">No jobs with outstanding assets found.</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {jobs.map(job => (
                        <button
                          key={job.id}
                          onClick={() => onSelectJob(job.id)}
                          className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition active:scale-95 ${
                            selectedJobId === job.id
                              ? 'border-sky-600 bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {job.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onCommit}
                  disabled={committing || !selectedJobId}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 ${accentBg} text-white rounded-xl font-bold text-sm hover:opacity-90 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {committing ? <Loader2 className="w-5 h-5 animate-spin" /> : <DirectionIcon className="w-5 h-5" />}
                  {committing ? 'Processing…' : `${actionLabel} (${count})`}
                </button>
                <button
                  onClick={onClear}
                  className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition active:scale-95"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed sticky bar — positioned above the FieldShell bottom nav
          (bottom-16 = 64px) so it's visible, not hidden behind the tab bar */}
      <div className="fixed bottom-16 left-0 right-0 z-[65]">
        <div className="max-w-3xl xl:max-w-4xl mx-auto px-4 pb-3">
          <button
            onClick={() => setExpanded(true)}
            className={`w-full rounded-2xl shadow-xl flex items-center gap-3 px-4 py-3.5 ${accentTint} border-2 active:scale-[0.99] transition backdrop-blur-xl`}
          >
            <div className={`w-11 h-11 rounded-xl ${accentBg} text-white flex items-center justify-center flex-shrink-0 shadow-md`}>
              <DirectionIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-slate-900 leading-tight">
                {actionLabel} · {count} item{count !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {isSignOut ? 'Tap to review and sign out to job' : 'Tap to review and return to yard'}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full ${accentBg} text-white text-sm font-bold tabular-nums flex-shrink-0 shadow-sm`}>
              {count}
            </div>
            <ChevronUp className={`w-5 h-5 ${accentText} flex-shrink-0`} />
          </button>
        </div>
      </div>
    </>
  );
}