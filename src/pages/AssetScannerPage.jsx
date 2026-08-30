import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, Package, CheckCircle2, AlertTriangle,
  Lock, Unlock, ArrowLeft, Layers, Store, PackageOpen,
  Wrench, ShieldCheck, Undo2, Barcode, ClipboardList,
} from 'lucide-react';
import UnifiedScanBasket from '@/components/assetcommand/UnifiedScanBasket';
import AssetCommandDrawer from '@/components/assetcommand/AssetCommandDrawer';
import DriveAwayModal from '@/components/assetcommand/DriveAwayModal';
import ReportFaultModal from '@/components/assetcommand/ReportFaultModal';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import FullScreenScanner from '@/components/assetcommand/FullScreenScanner';
import RecentScansStrip from '@/components/assetcommand/RecentScansStrip';
import OfflineScanQueueBanner from '@/components/assetcommand/OfflineScanQueueBanner';
import TabBar from '@/components/TabBar';
import MyGearTab from '@/components/fieldhub/MyGearTab';
import GoodsInDeliveryNote from '@/components/assetcommand/GoodsInDeliveryNote';
import ConsumableUsageModal from '@/components/assetcommand/ConsumableUsageModal';
import SiteCollectMode from '@/components/logistics/SiteCollectMode';
import SiteCollectionScanner from '@/components/logistics/SiteCollectionScanner';
import ScannerPickListsMode from '@/components/assetcommand/ScannerPickListsMode';
import { enableKioskScannerMode, disableKioskScannerMode, isKioskScannerMode } from '@/utils/kioskMode';
import { playSuccess, playError, playConfirm } from '@/utils/scanFeedback';
import { useToast } from '@/components/ui/use-toast';

const RECENT_KEY = 'gc-scanner-recent';
const OFFLINE_KEY = 'gc-scanner-offline';

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
}
function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

/**
 * Asset Scanner — Field Pro Clean redesign.
 * Full-screen scanner overlay, recent-scan history, offline scan queue,
 * and a bright scan-first layout with compliance ring badges.
 */
