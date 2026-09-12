import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Cog, Wrench, Package, ArrowRight, MapPin, Anchor, ChevronDown, Link2 } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';

const assetTypeConfig = {
  rig: { icon: Cog, chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { icon: Wrench, chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { icon: Package, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { icon: Package, chip: 'bg-slate-50 text-slate-600 border-slate-200' },
  lifting: { icon: Anchor, chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  portable_appliance: { icon: Package, chip: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function AssetChip({ type, name, serial, onSite }) {
  const cfg = assetTypeConfig[type] || assetTypeConfig.machinery;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border ${cfg.chip}`}>
      <Icon className="w-3 h-3" />
      {name}
      {serial && <span className="text-[10px] opacity-60 font-mono">#{serial}</span>}
      {onSite && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
    </span>
  );
}

function RigRow({ rig, assetMap, costItems, jobId }) {
  const [expanded, setExpanded] = useState(false);
  const linkedIds = rig.linked_equipment_ids || [];

  // Find linked gear that is also on this job (by matching site_asset_id)
  const linkedOnJob = linkedIds
    .map(id => {
      const asset = assetMap[id];
      if (!asset) return null;
      const costItem = costItems.find(c => c.job_id === jobId && c.site_asset_id === id && (c.hire_status || 'active') === 'active');
      return asset && costItem ? { asset, costItem } : null;
    })
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <AssetChip type="rig" name={rig.asset_name} serial={rig.serial_number} onSite={rig.on_site} />
        {linkedOnJob.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded-md hover:bg-blue-100 transition"
          >
            <Link2 className="w-3 h-3" />
            {linkedOnJob.length} gear
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {expanded && linkedOnJob.length > 0 && (
        <div className="px-2.5 pb-2 pt-1 space-y-1 border-t border-blue-100/60">
          {linkedOnJob.map(({ asset, costItem }) => (
            <div key={asset.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="font-medium">{asset.name}</span>
              {asset.serial_number && <span className="text-[10px] font-mono text-slate-400">#{asset.serial_number}</span>}
              <span className="text-[10px] text-slate-400 capitalize">{asset.asset_type}</span>
              {(costItem.current_location || 'yard') === 'site' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobAssetsWidget({ onSelectJob }) {
  const { selectedJobId } = useJobFilter();

  // Source of truth: JobCostItem records linked to a SiteAsset. The
  // JobAssetAssignment entity is an unreliable denormalised snapshot that has
  // historically failed to populate (schema enum mismatches, bulkCreate
  // atomicity). Reading directly from JobCostItem + SiteAsset guarantees the
  // dashboard reflects what managers actually assigned in the logistics hub.
  const { data: costItems = [], isLoading } = useQuery({
    queryKey: ['job-cost-items-with-assets'],
    queryFn: () => base44.entities.JobCostItem.list('-updated_date', 500),
  });
  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-widget'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const assetMap = {};
  (siteAssets || []).forEach(a => { assetMap[a.id] = a; });

  // Active cost items linked to a physical SiteAsset (rigs, machinery, gear).
  // Excludes off-hired/returned items and non-physical categories (labour,
  // contractor/client-supplied) that don't represent owned equipment on site.
  const activeAssetItems = (costItems || []).filter(c =>
    c.site_asset_id &&
    c.site_asset_id.trim() !== '' &&
    (c.hire_status || 'active') === 'active' &&
    c.category !== 'labour' &&
    c.category !== 'contractor_supplied' &&
    c.category !== 'client_supplied' &&
    (selectedJobId === 'all' || c.job_id === selectedJobId)
  );

  const byJob = {};
  activeAssetItems.forEach(c => {
    const asset = assetMap[c.site_asset_id];
    if (!asset) return; // skip orphaned links
    if (!byJob[c.job_id]) byJob[c.job_id] = [];
    byJob[c.job_id].push({
      id: c.id,
      asset_id: asset.id,
      asset_name: asset.name || c.description,
      asset_type: asset.asset_type || 'machinery',
      serial_number: asset.serial_number || '',
      linked_equipment_ids: asset.linked_equipment_ids || [],
      on_site: (c.current_location || 'yard') === 'site',
    });
  });

  const jobEntries = Object.entries(byJob)
    .map(([jobId, assets]) => ({ job: jobs.find(j => j.id === jobId), assets }))
    .filter(e => e.job)
    .sort((a, b) => (a.job.name || '').localeCompare(b.job.name || ''));

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50/90 via-white to-white border-b border-slate-100/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Job Assets</h2>
            <p className="text-xs text-slate-400">Rigs, machinery &amp; trailers on active Jobs</p>
          </div>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{jobEntries.length} {jobEntries.length === 1 ? 'Job' : 'Jobs'}</span>
      </div>

      {isLoading ? (
        <div className="px-5 py-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : jobEntries.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Boxes className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No rigs or equipment assigned to Jobs yet
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 max-h-[480px] overflow-y-auto">
          {jobEntries.map(({ job, assets }) => {
            const rigs = assets.filter(a => a.asset_type === 'rig');
            const machinery = assets.filter(a => a.asset_type === 'machinery');
            const trailers = assets.filter(a => a.asset_type === 'trailer');
            const other = assets.filter(a => !['rig', 'machinery', 'trailer'].includes(a.asset_type));
            return (
              <button key={job.id} onClick={() => onSelectJob(job)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-slate-50/50 hover:shadow-sm transition cursor-pointer text-left group">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-slate-900 truncate flex-1">{job.name}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
                </div>
                {job.location && (
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {job.location}
                  </p>
                )}
                <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  {rigs.map(a => (
                    <RigRow key={a.id} rig={a} assetMap={assetMap} costItems={activeAssetItems} jobId={job.id} />
                  ))}
                  {(machinery.length > 0 || trailers.length > 0 || other.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {machinery.map(a => <AssetChip key={a.id} type="machinery" name={a.asset_name} serial={a.serial_number} onSite={a.on_site} />)}
                      {trailers.map(a => <AssetChip key={a.id} type="trailer" name={a.asset_name} serial={a.serial_number} onSite={a.on_site} />)}
                      {other.map(a => <AssetChip key={a.id} type={a.asset_type} name={a.asset_name} serial={a.serial_number} onSite={a.on_site} />)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}