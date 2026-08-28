import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, ScanLine, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldX, Cog, Wrench, Package, Truck, Anchor,
  Database, Link2, AlertCircle, Camera, FileText, QrCode, Wrench as WrenchIcon,
  Trash2, History, Layers, Scan, Clock, CalendarClock, Gauge, Plug,
  Plus, ChevronUp, ChevronDown, Award, ExternalLink,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { playSuccess, playError, playConfirm } from '@/utils/scanFeedback';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import AssetPassportDrawer from '@/components/assetcommand/AssetPassportDrawer';
import AssetQRCard from '@/components/assetcommand/AssetQRCard';
import BookToVehicleModal from '@/components/assetcommand/BookToVehicleModal';
import ScrapModal from '@/components/assetcommand/ScrapModal';
import AssetMovementHistory from '@/components/assetcommand/AssetMovementHistory';
import BulkScanBasket from '@/components/logistics/BulkScanBasket';
import QuickAddAssetModal from '@/components/assetcommand/QuickAddAssetModal';
import PATTestModal from '@/components/assetcommand/PATTestModal';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { label: 'PAT', icon: Plug, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: AlertCircle },
};

const SYNC_META = {
  synced: { label: 'Synced', tone: 'text-emerald-700' },
  pending: { label: 'Pending', tone: 'text-amber-700' },
  failed: { label: 'Failed', tone: 'text-red-700' },
  never: { label: 'Never synced', tone: 'text-slate-500' },
};

const SERVICE_TYPES = [
  { value: 'service', label: 'Service' },
  { value: 'repair', label: 'Repair' },
  { value: 'loler_inspection', label: 'LOLER Inspection' },
  { value: 'puwer_inspection', label: 'PUWER Inspection' },
  { value: 'pre_use_check', label: 'Pre-use Check' },
];

