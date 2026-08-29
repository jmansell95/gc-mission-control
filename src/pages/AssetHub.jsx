import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug,
  Plus, Search, Boxes, ScanLine, X, TrendingUp, TrendingDown, RefreshCw, Lock, ShieldCheck,
  CheckSquare, Upload, Database, MapPin, QrCode, Trash2, CircleDot, Warehouse, AlertTriangle, Weight,
} from 'lucide-react';
import ConsumableInventoryManager from '@/components/settings/ConsumableInventoryManager';
import ConsumablesView from '@/components/assethub/ConsumablesView';
import { rollupCompliance, daysUntil } from '@/utils/rigRollup';
import RigDetailDrawer from '@/components/righub/RigDetailDrawer';
import EquipmentDetailDrawer from '@/components/righub/EquipmentDetailDrawer';
import RecertPipeline from '@/components/righub/RecertPipeline';
import MasterCertificateVault from '@/components/righub/MasterCertificateVault';
import CertificateVault from '@/components/righub/CertificateVault';
import RecertActionModal from '@/components/righub/RecertActionModal';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import FleetHealthGauge from '@/components/righub/FleetHealthGauge';
import FleetComplianceDonut from '@/components/righub/FleetComplianceDonut';
import FleetSyncPanel from '@/components/righub/FleetSyncPanel';
import DrillingEfficiencyPanel from '@/components/righub/DrillingEfficiencyPanel';
import FleetUtilizationHeatmap from '@/components/righub/FleetUtilizationHeatmap';
import AssetUtilizationTrends from '@/components/assethub/AssetUtilizationTrends';
import DepreciationSchedule from '@/components/assethub/DepreciationSchedule';
import BulkAssetUpload from '@/components/righub/BulkAssetUpload';
import SmartCertImport from '@/components/righub/SmartCertImport';
import BulkQRPrinter from '@/components/assetcommand/BulkQRPrinter';
import BulkWeightModal from '@/components/assethub/BulkWeightModal';
import PATTestingPanel from '@/components/pat/PATTestingPanel';
import ScrapPilePanel from '@/components/assetcommand/ScrapPilePanel';
import AssetInventoryGrid from '@/components/assethub/AssetInventoryGrid';
import PrintWeightRegister from '@/components/assethub/PrintWeightRegister';
import AssetDeploymentsPanel from '@/components/assethub/AssetDeploymentsPanel';
import PredictiveMaintenanceWidget from '@/components/vehicles/PredictiveMaintenanceWidget';
import PredictiveInsightsWidget from '@/components/dashboard/PredictiveInsightsWidget';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/StateViews';
import PageHeader from '@/components/PageHeader';
import RunReportButton from '@/components/reports/RunReportButton';
import TabBar from '@/components/TabBar';
import SubPills from '@/components/SubPills';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import { useAssetRealtime } from '@/hooks/useAssetRealtime';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Boxes },
  { id: 'rig', label: 'Rigs', icon: Cog },
  { id: 'lifting', label: 'Lifting', icon: Anchor },
  { id: 'machinery', label: 'Machinery', icon: Wrench },
  { id: 'trailer', label: 'Trailers', icon: Package },
  { id: 'portable_appliance', label: 'PAT', icon: Plug },
];

