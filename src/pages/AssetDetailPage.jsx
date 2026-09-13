import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Wrench, AlertTriangle, Briefcase, QrCode,
  Package, ShieldCheck, FileText, Clock, X, Plug,
  ArrowLeft, Pencil, RefreshCw, Hash, Weight, Upload,
  Cog, Anchor,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { rollupCompliance } from '@/utils/rigRollup';
import { COMPLIANCE_META, ASSET_TYPE_META } from '@/utils/rigRollup';
import AssetColourDot from '@/components/assethub/AssetColourDot';

import AssetOverviewTab from '@/components/assetdetail/AssetOverviewTab';
import AssetDeploymentTab from '@/components/assetdetail/AssetDeploymentTab';
import AssetFinancialTab from '@/components/assetdetail/AssetFinancialTab';
import LogServiceModal from '@/components/assetdetail/LogServiceModal';
import AssignToJobModal from '@/components/assetdetail/AssignToJobModal';
import ReportFaultModal from '@/components/assetcommand/ReportFaultModal';
import RecertActionModal from '@/components/righub/RecertActionModal';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import AssetQRCard from '@/components/assetcommand/AssetQRCard';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';
import CompliancePackGenerator from '@/components/assetcommand/CompliancePackGenerator';
import AssetMovementHistory from '@/components/assetcommand/AssetMovementHistory';
import AssetPandaImageGallery from '@/components/assetdetail/AssetPandaImageGallery';
import PATTestForm from '@/components/pat/PATTestForm';
import { useAssetRealtime } from '@/hooks/useAssetRealtime';
import { trackRecentlyViewedAsset } from '@/components/assethub/recentlyViewed';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700',
  machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600',
  lifting: 'from-teal-500 to-cyan-700',
  portable_appliance: 'from-amber-400 to-yellow-600',
};

const COMPLIANCE_RING = {
  compliant: { color: '#10b981', pct: 100 },
  expiring: { color: '#f59e0b', pct: 70 },
  expired: { color: '#ef4444', pct: 25 },
  unknown: { color: '#94a3b8', pct: 8 },
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'service', label: 'Service', icon: Wrench },
  { key: 'deployment', label: 'Deployment', icon: Briefcase },
  { key: 'financial', label: 'Financial', icon: FileText },
  { key: 'activity', label: 'Activity', icon: Clock },
];