export default function AssetLens({ open, onClose, assets: propAssets = [] }) {
  const queryClient = useQueryClient();
  const [basket, setBasket] = useState([]);
  const [basketExpanded, setBasketExpanded] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [scanError, setScanError] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [passportAsset, setPassportAsset] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showBookVehicle, setShowBookVehicle] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ record_type: 'service', result: 'pass', notes: '' });
  const [savingService, setSavingService] = useState(false);
  const [showScrap, setShowScrap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkHistory, setShowBulkHistory] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showPAT, setShowPAT] = useState(false);
  const [pushingToPanda, setPushingToPanda] = useState(false);

  const { data: config = null } = useQuery({
    queryKey: ['assetpanda-config'],
    queryFn: async () => { const list = await base44.entities.AssetPandaConfig.filter({ key: 'global' }); return list[0] || null; },
    enabled: open,
  });

  const { data: fetchedAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
    enabled: open && propAssets.length === 0,
  });
  const allAssets = propAssets.length > 0 ? propAssets : fetchedAssets;

  // Live search — compute ALL matches as the user types (in-memory, instant)
  const matches = useMemo(() => {
    const q = scannedValue.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allAssets.filter((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      return (sn && sn.includes(q)) || (pid && pid.includes(q)) || (nm && nm.includes(q));
    }).slice(0, 8);
  }, [scannedValue, allAssets]);

  // The actively selected asset — either user-picked, or auto-selected when exactly 1 match
  const match = useMemo(() => {
    if (selectedAssetId) return allAssets.find((a) => a.id === selectedAssetId) || null;
    if (matches.length === 1) return matches[0];
    return null;
  }, [matches, selectedAssetId, allAssets]);

  // Fetch certificates (service records with certificate_url) for the matched asset
  const { data: certificates = [] } = useQuery({
    queryKey: ['asset-certificates', match?.id],
    queryFn: async () => {
      const all = await base44.entities.ServiceRecord.filter({ site_asset_id: match.id });
      return all.filter(s => s.certificate_url).sort((a, b) => {
        const da = a.date ? new Date(a.date.includes('T') ? a.date : a.date + 'T00:00:00').getTime() : 0;
        const db = b.date ? new Date(b.date.includes('T') ? b.date : b.date + 'T00:00:00').getTime() : 0;
        return db - da;
      });
    },
    enabled: !!match,
  });

  // Live search — fires on every keystroke (in-memory, no debounce needed)
  const handleLiveSearch = useCallback((val) => {
    setScannedValue(val);
    setSelectedAssetId(null);
    setScanError('');
    setLastScan('');
  }, []);

  // Unified scan handler — camera scan or manual submit: audio feedback + auto-basket
  const handleScan = useCallback((val) => {
    const q = val.trim().toLowerCase();
    if (!q) return;
    setScannedValue(val);
    const found = allAssets.find((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      return sn === q || pid === q || nm === q || (sn && sn.includes(q)) || (pid && pid.includes(q));
    });
    if (found) {
      playSuccess();
      setLastScan(found.name);
      setScanError('');
      setSelectedAssetId(found.id);
      setBasket((prev) => prev.find((a) => a.id === found.id) ? prev : [...prev, found]);
    } else {
      playError();
      setLastScan('');
      setScanError(val);
    }
  }, [allAssets]);

  // User picks an asset from the live results list
  const selectAsset = useCallback((asset) => {
    playSuccess();
    setLastScan(asset.name);
    setScanError('');
    setSelectedAssetId(asset.id);
    setScannedValue(asset.serial_number || asset.name || '');
    setBasket((prev) => prev.find((a) => a.id === asset.id) ? prev : [...prev, asset]);
  }, []);

  const removeFromBasket = (id) => setBasket((prev) => prev.filter((a) => a.id !== id));
  const clearBasket = () => setBasket([]);

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null); setSyncError(null);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      setSyncResult(res);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetpanda-config'] });
    } catch (e) { setSyncError(e?.message || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const pushToPanda = async (assetId, action = 'update') => {
    setPushingToPanda(true);
    try {
      await base44.functions.invoke('pushAssetUpdateToPanda', { asset_id: assetId, action });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    } catch (e) { console.warn('Panda push failed:', e); }
    setPushingToPanda(false);
  };

  const handleSaveService = async () => {
    if (!match) return;
    setSavingService(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await base44.entities.ServiceRecord.create({
        site_asset_id: match.id,
        record_type: serviceForm.record_type,
        date: today,
        result: serviceForm.result,
        notes: serviceForm.notes,
      });
      if (serviceForm.record_type === 'repair' || serviceForm.result === 'fail') {
        await base44.entities.SiteAsset.update(match.id, {
          maintenance_status: serviceForm.result === 'fail' ? 'overdue' : 'due_soon',
          repair_notes: serviceForm.notes,
          service_notes: serviceForm.notes,
        });
      } else {
        await base44.entities.SiteAsset.update(match.id, {
          last_service_date: today,
          service_notes: serviceForm.notes,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records'] });
      // Push to Asset Panda
      await pushToPanda(match.id, 'update');
      playConfirm();
      setShowServiceForm(false);
      setServiceForm({ record_type: 'service', result: 'pass', notes: '' });
    } catch (e) { console.error('Service save error:', e); }
    setSavingService(false);
  };

  if (!open) return null;

  const typeMeta = match ? TYPE_META[match.asset_type] || TYPE_META.machinery : null;
  const compMeta = match ? COMPLIANCE_META[match.compliance_status] || COMPLIANCE_META.unknown : null;
  const syncMeta = match ? SYNC_META[match.sync_status] || SYNC_META.never : null;
  const isPortable = match?.asset_type === 'portable_appliance';

  const maintTone = match?.maintenance_status === 'overdue' ? 'text-red-600'
    : match?.maintenance_status === 'due_soon' ? 'text-amber-600'
    : match?.maintenance_status === 'ok' ? 'text-emerald-600' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white shadow-2xl w-full h-[100dvh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 sticky top-0 bg-white z-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Logistics Hub</h3>
              <p className="text-[11px] text-slate-400">Scan · Search · Book · Sync — all in one place</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition active:scale-90">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Scanner — always at top, no mode toggle */}
        <div className="p-4 pb-2 space-y-3">
          <BarcodeScanner onScan={handleScan} onSearch={handleLiveSearch} placeholder="Scan QR / type serial / search name…" autoFocus={false} />

          {/* Config warning */}
          {!config?.group_id && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Asset Panda isn't configured. Add your API token + group ID in Settings → Asset Panda Sync Data.</span>
            </div>
          )}

          {/* Last scan feedback */}
          {lastScan && !scanError && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 animate-pop-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-800 font-semibold truncate">Recognised: {lastScan}</p>
            </div>
          )}
          {scanError && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-medium flex-1 truncate">Not in inventory: "{scanError}"</p>
              <button onClick={() => setShowQuickAdd(true)} className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          )}
        </div>

        {/* Content area — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* No scan yet / too short to search */}
          {scannedValue.trim().length < 2 && !match && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Ready to scan</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Point the camera at a QR label, or type a serial number / name above. Found items show instantly and collect in the basket below.</p>
            </div>
          )}

          {/* Multiple matches — pick one */}
          {scannedValue.trim() && matches.length > 1 && !match && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 px-1">{matches.length} matches — tap the right one</p>
              {matches.map((a) => {
                const tm = TYPE_META[a.asset_type] || TYPE_META.machinery;
                const cm = COMPLIANCE_META[a.compliance_status] || COMPLIANCE_META.unknown;
                return (
                  <button key={a.id} onClick={() => selectAsset(a)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/50 transition active:scale-[0.98] text-left">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${tm.tint}`}>
                      <tm.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{a.serial_number || '—'}</p>
                    </div>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${cm.tone}`}>
                      <cm.Icon className="w-3 h-3" /> {cm.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No match */}
          {scannedValue.trim().length >= 2 && matches.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 mb-1">No asset matches "{scannedValue}"</p>
              <p className="text-xs text-slate-500 mb-3">This might be a new item. Add it to your inventory and it'll sync to Asset Panda.</p>
              <button onClick={() => setShowQuickAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition active:scale-95">
                <Plus className="w-4 h-4" /> Add to Inventory
              </button>
            </div>
          )}

          {/* Match found — full detail panel */}
          {match && typeMeta && (
            <div className="space-y-3">
              {/* Asset identity card */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3.5 py-3 flex items-center gap-3 border-b border-slate-100">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border flex-shrink-0 ${typeMeta.tint}`}>
                    <typeMeta.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{match.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono">{match.serial_number || '—'}</span>
                      {match.rig_type && match.rig_type !== 'n/a' && <span className="text-[10px] uppercase font-semibold text-slate-500">{match.rig_type}</span>}
                      {!match.is_active && <span className="text-[10px] uppercase font-bold text-red-600">Inactive</span>}
                    </p>
                  </div>
                  <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${compMeta.tone}`}>
                    <compMeta.Icon className="w-3 h-3" /> {compMeta.label}
                  </div>
                </div>

                {/* Quick info strip — 3 key stats, fully readable on mobile + web */}
                <div className="grid grid-cols-3 gap-px bg-slate-100 border-t border-slate-100">
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide flex items-center gap-1 mb-1 whitespace-nowrap"><CalendarClock className="w-3 h-3" /> Compliance</p>
                    <p className="text-sm font-bold text-slate-800 leading-tight whitespace-nowrap">
                      {match.compliance_expiry_date ? safeFormat(match.compliance_expiry_date, 'dd MMM yy') : 'Lifetime'}
                    </p>
                    <p className={`text-[10px] font-semibold mt-0.5 whitespace-nowrap ${
                      match.compliance_status === 'compliant' ? 'text-emerald-600' :
                      match.compliance_status === 'expiring' ? 'text-amber-600' :
                      match.compliance_status === 'expired' ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {match.compliance_expiry_date ? (match.compliance_status === 'compliant' ? 'In date' : match.compliance_status === 'expiring' ? 'Expiring' : 'Expired') : 'No expiry'}
                    </p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide flex items-center gap-1 mb-1 whitespace-nowrap"><Wrench className="w-3 h-3" /> Last Service</p>
                    <p className="text-sm font-bold text-slate-800 leading-tight whitespace-nowrap">
                      {match.last_service_date ? safeFormat(match.last_service_date, 'dd MMM yy') : 'None'}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">
                      {match.next_service_date ? `Next ${safeFormat(match.next_service_date, 'dd MMM')}` : 'No schedule'}
                    </p>
                  </div>
                  <div className="bg-white px-3 py-2.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide flex items-center gap-1 mb-1 whitespace-nowrap">
                      {match.asset_type === 'rig' ? <Gauge className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {match.asset_type === 'rig' ? 'Op. Hours' : 'Maint.'}
                    </p>
                    {match.asset_type === 'rig' ? (
                      <>
                        <p className="text-sm font-bold text-slate-800 leading-tight whitespace-nowrap">{Math.round(match.operating_hours || 0)}h</p>
                        <p className={`text-[10px] font-semibold mt-0.5 whitespace-nowrap ${maintTone}`}>
                          {match.service_interval_hours ? `${Math.round(match.hours_since_last_service || 0)}h / ${match.service_interval_hours}h` : (match.maintenance_status || 'unknown').replace(/_/g, ' ')}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm font-bold leading-tight whitespace-nowrap ${maintTone}`}>{(match.maintenance_status || 'unknown').replace(/_/g, ' ')}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">
                          {match.responsible_person ? match.responsible_person : 'No keeper'}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Stock + sync provenance */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
                  <div className="px-3.5 py-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-medium text-slate-400">Stock</span>
                    <span className="text-xs font-semibold text-slate-700">{(match.stock_level || 'unknown').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="px-3.5 py-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-medium text-slate-400 flex items-center gap-1"><Link2 className="w-2.5 h-2.5" /> Panda</span>
                    <span className={`text-[11px] font-medium ${syncMeta.tone}`}>{syncMeta.label}</span>
                  </div>
                </div>
              </div>

              {/* Certificates section */}
              {certificates.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-xs font-semibold text-slate-800">Certificates ({certificates.length})</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {certificates.map((cert) => (
                      <a key={cert.id} href={cert.certificate_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition">
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 truncate">{cert.certificate_name || 'Certificate'}</p>
                          <p className="text-[10px] text-slate-400">{cert.record_type?.replace(/_/g, ' ')} · {cert.date ? safeFormat(cert.date, 'dd MMM yyyy') : '—'} · {cert.result?.toUpperCase()}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — compact grid */}
              <div className="grid grid-cols-4 gap-2">
                <ActionBtn icon={FileText} label="Passport" tint="bg-slate-800 text-white" onClick={() => setPassportAsset(match)} />
                <ActionBtn icon={History} label="History" tint="bg-blue-600 text-white" onClick={() => setShowHistory(s => !s)} />
                <ActionBtn icon={Wrench} label="Service" tint="bg-amber-600 text-white" onClick={() => setShowServiceForm(s => !s)} />
                {isPortable
                  ? <ActionBtn icon={Plug} label="PAT Test" tint="bg-purple-600 text-white" onClick={() => setShowPAT(true)} />
                  : <ActionBtn icon={Trash2} label="Scrap" tint="bg-red-600 text-white" onClick={() => setShowScrap(true)} />
                }
                <ActionBtn icon={Truck} label="Book" tint="bg-emerald-700 text-white" onClick={() => setShowBookVehicle(true)} />
                <ActionBtn icon={QrCode} label="QR" tint="bg-slate-100 text-slate-700" onClick={() => setShowQR(true)} />
                <ActionBtn icon={Layers} label={`Basket (${basket.length})`} tint="bg-emerald-100 text-emerald-700" onClick={() => setBasketExpanded(s => !s)} hidden={basket.length === 0} />
              </div>

              {/* Movement History */}
              {showHistory && <AssetMovementHistory asset={match} />}

              {/* Inline service form */}
              {showServiceForm && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Quick Service / Repair Log</p>
                    <button onClick={() => setShowServiceForm(false)} className="p-1.5 text-slate-400 hover:bg-white rounded-lg"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Type</label>
                      <select value={serviceForm.record_type} onChange={e => setServiceForm(p => ({ ...p, record_type: e.target.value }))}
                        className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                        {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Result</label>
                      <select value={serviceForm.result} onChange={e => setServiceForm(p => ({ ...p, result: e.target.value }))}
                        className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                        <option value="advisory">Advisory</option>
                        <option value="n/a">N/A</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Notes</label>
                    <textarea value={serviceForm.notes} onChange={e => setServiceForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                      placeholder="Findings, defects, parts replaced…" className="w-full px-2.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
                  </div>
                  <button onClick={handleSaveService} disabled={savingService || pushingToPanda}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-60 active:scale-95">
                    {savingService ? <Loader2 className="w-4 h-4 animate-spin" /> : pushingToPanda ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    {savingService ? 'Saving…' : pushingToPanda ? 'Syncing to Panda…' : 'Save & Sync to Panda'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sync action */}
          <div className="pt-1 border-t border-slate-100">
            <button onClick={handleSync} disabled={syncing || !config?.group_id}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm active:scale-95">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing from Asset Panda…' : 'Refresh all from Asset Panda'}
            </button>
            {syncError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {syncError}</p>}
            {syncResult && <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {syncResult.summary || 'Sync complete'}</p>}
            <p className="text-[10px] text-slate-400 mt-2 text-center flex items-center justify-center gap-1">
              <Database className="w-3 h-3" /> {allAssets.length} assets in cache · last sync {config?.last_sync_at ? safeFormat(config.last_sync_at, 'dd MMM HH:mm') : 'never'}
            </p>
          </div>
        </div>

        {/* Basket tray — sticky bottom */}
        {basket.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 z-20">
            <button onClick={() => setBasketExpanded(s => !s)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Basket: {basket.length} item{basket.length !== 1 ? 's' : ''}</span>
              </div>
              {basketExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
            </button>
            {basketExpanded && (
              <div className="px-4 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
                <BulkScanBasket items={basket} onRemove={removeFromBasket} onClear={clearBasket} />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowBulkHistory(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-xs hover:bg-blue-700 transition active:scale-95">
                    <History className="w-4 h-4" /> History
                  </button>
                  <button onClick={() => setShowBookVehicle(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-700 text-white rounded-lg font-semibold text-xs hover:bg-emerald-800 transition active:scale-95">
                    <Truck className="w-4 h-4" /> Book to Vehicle
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlays */}
      {passportAsset && (
        <AssetPassportDrawer asset={passportAsset} allAssets={allAssets} onClose={() => setPassportAsset(null)} />
      )}
      {showQR && match && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQR(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">QR Label</h3>
              <button onClick={() => setShowQR(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-5"><AssetQRCard asset={match} /></div>
          </div>
        </div>
      )}
      {showBookVehicle && (basket.length > 0
        ? <BookToVehicleModal assets={basket} onClose={() => setShowBookVehicle(false)} onSuccess={clearBasket} />
        : match && <BookToVehicleModal asset={match} onClose={() => setShowBookVehicle(false)} />
      )}
      {showScrap && match && (
        <ScrapModal asset={match} onClose={() => setShowScrap(false)} />
      )}
      {showPAT && match && (
        <PATTestModal asset={match} onClose={() => setShowPAT(false)} />
      )}
      {showQuickAdd && (
        <QuickAddAssetModal scannedValue={scanError || scannedValue} onClose={() => setShowQuickAdd(false)} onCreated={(newAsset) => {
          setScannedValue(newAsset.serial_number || newAsset.name || '');
          setScanError('');
          setShowQuickAdd(false);
        }} />
      )}
      {showBulkHistory && basket.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBulkHistory(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <History className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Movement History</h3>
                  <p className="text-[11px] text-slate-400">{basket.length} items · merged timeline</p>
                </div>
              </div>
              <button onClick={() => setShowBulkHistory(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4">
              <AssetMovementHistory assets={basket} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, tint, onClick, hidden }) {
  if (hidden) return null;
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition active:scale-95 ${tint}`}>
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-bold uppercase tracking-wide leading-tight text-center">{label}</span>
    </button>
  );
}