export default function AssetHub() {
  const navigate = useNavigate();
  useAssetRealtime();
  const [view, setView] = useState('inventory');
  const [group, setGroup] = useState('inventory');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [depotOnly, setDepotOnly] = useState(false);
  const [openRig, setOpenRig] = useState(null);
  const [openEquip, setOpenEquip] = useState(null);
  const [editorAsset, setEditorAsset] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [recertAsset, setRecertAsset] = useState(null);
  const [certVaultRig, setCertVaultRig] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkCerts, setBulkCerts] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showBulkQR, setShowBulkQR] = useState(false);
  const [showBulkWeight, setShowBulkWeight] = useState(false);
  const [groupBy, setGroupBy] = useState('none');

  const { data: allAssets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: async () => {
      // Load beyond the default 500-record cap so locally-created assets
      // buried under a large Asset Panda sync resurface in the inventory.
      return await base44.entities.SiteAsset.filter({}, '-created_date', 2000);
    },
  });

  // Vehicles are managed in the dedicated Fleet Hub — exclude them from the Assets inventory
  const assets = useMemo(() => allAssets.filter(a => a.asset_type !== 'vehicle'), [allAssets]);

  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);
  const equipment = useMemo(() => assets.filter(a => a.asset_type !== 'rig'), [assets]);

  const pandaCount = useMemo(() => assets.filter(a => a.panda_asset_id).length, [assets]);
  const localCount = useMemo(() => assets.filter(a => !a.panda_asset_id).length, [assets]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const c = { all: assets.length, rig: 0, lifting: 0, machinery: 0, trailer: 0, portable_appliance: 0 };
    assets.forEach(a => { if (c[a.asset_type] != null) c[a.asset_type]++; });
    return c;
  }, [assets]);

  // Compliance stats
  const recertCount = useMemo(() => assets.filter(a => {
    const d = daysUntil(a.compliance_expiry_date);
    const sd = daysUntil(a.next_service_date);
    return a.compliance_status === 'expired' || a.compliance_status === 'expiring'
      || (d !== null && d <= 30) || (sd !== null && sd <= 30)
      || (d === null && sd === null && a.compliance_status !== 'compliant');
  }).length, [assets]);

  const totalKnown = assets.filter(a => a.compliance_status && a.compliance_status !== 'unknown').length;
  const compliantCount = assets.filter(a => a.compliance_status === 'compliant').length;
  const fleetHealthPct = totalKnown > 0 ? (compliantCount / totalKnown) * 100 : 0;

  const fleetCounts = useMemo(() => {
    const c = { compliant: 0, expiring: 0, expired: 0, unknown: 0 };
    assets.forEach(a => { c[(a.compliance_status || 'unknown')]++; });
    return c;
  }, [assets]);

  // 4 consolidated tab groups (down from 7 flat tabs)
  const TAB_GROUPS = [
    { id: 'inventory', label: 'Inventory', icon: Boxes, sub: [
      { id: 'inventory', label: 'All Assets', icon: Boxes, count: assets.length },
      { id: 'deployments', label: 'Deployments', icon: MapPin },
      { id: 'consumables', label: 'Consumables', icon: Package },
    ]},
    { id: 'compliance', label: 'Compliance & Certs', icon: ShieldCheck, sub: [
      { id: 'compliance', label: 'Recert & Vaults', icon: ShieldCheck, badge: recertCount },
      { id: 'pat_testing', label: 'PAT Testing', icon: Plug, badge: categoryCounts.portable_appliance },
    ]},
    { id: 'performance', label: 'Performance & Lifecycle', icon: TrendingUp, sub: [
      { id: 'performance', label: 'Performance', icon: TrendingUp },
      { id: 'lifecycle', label: 'Lifecycle', icon: TrendingDown },
      { id: 'scrap', label: 'Scrap Pile', icon: Trash2 },
    ]},
    { id: 'tools', label: 'Tools', icon: Wrench, sub: [
      { id: 'tools', label: 'Tools', icon: Wrench },
    ]},
  ];
  const activeGroup = TAB_GROUPS.find(g => g.id === group) || TAB_GROUPS[0];
  const handleGroupChange = (g) => {
    setGroup(g);
    const ag = TAB_GROUPS.find(x => x.id === g);
    setView(ag?.sub?.[0]?.id || g);
  };

  const openAdd = () => { setEditorAsset(null); setEditorOpen(true); };

  // Bulk cert helpers
  const filteredEquipForBulk = useMemo(() => equipment.filter(a => {
    if (depotOnly && !(a.storage_location || '').toLowerCase().match(/depot|yard|dartford/)) return false;
    if (sourceFilter === 'panda' && !a.panda_asset_id) return false;
    if (sourceFilter === 'local' && a.panda_asset_id) return false;
    if (category !== 'all' && category !== 'rig' && a.asset_type !== category) return false;
    if (compFilter !== 'all' && (a.compliance_status || 'unknown') !== compFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }), [equipment, category, compFilter, search, sourceFilter, depotOnly]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Boxes}
        title="Assets Hub"
        subtitle="Rigs, gear & PAT — Asset Panda synced + locally created. Warehouse consumables & internal stock."
        actions={
            <div className="flex items-center gap-2 flex-wrap">
              <PrintWeightRegister assets={assets} />
              <RunReportButton hub="assets" />
              <button onClick={() => navigate('/scanner')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg font-semibold text-xs hover:bg-[#244715] transition shadow-sm"><ScanLine className="w-3.5 h-3.5" /> Scanner</button>
              <button onClick={() => setShowBulkQR(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><QrCode className="w-3.5 h-3.5" /> QR Labels</button>
              <button onClick={() => setShowSmartImport(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><ScanLine className="w-3.5 h-3.5" /> Smart Import</button>
              <button onClick={() => setShowBulkUpload(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition shadow-sm"><Upload className="w-3.5 h-3.5" /> Bulk Upload</button>
              <button onClick={() => setShowBulkWeight(true)} className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-blue-600 hover:text-blue-600 transition shadow-sm"><Weight className="w-3.5 h-3.5" /> Bulk Weights</button>
              <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg font-semibold text-xs hover:bg-[#244715] transition shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Asset</button>
            </div>
        }
      />
      <TabBar
        tabs={TAB_GROUPS.map(g => ({ id: g.id, label: g.label, icon: g.icon, badge: g.id === 'compliance' ? recertCount : undefined, count: g.id === 'inventory' ? assets.length : undefined }))}
        activeTab={group}
        onChange={handleGroupChange}
      />
      <SubPills active={view} onChange={setView} pills={activeGroup?.sub || []} />

      {/* Assets KPI Bar — quick category + compliance overview */}
      {assets.length > 0 && (
        <HubStatsBar tiles={[
          { icon: Boxes, label: 'Total Assets', value: assets.length, sublabel: 'Excl. vehicles', color: 'brand' },
          { icon: Database, label: 'Panda Synced', value: pandaCount, sublabel: 'From Asset Panda', color: 'amber' },
          { icon: CircleDot, label: 'Locally Created', value: localCount, sublabel: 'Manual entries', color: 'blue' },
          { icon: Cog, label: 'Rigs', value: categoryCounts.rig, sublabel: 'Drilling units', color: 'amber' },
          { icon: Anchor, label: 'Lifting', value: categoryCounts.lifting, sublabel: 'LOLER gear', color: 'blue' },
          { icon: Wrench, label: 'Machinery', value: categoryCounts.machinery, sublabel: 'Plant & equip', color: 'violet' },
          { icon: ShieldCheck, label: 'Compliant', value: fleetCounts.compliant, sublabel: `${Math.round(fleetHealthPct)}% of known`, color: 'emerald' },
          { icon: AlertTriangle, label: 'Needs Recert', value: recertCount, sublabel: 'Expired/expiring', color: recertCount > 0 ? 'rose' : 'slate' },
        ]} />
      )}

      {/* Tools tab — bulk upload / smart import / QR labels */}
      {view === 'tools' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={() => setShowBulkUpload(true)} className="insight-card rounded-2xl p-5 text-left hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-[#2E5A1A]/10 flex items-center justify-center mb-3"><Upload className="w-5 h-5 text-[#2E5A1A]" /></div>
            <p className="font-bold text-slate-900">Bulk Upload</p>
            <p className="text-xs text-slate-500 mt-0.5">Import assets from a spreadsheet</p>
          </button>
          <button onClick={() => setShowSmartImport(true)} className="insight-card rounded-2xl p-5 text-left hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><ScanLine className="w-5 h-5 text-blue-600" /></div>
            <p className="font-bold text-slate-900">Smart Cert Import</p>
            <p className="text-xs text-slate-500 mt-0.5">Pull certificates from email</p>
          </button>
          <button onClick={() => setShowBulkQR(true)} className="insight-card rounded-2xl p-5 text-left hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-3"><QrCode className="w-5 h-5 text-violet-600" /></div>
            <p className="font-bold text-slate-900">QR Labels</p>
            <p className="text-xs text-slate-500 mt-0.5">Print asset QR codes</p>
          </button>
          <button onClick={() => setShowBulkWeight(true)} className="insight-card rounded-2xl p-5 text-left hover:shadow-md transition">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><Weight className="w-5 h-5 text-blue-600" /></div>
            <p className="font-bold text-slate-900">Bulk Weights</p>
            <p className="text-xs text-slate-500 mt-0.5">Set weight (kg) for payload checks</p>
          </button>
        </div>
      ) : view === 'consumables' ? (
        <ErrorBoundary><ConsumablesView /></ErrorBoundary>
      ) : (
        <>
          {/* Fleet health strip — refined brand card with sync + health visuals */}
          <div className="insight-card rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex w-9 h-9 rounded-xl stat-gradient-brand items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">Fleet Health</p>
                <p className="text-[11px] text-slate-400">Compliance & sync status</p>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-200" />
              <FleetSyncPanel />
            </div>
            <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
              <FleetHealthGauge percent={fleetHealthPct} size={88} />
              <div className="h-9 w-px bg-slate-200 hidden sm:block" />
              <FleetComplianceDonut counts={fleetCounts} size={88} onSegmentClick={(k) => { setCompFilter(k); setView('inventory'); }} />
            </div>
          </div>

          {/* Filters (inventory tab only) */}
          {view === 'inventory' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
              {/* Category pills */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => {
                  const CIcon = cat.icon;
                  const active = category === cat.id;
                  const count = categoryCounts[cat.id] || 0;
                  return (
                    <button key={cat.id} onClick={() => setCategory(cat.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <CIcon className="w-3.5 h-3.5" /> {cat.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white text-slate-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Search + filters */}
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select value={compFilter} onChange={e => setCompFilter(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
                    <option value="all">All Status</option>
                    <option value="compliant">Compliant</option>
                    <option value="expiring">Expiring</option>
                    <option value="expired">Expired</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    {[
                      { val: 'all', label: 'All', Icon: Boxes },
                      { val: 'panda', label: 'Panda', Icon: Database },
                      { val: 'local', label: 'Local', Icon: CircleDot },
                    ].map(opt => {
                      const OIcon = opt.Icon;
                      const active = sourceFilter === opt.val;
                      return (
                        <button key={opt.val} onClick={() => setSourceFilter(opt.val)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                          <OIcon className="w-3 h-3" /> {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setDepotOnly(d => !d)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0 ${depotOnly ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
                    <Warehouse className="w-4 h-4" /> {depotOnly ? 'Depot Only' : 'Depot'}
                  </button>
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
                    <option value="none">No grouping</option>
                    <option value="type">Group by Type</option>
                    <option value="location">Group by Location</option>
                    <option value="status">Group by Status</option>
                    <option value="panda_group">Group by Panda Group</option>
                  </select>
                  {category !== 'rig' && (
                    <button onClick={() => { setSelectionMode(m => !m); setSelected(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0 ${selectionMode ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
                      <CheckSquare className="w-4 h-4" /> {selectionMode ? 'Done' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>
          ) : view === 'inventory' ? (
            <AssetInventoryGrid
              assets={assets}
              rigs={rigs}
              category={category}
              search={search}
              compFilter={compFilter}
              sourceFilter={sourceFilter}
              depotOnly={depotOnly}
              groupBy={groupBy}
              selectionMode={selectionMode}
              selected={selected}
              setSelected={setSelected}
              onOpenRig={(rig) => navigate(`/assets/${rig.id}`)}
              onOpenEquip={(equip) => navigate(`/assets/${equip.id}`)}
              onCertVault={setCertVaultRig}
              onUploadCert={(a) => setRecertAsset(a)}
            />
          ) : view === 'deployments' ? (
            <ErrorBoundary><AssetDeploymentsPanel assets={assets} /></ErrorBoundary>
          ) : view === 'compliance' ? (
            <ErrorBoundary>
              <div className="space-y-6">
                <RecertPipeline assets={assets} onRecert={(a) => setRecertAsset(a)} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} />
                <div>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 px-1">Certificate Vault</h3>
                  <MasterCertificateVault assets={assets} onOpenAsset={(a) => a.asset_type === 'rig' ? setOpenRig(a) : setOpenEquip(a)} />
                </div>
              </div>
            </ErrorBoundary>
          ) : view === 'pat_testing' ? (
            <ErrorBoundary>
              <PATTestingPanel />
            </ErrorBoundary>
          ) : view === 'performance' ? (
            <ErrorBoundary>
              <div className="space-y-6">
                <FleetUtilizationHeatmap assets={assets} />
                <DrillingEfficiencyPanel assets={assets} />
                <AssetUtilizationTrends />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <PredictiveMaintenanceWidget onSelectVehicle={(v) => navigate('/fleet')} />
                  <PredictiveInsightsWidget onNavigate={(section) => navigate('/admin', { state: { section } })} />
                </div>
              </div>
            </ErrorBoundary>
          ) : view === 'lifecycle' ? (
            <ErrorBoundary>
              <DepreciationSchedule />
            </ErrorBoundary>
          ) : view === 'scrap' ? (
            <ErrorBoundary><ScrapPilePanel /></ErrorBoundary>
          ) : null}

          {/* Bulk cert action bar */}
          {selectionMode && view === 'inventory' && filteredEquipForBulk.length > 0 && (
            <div className="sticky bottom-4 z-30 bg-[#2E5A1A] text-white rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold">{selected.size} of {filteredEquipForBulk.length} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setBulkCerts(filteredEquipForBulk.filter(a => selected.has(a.id)))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition"><Lock className="w-3.5 h-3.5" /> View Certs</button>
                <button onClick={() => setSelected(new Set(filteredEquipForBulk.map(a => a.id)))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition">Select All</button>
                <button onClick={() => { setSelected(new Set()); setSelectionMode(false); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition"><X className="w-3.5 h-3.5" /> Clear</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawers & modals */}
      {openRig && <RigDetailDrawer rig={openRig} allAssets={assets} onClose={() => setOpenRig(null)} onOpenEquipment={(eq) => setOpenEquip(eq)} onEdit={(a) => { setOpenRig(null); setEditorAsset(a); setEditorOpen(true); }} onRecert={(a) => { setOpenRig(null); setRecertAsset(a); }} />}
      {openEquip && <EquipmentDetailDrawer equipment={openEquip} parentRig={rigs.find(r => (r.linked_equipment_ids || []).includes(openEquip.id)) || null} onClose={() => setOpenEquip(null)} onOpenRig={(rig) => { setOpenEquip(null); setOpenRig(rig); }} onEdit={(a) => { setOpenEquip(null); setEditorAsset(a); setEditorOpen(true); }} onRecert={(a) => { setOpenEquip(null); setRecertAsset(a); }} />}
      {editorOpen && <AssetComplianceEditor asset={editorAsset} onClose={() => { setEditorOpen(false); setEditorAsset(null); }} />}
      {recertAsset && <RecertActionModal asset={recertAsset} onClose={() => setRecertAsset(null)} />}
      {certVaultRig && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => setCertVaultRig(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4 text-white" /></div><div className="min-w-0"><h3 className="font-bold text-slate-900 truncate">{certVaultRig.name} — Certificates</h3><p className="text-[11px] text-slate-400 truncate">Rig & all linked equipment</p></div></div>
              <button onClick={() => setCertVaultRig(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4"><CertificateVault assets={[certVaultRig, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean)]} assetIds={[certVaultRig.id, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => a.id)]} assetNames={{ [certVaultRig.id]: certVaultRig.name, ...(certVaultRig.linked_equipment_ids || []).reduce((m, id) => { const a = assets.find(x => x.id === id); if (a) m[id] = a.name; return m; }, {}) }} /></div>
          </div>
        </div>
      )}
      {bulkCerts && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => setBulkCerts(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0"><div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0"><Lock className="w-4 h-4 text-white" /></div><div className="min-w-0"><h3 className="font-bold text-slate-900 truncate">{bulkCerts.length} Assets — Certificates</h3></div></div>
              <button onClick={() => setBulkCerts(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4"><CertificateVault assets={bulkCerts} assetIds={bulkCerts.map(a => a.id)} assetNames={Object.fromEntries(bulkCerts.map(a => [a.id, a.name]))} /></div>
          </div>
        </div>
      )}
      {showBulkUpload && <BulkAssetUpload onClose={() => setShowBulkUpload(false)} />}
      {showSmartImport && <SmartCertImport onClose={() => setShowSmartImport(false)} />}
      {showBulkQR && <BulkQRPrinter onClose={() => setShowBulkQR(false)} />}
      {showBulkWeight && <BulkWeightModal assets={assets} onClose={() => setShowBulkWeight(false)} />}
    </div>
  );
}