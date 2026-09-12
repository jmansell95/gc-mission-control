import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ScanLine, X, Package, CheckCircle2, AlertCircle, Loader2,
  ArrowLeft, Truck, Warehouse, ArrowRightLeft, QrCode, ChevronRight, Minus, Plus
} from 'lucide-react';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import CollectionSignOffModal from '@/components/logistics/CollectionSignOffModal';
import { useToast } from '@/components/ui/use-toast';

/**
 * SiteCollectionScanner — full-screen driver interface for collecting
 * items from a site using QR code scanning. Shows the live manifest of
 * items on the job (collected vs still on site), lets the driver scan
 * each item's QR code, enter the quantity being collected, then choose
 * to return the items to the depot or transfer them directly to another
 * job.
 */
export default function SiteCollectionScanner({ delivery, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [scannedItems, setScannedItems] = useState([]); // [{ id, name, serial, qty, asset_id }]
  const [scanError, setScanError] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [qtyPrompt, setQtyPrompt] = useState(null); // { asset, item, maxQty }
  const [pendingQty, setPendingQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signOffMode, setSignOffMode] = useState('return');
  const [pendingTransfer, setPendingTransfer] = useState(null);

  // Fetch the job's cost items (the manifest)
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['job-collection-items', delivery.job_id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: delivery.job_id }),
    enabled: !!delivery.job_id,
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets-collection'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const assetMap = useMemo(() => {
    const m = {};
    (assets || []).forEach(a => { m[a.id] = a; });
    return m;
  }, [assets]);

  // Items on site (the collection target) and items already collected (in_transit)
  const onSiteItems = useMemo(() => {
    return items
      .filter(c => c.site_asset_id && c.current_location === 'site')
      .filter(c => c.category !== 'labour' && c.category !== 'contractor_supplied' && c.category !== 'client_supplied')
      .map(c => ({ ...c, asset: assetMap[c.site_asset_id] }))
      .filter(c => c.asset);
  }, [items, assetMap]);

  const collectedItems = useMemo(() => {
    return items
      .filter(c => c.site_asset_id && c.current_location === 'in_transit')
      .map(c => ({ ...c, asset: assetMap[c.site_asset_id] }))
      .filter(c => c.asset);
  }, [items, assetMap]);

  // Auto-start the delivery if it's still pending
  const handleStartIfNeeded = useCallback(async () => {
    if (delivery.status === 'pending') {
      try {
        await base44.entities.DeliveryLog.update(delivery.id, {
          status: 'in_progress',
          started_at: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      } catch (e) { /* silent */ }
    }
  }, [delivery, queryClient]);

  const handleScan = useCallback((val) => {
    const q = val.trim().toLowerCase();
    if (!q) return;

    // Match against assets on this job's manifest
    const match = onSiteItems.find(c => {
      const sn = (c.asset.serial_number || '').toLowerCase().trim();
      const nm = (c.asset.name || '').toLowerCase().trim();
      const aid = (c.asset.id || '').toLowerCase().trim();
      return sn === q || nm === q || aid === q || (sn && sn.includes(q));
    });

    if (!match) {
      // Check if already collected
      const alreadyCollected = collectedItems.find(c => {
        const sn = (c.asset.serial_number || '').toLowerCase().trim();
        const nm = (c.asset.name || '').toLowerCase().trim();
        return sn === q || nm === q;
      });
      if (alreadyCollected) {
        setScanError(`Already collected: ${alreadyCollected.asset.name}`);
      } else {
        setScanError(`No matching item on this site for "${val}"`);
      }
      setLastScan('');
      return;
    }

    setScanError('');
    setLastScan(match.asset.name);

    // If quantity is 1, collect immediately; otherwise prompt for quantity
    const maxQty = Math.max(1, Number(match.quantity) || 1);
    if (maxQty === 1) {
      doCollect(match, 1);
    } else {
      setQtyPrompt({ item: match, asset: match.asset, maxQty });
      setPendingQty(1);
    }
  }, [onSiteItems, collectedItems]);

  const doCollect = async (item, qty) => {
    setSubmitting(true);
    try {
      await handleStartIfNeeded();
      const res = await base44.functions.invoke('processSiteCollection', {
        action: 'collect',
        delivery_id: delivery.id,
        site_asset_id: item.site_asset_id,
        quantity_collected: qty,
      });
      if (res.data?.ok) {
        setScannedItems(prev => [...prev, {
          id: res.data.item_id,
          name: item.asset.name,
          serial: item.asset.serial_number || '',
          qty,
        }]);
        toast({ title: 'Collected', description: `${res.data.asset_name} (${qty} ${item.unit_label || ''})` });
      } else {
        setScanError(res.data?.error || 'Collection failed');
      }
    } catch (e) {
      setScanError(e.message || 'Collection failed');
    } finally {
      setSubmitting(false);
      setQtyPrompt(null);
    }
  };

  const confirmQty = () => {
    if (qtyPrompt && pendingQty >= 1) {
      doCollect(qtyPrompt.item, pendingQty);
    }
  };

  const handleCompleteReturn = async (signOffData) => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('processSiteCollection', {
        action: 'complete_return',
        delivery_id: delivery.id,
        signature_data_url: signOffData.signature_data_url,
        signed_by_name: signOffData.signed_by_name,
      });
      if (res.data?.ok) {
        // Persist signature on the delivery log
        try {
          await base44.entities.DeliveryLog.update(delivery.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            signature_data_url: signOffData.signature_data_url,
            signed_by_name: signOffData.signed_by_name,
          });
        } catch { /* best-effort */ }
        toast({ title: 'Collection complete', description: `${res.data.items_returned} item(s) returned to depot.` });
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
        queryClient.invalidateQueries({ queryKey: ['job-collection-items'] });
        onClose();
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setShowSignOff(false);
      setShowComplete(false);
    }
  };

  const handleCompleteTransfer = async (destJobId, destJobName, destAddress, signOffData) => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('processSiteCollection', {
        action: 'complete_transfer',
        delivery_id: delivery.id,
        destination_job_id: destJobId,
        destination_job_name: destJobName,
        destination_address: destAddress,
        signature_data_url: signOffData?.signature_data_url,
        signed_by_name: signOffData?.signed_by_name,
      });
      if (res.data?.ok) {
        try {
          await base44.entities.DeliveryLog.update(delivery.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            signature_data_url: signOffData?.signature_data_url,
            signed_by_name: signOffData?.signed_by_name,
          });
        } catch { /* best-effort */ }
        toast({ title: 'Transfer initiated', description: `${res.data.items_transferred} item(s) will be delivered to ${destJobName}.` });
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
        queryClient.invalidateQueries({ queryKey: ['job-collection-items'] });
        onClose();
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setShowSignOff(false);
      setShowTransfer(false);
      setShowComplete(false);
    }
  };

  const collectedCount = scannedItems.length;
  const onSiteCount = onSiteItems.length;
  const allCollected = onSiteCount > 0 && collectedItems.length === 0 && collectedCount > 0 ? false : collectedItems.length >= onSiteCount && onSiteCount > 0;

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col z-50 animate-pop-in">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Site Collection</h1>
            <p className="text-xs text-slate-400">{delivery.job_name || 'Job'} · {collectedCount} collected · {onSiteCount} on site</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collectedCount > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              {collectedCount} loaded
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {/* Scanner card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-slate-900">Scan item QR codes to collect</p>
            </div>
            <BarcodeScanner onScan={handleScan} placeholder="Scan or type serial number…" autoFocus={false} />
          </div>

          {/* Last scan feedback */}
          {lastScan && !scanError && !qtyPrompt && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-pop-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 font-semibold truncate">Collected: {lastScan}</p>
            </div>
          )}
          {scanError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium flex-1 truncate">{scanError}</p>
              <button onClick={() => setScanError('')} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quantity prompt */}
          {qtyPrompt && (
            <div className="bg-white rounded-2xl border-2 border-blue-300 shadow-lg p-4 animate-pop-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{qtyPrompt.asset.name}</p>
                  <p className="text-xs text-slate-400 font-mono truncate">{qtyPrompt.asset.serial_number || '—'}</p>
                  <p className="text-xs text-slate-500">Max available: {qtyPrompt.maxQty}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-2">How many are you collecting?</p>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setPendingQty(Math.max(1, pendingQty - 1))}
                  className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center active:scale-95 transition"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <input
                  type="number"
                  value={pendingQty}
                  onChange={e => setPendingQty(Math.max(1, Math.min(qtyPrompt.maxQty, Number(e.target.value) || 1)))}
                  className="w-20 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setPendingQty(Math.min(qtyPrompt.maxQty, pendingQty + 1))}
                  className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center active:scale-95 transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPendingQty(qtyPrompt.maxQty)}
                  className="ml-auto px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  All ({qtyPrompt.maxQty})
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setQtyPrompt(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmQty}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Collection
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {onSiteCount > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-900">Collection Progress</p>
                <span className="text-xs font-bold text-slate-500">{collectedItems.length} / {onSiteCount + collectedItems.length}</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${onSiteCount + collectedItems.length > 0 ? (collectedItems.length / (onSiteCount + collectedItems.length)) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Collected items */}
          {collectedItems.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Collected ({collectedItems.length})
              </h3>
              <div className="space-y-1.5">
                {collectedItems.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 animate-pop-in">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.asset.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{c.asset.serial_number || '—'} · Qty {c.quantity || 1}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">LOADED</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Still on site */}
          {onSiteItems.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-400" /> Still on site ({onSiteItems.length})
              </h3>
              <div className="space-y-1.5">
                {onSiteItems.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.asset.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{c.asset.serial_number || '—'} · Qty {c.quantity || 1}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">ON SITE</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      {collectedItems.length > 0 && (
        <footer className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowComplete(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition shadow-sm active:scale-95"
            >
              <Truck className="w-5 h-5" /> Complete Collection ({collectedItems.length} items loaded)
            </button>
          </div>
        </footer>
      )}

      {/* Complete options modal */}
      {showComplete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-pop-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Complete Collection</h3>
              <button onClick={() => setShowComplete(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-500 mb-3">You've collected {collectedItems.length} item(s). Where are they going?</p>

              <button
                onClick={() => { setSignOffMode('return'); setShowComplete(false); setShowSignOff(true); }}
                disabled={submitting}
                className="w-full flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-100 transition active:scale-[0.98] text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <Warehouse className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Return to Depot</p>
                  <p className="text-xs text-slate-500">Bring items back to the yard. Hired equipment will be marked off-hired.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>

              <button
                onClick={() => { setShowComplete(false); setShowTransfer(true); }}
                disabled={submitting}
                className="w-full flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl hover:border-amber-400 hover:bg-amber-100 transition active:scale-[0.98] text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Transfer to Another Site</p>
                  <p className="text-xs text-slate-500">Deliver directly to a different job. A new delivery task is created automatically.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <SiteTransferModal
          itemCount={collectedItems.length}
          onConfirm={(destJobId, destJobName, destAddress) => {
            setPendingTransfer({ destJobId, destJobName, destAddress });
            setSignOffMode('transfer');
            setShowTransfer(false);
            setShowSignOff(true);
          }}
          onBack={() => { setShowTransfer(false); setShowComplete(true); }}
          submitting={submitting}
        />
      )}

      {/* Sign-off modal (signature capture for return or transfer) */}
      {showSignOff && (
        <CollectionSignOffModal
          open={showSignOff}
          itemCount={collectedItems.length}
          mode={signOffMode}
          destinationName={signOffMode === 'transfer' ? pendingTransfer?.destJobName : ''}
          onClose={() => {
            setShowSignOff(false);
            if (signOffMode === 'transfer') { setShowTransfer(true); }
            else { setShowComplete(true); }
          }}
          onConfirm={(signOffData) => {
            if (signOffMode === 'return') {
              handleCompleteReturn(signOffData);
            } else if (pendingTransfer) {
              handleCompleteTransfer(
                pendingTransfer.destJobId,
                pendingTransfer.destJobName,
                pendingTransfer.destAddress,
                signOffData
              );
            }
          }}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// Inline transfer modal (kept in the same file for cohesion)
function SiteTransferModal({ itemCount, onConfirm, onBack, submitting }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['active-jobs-transfer'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress', 'decommissioning'] } }, '-updated_date', 100),
  });
  const [selectedJob, setSelectedJob] = useState('');
  const [search, setSearch] = useState('');

  const filteredJobs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (jobs || []).filter(j => !q || (j.name || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q));
  }, [jobs, search]);

  const job = jobs.find(j => j.id === selectedJob);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-pop-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900">Transfer to Site</h3>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-slate-500 mb-4">Select the destination job for {itemCount} collected item(s). A new delivery task will be created.</p>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 mb-3"
          />

          <div className="space-y-1.5">
            {filteredJobs.map(j => (
              <button
                key={j.id}
                onClick={() => setSelectedJob(j.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${selectedJob === j.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedJob === j.id ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{j.name}</p>
                  <p className="text-xs text-slate-400 truncate">{j.location || 'No address'}</p>
                </div>
                {selectedJob === j.id && <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />}
              </button>
            ))}
            {filteredJobs.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">No jobs found</p>
            )}
          </div>
        </div>
        {selectedJob && (
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <button
              onClick={() => onConfirm(selectedJob, job?.name || '', job?.location || '')}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
              Transfer {itemCount} item(s) to {job?.name || 'site'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}