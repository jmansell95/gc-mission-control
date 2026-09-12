import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ClipboardList, Printer, X, MapPin, Truck, User, Package,
  CheckCircle2, Circle, Clock, Navigation, FileText, AlertTriangle, PenLine,
  Barcode, Loader2,
} from 'lucide-react';
import { buildPickListHtml, downloadPickListPDF, parsePickItems } from './pickListHtml';
import { useToast } from '@/components/ui/use-toast';
import SignaturePad from '@/components/staff/SignaturePad';
import FullScreenScanner from '@/components/assetcommand/FullScreenScanner';
import { playSuccess, playError } from '@/utils/scanFeedback';

/**
 * Mobile-first full-screen Pick List modal with per-stage drawn-signature sign-off.
 *
 * Each of the 3 stages (Picked, Loaded, Driver Check) requires the signer to
 * draw their signature on a canvas before the stage is confirmed — creating a
 * legally defensible audit trail per stage.
 *
 * Props:
 *   delivery   — the DeliveryLog record
 *   job        — optional Job record
 *   vehicle    — optional Vehicle record
 *   driverName — optional driver display name
 *   open       — boolean
 *   onClose    — callback
 */
export default function PickListModal({ delivery, job, vehicle, driverName, open, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(null);
  const [activeStage, setActiveStage] = useState(null); // which stage canvas is open
  const [currentSig, setCurrentSig] = useState(null); // drawn signature data URL for the active stage
  const [scannedIndices, setScannedIndices] = useState(new Set());
  const [showScanner, setShowScanner] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const lastPickScanRef = useRef({ value: '', ts: 0 });

  const { data: fetchedJob } = useQuery({
    queryKey: ['picklist-job', delivery?.job_id],
    queryFn: () => base44.entities.Job.get(delivery.job_id),
    enabled: open && !!delivery?.job_id && !job,
  });
  const { data: fetchedVehicle } = useQuery({
    queryKey: ['picklist-vehicle', delivery?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.get(delivery.vehicle_id),
    enabled: open && !!delivery?.vehicle_id && !vehicle,
  });

  const resolvedJob = job || fetchedJob || null;
  const resolvedVehicle = vehicle || fetchedVehicle || null;
  const myName = user?.full_name || user?.email || 'Staff';

  const html = useMemo(() => {
    if (!open || !delivery) return '';
    return buildPickListHtml({ delivery, job: resolvedJob, vehicle: resolvedVehicle, driverName });
  }, [open, delivery, resolvedJob, resolvedVehicle, driverName]);

  const items = useMemo(() => parsePickItems(delivery), [delivery]);

  const hasRealItems = items.length > 0 && items[0] !== '(no items listed)';
  const allScanned = !hasRealItems || items.every((_, i) => scannedIndices.has(i));

  // Match a scanned asset name to a pick list line (case-insensitive substring).
  // Strips quantity suffixes like "x10" from the line so "Coreliners x10"
  // still matches an asset named "Coreliner".
  const matchAssetToItem = (assetName) => {
    if (!assetName) return -1;
    const norm = assetName.toLowerCase().trim();
    for (let i = 0; i < items.length; i++) {
      const line = items[i].toLowerCase().replace(/\s*x\d+\s*/g, ' ').trim();
      if (!line || line === '(no items listed)') continue;
      if (norm.includes(line) || line.includes(norm)) return i;
    }
    return -1;
  };

  const handlePickScan = async (val) => {
    const q = val.trim();
    if (!q) return;
    const now = Date.now();
    if (lastPickScanRef.current.value === q && now - lastPickScanRef.current.ts < 2000) return;
    lastPickScanRef.current = { value: q, ts: now };
    setScanBusy(true);
    try {
      const res = await base44.functions.invoke('resolveAssetByQR', { scan: q });
      const data = res.data || res;
      const found = data.asset;
      if (!found) {
        playError();
        toast({ title: 'Not found', description: 'No asset matches this QR code', variant: 'destructive' });
        return;
      }
      const idx = matchAssetToItem(found.name);
      if (idx < 0) {
        playError();
        toast({ title: 'Not on pick list', description: `${found.name} isn't listed on this delivery`, variant: 'destructive' });
        return;
      }
      if (scannedIndices.has(idx)) {
        playSuccess();
        toast({ title: 'Already scanned', description: found.name });
        return;
      }
      playSuccess();
      const newSize = scannedIndices.size + 1;
      setScannedIndices(prev => new Set([...prev, idx]));
      toast({ title: '✓ Checked off', description: `${found.name} · ${newSize}/${items.length}` });
      if (newSize >= items.length) setShowScanner(false);
    } catch (e) {
      playError();
      toast({ title: 'Scan failed', description: e.message, variant: 'destructive' });
    }
    setScanBusy(false);
  };

  const signStages = useMemo(() => [
    {
      key: 'picked',
      label: 'Picked',
      icon: Package,
      done: !!delivery?.picked_at,
      by: delivery?.picked_by_name,
      at: delivery?.picked_at,
      sig: delivery?.picked_signature_data_url,
      fields: (sig) => ({ picked_by_name: myName, picked_at: new Date().toISOString(), picked_signature_data_url: sig }),
    },
    {
      key: 'loaded',
      label: 'Loaded',
      icon: Truck,
      done: !!delivery?.loaded_at,
      by: delivery?.loaded_by_name,
      at: delivery?.loaded_at,
      sig: delivery?.loaded_signature_data_url,
      fields: (sig) => ({ loaded_by_name: myName, loaded_at: new Date().toISOString(), loaded_signature_data_url: sig }),
    },
    {
      key: 'driver_check',
      label: 'Driver Check',
      icon: CheckCircle2,
      done: !!delivery?.driver_checked_at,
      by: delivery?.driver_checked_by,
      at: delivery?.driver_checked_at,
      sig: delivery?.driver_check_signature_data_url,
      fields: (sig) => ({ driver_checked: true, driver_checked_by: myName, driver_checked_at: new Date().toISOString(), driver_check_signature_data_url: sig }),
    },
  ], [delivery, myName]);

  const allDone = signStages.every(s => s.done);

  const confirmStage = async (stage) => {
    if (!currentSig || busy) return;
    setBusy(stage.key);
    try {
      await base44.entities.DeliveryLog.update(delivery.id, stage.fields(currentSig));
      toast({ title: `${stage.label} confirmed`, description: `Signed off by ${myName}` });
      queryClient.invalidateQueries({ queryKey: ['depot-pick-lists'] });
      queryClient.invalidateQueries({ queryKey: ['driver-hub-deliveries'] });
      setActiveStage(null);
      setCurrentSig(null);
    } catch (e) {
      toast({ title: 'Sign-off failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const cancelStage = () => {
    setActiveStage(null);
    setCurrentSig(null);
  };

  if (!open || !delivery) return null;

  const dateStr = delivery.scheduled_date
    ? new Date(delivery.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/96 backdrop-blur-md animate-pop-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white safe-area-top flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold truncate leading-tight text-sm">Warehouse Pick List</h3>
            <p className="text-[11px] text-white/70 truncate">
              {delivery.job_name || 'Drop'}
              {delivery.optimized_sequence_index ? ` · Stop ${delivery.optimized_sequence_index}` : ''}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {/* Job & route details */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <FileText className="w-4 h-4 text-[#2E5A1A]" />
              <h4 className="text-sm font-bold text-slate-900">Job Details</h4>
            </div>
            <DetailRow icon={FileText} label="Job" value={delivery.job_name || resolvedJob?.name} />
            <DetailRow icon={Navigation} label="Job Ref" value={delivery.job_reference || resolvedJob?.job_reference} />
            <DetailRow icon={MapPin} label="Deliver To" value={delivery.delivery_address} />
            {resolvedJob?.what3words && (
              <DetailRow icon={MapPin} label="what3words" value={`///${resolvedJob.what3words}`} mono />
            )}
            <DetailRow icon={User} label="Site Contact" value={resolvedJob?.site_contact_name ? `${resolvedJob.site_contact_name}${resolvedJob.site_contact_phone ? ' · ' + resolvedJob.site_contact_phone : ''}` : delivery.contact_name} />
            <DetailRow icon={Clock} label="Scheduled" value={dateStr} />
            {delivery.po_number && <DetailRow icon={FileText} label="PO / Ref" value={delivery.po_number} />}
          </div>

          {/* Vehicle */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Truck className="w-4 h-4 text-[#2E5A1A]" />
              <h4 className="text-sm font-bold text-slate-900">Vehicle & Loading</h4>
            </div>
            <DetailRow icon={Truck} label="Vehicle" value={resolvedVehicle?.name ? `${resolvedVehicle.name}${resolvedVehicle.registration_number ? ` (${resolvedVehicle.registration_number})` : ''}` : '—'} />
            <DetailRow icon={User} label="Driver" value={driverName || delivery.driver_staff_name || '—'} />
            <DetailRow icon={MapPin} label="Pick Up From" value={delivery.pickup_address || 'Depot / Yard'} />
            {resolvedVehicle?.height_m && (
              <div className="flex items-start gap-2.5 px-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-700">Vehicle height: {resolvedVehicle.height_m} m — check bridge clearance</p>
              </div>
            )}
          </div>

          {/* Items to pick — scan to check off */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Package className="w-4 h-4 text-[#2E5A1A]" />
              <h4 className="text-sm font-bold text-slate-900">Items to Pick ({items.length})</h4>
              {hasRealItems && (
                <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${allScanned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {allScanned ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  {scannedIndices.size}/{items.length} scanned
                </span>
              )}
            </div>

            {hasRealItems && (
              <button
                onClick={() => setShowScanner(true)}
                disabled={allScanned}
                className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition touch-manipulation min-h-[48px] ${allScanned ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-[#2E5A1A] text-white hover:bg-[#244715] active:scale-95'}`}
              >
                <Barcode className="w-4 h-4" /> {allScanned ? 'All Items Scanned' : 'Scan to Check Off'}
              </button>
            )}

            <div className="space-y-1.5">
              {items.map((line, i) => {
                const scanned = scannedIndices.has(i);
                return (
                  <div key={i} className={`flex items-center gap-3 py-2 px-2 rounded-lg transition ${scanned ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${scanned ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-[#2E5A1A]'}`}>{i + 1}</span>
                    <span className={`text-sm flex-1 ${scanned ? 'text-emerald-800 font-medium' : 'text-slate-700'}`}>{line}</span>
                    {scanned ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <span className="w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
            {hasRealItems && !allScanned && (
              <p className="text-[11px] text-amber-600 px-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Scan all items before signing off each stage
              </p>
            )}
          </div>

          {/* Notes */}
          {delivery.notes && (
            <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">Driver / Special Instructions</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{delivery.notes}</p>
            </div>
          )}

          {/* Digital sign-off with per-stage drawn signatures */}
          <div className="hub-glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <PenLine className="w-4 h-4 text-[#2E5A1A]" />
              <h4 className="text-sm font-bold text-slate-900">Digital Sign-Off</h4>
              {allDone && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 px-1">Each stage requires a drawn signature to confirm.</p>
            <div className="space-y-2">
              {signStages.map(stage => {
                const Icon = stage.icon;
                const isBusy = busy === stage.key;
                const isActive = activeStage === stage.key;
                return (
                  <div key={stage.key} className={`rounded-xl border transition overflow-hidden ${stage.done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    {/* Stage header row */}
                    <button
                      onClick={() => !stage.done && !busy && allScanned && setActiveStage(isActive ? null : stage.key)}
                      disabled={stage.done || busy || (!allScanned && hasRealItems)}
                      className={`w-full flex items-center gap-3 p-3 text-left touch-manipulation min-h-[56px] ${stage.done ? 'cursor-default' : allScanned ? 'cursor-pointer hover:border-[#2E5A1A] active:scale-[0.99]' : 'cursor-not-allowed opacity-60'} ${isActive ? 'border-b-0' : ''}`}
                    >
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stage.done ? 'bg-emerald-600' : 'bg-slate-100'}`}>
                        {stage.done ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-slate-500" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${stage.done ? 'text-emerald-800' : 'text-slate-800'}`}>{stage.label}</p>
                        {stage.done ? (
                          <p className="text-[11px] text-emerald-600 truncate">
                            {stage.by} · {new Date(stage.at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">{allScanned ? `Tap to sign as ${myName}` : 'Scan all items first'}</p>
                        )}
                      </div>
                      {!stage.done && (isBusy ? (
                        <div className="w-5 h-5 border-2 border-[#2E5A1A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      ))}
                    </button>

                    {/* Completed stage — show signature thumbnail */}
                    {stage.done && stage.sig && (
                      <div className="px-3 pb-3 flex items-center gap-3">
                        <img src={stage.sig} alt={`${stage.label} signature`} className="h-10 max-w-[160px] object-contain rounded border border-emerald-200 bg-white" />
                        <span className="text-[10px] text-emerald-600 font-semibold">Signed</span>
                      </div>
                    )}

                    {/* Active unsigned stage — show signature canvas */}
                    {isActive && !stage.done && (
                      <div className="p-3 border-t border-slate-100 space-y-2">
                        <SignaturePad onChange={setCurrentSig} />
                        <div className="flex gap-2">
                          <button
                            onClick={() => cancelStage()}
                            disabled={busy}
                            className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition touch-manipulation min-h-[44px] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => confirmStage(stage)}
                            disabled={!currentSig || busy}
                            className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#244715] transition touch-manipulation min-h-[44px] disabled:opacity-50"
                          >
                            {isBusy ? (
                              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirming…</>
                            ) : (
                              <><PenLine className="w-4 h-4" /> Confirm & Sign</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition touch-manipulation min-h-[48px]">
            Close
          </button>
          <button
            onClick={() => downloadPickListPDF({ delivery, job: resolvedJob, vehicle: resolvedVehicle, driverName })}
            className="flex-[2] inline-flex items-center justify-center gap-2 py-3 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#244715] transition shadow-sm touch-manipulation min-h-[48px]"
          >
            <Printer className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* QR scanner overlay — scan items to check them off the pick list */}
      {showScanner && (
        <FullScreenScanner
          onScan={handlePickScan}
          onClose={() => setShowScanner(false)}
          resolving={scanBusy}
          scanResult={null}
          scanError=""
          pendingPanda={null}
          alreadyInBasket={false}
          confirming={false}
          refreshing={false}
          onViewAsset={() => {}}
          onScanNext={() => {}}
          onAddToBasket={() => {}}
          onConfirmPanda={() => {}}
          onCancelPanda={() => {}}
        />
      )}
    </div>,
    document.body
  );
}

function DetailRow({ icon: Icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 px-1">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
        <p className={`text-sm text-slate-800 font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}