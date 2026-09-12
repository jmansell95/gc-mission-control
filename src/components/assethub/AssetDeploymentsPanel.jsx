import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Package, Truck, Anchor, Wrench, Cog, Plug, ArrowRight, Boxes, Clock, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const TYPE_ICON = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug,
};

const STATUS_META = {
  assigned: { label: 'Assigned', cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  on_site: { label: 'On Site', cls: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  returned: { label: 'Returned', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export default function AssetDeploymentsPanel({ assets = [] }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpand = (jobId) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(jobId)) n.delete(jobId);
    else n.add(jobId);
    return n;
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['asset-deployments'],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ status: { $in: ['assigned', 'on_site'] } }, '-assigned_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-deployments'],
    queryFn: () => base44.entities.Job.list('-updated_date', 200),
  });

  const assetById = useMemo(() => Object.fromEntries(assets.map(a => [a.id, a])), [assets]);
  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  // Group assignments by job
  const byJob = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      if (!map[a.job_id]) map[a.job_id] = { job: jobById[a.job_id] || { id: a.job_id, name: a.job_name || 'Unknown Job' }, items: [] };
      map[a.job_id].items.push(a);
    });
    return Object.values(map).sort((x, y) => y.items.length - x.items.length);
  }, [assignments, jobById]);

  // Assets currently in yard (not deployed)
  const deployedAssetIds = useMemo(() => new Set(assignments.map(a => a.asset_id)), [assignments]);
  const yardAssets = useMemo(() => assets.filter(a => a.is_active !== false && !deployedAssetIds.has(a.id) && a.asset_type !== 'vehicle'), [assets, deployedAssetIds]);

  const filtered = statusFilter === 'yard' ? [] : byJob;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile icon={MapPin} label="On Site" value={assignments.filter(a => a.status === 'on_site').length} tone="emerald" />
        <SummaryTile icon={Clock} label="Assigned (pending)" value={assignments.filter(a => a.status === 'assigned').length} tone="blue" />
        <SummaryTile icon={Boxes} label="In Yard" value={yardAssets.length} tone="slate" />
        <SummaryTile icon={ArrowRight} label="Active Deployments" value={byJob.length} tone="violet" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <FilterPill active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} label="All Deployments" />
        <FilterPill active={statusFilter === 'on_site'} onClick={() => setStatusFilter('on_site')} label="On Site Only" />
        <FilterPill active={statusFilter === 'yard'} onClick={() => setStatusFilter('yard')} label="In Yard" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : statusFilter === 'yard' ? (
        <YardAssetsList assets={yardAssets} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No active deployments</p>
          <p className="text-xs mt-1">All assets are in the yard</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(({ job, items }) => {
            const visible = statusFilter === 'on_site' ? items.filter(i => i.status === 'on_site') : items;
            if (visible.length === 0) return null;
            const isOpen = expanded.has(job.id);
            return (
              <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(job.id)}
                  className="w-full px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-100/60 transition text-left"
                >
                  <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm truncate">{job.name || 'Unknown Job'}</p>
                    {job.location && <p className="text-xs text-slate-400 truncate">{job.location}</p>}
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full">{visible.length}</span>
                </button>
                {isOpen && (
                <div className="divide-y divide-slate-50">
                  {visible.map(item => {
                    const asset = assetById[item.asset_id];
                    const Icon = TYPE_ICON[item.asset_type] || Boxes;
                    const meta = STATUS_META[item.status] || STATUS_META.assigned;
                    return (
                      <div key={item.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/50">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.asset_name || asset?.name || 'Unknown'}</p>
                          <p className="text-[11px] text-slate-400 truncate">{item.asset_type || asset?.asset_type}{asset?.serial_number ? ` · ${asset.serial_number}` : ''}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${meta.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-600',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <Icon className="w-4 h-4 mb-1.5 opacity-70" />
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${active ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
      {label}
    </button>
  );
}

function YardAssetsList({ assets }) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-300" />
        <p className="text-sm font-medium">No assets in yard</p>
        <p className="text-xs mt-1">All active assets are deployed</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-50">
      {assets.map(a => {
        const Icon = TYPE_ICON[a.asset_type] || Boxes;
        return (
          <div key={a.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/50">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{a.asset_type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
            </div>
            {a.storage_location && <span className="text-[11px] text-slate-400 truncate hidden sm:block">{a.storage_location}</span>}
            {a.stock_level === 'out_of_stock' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">Out</span>}
            {a.stock_level === 'needs_service' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">Service</span>}
          </div>
        );
      })}
    </div>
  );
}