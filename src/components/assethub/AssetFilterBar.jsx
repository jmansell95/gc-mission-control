import React, { useState } from 'react';
import {
  Boxes, Cog, Anchor, Wrench, Package, Plug, Search, Warehouse,
  LayoutGrid, CheckSquare, ChevronDown, ChevronUp, SlidersHorizontal,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Boxes },
  { id: 'rig', label: 'Rigs', icon: Cog },
  { id: 'lifting', label: 'Lifting', icon: Anchor },
  { id: 'machinery', label: 'Machinery', icon: Wrench },
  { id: 'trailer', label: 'Trailers', icon: Package },
  { id: 'portable_appliance', label: 'PAT', icon: Plug },
];

/**
 * AssetFilterBar — unified, responsive filter bar for the Asset Hub.
 * On mobile: search + category pills (horizontal scroll) + collapsible advanced filters.
 * On desktop: all filters visible in a single row.
 */
export default function AssetFilterBar({
  category, setCategory, categoryCounts = {},
  search, setSearch,
  compFilter, setCompFilter,
  sourceFilter, setSourceFilter,
  depotOnly, setDepotOnly,
  groupBy, setGroupBy,
  deployFilter, setDeployFilter,
  lifecycleFilter, setLifecycleFilter,
  maintenanceFilter, setMaintenanceFilter,
  compact, setCompact,
  selectionMode, setSelectionMode,
  showSelection = true,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectCls = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary bg-white min-h-[40px]';

  return (
    <div className="hub-glass rounded-2xl p-3 sm:p-4 space-y-3">
      {/* Row 1: Search + category pills */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or serial..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 min-h-[40px]"
          />
        </div>

        {/* Category pills — horizontal scroll on mobile */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
          {CATEGORIES.map(cat => {
            const CIcon = cat.icon;
            const active = category === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap min-h-[40px] ${
                  active ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <CIcon className="w-3.5 h-3.5" /> {cat.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white text-slate-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Quick filters (always visible) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Compliance status */}
        <select value={compFilter} onChange={e => setCompFilter(e.target.value)} className={selectCls}>
          <option value="all">All Status</option>
          <option value="compliant">Compliant</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
          <option value="unknown">Unknown</option>
        </select>

        {/* Source toggle */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {[
            { val: 'all', label: 'All' },
            { val: 'panda', label: 'Panda' },
            { val: 'local', label: 'Local' },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setSourceFilter(opt.val)}
              className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-semibold transition min-h-[36px] ${
                sourceFilter === opt.val ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Depot toggle */}
        <button
          onClick={() => setDepotOnly(d => !d)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition min-h-[40px] ${
            depotOnly ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-4 h-4" /> Depot
        </button>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(s => !s)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition min-h-[40px] ${
            showAdvanced ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* View toggle */}
        <button
          onClick={() => setCompact(c => !c)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition min-h-[40px] ${
            compact ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
          title="Toggle compact view"
        >
          <LayoutGrid className="w-4 h-4" /> {compact ? 'Compact' : 'Detailed'}
        </button>

        {/* Selection mode */}
        {showSelection && (
          <button
            onClick={() => { setSelectionMode(m => !m); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition min-h-[40px] ${
              selectionMode ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CheckSquare className="w-4 h-4" /> {selectionMode ? 'Done' : 'Select'}
          </button>
        )}
      </div>

      {/* Row 3: Advanced filters (collapsible) */}
      {showAdvanced && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className={selectCls}>
            <option value="none">No grouping</option>
            <option value="type">Group by Type</option>
            <option value="location">Group by Location</option>
            <option value="status">Group by Status</option>
            <option value="panda_group">Group by Panda Group</option>
          </select>
          <select value={deployFilter} onChange={e => setDeployFilter(e.target.value)} className={selectCls}>
            <option value="all">All Locations</option>
            <option value="in_depot">In Depot</option>
            <option value="on_site">On Site / Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={lifecycleFilter} onChange={e => setLifecycleFilter(e.target.value)} className={selectCls}>
            <option value="all">All Lifecycle</option>
            <option value="active">Active</option>
            <option value="aging">Aging</option>
            <option value="due_for_replacement">Due for Replacement</option>
            <option value="disposed">Disposed</option>
          </select>
          <select value={maintenanceFilter} onChange={e => setMaintenanceFilter(e.target.value)} className={selectCls}>
            <option value="all">All Maintenance</option>
            <option value="on_track">On Track</option>
            <option value="due_soon">Due Soon</option>
            <option value="overdue">Overdue</option>
            <option value="no_interval">No Interval</option>
          </select>
        </div>
      )}
    </div>
  );
}