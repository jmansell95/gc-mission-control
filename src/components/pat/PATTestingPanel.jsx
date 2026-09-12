import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plug, Search, ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  RefreshCw, CheckCircle2, XCircle, Clock, Printer, Zap, ChevronRight,
  ScanLine, AlertTriangle, Upload,
} from 'lucide-react';
import { daysUntil } from '@/utils/rigRollup';
import { Skeleton } from '@/components/StateViews';
import PATTestForm from '@/components/pat/PATTestForm';
import KEWPATImportModal from '@/components/pat/KEWPATImportModal';
import BarcodeScanner from '@/components/staff/BarcodeScanner';
import { safeFormat } from '@/utils/format';
import { useToast } from '@/components/ui/use-toast';
import { useGlobalScanner } from '@/contexts/GlobalScannerContext';

/**
 * PATTestingPanel — the reusable PAT testing workspace.
 *
 * Renders the scanner, session log, search, asset queue, and modals.
 * Used both as a standalone page (wrapped in PageHeader by PATTestingConsole)
 * and as an embedded sub-tab inside the Asset Hub.
 */
export default function PATTestingPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openScanner } = useGlobalScanner();
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState('all');
  const [testAsset, setTestAsset] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [sessionLog, setSessionLog] = useState([]);
  const [importOpen, setImportOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const patAssets = useMemo(() => assets.filter(a => a.asset_type === 'portable_appliance'), [assets]);

  const items = useMemo(() => patAssets.map(a => {
    const d = daysUntil(a.compliance_expiry_date);
    let b;
    if (a.compliance_status === 'expired' || (d !== null && d < 0)) b = 'overdue';
    else if (a.compliance_status === 'expiring' || (d !== null && d <= 30)) b = 'due_soon';
    else if (a.compliance_status === 'unknown' || d === null) b = 'unknown';
    else b = 'ok';
    return { asset: a, bucket: b, days: d };
  }), [patAssets]);

  const counts = useMemo(() => ({
    overdue: items.filter(i => i.bucket === 'overdue').length,
    due_soon: items.filter(i => i.bucket === 'due_soon').length,
    unknown: items.filter(i => i.bucket === 'unknown').length,
    ok: items.filter(i => i.bucket === 'ok').length,
    total: items.length,
  }), [items]);

  const q = search.toLowerCase().trim();
  const filtered = items.filter(({ asset, bucket: b }) => {
    if (bucket !== 'all' && b !== bucket) return false;
    if (!q) return true;
    return (asset.name || '').toLowerCase().includes(q)
      || (asset.serial_number || '').toLowerCase().includes(q)
      || (asset.barcode || '').toLowerCase().includes(q)
      || (asset.fleet_number || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, unknown: 2, ok: 3 };
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    return (a.days ?? 9999) - (b.days ?? 9999);
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda');
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({ title: 'Asset Panda synced', description: res.data?.summary || `${res.data?.pulled || 0} assets pulled.` });
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleTestSaved = (assetName, result) => {
    setSessionLog(prev => [...prev, { name: assetName, result, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }]);
  };

  const sessionPassed = sessionLog.filter(s => s.result === 'pass').length;
  const sessionFailed = sessionLog.filter(s => s.result === 'fail').length;

  const BUCKETS = [
    { id: 'all', label: 'All', icon: Plug, count: counts.total },
    { id: 'overdue', label: 'Overdue', icon: ShieldX, count: counts.overdue },
    { id: 'due_soon', label: 'Due Soon', icon: ShieldAlert, count: counts.due_soon },
    { id: 'unknown', label: 'No Date', icon: HelpCircle, count: counts.unknown },
    { id: 'ok', label: 'Compliant', icon: ShieldCheck, count: counts.ok },
  ];

  return (
    <div className="space-y-4">
      {/* Compact stats bar + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {BUCKETS.map(b => {
            const BIcon = b.icon;
            const active = bucket === b.id;
            return (
              <button key={b.id} onClick={() => setBucket(b.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-amber-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <BIcon className="w-3.5 h-3.5" /> {b.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{b.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:border-amber-400 hover:text-amber-600 transition shadow-sm">
            <Upload className="w-3.5 h-3.5" /> Import KEWPAT
          </button>
          <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:border-primary hover:text-primary transition shadow-sm disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync Panda'}
          </button>
        </div>
      </div>

      {/* Scanner section — opens the full-screen camera scanner */}
      <button onClick={() => openScanner({ mode: 'pat' })}
        className="w-full flex items-center gap-3 p-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl shadow-sm hover:brightness-110 transition active:scale-[0.98]">
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <ScanLine className="w-6 h-6" />
        </div>
        <div className="text-left flex-1">
          <p className="font-bold text-sm">Scan to Test</p>
          <p className="text-xs text-white/80">Opens the camera — scan, PAT test, log repairs & faults in one flow</p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60" />
      </button>

      {/* Session progress */}
      {sessionLog.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-600" /> This Session</p>
            <button onClick={() => setSessionLog([])} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> {sessionPassed} passed</span>
            <span className="flex items-center gap-1 text-red-600 font-semibold"><XCircle className="w-3.5 h-3.5" /> {sessionFailed} failed</span>
            <span className="text-slate-400">{sessionLog.length} tested</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, serial, barcode or fleet no..."
          className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 bg-white" />
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Plug className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {patAssets.length === 0
              ? 'No portable appliances found. Sync from Asset Panda or add one in Asset Hub.'
              : 'No items match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ asset, bucket, days }) => {
            const meta = bucket === 'overdue' ? { Icon: ShieldX, tone: 'text-red-600 bg-red-50 border-red-200' }
              : bucket === 'due_soon' ? { Icon: ShieldAlert, tone: 'text-amber-600 bg-amber-50 border-amber-200' }
              : bucket === 'unknown' ? { Icon: HelpCircle, tone: 'text-slate-500 bg-slate-50 border-slate-200' }
              : { Icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
            const BIcon = meta.Icon;
            return (
              <div key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${meta.tone}`}>
                  <BIcon className="w-5 h-5" />
                </div>
                <button onClick={() => setTestAsset(asset)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{asset.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {asset.equipment_type || asset.compliance_category || 'Portable Appliance'}
                      {asset.serial_number && ` · ${asset.serial_number}`}
                      {asset.fleet_number && ` · #${asset.fleet_number}`}
                    </p>
                    {days !== null && (
                      <p className={`text-[10px] font-medium ${days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`} · {safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                </button>
                <button onClick={() => setTestAsset(asset)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg text-xs font-semibold hover:brightness-110 transition flex-shrink-0 shadow-sm">
                  <Zap className="w-3.5 h-3.5" /> Test
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bluetooth printer note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5">
        <Printer className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          After saving a record, use your KEWPAT / Bluetooth printer to print the physical appliance label as normal — the digital record is now stored here.
        </p>
      </div>

      {/* Modals */}
      {testAsset && (
        <PATTestForm asset={testAsset} onClose={() => setTestAsset(null)} onSaved={handleTestSaved} />
      )}
      {importOpen && (
        <KEWPATImportModal assets={assets} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}