/** Unified hero — works on all screen sizes */
function AssetHero({ asset, onBack, onEdit, onRecert, onQR, onRefresh, refreshing }) {
  if (!asset) return null;
  const Icon = TYPE_ICON[asset.asset_type] || Wrench;
  const meta = COMPLIANCE_META[asset.compliance_status || 'unknown'];
  const CompIcon = asset.compliance_status === 'expired' ? ShieldCheck
    : asset.compliance_status === 'expiring' ? AlertTriangle
    : asset.compliance_status === 'unknown' ? Package
    : ShieldCheck;
  const grad = TYPE_GRADIENT[asset.asset_type] || 'from-slate-500 to-slate-700';
  const ring = COMPLIANCE_RING[asset.compliance_status || 'unknown'] || COMPLIANCE_RING.unknown;
  const photo = asset.panda_image_urls?.[0];
  const photoUrl = photo?.medium || photo?.url;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (ring.pct / 100) * circumference;

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary text-xs font-semibold transition min-h-[36px]">
          <ArrowLeft className="w-4 h-4" /> Assets
        </button>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition min-h-[36px]">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {onRecert && (
            <button onClick={onRecert} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg text-xs font-bold transition shadow-sm min-h-[36px]">
              <Upload className="w-3.5 h-3.5" /> Cert
            </button>
          )}
          {onQR && (
            <button onClick={onQR} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition min-h-[36px]">
              <QrCode className="w-3.5 h-3.5" /> QR
            </button>
          )}
          {asset.panda_asset_id && onRefresh && (
            <button onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition disabled:opacity-60 min-h-[36px]">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Sync' : 'Sync'}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 px-4 pb-3 pt-2">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle cx="32" cy="32" r={radius} fill="none" stroke={ring.color} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-700 ease-out" />
          </svg>
          <div className="absolute inset-2.5 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${ring.color}18, ${ring.color}06)` }}>
            {photoUrl ? (
              <img src={photoUrl} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-8 h-8" style={{ color: ring.color }} />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AssetColourDot colour={asset.colour} size={16} />
            <h1 className="font-extrabold text-slate-900 text-lg lg:text-xl truncate leading-tight">{asset.name}</h1>
            {asset.fleet_number && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                <Hash className="w-3 h-3" /> FAA {asset.fleet_number}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {[asset.make, asset.model].filter(Boolean).join(' · ') || (ASSET_TYPE_META[asset.asset_type]?.label || asset.asset_type)}
            {asset.equipment_type ? ` · ${asset.equipment_type}` : ''}
            {asset.rig_type && asset.rig_type !== 'n/a' ? ` · ${asset.rig_type.toUpperCase()}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: `${ring.color}15`, color: ring.color }}>
          <CompIcon className="w-3.5 h-3.5" /> {meta.label}
        </span>
        {asset.is_active === false && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Inactive
          </span>
        )}
        {asset.weight_kg != null && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
            <Weight className="w-3.5 h-3.5" /> {Math.round(asset.weight_kg)} kg
          </span>
        )}
      </div>
    </div>
  );
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useAssetRealtime();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogService, setShowLogService] = useState(false);
  const [showReportFault, setShowReportFault] = useState(false);
  const [showAssignJob, setShowAssignJob] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showRecert, setShowRecert] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showPATTest, setShowPATTest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const staffProfile = useMemo(() => ({ name: user?.full_name || user?.email || 'Manager' }), [user]);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset-detail', id],
    queryFn: () => base44.entities.SiteAsset.get(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (asset?.id && asset?.name) {
      trackRecentlyViewedAsset({ id: asset.id, name: asset.name, asset_type: asset.asset_type, colour: asset.colour });
    }
  }, [asset?.id]);

  const { data: allAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-asset-detail'],
    queryFn: () => base44.entities.Job.list('-updated_date', 200),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['asset-deployments', id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ asset_id: id }, '-assigned_date', 100),
    enabled: !!id,
  });

  const linkedItems = useMemo(
    () => (asset?.linked_equipment_ids || []).map(lid => allAssets.find(a => a.id === lid)).filter(Boolean),
    [asset, allAssets]
  );

  const parentRig = useMemo(
    () => !asset || asset.asset_type === 'rig' ? null : allAssets.find(r => r.asset_type === 'rig' && (r.linked_equipment_ids || []).includes(asset.id)),
    [asset, allAssets]
  );

  const rollup = useMemo(() => asset ? rollupCompliance(asset, linkedItems) : null, [asset, linkedItems]);

  const currentDeployment = useMemo(
    () => assignments.find(a => a.status === 'assigned' || a.status === 'on_site'),
    [assignments]
  );
  const currentJob = useMemo(
    () => currentDeployment ? jobs.find(j => j.id === currentDeployment.job_id) : null,
    [currentDeployment, jobs]
  );

  const vaultAssetIds = useMemo(() => asset ? [asset.id, ...linkedItems.map(i => i.id)] : [], [asset, linkedItems]);
  const vaultAssetNames = useMemo(() => {
    if (!asset) return {};
    return { [asset.id]: asset.name, ...Object.fromEntries(linkedItems.map(i => [i.id, i.name])) };
  }, [asset, linkedItems]);
  const vaultAssets = useMemo(() => asset ? [asset, ...linkedItems] : [], [asset, linkedItems]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['asset-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    queryClient.invalidateQueries({ queryKey: ['service-records', id] });
    queryClient.invalidateQueries({ queryKey: ['asset-deployments', id] });
  };

  const handleRefreshFromPanda = async () => {
    if (!asset?.panda_asset_id) return;
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke('getAssetPandaObject', { site_asset_id: asset.id });
      const d = res.data || {};
      if (d.error) {
        toast({ title: 'Refresh failed', description: d.error, variant: 'destructive' });
      } else {
        toast({ title: 'Refreshed from Panda', description: `${d.raw_field_count ?? 0} fields · ${d.image_count ?? 0} photos.` });
        await queryClient.invalidateQueries({ queryKey: ['asset-detail', id] });
        await queryClient.invalidateQueries({ queryKey: ['asset-panda-images', id] });
        await queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      }
    } catch (e) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Package className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-500 font-semibold">Asset not found</p>
        <button onClick={() => navigate('/assets')} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold min-h-[44px]">
          Back to Assets
        </button>
      </div>
    );
  }

  const isPortableAppliance = asset.asset_type === 'portable_appliance';
  const quickActions = [
    ...(isPortableAppliance ? [{ label: 'PAT Test', icon: Plug, onClick: () => setShowPATTest(true) }] : []),
    { label: 'Log Service', icon: Wrench, onClick: () => setShowLogService(true) },
    { label: 'Report Fault', icon: AlertTriangle, onClick: () => setShowReportFault(true) },
    { label: 'Assign to Job', icon: Briefcase, onClick: () => setShowAssignJob(true) },
    { label: 'Print QR', icon: QrCode, onClick: () => setShowQR(true) },
  ];

  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      {/* Unified hero — same on all screen sizes */}
      <div className="px-3 lg:px-6 pt-3 lg:pt-6 max-w-7xl mx-auto">
        <AssetHero
          asset={asset}
          onBack={() => navigate('/assets')}
          onEdit={() => setShowEditor(true)}
          onRecert={() => setShowRecert(true)}
          onQR={() => setShowQR(true)}
          onRefresh={handleRefreshFromPanda}
          refreshing={refreshing}
        />
        {asset.panda_asset_id && (
          <div className="mt-3">
            <AssetPandaImageGallery asset={asset} />
          </div>
        )}
      </div>

      {/* Quick action bar — horizontal scroll on mobile, row on desktop */}
      <div className="px-3 lg:px-6 mt-3 max-w-7xl mx-auto">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={a.onClick}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary hover:bg-emerald-50/40 text-sm font-semibold text-slate-700 transition flex-shrink-0 min-h-[44px]"
              >
                <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky tab bar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 mt-3">
        <div className="flex gap-1 px-3 lg:px-6 py-2.5 overflow-x-auto no-scrollbar max-w-7xl mx-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition min-h-[44px] ${
                  active ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-slate-400'}`} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-3 lg:px-6 py-4 lg:py-6 max-w-7xl mx-auto space-y-4">
        {activeTab === 'overview' && (
          <AssetOverviewTab
            asset={asset}
            linkedItems={linkedItems}
            parentRig={parentRig}
            currentDeployment={currentDeployment}
            currentJob={currentJob}
            onOpenLinked={(linkedId) => navigate(`/assets/${linkedId}`)}
            onOpenRig={(rig) => navigate(`/assets/${rig.id}`)}
          />
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            {rollup && rollup.total > 1 && (
              <div className="hub-glass rounded-2xl p-4 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm font-bold text-slate-900">System Compliance: {rollup.master}</p>
                  <p className="text-xs text-slate-500">
                    {rollup.counts.compliant} compliant · {rollup.counts.expiring} expiring · {rollup.counts.expired} expired · {rollup.counts.unknown} unknown
                  </p>
                </div>
              </div>
            )}
            <CertificateVault assetIds={vaultAssetIds} assetNames={vaultAssetNames} assets={vaultAssets} />
            <CompliancePackGenerator asset={asset} linkedItems={linkedItems} />
          </div>
        )}

        {activeTab === 'service' && (
          <ServiceHistoryPanel assetId={asset.id} assetName={asset.name} assetType={asset.asset_type} />
        )}

        {activeTab === 'deployment' && (
          <AssetDeploymentTab asset={asset} assignments={assignments} jobs={jobs} onAssign={() => setShowAssignJob(true)} />
        )}

        {activeTab === 'financial' && (
          <AssetFinancialTab asset={asset} />
        )}

        {activeTab === 'activity' && (
          <div className="hub-glass rounded-2xl p-4">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Movement & Activity Timeline
            </h3>
            <AssetMovementHistory asset={asset} assets={vaultAssets} />
          </div>
        )}
      </div>

      {/* Mobile bottom action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 safe-area-bottom shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-around px-1.5 py-2">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={a.onClick}
                className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-600 active:scale-90 transition min-w-[44px] min-h-[44px] justify-center"
              >
                <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showLogService && <LogServiceModal asset={asset} onClose={() => setShowLogService(false)} />}
      {showReportFault && <ReportFaultModal asset={asset} staffProfile={staffProfile} onClose={() => setShowReportFault(false)} />}
      {showAssignJob && <AssignToJobModal asset={asset} onClose={() => setShowAssignJob(false)} />}
      {showRecert && <RecertActionModal asset={asset} onClose={() => setShowRecert(false)} onSaved={() => invalidateAll()} />}
      {showEditor && <AssetComplianceEditor asset={asset} onClose={() => { setShowEditor(false); invalidateAll(); }} />}
      {showPATTest && <PATTestForm asset={asset} onClose={() => setShowPATTest(false)} onSaved={() => invalidateAll()} />}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => setShowQR(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" /> QR Code
              </h3>
              <button onClick={() => setShowQR(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <AssetQRCard asset={asset} />
          </div>
        </div>
      )}
    </div>
  );
}