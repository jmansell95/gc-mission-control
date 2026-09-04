import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Wrench, AlertTriangle, Briefcase, QrCode,
  Package, ShieldCheck, FileText, Clock, X, Plug,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { rollupCompliance } from '@/utils/rigRollup';

import AssetDetailHero from '@/components/assetdetail/AssetDetailHero';
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

const TABS = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'service', label: 'Service', icon: Wrench },
  { key: 'deployment', label: 'Deployment', icon: Briefcase },
  { key: 'financial', label: 'Financial', icon: FileText },
  { key: 'activity', label: 'Activity', icon: Clock },
];

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

  const staffProfile = useMemo(() => ({ name: user?.full_name || user?.email || 'Manager' }), [user]);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset-detail', id],
    queryFn: () => base44.entities.SiteAsset.get(id),
    enabled: !!id,
  });

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

  // For equipment (non-rig): find the parent rig this item is linked to
  const parentRig = useMemo(
    () => asset?.asset_type !== 'rig' ? allAssets.find(r => r.asset_type === 'rig' && (r.linked_equipment_ids || []).includes(asset.id)) : null,
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

  // Pull the latest object fields + photos from Asset Panda and cache them.
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
        <button onClick={() => navigate('/assets')} className="mt-4 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold">
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
    <div className="min-h-screen">
      {/* Mobile hero */}
      <div className="lg:hidden p-3 space-y-3">
        <AssetDetailHero
          asset={asset}
          onBack={() => navigate('/assets')}
          onEdit={() => setShowEditor(true)}
          onRecert={() => setShowRecert(true)}
          onQR={() => setShowQR(true)}
          onRefresh={handleRefreshFromPanda}
          refreshing={refreshing}
        />
        {asset.panda_asset_id && (
          <AssetPandaImageGallery asset={asset} />
        )}
      </div>

      {/* Two-column layout (desktop) */}
      <div className="lg:flex lg:max-w-7xl lg:mx-auto">
        {/* Left rail — desktop only */}
        <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
          <div className="lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto p-4 space-y-3">
            <AssetDetailHero
              asset={asset}
              onBack={() => navigate('/assets')}
              onEdit={() => setShowEditor(true)}
              onRecert={() => setShowRecert(true)}
              onQR={() => setShowQR(true)}
              onRefresh={handleRefreshFromPanda}
              refreshing={refreshing}
            />
            {/* Quick action buttons */}
            <div className="space-y-2">
              {quickActions.map(a => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-[#2E5A1A] hover:bg-emerald-50/40 text-sm font-semibold text-slate-700 transition group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition">
                      <Icon className="w-4 h-4 text-[#2E5A1A]" />
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
            <div className="flex gap-1 px-3 py-2.5 overflow-x-auto no-scrollbar">
              {TABS.map(t => {
                const Icon = t.icon;
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition touch-manipulation ${
                      active
                        ? 'bg-[#2E5A1A] text-white shadow-md shadow-emerald-900/10'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-emerald-300' : 'text-slate-400'}`} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-3 lg:p-6 pb-28 lg:pb-8 space-y-4">
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
                {/* Master compliance rollup (for rigs with linked equipment) */}
                {rollup && rollup.total > 1 && (
                  <div className="insight-card rounded-2xl p-4 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-[#2E5A1A]" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">System Compliance: {rollup.master}</p>
                      <p className="text-xs text-slate-500">
                        {rollup.counts.compliant} compliant · {rollup.counts.expiring} expiring · {rollup.counts.expired} expired · {rollup.counts.unknown} unknown
                      </p>
                    </div>
                  </div>
                )}
                <CertificateVault
                  assetIds={vaultAssetIds}
                  assetNames={vaultAssetNames}
                  assets={vaultAssets}
                />
                <CompliancePackGenerator asset={asset} linkedItems={linkedItems} />
              </div>
            )}

            {activeTab === 'service' && (
              <ServiceHistoryPanel
                assetId={asset.id}
                assetName={asset.name}
                assetType={asset.asset_type}
              />
            )}

            {activeTab === 'deployment' && (
              <AssetDeploymentTab
                asset={asset}
                assignments={assignments}
                jobs={jobs}
                onAssign={() => setShowAssignJob(true)}
              />
            )}

            {activeTab === 'financial' && (
              <AssetFinancialTab asset={asset} />
            )}

            {activeTab === 'activity' && (
              <div className="insight-card rounded-2xl p-4">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2E5A1A]" /> Movement & Activity Timeline
                </h3>
                <AssetMovementHistory asset={asset} assets={vaultAssets} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom quick-action bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 safe-area-bottom shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-around px-1.5 py-2">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={a.onClick}
                className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-600 active:scale-90 transition touch-manipulation min-w-[44px] min-h-[44px] justify-center"
              >
                <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#2E5A1A]" />
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
      {showRecert && (
        <RecertActionModal
          asset={asset}
          onClose={() => setShowRecert(false)}
          onSaved={() => invalidateAll()}
        />
      )}
      {showEditor && (
        <AssetComplianceEditor
          asset={asset}
          onClose={() => { setShowEditor(false); invalidateAll(); }}
        />
      )}
      {showPATTest && (
        <PATTestForm
          asset={asset}
          onClose={() => setShowPATTest(false)}
          onSaved={() => invalidateAll()}
        />
      )}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => setShowQR(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#2E5A1A]" /> QR Code
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