export default function AssetScannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [basket, setBasket] = useState([]);
  const basketRef = useRef(basket);
  basketRef.current = basket;
  const [direction, setDirection] = useState('signout');
  const [lastScan, setLastScan] = useState('');
  const [scanError, setScanError] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [kioskLocked, setKioskLocked] = useState(isKioskScannerMode());
  const [mode, setMode] = useState('assets');
  const [scanDelivery, setScanDelivery] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [commandAsset, setCommandAsset] = useState(null);
  const [driveAwayAsset, setDriveAwayAsset] = useState(null);
  const [faultAsset, setFaultAsset] = useState(null);
  const [hubTab, setHubTab] = useState('scan');
  const [pendingPanda, setPendingPanda] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedTrailerId, setSelectedTrailerId] = useState('');
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showConsumableModal, setShowConsumableModal] = useState(false);
  const [recent, setRecent] = useState(() => loadJSON(RECENT_KEY, []));
  const [offlineScans, setOfflineScans] = useState(() => loadJSON(OFFLINE_KEY, []));
  const [retrying, setRetrying] = useState(false);
  const [alreadyInBasket, setAlreadyInBasket] = useState(false);
  const lastScanRef = useRef({ value: '', ts: 0 });

  useEffect(() => {
    base44.functions.invoke('getMyStaffProfile').then(res => setStaffProfile(res.data)).catch(() => {});
  }, []);

  const isHubAdmin = staffProfile?.is_admin || staffProfile?.system_role === 'super_admin';

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: trailers = [] } = useQuery({
    queryKey: ['active-trailers'],
    queryFn: () => base44.entities.SiteAsset.filter({ asset_type: 'trailer', is_active: true }),
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-today-assignments', staffProfile?.id],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: new Date().toISOString().slice(0, 10) }),
    enabled: !!staffProfile?.id,
  });

  const todaysJobs = useMemo(() => {
    const activeJobIds = myAssignments
      .filter(a => (a.status || 'assigned') !== 'completed' && a.job_id)
      .map(a => a.job_id);
    const uniqueIds = [...new Set(activeJobIds)];
    return uniqueIds.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  }, [myAssignments, jobs]);

  const { data: outstandingAssignments = [] } = useQuery({
    queryKey: ['outstanding-asset-assignments', staffProfile?.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ status: { $in: ['assigned', 'on_site'] } }),
    enabled: !!staffProfile?.id && direction === 'return',
  });

  const returnJobs = useMemo(() => {
    const jobIds = [...new Set(outstandingAssignments.map(a => a.job_id).filter(Boolean))];
    return jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  }, [outstandingAssignments, jobs]);

  const availableJobs = direction === 'signout' ? todaysJobs : returnJobs;

  const quickStats = useMemo(() => {
    const active = assets.filter(a => a.is_active !== false);
    const compliant = active.filter(a => a.compliance_status === 'compliant').length;
    const issues = active.filter(a => a.compliance_status === 'expired' || a.compliance_status === 'expiring').length;
    const rigs = active.filter(a => a.is_rig === true).length;
    return { total: active.length, compliant, issues, rigs };
  }, [assets]);

  const [resolving, setResolving] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);

  const pushRecent = useCallback((asset) => {
    setRecent(prev => {
      const filtered = prev.filter(r => r.id !== asset.id);
      const next = [{ id: asset.id, name: asset.name, serial_number: asset.serial_number, compliance_status: asset.compliance_status }, ...filtered].slice(0, 10);
      saveJSON(RECENT_KEY, next);
      return next;
    });
  }, []);

  const handleScan = useCallback(async (val) => {
    const q = val.trim();
    if (!q) return;
    // Deduplicate rapid-fire scans from the BarcodeDetector (fires every frame).
    // Same value within 2s is ignored entirely — prevents duplicate toasts/popups.
    const now = Date.now();
    if (lastScanRef.current.value === q && now - lastScanRef.current.ts < 2000) return;
    lastScanRef.current = { value: q, ts: now };
    setResolving(true);
    setScanError('');
    try {
      const res = await base44.functions.invoke('resolveAssetByQR', { scan: q });
      const data = res.data || res;
      if (data.needs_confirm) {
        setResolving(false);
        setScanError('');
        setLastScan(data.name || val);
        setScanResult(null);
        setPendingPanda(data);
        return;
      }
      const found = data.asset;
      if (!found) {
        setResolving(false);
        playError();
        setScanError(val);
        setLastScan('');
        setScanResult(null);
        return;
      }
      playSuccess();
      setScanError('');
      setLastScan(found.name);
      setScanResult(found);
      setPendingPanda(null);
      setAlreadyInBasket(basketRef.current.some(a => a.id === found.id));
      pushRecent(found);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      if (data.source === 'panda' && data.created) {
        toast({ title: 'New from Asset Panda', description: `${found.name} added to local inventory` });
      }
      // Background refresh from Asset Panda — non-blocking, updates the card in place
      if (data.refresh_from_panda && found.panda_asset_id) {
        setRefreshingId(found.id);
        base44.functions.invoke('refreshScannedAsset', { site_asset_id: found.id })
          .then((res) => {
            const updated = res.data?.asset || res.asset;
            if (updated) {
              setScanResult((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
              setBasket((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
              queryClient.invalidateQueries({ queryKey: ['site-assets'] });
            }
          })
          .catch(() => {})
          .finally(() => setRefreshingId(null));
      }
    } catch (e) {
      // Network/resolve failure — queue offline for retry
      playError();
      setOfflineScans(prev => {
        const next = [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value: q, timestamp: new Date().toISOString() }];
        saveJSON(OFFLINE_KEY, next);
        return next;
      });
      setScanError(val);
      setLastScan('');
      setScanResult(null);
    }
    setResolving(false);
  }, [toast, queryClient, pushRecent]);

  // Auto-retry offline scans when connectivity returns
  useEffect(() => {
    const onOnline = () => {
      if (offlineScans.length === 0) return;
      setRetrying(true);
      (async () => {
        const pending = [...offlineScans];
        for (const item of pending) {
          await handleScan(item.value);
        }
        setOfflineScans([]);
        saveJSON(OFFLINE_KEY, []);
        setRetrying(false);
      })();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [offlineScans, handleScan]);

  const retryOffline = async () => {
    if (offlineScans.length === 0) return;
    setRetrying(true);
    const pending = [...offlineScans];
    for (const item of pending) {
      await handleScan(item.value);
    }
    setOfflineScans([]);
    saveJSON(OFFLINE_KEY, []);
    setRetrying(false);
  };

  const dismissOffline = () => {
    setOfflineScans([]);
    saveJSON(OFFLINE_KEY, []);
  };

  const handleSelectResult = (asset) => {
    playSuccess();
    setBasket((prev) => prev.find(a => a.id === asset.id) ? prev : [...prev, asset]);
    pushRecent(asset);
  };

  const handleScanNext = useCallback(() => {
    setScanResult(null);
    setScanError('');
    setPendingPanda(null);
    setAlreadyInBasket(false);
  }, []);

  const handleAddToBasket = useCallback((asset, qty = 1) => {
    setBasket(prev => prev.find(a => a.id === asset.id) ? prev : [...prev, { ...asset, _qty: qty }]);
    handleScanNext();
  }, [handleScanNext]);

  const handleViewAsset = useCallback((asset) => {
    setCommandAsset(asset);
  }, []);

  const removeFromBasket = (id) => setBasket((prev) => prev.filter((a) => a.id !== id));
  const clearBasket = () => { setBasket([]); setSelectedJobId(''); setSelectedVehicleId(''); setSelectedTrailerId(''); };

  const toggleKiosk = () => {
    if (kioskLocked) {
      disableKioskScannerMode();
      setKioskLocked(false);
      toast({ title: 'Kiosk mode disabled', description: 'This device will open the dashboard normally.' });
    } else {
      enableKioskScannerMode();
      setKioskLocked(true);
      toast({ title: 'Kiosk mode enabled', description: 'This device will auto-open the scanner on every load.' });
    }
  };

  const handleConfirmPandaLink = async () => {
    if (!pendingPanda) return;
    setConfirming(true);
    try {
      const res = await base44.functions.invoke('confirmPandaScanLink', {
        panda_id: pendingPanda.panda_id,
        group_id: pendingPanda.group_id,
        barcode: pendingPanda.barcode || '',
      });
      const created = res.data?.asset || res.asset;
      if (created) {
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        setScanResult(created);
        setLastScan(created.name);
        setPendingPanda(null);
        setAlreadyInBasket(false);
        pushRecent(created);
        toast({ title: 'Linked to Asset Panda', description: `${created.name} added to your inventory` });
      } else {
        toast({ title: 'Could not link', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not link', description: e.message, variant: 'destructive' });
    }
    setConfirming(false);
  };

  const handleCommit = async () => {
    if (!selectedJobId || basket.length === 0) return;
    const job = availableJobs.find(j => j.id === selectedJobId);
    const jobName = job?.name || '';
    setCommitting(true);
    try {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || '';
      const assetIds = basket.map(a => a.id);

      if (direction === 'signout') {
        const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
        const vehicleName = selectedVehicle ? `${selectedVehicle.name}${selectedVehicle.registration_number ? ` (${selectedVehicle.registration_number})` : ''}` : '';
        const selectedTrailer = trailers.find(t => t.id === selectedTrailerId);
        const trailerName = selectedTrailer?.name || '';
        const quantities = {};
        basket.forEach(a => { quantities[a.id] = a._qty || 1; });
        const res = await base44.functions.invoke('commitBasketSignOut', {
          asset_ids: assetIds,
          quantities,
          job_id: selectedJobId,
          job_name: jobName,
          staff_id: me?.id,
          staff_name: myName,
          vehicle_id: selectedVehicleId || '',
          vehicle_name: vehicleName,
          trailer_id: selectedTrailerId || '',
          trailer_name: trailerName,
        });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        playConfirm();
        toast({ title: 'Signed Out', description: `${data.assignments_created || assetIds.length} item(s) assigned to ${jobName}.` });
      } else {
        const quantities = {};
        basket.forEach(a => { quantities[a.id] = a._qty || 1; });
        const res = await base44.functions.invoke('processAssetReturn', {
          job_id: selectedJobId,
          job_name: jobName,
          staff_id: me?.id,
          staff_name: myName,
          scanned_asset_ids: assetIds,
          quantities,
        });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        playConfirm();
        toast({ title: 'Returned to Yard', description: `${data.assets_returned || assetIds.length} item(s) returned from ${jobName}.` });
      }

      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-asset-assignments'] });
      clearBasket();
      setLastScan('');
      setScanResult(null);
    } catch (e) {
      toast({ title: 'Commit failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setCommitting(false);
  };

  const handleBooked = () => {
    clearBasket();
    setShowBook(false);
    setLastScan('');
    setScanResult(null);
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };

  if (mode === 'goods-in') {
    return <GoodsInDeliveryNote onBack={() => setMode('assets')} />;
  }

  if (mode === 'pick-lists') {
    return <ScannerPickListsMode onBack={() => setMode('assets')} />;
  }

  if (mode === 'site-collect') {
    return (
      <>
        <div className="fixed inset-0 bg-[#F5FBF6] flex flex-col">
          <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setMode('assets')} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition active:scale-95">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <PackageOpen className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h1 className="text-hub-title font-bold text-slate-900 leading-tight">Site Collection</h1>
                <p className="text-hub-caption text-slate-400">Scan QR codes to collect items from site</p>
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl xl:max-w-4xl mx-auto w-full p-4">
              <SiteCollectMode staff={staffProfile} onOpenScanner={(d) => setScanDelivery(d)} />
            </div>
          </div>
        </div>
        {scanDelivery && (
          <SiteCollectionScanner delivery={scanDelivery} onClose={() => setScanDelivery(null)} />
        )}
      </>
    );
  }

  const isSignOut = direction === 'signout';

  return (
    <div className="fixed inset-0 bg-[#F5FBF6] flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-lg border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5 min-w-0">
          {!kioskLocked && (
            <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(isHubAdmin ? '/admin' : '/staff-schedule'))} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95 touch-manipulation">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
            <ScanLine className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-hub-title font-bold text-slate-900 leading-tight">Asset Scanner</h1>
            <p className="text-hub-caption text-slate-500">{basket.length} item{basket.length !== 1 ? 's' : ''} · {isSignOut ? 'Sign Out' : 'Return'} mode</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isHubAdmin && (
            <button
              onClick={toggleKiosk}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 ${kioskLocked ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-600'}`}
            >
              {kioskLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="hidden sm:inline">{kioskLocked ? 'Kiosk On' : 'Kiosk'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Unified TabBar — replaces the old dual mode-toggles + FieldHubTabs */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-slate-200 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TabBar
            tabs={[
              { id: 'scan', label: 'Scan', icon: ScanLine },
              { id: 'mygear', label: 'My Gear', icon: Wrench },
              { id: 'pick-lists', label: 'Pick Lists', icon: ClipboardList },
              ...(isHubAdmin ? [{ id: 'goods-in', label: 'Goods In', icon: Store }] : []),
              { id: 'collect', label: 'Collect', icon: PackageOpen },
            ]}
            activeTab={mode === 'assets' ? hubTab : mode}
            onChange={(tabId) => {
              if (tabId === 'scan') { setMode('assets'); setHubTab('scan'); }
              else if (tabId === 'mygear') { setMode('assets'); setHubTab('mygear'); }
              else if (tabId === 'pick-lists') setMode('pick-lists');
              else if (tabId === 'goods-in') setMode('goods-in');
              else if (tabId === 'collect') setMode('site-collect');
            }}
          />
          <button
            onClick={() => setShowConsumableModal(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition active:scale-95 bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <Package className="w-3.5 h-3.5" /> Use Stock
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl xl:max-w-4xl mx-auto w-full p-4 space-y-hub-gap-sm sm:space-y-hub-gap" style={{ paddingBottom: basket.length > 0 ? '100px' : '16px' }}>
          {hubTab === 'scan' && (
            <>
              {/* Offline queue banner */}
              <OfflineScanQueueBanner
                count={offlineScans.length}
                retrying={retrying}
                onRetry={retryOffline}
                onDismiss={dismissOffline}
              />

              {/* Recent scans strip */}
              <RecentScansStrip
                recent={recent}
                onSelect={handleSelectResult}
                onClear={() => { setRecent([]); saveJSON(RECENT_KEY, []); }}
              />

              {/* Compact stats strip */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-600">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="tabular-nums">{quickStats.total}</span> assets
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-600">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span className="tabular-nums">{quickStats.rigs}</span> rigs
                </span>
                {quickStats.issues > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 font-semibold text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{quickStats.issues}</span> issues
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All clear
                  </span>
                )}
              </div>

              {/* Hero scan card — focal point with integrated direction toggle */}
              <div className="relative rounded-3xl overflow-hidden insight-card">
                <div className="absolute inset-0 bg-gradient-to-br from-[#2E5A1A] via-[#3a7a22] to-[#1c4a12]" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(141,198,63,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(16,185,129,0.3) 0%, transparent 50%)' }} />
                <div className="relative p-6 flex flex-col items-center text-center">
                  {/* Direction toggle — integrated */}
                  <div className="flex gap-1 p-1 bg-white/15 backdrop-blur-md rounded-xl mb-5 w-full max-w-xs">
                    <button
                      onClick={() => { setDirection('signout'); setSelectedJobId(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${isSignOut ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-white/80'}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Sign Out
                    </button>
                    <button
                      onClick={() => { setDirection('return'); setSelectedJobId(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${!isSignOut ? 'bg-white text-sky-700 shadow-sm' : 'text-white/80'}`}
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Return
                    </button>
                  </div>

                  {/* Scan button — the focal point */}
                  <button
                    onClick={() => setShowFullScreen(true)}
                    className="relative w-28 h-28 rounded-full bg-white/15 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-2xl active:scale-95 transition group"
                  >
                    <span className="absolute -inset-3 rounded-full bg-emerald-400/20 blur-xl animate-pulse group-hover:bg-emerald-400/30" />
                    <span className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping-slow" />
                    <Barcode className="w-12 h-12 text-white relative z-10" />
                  </button>
                  <p className="mt-5 text-lg font-bold text-white">Tap to Scan</p>
                  <p className="text-sm text-white/70 mt-0.5">
                    {isSignOut ? 'Sign out gear to a job' : 'Return gear to the yard'}
                  </p>
                </div>
              </div>

              {/* Scanner + My Gear split (tablet) / stacked (mobile) */}
              <div className="md:grid md:grid-cols-2 md:gap-hub-gap">
                <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
                  {/* Resolving overlay (when full-screen scanner is closed) */}
                  {resolving && !showFullScreen && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-2.5">
                      <div className="w-5 h-5 border-2 border-[#2E5A1A] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium text-[#2E5A1A]">Checking Asset Panda…</p>
                    </div>
                  )}

                </div>

                {/* My Gear manifest — tablet sidebar */}
                <div className="hidden md:block">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-emerald-700" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">My Gear Manifest</h3>
                    </div>
                    <MyGearTab staffProfile={staffProfile} allAssets={assets} onOpenAsset={setCommandAsset} />
                  </div>
                </div>
              </div>
            </>
          )}

          {hubTab === 'mygear' && (
            <MyGearTab staffProfile={staffProfile} allAssets={assets} onOpenAsset={setCommandAsset} />
          )}
        </div>
      </div>

      {/* Unified sticky basket */}
      {hubTab === 'scan' && basket.length > 0 && (
        <UnifiedScanBasket
          items={basket}
          onRemove={removeFromBasket}
          onClear={clearBasket}
          direction={direction}
          onToggleDirection={(d) => { setDirection(d); setSelectedJobId(''); setSelectedVehicleId(''); setSelectedTrailerId(''); }}
          onCommit={handleCommit}
          committing={committing}
          jobs={availableJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          onSelectVehicle={setSelectedVehicleId}
          trailers={trailers}
          selectedTrailerId={selectedTrailerId}
          onSelectTrailer={setSelectedTrailerId}
        />
      )}

      {/* Full-screen scanner overlay */}
      {showFullScreen && (
        <FullScreenScanner
          onScan={handleScan}
          onClose={() => setShowFullScreen(false)}
          resolving={resolving}
          scanResult={scanResult}
          scanError={scanError}
          pendingPanda={pendingPanda}
          alreadyInBasket={alreadyInBasket}
          confirming={confirming}
          refreshing={refreshingId === scanResult?.id}
          onViewAsset={handleViewAsset}
          onScanNext={handleScanNext}
          onAddToBasket={handleAddToBasket}
          onConfirmPanda={handleConfirmPandaLink}
          onCancelPanda={() => { setPendingPanda(null); setLastScan(''); }}
        />
      )}

      {/* Book to Vehicle modal */}
      {showBook && (
        <BookToVehicleModal assets={basket} onClose={() => setShowBook(false)} onSuccess={handleBooked} />
      )}

      {/* Asset Command Drawer */}
      {commandAsset && (
        <AssetCommandDrawer
          asset={commandAsset}
          allAssets={assets}
          staffProfile={staffProfile}
          onClose={() => setCommandAsset(null)}
          onDriveAway={(asset) => { setCommandAsset(null); setDriveAwayAsset(asset); }}
          onBookToVehicle={(asset) => { setCommandAsset(null); setBasket([asset]); setShowBook(true); }}
          onReportFault={(asset) => { setCommandAsset(null); setFaultAsset(asset); }}
        />
      )}

      {/* Drive Away */}
      {driveAwayAsset && (
        <DriveAwayModal
          asset={driveAwayAsset}
          staffProfile={staffProfile}
          onClose={() => setDriveAwayAsset(null)}
          onSuccess={() => { setDriveAwayAsset(null); setLastScan(''); }}
        />
      )}

      {/* Report Fault */}
      {faultAsset && (
        <ReportFaultModal
          asset={faultAsset}
          staffProfile={staffProfile}
          onClose={() => setFaultAsset(null)}
        />
      )}

      {/* Consumable Usage Modal */}
      {showConsumableModal && (
        <ConsumableUsageModal
          onClose={() => setShowConsumableModal(false)}
          onUsed={() => queryClient.invalidateQueries({ queryKey: ['consumable-stock-items'] })}
        />
      )}
    </div>
  );
}