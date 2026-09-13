import React, { useMemo } from 'react';
import { Cog, Wrench, Boxes, Warehouse, MapPin, AlertTriangle, Package } from 'lucide-react';
import AssetCard from './AssetCard';
import { rollupCompliance, derivedComplianceStatus, findParentRig, daysUntil, ASSET_TYPE_META, COMPLIANCE_META } from '@/utils/rigRollup';

function isInDepot(asset) {
  const loc = (asset?.storage_location || '').toLowerCase().trim();
  return loc.includes('depot') || loc.includes('yard') || loc.includes('dartford');
}

/** Summary stat pill */
function SummaryPill({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/**
 * AssetGrid — unified, responsive grid for rigs and equipment.
 * Renders rigs (with compliance rollup) and equipment in a single responsive grid.
 * 1 column on mobile, 2 on tablet (md), 3 on desktop (xl).
 */
export default function AssetGrid({
  assets, rigs, category, search, compFilter, sourceFilter = 'all', depotOnly = false,
  groupBy = 'none', compact = false,
  deployFilter = 'all', lifecycleFilter = 'all', maintenanceFilter = 'all',
  selectionMode, selected, setSelected,
  onOpenRig, onOpenEquip, onCertVault, onUploadCert,
}) {
  const q = search.toLowerCase().trim();

  const matchesSource = (a) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'panda') return !!a.panda_asset_id;
    if (sourceFilter === 'local') return !a.panda_asset_id;
    return true;
  };

  const matchesDeploy = (a) => {
    if (deployFilter === 'all') return true;
    if (deployFilter === 'in_depot') return isInDepot(a);
    if (deployFilter === 'on_site') return !isInDepot(a) && a.is_active !== false;
    if (deployFilter === 'inactive') return a.is_active === false;
    return true;
  };

  const matchesLifecycle = (a) => {
    if (lifecycleFilter === 'all') return true;
    if (a.disposal_date) return lifecycleFilter === 'disposed';
    if (a.lifecycle_status === 'disposed') return lifecycleFilter === 'disposed';
    if (a.replacement_date) {
      const days = Math.floor((new Date(a.replacement_date) - new Date()) / 86400000);
      if (days <= 90 && days >= -365) return lifecycleFilter === 'due_for_replacement';
    }
    if (a.depreciation_years && a.acquisition_date) {
      const yearsElapsed = (Date.now() - new Date(a.acquisition_date).getTime()) / (365.25 * 86400000);
      if (yearsElapsed >= a.depreciation_years) return lifecycleFilter === 'aging';
    }
    return lifecycleFilter === 'active';
  };

  const matchesMaintenance = (a) => {
    if (maintenanceFilter === 'all') return true;
    const hours = a.operating_hours || a.hours_used || 0;
    const interval = a.service_interval_hours || 0;
    if (maintenanceFilter === 'overdue') return interval > 0 && hours >= interval;
    if (maintenanceFilter === 'due_soon') { const pct = interval > 0 ? (hours / interval) * 100 : 0; return pct >= 80 && pct < 100; }
    if (maintenanceFilter === 'on_track') { const pct = interval > 0 ? (hours / interval) * 100 : 0; return pct < 80; }
    if (maintenanceFilter === 'no_interval') return !interval;
    return true;
  };

  const rigsData = useMemo(() => rigs.map(rig => {
    const linked = (rig.linked_equipment_ids || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
    return { rig, linked, rollup: rollupCompliance(rig, linked) };
  }), [rigs, assets]);

  const filteredRigs = useMemo(() => rigsData.filter(({ rig, rollup }) => {
    if (depotOnly && !isInDepot(rig)) return false;
    if (!matchesSource(rig)) return false;
    if (!matchesDeploy(rig)) return false;
    if (!matchesLifecycle(rig)) return false;
    if (!matchesMaintenance(rig)) return false;
    if (compFilter !== 'all' && rollup.master !== compFilter) return false;
    if (!q) return true;
    return (rig.name || '').toLowerCase().includes(q) || (rig.serial_number || '').toLowerCase().includes(q);
  }), [rigsData, q, compFilter, sourceFilter, depotOnly, deployFilter, lifecycleFilter, maintenanceFilter]);

  const filteredEquip = useMemo(() => assets.filter(a => {
    if (a.asset_type === 'rig') return false;
    if (depotOnly && !isInDepot(a)) return false;
    if (!matchesSource(a)) return false;
    if (!matchesDeploy(a)) return false;
    if (!matchesLifecycle(a)) return false;
    if (!matchesMaintenance(a)) return false;
    if (category !== 'all' && a.asset_type !== category) return false;
    if (compFilter !== 'all' && derivedComplianceStatus(a) !== compFilter) return false;
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q);
  }).map(eq => ({ equip: eq, parentRig: findParentRig(eq.id, rigs) })), [assets, rigs, category, q, compFilter, sourceFilter, depotOnly, deployFilter, lifecycleFilter, maintenanceFilter]);

  const showRigs = category === 'all' || category === 'rig';
  const showEquip = category !== 'rig';
  const totalCount = (showRigs ? filteredRigs.length : 0) + (showEquip ? filteredEquip.length : 0);

  // Summary stats
  const depotCount = useMemo(() => assets.filter(a => a.asset_type !== 'rig' && isInDepot(a)).length, [assets]);
  const onSiteCount = useMemo(() => assets.filter(a => a.asset_type !== 'rig' && !isInDepot(a) && a.is_active !== false).length, [assets]);
  const attentionCount = useMemo(() => assets.filter(a => {
    if (a.asset_type === 'rig') return false;
    const d = daysUntil(a.compliance_expiry_date);
    return a.compliance_status === 'expired' || (d !== null && d <= 30) || a.is_active === false;
  }).length, [assets]);

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2.5">
          <SummaryPill icon={Boxes} label="Total Equipment" value={assets.filter(a => a.asset_type !== 'rig').length} tone="bg-slate-100 text-slate-600" />
          <SummaryPill icon={Warehouse} label="In Depot" value={depotCount} tone="bg-emerald-100 text-emerald-700" />
          <SummaryPill icon={MapPin} label="On Site" value={onSiteCount} tone="bg-blue-100 text-blue-700" />
          <SummaryPill icon={AlertTriangle} label="Needs Attention" value={attentionCount} tone="bg-amber-100 text-amber-700" />
        </div>
        <div className="hub-glass rounded-2xl p-10 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {assets.length === 0 ? 'No assets yet. Sync from Asset Panda to populate.' : 'No assets match your filters.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-2.5">
        <SummaryPill icon={Boxes} label="Total Equipment" value={assets.filter(a => a.asset_type !== 'rig').length} tone="bg-slate-100 text-slate-600" />
        <SummaryPill icon={Warehouse} label="In Depot" value={depotCount} tone="bg-emerald-100 text-emerald-700" />
        <SummaryPill icon={MapPin} label="On Site" value={onSiteCount} tone="bg-blue-100 text-blue-700" />
        <SummaryPill icon={AlertTriangle} label="Needs Attention" value={attentionCount} tone="bg-amber-100 text-amber-700" />
      </div>

      {/* Rigs section */}
      {showRigs && filteredRigs.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <Cog className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Rigs <span className="text-slate-400 font-normal normal-case tracking-normal">({filteredRigs.length})</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRigs.map(({ rig, linked }) => (
              <AssetCard
                key={rig.id}
                asset={rig}
                linkedItems={linked}
                compact={compact}
                selectionMode={selectionMode}
                isSelected={selected.has(rig.id)}
                onToggleSelect={toggleSelect}
                onOpen={onOpenRig}
                onCertVault={onCertVault}
                onUploadCert={onUploadCert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Equipment section */}
      {showEquip && filteredEquip.length > 0 && (() => {
        const groupKey = (eq) => {
          if (groupBy === 'type') return eq.asset_type || 'other';
          if (groupBy === 'location') return eq.storage_location || 'Unspecified';
          if (groupBy === 'status') return derivedComplianceStatus(eq) || 'unknown';
          if (groupBy === 'panda_group') return eq.panda_group_label || 'Ungrouped';
          return 'all';
        };
        const groupLabel = (key) => {
          if (groupBy === 'type') return (ASSET_TYPE_META[key]?.label || key);
          if (groupBy === 'status') return (COMPLIANCE_META[key]?.label || key);
          return key;
        };
        const groups = groupBy === 'none'
          ? [{ key: 'all', items: filteredEquip }]
          : Object.entries(
              filteredEquip.reduce((m, entry) => {
                const k = groupKey(entry.equip);
                (m[k] = m[k] || []).push(entry);
                return m;
              }, {})
            ).map(([key, items]) => ({ key, items }));

        return groups.map((group) => (
          <div key={group.key} className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Wrench className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                {depotOnly && groupBy === 'none' ? 'Depot Equipment' : 'Equipment'}
                {groupBy !== 'none' && <span className="text-slate-500 normal-case tracking-normal">· {groupLabel(group.key)}</span>}
                <span className="text-slate-400 font-normal normal-case tracking-normal">({group.items.length})</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.items.map(({ equip, parentRig }) => (
                <AssetCard
                  key={equip.id}
                  asset={equip}
                  parentRig={parentRig}
                  compact={compact}
                  selectionMode={selectionMode}
                  isSelected={selected.has(equip.id)}
                  onToggleSelect={toggleSelect}
                  onOpen={onOpenEquip}
                  onOpenRig={onOpenRig}
                  onUploadCert={onUploadCert}
                />
              ))}
            </div>
          </div>
        ));
      })()}
    </div>
  );
}