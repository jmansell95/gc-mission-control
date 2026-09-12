import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Info, Plus, ScanLine, ShieldAlert, ShieldX, HelpCircle } from 'lucide-react';
import SyncComplianceButton from '@/components/SyncComplianceButton';
import AssetComplianceEditor from '@/components/AssetComplianceEditor';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import FleetHealthRibbon from '@/components/assetcommand/FleetHealthRibbon';
import FleetCommandGrid from '@/components/assetcommand/FleetCommandGrid';
import AssetPassportDrawer from '@/components/assetcommand/AssetPassportDrawer';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { useScopedEntity } from '@/hooks/useScopedEntity';

/**
 * Asset Command Centre — the comprehensive fleet management system.
 * Replaces the old card grid with a high-density command grid, fleet health
 * ribbon and contextual passport drawer (overview · certificates · service
 * history · compliance pack · QR code).
 */
export default function SiteAssetManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [passportAssetId, setPassportAssetId] = useState(null);
  const [editorAsset, setEditorAsset] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: assets = [], isLoading } = useScopedEntity('SiteAsset', { queryKey: ['site-assets'], sort: '-created_date', limit: 500 });

  const openAdd = () => { setEditorAsset(null); setEditorOpen(true); };
  const openEdit = (asset) => { setEditorAsset(asset); setEditorOpen(true); };
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['scoped', 'SiteAsset'] }); queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] }); };

  const handleBulkToggleActive = async (list, active) => {
    try {
      await base44.entities.SiteAsset.bulkUpdate(list.map(a => ({ id: a.id, is_active: active })));
      toast({ title: `${list.length} asset${list.length > 1 ? 's' : ''} ${active ? 'activated' : 'deactivated'}` });
      refresh();
    } catch (e) {
      toast({ title: 'Bulk update failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleBulkExportCerts = async (list) => {
    try {
      const records = await base44.entities.ServiceRecord.list('-date', 500);
      const idSet = new Set(list.map(a => a.id));
      const certs = records.filter(r => idSet.has(r.site_asset_id) && r.certificate_url);
      if (certs.length === 0) { toast({ title: 'No certificates found for the selected assets' }); return; }
      certs.slice(0, 20).forEach((c, i) => setTimeout(() => window.open(c.certificate_url, '_blank'), i * 200));
      toast({ title: `Opening ${Math.min(certs.length, 20)} certificate${certs.length > 1 ? 's' : ''}` });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    const asset = confirmDelete;
    try {
      await base44.entities.SiteAsset.delete(asset.id);
      toast({ title: 'Asset deleted', description: `${asset.name} removed.` });
      refresh();
      setConfirmDelete(null);
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const expiredCount = assets.filter(a => a.compliance_status === 'expired').length;
  const expiringCount = assets.filter(a => a.compliance_status === 'expiring').length;
  const unknownCount = assets.filter(a => (a.compliance_status || 'unknown') === 'unknown').length;

  return (
    <div>
      <SettingsSectionHeader
        icon={Wrench}
        title="Asset Manager"
        description="Full fleet management — view, edit, download certificates & generate compliance packs"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openAdd} type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg hover:brightness-110 active:scale-95 transition text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Add Asset
            </button>
            <button onClick={() => navigate('/rig-hub')} type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-95 transition text-sm font-semibold shadow-sm">
              <ScanLine className="w-4 h-4" /> Asset Hub
            </button>
            <SyncComplianceButton />
          </div>
        }
      />

      {/* Master-system info banner */}
      <div className="hub-glass rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-sm text-slate-600 pt-1">
          This is the <strong>master record</strong> for all assets. Add and edit rigs, machinery, trailers, vehicles, lifting gear and PAT directly here. Click any asset to open its <strong>Asset Passport</strong> — view certificates, log services, generate an audit compliance pack or print an on-site QR label. Use <strong>Import from GC</strong> once to pull existing records from the old Compliance Manager.
        </p>
      </div>

      {/* Fleet health ribbon */}
      <FleetHealthRibbon assets={assets} />

      {/* Quick attention summary when issues exist */}
      {(expiredCount > 0 || expiringCount > 0 || unknownCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="font-semibold text-slate-500">Needs attention:</span>
          {expiredCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 font-semibold"><ShieldX className="w-3.5 h-3.5" /> {expiredCount} expired</span>}
          {expiringCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold"><ShieldAlert className="w-3.5 h-3.5" /> {expiringCount} expiring</span>}
          {unknownCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold"><HelpCircle className="w-3.5 h-3.5" /> {unknownCount} unknown</span>}
          <span className="text-slate-400">— filter via the quick-view tabs below</span>
        </div>
      )}

      {/* Command grid */}
      <FleetCommandGrid
        assets={assets}
        isLoading={isLoading}
        onOpenPassport={(a) => setPassportAssetId(a.id)}
        onEdit={openEdit}
        onDelete={setConfirmDelete}
        onBulkToggleActive={handleBulkToggleActive}
        onBulkExportCerts={handleBulkExportCerts}
      />

      {/* Asset passport drawer — looks up the live asset so it stays fresh after service logs */}
      <AssetPassportDrawer
        asset={assets.find(a => a.id === passportAssetId) || null}
        allAssets={assets}
        onClose={() => setPassportAssetId(null)}
        onEdit={(a) => { setPassportAssetId(null); openEdit(a); }}
      />

      {/* Add / edit editor */}
      {editorOpen && (
        <AssetComplianceEditor asset={editorAsset} onClose={() => { setEditorOpen(false); setEditorAsset(null); }} />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><ShieldX className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="font-bold text-slate-900">Delete asset?</p>
                <p className="text-xs text-slate-500">{confirmDelete.name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">This permanently removes the asset and is irreversible. Service records and certificates are retained.</p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={handleDelete} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}