import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  X, ScanLine, Drill, CheckCircle2, AlertTriangle, Loader2,
  Users, MapPin, Clock, ChevronRight, Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import { useToast } from '@/components/ui/use-toast';

/**
 * Rig QR Sign-In — drillers scan the QR code on their rig to instantly
 * sign into the correct job. Finds today's RotaAssignment that has this
 * rig_asset_id for the current staff member, then calls onSignIn(assignmentId)
 * which opens the Shift Wizard.
 */
export default function RigSignInScanner({ open, onClose, staffId, assignments = [], jobs = [], rigs = [], allStaff = [], onSignIn }) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const rigMap = useMemo(() => Object.fromEntries(rigs.map(r => [r.id, r])), [rigs]);

  const handleScan = useCallback(async (val) => {
    const q = val.trim();
    if (!q) return;
    setSearching(true);
    setError('');

    try {
      // Resolve via backend — Asset Panda first (live), local fallback.
      const res = await base44.functions.invoke('resolveAssetByQR', { scan: q });
      const data = res.data || res;
      const found = data.asset;

      if (!found || !found.is_rig) {
        setSearching(false);
        setError(found ? `${found.name} is not a rig` : `No rig found for "${val}"`);
        setScanResult(null);
        return;
      }

      setScanResult(found);

      // Find today's assignment for this staff with this rig
      const todayAssignment = assignments.find(a =>
        a.staff_id === staffId &&
        a.assigned_date === todayStr &&
        a.rig_asset_id === found.id &&
        (a.status || 'assigned') !== 'completed'
      );

      setSearching(false);
      if (!todayAssignment) {
        setError(`You're not assigned to ${found.name} today. Check with your manager.`);
        return;
      }
      const job = jobs.find(j => j.id === todayAssignment.job_id);
      toast({
        title: `Rig ${found.name} found`,
        description: `Signing you into ${job?.name || 'your job'}…`,
      });
      // Auto-sign-in after a brief confirmation
      setTimeout(() => {
        if (onSignIn) onSignIn(todayAssignment.id);
        onClose();
      }, 800);
    } catch (e) {
      setSearching(false);
      setError(`Could not resolve scan — ${e.message || 'try again'}`);
      setScanResult(null);
    }
  }, [assignments, staffId, todayStr, jobs, toast, onSignIn, onClose]);

  // Show rig + crew details after a successful scan
  const scannedRig = scanResult;
  const scannedAssignment = scannedRig
    ? assignments.find(a => a.rig_asset_id === scannedRig.id && a.assigned_date === todayStr)
    : null;
  const scannedJob = scannedAssignment ? jobs.find(j => j.id === scannedAssignment.job_id) : null;
  const crewOnRig = scannedRig
    ? assignments.filter(a => a.rig_asset_id === scannedRig.id && a.assigned_date === todayStr)
    : [];
  const crewNames = crewOnRig.map(a => allStaff.find(s => s.id === a.staff_id)?.name).filter(Boolean);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-white flex flex-col"
      >
        {/* Header */}
        <div className="hero-gradient px-5 py-4 text-white flex-shrink-0 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <Drill className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">Scan Rig QR</h2>
                <p className="text-white/70 text-xs truncate">Point your camera at the rig's QR code to sign in</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Scanner */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <BarcodeScanner
              onScan={handleScan}
              onSearch={() => {}}
              placeholder="Scan rig QR code…"
              autoFocus={true}
            />
          </div>

          {/* Searching state */}
          {searching && (
            <div className="flex items-center justify-center gap-2.5 py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm font-medium text-slate-600">Finding your assignment…</p>
            </div>
          )}

          {/* Error */}
          {error && !searching && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
              <button onClick={() => setError('')} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Scanned rig result */}
          {scannedRig && !error && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="hub-glass rounded-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] px-4 py-3 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Drill className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/70 uppercase tracking-wide font-semibold">Rig Identified</p>
                    <h3 className="text-lg font-bold leading-tight">{scannedRig.name}</h3>
                  </div>
                  <span className="ml-auto text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase">
                    {scannedRig.rig_type === 'cp' ? 'Cable Percussion' : scannedRig.rig_type === 'rotary' ? 'Rotary' : 'Rig'}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {scannedAssignment ? (
                  <>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{scannedJob?.name || 'Job'}</p>
                        <p className="text-xs text-slate-500 break-words">{scannedJob?.location}</p>
                      </div>
                    </div>
                    {scannedAssignment.start_time && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{scannedAssignment.start_time}{scannedAssignment.end_time ? ` – ${scannedAssignment.end_time}` : ''}</span>
                      </div>
                    )}
                    {crewNames.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>Crew: {crewNames.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-800 font-medium">Signing you in…</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">You're not assigned to this rig today.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Helper text */}
          {!scannedRig && !error && !searching && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center mx-auto mb-4 ring-4 ring-primary/5">
                <ScanLine className="w-10 h-10 text-primary/40" />
              </div>
              <p className="text-slate-700 font-bold">Ready to Scan</p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Each rig has a QR code sticker. Scan it to instantly sign into your assigned job — no need to search through your schedule.</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}