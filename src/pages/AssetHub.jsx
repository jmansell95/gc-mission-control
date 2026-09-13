import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Cog, Wrench, Package, Anchor, Plug,
  Plus, ScanLine, X, ShieldCheck,
  Upload, Database, MapPin, QrCode, Weight, Boxes, Lock,
} from 'lucide-react';
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
import AssetDeploymentsPanel from '@/components/assethub/AssetDeploymentsPanel';
import PredictiveMaintenanceWidget from '@/components/vehicles/PredictiveMaintenanceWidget';
import PredictiveInsightsWidget from '@/components/dashboard/PredictiveInsightsWidget';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/StateViews';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import { ASSETS_HELP_TOPICS, ASSETS_ONBOARDING, ASSETS_QUICK_LINKS } from '@/components/assethub/assetsHubContent';
import RunReportButton from '@/components/reports/RunReportButton';
import PrintWeightRegister from '@/components/assethub/PrintWeightRegister';
import RecentlyViewedStrip from '@/components/assethub/RecentlyViewedStrip';
import BulkActionsBar from '@/components/assethub/BulkActionsBar';
import AssetFilterBar from '@/components/assethub/AssetFilterBar';
import AssetGrid from '@/components/assethub/AssetGrid';
import { useAssetRealtime } from '@/hooks/useAssetRealtime';

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
  const [compact, setCompact] = useState(false);
  const [deployFilter, setDeployFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');
  const [maintenanceFilter, setMaintenanceFilter] = useState('all');

  const { data: allAssets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: async () => base44.entities.SiteAsset.filter({}, '-created_date', 2000),
  });

  const assets = useMemo(() => allAssets.filter(a => a.asset_type !== 'vehicle'), [allAssets]);
  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);
  const equipment = useMemo(() => assets.filter(a => a.asset_type !== 'rig'), [assets]);

  const pandaCount = useMemo(() => assets.filter(a => a.panda_asset_id).length, [assets]);
  const localCount = useMemo(() => assets.filter(a => !a.panda_asset_id).length, [assets]);

  const categoryCounts = useMemo(() => {
    const c = { all: assets.length, rig: 0, lifting: 0, machinery: 0, trailer: 0, portable_appliance: 0 };
    assets.forEach(a => { if (c[a.asset_type] != null) c[a.asset_type]++; });
    return c;
  }, [assets]);

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
    const inDepot = (a.storage_location || '').toLowerCase().match(/depot|yard|dartford/);
    if (deployFilter === 'in_depot' && !inDepot) return false;
    if (deployFilter === 'on_site' && (inDepot || a.is_active === false)) return false;
    if (deployFilter === 'inactive' && a.is_active !== false) return false;
    if (lifecycleFilter !== 'all') {
      const ls = a.lifecycle_status || 'active';
      if (lifecycleFilter === 'due_for_replacement' && !(a.replacement_date && Math.floor((new Date(a.replacement_date) - new Date()) / 86400000) <= 90)) return false;
      if (lifecycleFilter === 'disposed' && !a.disposal_date && ls !== 'disposed') return false;
      if (lifecycleFilter === 'aging' && !(a.depreciation_years && a.acquisition_date && (Date.now() - new Date(a.acquisition_date).getTime()) / (365.25 * 86400000) >= a.depreciation_years)) return false;
      if (lifecycleFilter === 'active' && (ls === 'disposed' || ls === 'due_for_replacement' || ls === 'aging')) return false;
    }
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }), [equipment, category, compFilter, search, sourceFilter, depotOnly, deployFilter, lifecycleFilter]);

  const stats = assets.length > 0 ? [
    { icon: Boxes, label: 'Total Assets', value: assets.length, sublabel: 'Excl. vehicles', color: 'brand' },
    { icon: Database, label: 'Panda Synced', value: pandaCount, sublabel: 'From Asset Panda', color: 'amber' },
    { icon: Cog, label: 'Rigs', value: categoryCounts.rig, sublabel: 'Drilling units', color: 'amber' },
    { icon: Anchor, label: 'Lifting', value: categoryCounts.lifting, sublabel: 'LOLER gear', color: 'blue' },
    { icon: ShieldCheck, label: 'Compliant', value: fleetCounts.compliant, sublabel: `${Math.round(fleetHealthPct)}% of known`, color: 'emerald' },
    { icon: ShieldCheck, label: 'Needs Recert', value: recertCount, sublabel: 'Expired/expiring', color: recertCount > 0 ? 'rose' : 'slate' },
  ] : [];

  return (
    <HubShell
      hubKey="assets"
      icon={Boxes}
      eyebrow="Assets Hub"
      title="Assets Hub"
      subtitle="Rigs, gear & PAT — Asset Panda synced + locally created. Warehouse consumables & internal stock."
      breadcrumbs={[{ label: 'Assets Hub' }]}
      stats={stats}
      help={{ title: 'Assets Hub — how it works', topics: ASSETS_HELP_TOPICS }}
      onboarding={ASSETS_ONBOARDING}
      quickLinks={ASSETS_QUICK_LINKS}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <PrintWeightRegister assets={assets} />
          <RunReportButton hub="assets" />
          <button onClick={() => navigate('/scanner')} className="inline-flex items-center gap-1.5 h-9 px-3 bg-primary text-white rounded-xl font-semibold text-xs hover:bg-[#244715] transition shadow-sm min-h-[36px]">
            <ScanLine className="w-3.5 h-3.5" /> Scanner
          </button>
          <button onClick={() => setShowBulkQR(true)} className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:border-primary hover:text-primary transition shadow-sm min-h-[36px]">
            <QrCode className="w-3.5 h-3.5" /> QR Labels
          </button>
          <button onClick={() => setShowSmartImport(true)} className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:border-primary hover:text-primary transition shadow-sm min-h-[36px]">
            <ScanLine className="w-3.5 h-3.5" /> Smart Import
          </button>
          <button onClick={() => setShowBulkUpload(true)} className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:border-primary hover:text-primary transition shadow-sm min-h-[36px]">
            <Upload className="w-3.5 h-3.5" /> Bulk Upload
          </button>
          <button onClick={() => setShowBulkWeight(true)} className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:border-blue-600 hover:text-blue-600 transition shadow-sm min-h-[36px]">
            <Weight className="w-3.5 h-3.5" /> Bulk Weights
          </button>
          <button onClick={openAdd} className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-primary text-white rounded-xl font-semibold text-xs hover:bg-[#244715] transition shadow-sm min-h-[36px]">
            <Plus className="w-3.5 h-3.5" /> Add Asset
          </button>
        </div>
      }
      tabs={TAB_GROUPS.map(g => ({ id: g.id, label: g.label, icon: g.icon, badge: g.id === 'compliance' ? recertCount : undefined, count: g.id === 'inventory' ? assets.length : undefined }))}
      activeTab={group}
      onTabChange={handleGroupChange}
    >
      <SubPills active={view} onChange={setView} pills={activeGroup?.sub || []} />

      {view === 'consumables' ? (
        <ErrorBoundary><ConsumablesView /></ErrorBoundary>
      ) : view === 'deployments' ? (
        <ErrorBoundary><AssetDeploymentsPanel assets={assets} /></ErrorBoundary>
      ) : view === 'compliance' ? (
        <ErrorBoundary>
          <div className="space-y-4">
            <RecertPipeline assets={assets} onRecert={(a) => setRecertAsset(a)} onOpenAsset={(a) => navigate(`/assets/${a.id}`)} />
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 px-1">Certificate Vault</h3>
              <MasterCertificateVault assets={assets} onOpenAsset={(a) => navigate(`/assets/${a.id}`)} />
            </div>
          </div>
        </ErrorBoundary>
      ) : view === 'pat_testing' ? (
        <ErrorBoundary><PATTestingPanel /></ErrorBoundary>
      ) : (
        <>
          {/* Fleet health strip */}
          <div className="hub-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
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

          {/* Filter bar */}
          <AssetFilterBar
            category={category}
            setCategory={setCategory}
            categoryCounts={categoryCounts}
            search={search}
            setSearch={setSearch}
            compFilter={compFilter}
            setCompFilter={setCompFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            depotOnly={depotOnly}
            setDepotOnly={setDepotOnly}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            deployFilter={deployFilter}
            setDeployFilter={setDeployFilter}
            lifecycleFilter={lifecycleFilter}
            setLifecycleFilter={setLifecycleFilter}
            maintenanceFilter={maintenanceFilter}
            setMaintenanceFilter={setMaintenanceFilter}
            compact={compact}
            setCompact={setCompact}
            selectionMode={selectionMode}
            setSelectionMode={setSelectionMode}
            showSelection={category !== 'rig'}
          />

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
            </div>
          ) : (
            <>
              <RecentlyViewedStrip onOpen={(a) => navigate(`/assets/${a.id}`)} />
              <AssetGrid
                assets={assets}
                rigs={rigs}
                category={category}
                search={search}
                compFilter={compFilter}
                sourceFilter={sourceFilter}
                depotOnly={depotOnly}
                groupBy={groupBy}
                compact={compact}
                deployFilter={deployFilter}
                lifecycleFilter={lifecycleFilter}
                maintenanceFilter={maintenanceFilter}
                selectionMode={selectionMode}
                selected={selected}
                setSelected={setSelected}
                onOpenRig={(rig) => navigate(`/assets/${rig.id}`)}
                onOpenEquip={(equip) => navigate(`/assets/${equip.id}`)}
                onCertVault={setCertVaultRig}
                onUploadCert={(a) => setRecertAsset(a)}
              />
            </>
          )}

          {/* Bulk action bar */}
          {selectionMode && filteredEquipForBulk.length > 0 && (
            <BulkActionsBar
              selectedAssets={filteredEquipForBulk.filter(a => selected.has(a.id))}
              totalAvailable={filteredEquipForBulk.length}
              onSelectAll={() => setSelected(new Set(filteredEquipForBulk.map(a => a.id)))}
              onClear={() => { setSelected(new Set()); setSelectionMode(false); }}
              onViewCerts={() => setBulkCerts(filteredEquipForBulk.filter(a => selected.has(a.id)))}
              onRecert={selected.size === 1 ? () => setRecertAsset(filteredEquipForBulk.find(a => selected.has(a.id))) : undefined}
            />
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-pop-in">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{certVaultRig.name} — Certificates</h3>
                  <p className="text-[11px] text-slate-400 truncate">Rig & all linked equipment</p>
                </div>
              </div>
              <button onClick={() => setCertVaultRig(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4">
              <CertificateVault
                assets={[certVaultRig, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean)]}
                assetIds={[certVaultRig.id, ...(certVaultRig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => a.id)]}
                assetNames={{ [certVaultRig.id]: certVaultRig.name, ...(certVaultRig.linked_equipment_ids || []).reduce((m, id) => { const a = assets.find(x => x.id === id); if (a) m[id] = a.name; return m; }, {}) }}
              />
            </div>
          </div>
        </div>
      )}
      {bulkCerts && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => setBulkCerts(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-pop-in">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 truncate">{bulkCerts.length} Assets — Certificates</h3>
              </div>
              <button onClick={() => setBulkCerts(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-4">
              <CertificateVault assets={bulkCerts} assetIds={bulkCerts.map(a => a.id)} assetNames={Object.fromEntries(bulkCerts.map(a => [a.id, a.name]))} />
            </div>
          </div>
        </div>
      )}
      {showBulkUpload && <BulkAssetUpload onClose={() => setShowBulkUpload(false)} />}
      {showSmartImport && <SmartCertImport onClose={() => setShowSmartImport(false)} />}
      {showBulkQR && <BulkQRPrinter onClose={() => setShowBulkQR(false)} />}
      {showBulkWeight && <BulkWeightModal assets={assets} onClose={() => setShowBulkWeight(false)} />}
    </HubShell>
  );
}