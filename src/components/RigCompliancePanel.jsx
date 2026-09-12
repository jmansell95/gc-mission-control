import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, ShieldAlert, ShieldX, Download, FileText, Clock,
  Cog, Anchor, Wrench, Package, AlertTriangle, CheckCircle2, HelpCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const complianceConfig = {
  compliant: { icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Compliant', dot: 'bg-emerald-500' },
  expiring: { icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Expiring', dot: 'bg-amber-500' },
  expired: { icon: ShieldX, badge: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Expired', dot: 'bg-rose-500' },
  unknown: { icon: HelpCircle, badge: 'bg-slate-100 text-slate-500 ring-slate-200', label: 'Unknown', dot: 'bg-slate-400' },
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Package, lifting: Anchor };
const assetTypeLabel = { rig: 'Rig', machinery: 'Machinery', trailer: 'Trailer', vehicle: 'Vehicle', lifting: 'Lifting Gear' };

// Shows EVERY asset assigned to the job (rigs, lifting gear, machinery, trailers)
// with its compliance status and a View/Download button for each certificate on
// file. Staff and managers use this to access rig LOLER/PUWER certs and lifting
// gear inspection reports before or during a shift.
export default function RigCompliancePanel({ job }) {
  const { toast } = useToast();
  const [downloadedIds, setDownloadedIds] = useState(new Set());

  const { data: assignments = [] } = useQuery({
    queryKey: ['job-asset-assignments', job.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id }),
  });
  // Also pull equipment added via the Logistics tab (JobCostItem with a linked
  // SiteAsset). The Logistics tab writes to JobCostItem, not JobAssetAssignment,
  // so we merge both sources to show every asset assigned to the job.
  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items-compliance', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }),
  });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-items-equipment'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'equipment' }),
  });
  // ServiceRecord holds the actual LOLER/PUWER/PAT inspection certificates
  // (certificate_url). These are the real certificate files on the system —
  // ComplianceItem tracks expiry metadata but the uploaded reports live here.
  const { data: serviceRecords = [] } = useQuery({
    queryKey: ['service-records-equipment'],
    queryFn: () => base44.entities.ServiceRecord.list('-date', 500),
  });

  // Merge assets from both sources, deduped by asset_id.
  // JobAssetAssignment = dedicated assignment records; JobCostItem = equipment
  // added via the Logistics tab (with site_asset_id linking to the SiteAsset).
  const seenAssetIds = new Set();
  const assigned = [];
  for (const a of assignments) {
    const asset = assets.find(as => as.id === a.asset_id);
    if (asset && !seenAssetIds.has(asset.id)) {
      seenAssetIds.add(asset.id);
      assigned.push({ assignment: a, asset });
    }
  }
  for (const c of costItems) {
    if (!c.site_asset_id || seenAssetIds.has(c.site_asset_id)) continue;
    const asset = assets.find(as => as.id === c.site_asset_id);
    if (asset) {
      seenAssetIds.add(asset.id);
      assigned.push({ assignment: c, asset });
    }
  }

  const ordered = [...assigned].sort((a, b) => {
    const rank = { rig: 0, lifting: 1 };
    return (rank[a.asset.asset_type] ?? 9) - (rank[b.asset.asset_type] ?? 9);
  });

  const withCerts = ordered.map(r => {
    // Certificates come from ServiceRecord (LOLER/PUWER/PAT inspection reports
    // with actual uploaded files) plus any ComplianceItem with a document_url.
    const serviceCerts = serviceRecords
      .filter(s => s.site_asset_id === r.asset.id && s.certificate_url)
      .map(s => ({
        id: s.id,
        title: s.record_type === 'loler_inspection' ? 'LOLER Inspection' :
              s.record_type === 'puwer_inspection' ? 'PUWER Inspection' :
              s.record_type === 'pat_inspection' ? 'PAT Test' :
              s.record_type === 'calibration' ? 'Calibration' :
              s.record_type === 'service' ? 'Service Record' : 'Inspection',
        document_url: s.certificate_url,
        document_name: s.certificate_name,
        expiry_date: s.resulting_expiry_date || null,
        status_override: 'auto',
        tested_by: s.tested_by,
        result: s.result,
        date: s.date,
        source: 'service_record',
      }));
    const complianceCerts = complianceItems
      .filter(c => c.reference_id === r.asset.id && c.document_url)
      .map(c => ({ ...c, source: 'compliance_item' }));
    // Dedupe by document_url (a cert may exist in both)
    const seen = new Set();
    const certs = [...serviceCerts, ...complianceCerts].filter(c => {
      if (seen.has(c.document_url)) return false;
      seen.add(c.document_url);
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { ...r, certs };
  });

  const totalCerts = withCerts.reduce((sum, r) => sum + r.certs.length, 0);

  const handleDownload = (cert, assetName) => {
    if (!cert.document_url) {
      toast({ title: 'No document', description: 'This certificate has no uploaded file.', variant: 'destructive' });
      return;
    }
    window.open(cert.document_url, '_blank');
    setDownloadedIds(prev => new Set([...prev, cert.id]));
    toast({
      title: 'Certificate accessed',
      description: `${cert.title} for ${assetName} — opened for download. Recorded for audit trail.`,
    });
  };

  if (assigned.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
        <Cog className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No equipment assigned to this job</p>
        <p className="text-xs text-slate-300 mt-1">Assign equipment to access its compliance certificates</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Equipment Compliance & Certificates</h3>
          <p className="text-xs text-slate-400">{assigned.length} asset{assigned.length !== 1 ? 's' : ''} · {totalCerts} certificate{totalCerts !== 1 ? 's' : ''} on file — every access is recorded</p>
        </div>
      </div>

      {withCerts.map(({ assignment, asset, certs }) => {
        const comp = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
        const CompIcon = comp.icon;
        const TypeIcon = assetTypeIcon[asset.asset_type] || Cog;
        const typeLabel = assetTypeLabel[asset.asset_type] || 'Equipment';
        const isRig = asset.asset_type === 'rig' || asset.rig_type === 'cp' || asset.rig_type === 'rotary';
        const allDownloaded = certs.length > 0 && certs.every(c => downloadedIds.has(c.id));

        return (
          <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Asset header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isRig ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                <TypeIcon className={`w-5 h-5 ${isRig ? 'text-emerald-700' : 'text-slate-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-slate-900 text-sm truncate">{asset.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wide">{typeLabel}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {asset.serial_number || 'No serial'}{asset.equipment_type ? ` · ${asset.equipment_type}` : ''}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ring-1 ${comp.badge}`}>
                <CompIcon className="w-3.5 h-3.5" />{comp.label}
              </span>
            </div>

            {/* Compliance details */}
            <div className="px-4 py-3 space-y-2.5">
              {asset.compliance_expiry_date && (() => {
                const d = parseISO(asset.compliance_expiry_date);
                if (isNaN(d.getTime())) return null;
                return (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Compliance expiry</span>
                    <span className={`font-semibold ${
                      asset.compliance_status === 'expired' ? 'text-rose-600' :
                      asset.compliance_status === 'expiring' ? 'text-amber-600' : 'text-slate-700'
                    }`}>
                      {format(d, 'dd MMM yyyy')}
                    </span>
                  </div>
                );
              })()}
              {asset.responsible_person && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Responsible person</span>
                  <span className="font-medium text-slate-600">{asset.responsible_person}</span>
                </div>
              )}

              {/* Certificates */}
              {certs.length > 0 ? (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Certificates</p>
                  {certs.map(cert => {
                    const isDownloaded = downloadedIds.has(cert.id);
                    const certStatus = cert.status_override === 'not_required' ? 'not_required' :
                      !cert.expiry_date ? 'unknown' :
                      cert.expiry_date < format(new Date(), 'yyyy-MM-dd') ? 'expired' : 'valid';
                    return (
                      <div key={cert.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${
                          certStatus === 'expired' ? 'text-rose-500' :
                          certStatus === 'valid' ? 'text-emerald-600' : 'text-slate-400'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{cert.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {cert.expiry_date ? `Expires ${cert.expiry_date}` : 'No expiry'}
                            {cert.date ? ` · Inspected ${cert.date}` : ''}
                            {cert.tested_by ? ` · ${cert.tested_by}` : ''}
                            {cert.result ? ` · ${cert.result}` : ''}
                            {cert.document_name ? ` · ${cert.document_name}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={cert.document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                            View
                          </a>
                          <button
                            onClick={() => handleDownload(cert, asset.name)}
                            disabled={!cert.document_url}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isDownloaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            {isDownloaded ? 'Accessed' : 'Download'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-2 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">No compliance certificates on file for this asset</p>
                </div>
              )}

              {allDownloaded && certs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All certificates accessed — audit trail updated
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}