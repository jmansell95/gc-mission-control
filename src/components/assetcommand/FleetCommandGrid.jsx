import React, { useState, useMemo } from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Search, ArrowUpDown, FolderDown, Trash2, Power,
  Pencil, ScanLine, Filter,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { daysUntil } from '@/utils/rigRollup';
import { Skeleton } from '@/components/StateViews';

const COLOUR_HEX = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a', yellow: '#eab308',
  orange: '#ea580c', white: '#f8fafc', black: '#1e293b', silver: '#cbd5e1',
  grey: '#64748b', gray: '#64748b', purple: '#9333ea', brown: '#92400e',
  beige: '#e7d3a1', cream: '#f5ecd9', gold: '#d4af37', navy: '#1e3a8a',
};
function colourToHex(c) {
  const k = String(c || '').toLowerCase().trim();
  return COLOUR_HEX[k] || '#94a3b8';
}

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, badge: 'bg-blue-100 text-blue-700' },
  machinery: { label: 'Machinery', icon: Wrench, badge: 'bg-purple-100 text-purple-700' },
  trailer: { label: 'Trailer', icon: Package, badge: 'bg-amber-100 text-amber-700' },
  vehicle: { label: 'Vehicle', icon: Truck, badge: 'bg-slate-100 text-slate-700' },
  lifting: { label: 'Lifting', icon: Anchor, badge: 'bg-teal-100 text-teal-700' },
  portable_appliance: { label: 'PAT', icon: Plug, badge: 'bg-amber-100 text-amber-700' },
};

const COMP_META = {
  compliant: { label: 'Compliant', icon: ShieldCheck, tone: 'bg-emerald-100 text-emerald-700' },
  expiring: { label: 'Expiring', icon: ShieldAlert, tone: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Expired', icon: ShieldX, tone: 'bg-red-100 text-red-700' },
  unknown: { label: 'Unknown', icon: HelpCircle, tone: 'bg-slate-100 text-slate-500' },
};

const QUICK_VIEWS = [
  { key: 'all', label: 'All Assets', predicate: () => true },
  { key: 'expiring', label: 'Expiring Soon', predicate: a => a.compliance_status === 'expiring' },
  { key: 'expired', label: 'Expired', predicate: a => a.compliance_status === 'expired' },
  { key: 'unknown', label: 'Unknown', predicate: a => (a.compliance_status || 'unknown') === 'unknown' },
  { key: 'rigs', label: 'Rigs', predicate: a => a.asset_type === 'rig' },
  { key: 'lifting', label: 'Lifting Gear', predicate: a => a.asset_type === 'lifting' },
  { key: 'pat', label: 'PAT', predicate: a => a.asset_type === 'portable_appliance' },
  { key: 'inactive', label: 'Inactive', predicate: a => a.is_active === false },
  { key: 'unassigned', label: 'No Owner', predicate: a => !a.responsible_person },
  { key: 'yard', label: 'Yard', predicate: a => !!a.storage_location },
  { key: 'linked', label: 'Rig-Linked', predicate: a => Array.isArray(a.linked_equipment_ids) ? a.linked_equipment_ids.length > 0 : false },
];

const SORT_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'asset_type', label: 'Type' },
  { key: 'compliance_status', label: 'Compliance' },
  { key: 'compliance_expiry_date', label: 'Expiry' },
  { key: 'next_service_date', label: 'Next Service' },
];

const COMPLIANCE_ORDER = { expired: 0, expiring: 1, unknown: 2, compliant: 3 };

/**
 * Fleet Command Grid — high-density, sortable, filterable table with bulk
 * selection, quick views and inline actions. The core of the Asset
 * Command Centre.
 */
export default function FleetCommandGrid({ assets, isLoading, onOpenPassport, onEdit, onDelete, onBulkToggleActive, onBulkExportCerts }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());

  const typeOptions = useMemo(() => {
    const present = new Set(assets.map(a => a.asset_type).filter(Boolean));
    return ['all', ...Array.from(present)];
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const viewPred = QUICK_VIEWS.find(v => v.key === view)?.predicate || (() => true);
    let list = assets.filter(a => {
      if (!viewPred(a)) return false;
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      if (q) {
        const inName = (a.name || '').toLowerCase().includes(q);
        const inSerial = (a.serial_number || '').toLowerCase().includes(q);
        const inType = (a.equipment_type || '').toLowerCase().includes(q);
        const inResp = (a.responsible_person || '').toLowerCase().includes(q);
        const inLoc = (a.storage_location || '').toLowerCase().includes(q);
        if (!inName && !inSerial && !inType && !inResp && !inLoc) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (sortField === 'compliance_status') {
        av = COMPLIANCE_ORDER[av || 'unknown']; bv = COMPLIANCE_ORDER[bv || 'unknown'];
      } else {
        av = av || ''; bv = bv || '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [assets, search, view, typeFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id));
  const toggleAll = () => {
    setSelected(prev => {
      if (filtered.every(a => prev.has(a.id))) {
        const n = new Set(prev); filtered.forEach(a => n.delete(a.id)); return n;
      }
      const n = new Set(prev); filtered.forEach(a => n.add(a.id)); return n;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectedAssets = filtered.filter(a => selected.has(a.id));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-100 space-y-2.5">
        {/* Quick views */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_VIEWS.map(v => {
            const count = v.key === 'all' ? assets.length : assets.filter(v.predicate).length;
            return (
              <button key={v.key} onClick={() => setView(v.key)} type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${view === v.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {v.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${view === v.key ? 'bg-white/25' : 'bg-slate-200'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        {/* Search + type filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, serial, equipment type..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
            <option value="all">All Types</option>
            {typeOptions.filter(t => t !== 'all').map(t => (
              <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
            ))}
          </select>
        </div>
        {/* Sort hint */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <ArrowUpDown className="w-3 h-3" /> Click a column header to sort · {filtered.length} shown
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-emerald-800">{selected.size} selected</span>
          <button onClick={() => onBulkExportCerts(selectedAssets)} type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold transition">
            <FolderDown className="w-3.5 h-3.5" /> Open All Certs
          </button>
          <button onClick={() => { onBulkToggleActive(selectedAssets, true); clearSelection(); }} type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-emerald-700 hover:bg-emerald-50 font-semibold transition">
            <Power className="w-3.5 h-3.5" /> Activate
          </button>
          <button onClick={() => { onBulkToggleActive(selectedAssets, false); clearSelection(); }} type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-amber-700 hover:bg-amber-50 font-semibold transition">
            <Power className="w-3.5 h-3.5" /> Deactivate
          </button>
          <button onClick={clearSelection} type="button" className="px-2.5 py-1 text-slate-500 hover:text-slate-700 font-medium">Clear</button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="p-3 space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No assets match your filters</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing the search or switching view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </th>
                {SORT_FIELDS.map(f => (
                  <th key={f.key} className="px-3 py-2.5 cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort(f.key)}>
                    <span className="inline-flex items-center gap-1">
                      {f.label}
                      {sortField === f.key && <span className="text-emerald-600">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5">Serial</th>
                <th className="px-3 py-2.5">Responsible</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => {
                const tm = TYPE_META[a.asset_type] || TYPE_META.machinery;
                const cm = COMP_META[a.compliance_status] || COMP_META.unknown;
                const exp = a.compliance_expiry_date ? daysUntil(a.compliance_expiry_date) : null;
                const rowTint = a.compliance_status === 'expired' ? 'bg-red-50/30'
                  : a.compliance_status === 'expiring' ? 'bg-amber-50/20' : '';
                return (
                  <tr key={a.id} className={`hover:bg-slate-50/60 transition ${rowTint} ${!a.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    </td>
                    <td className="px-3 py-2.5 cursor-pointer" onClick={() => onOpenPassport(a)}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center flex-shrink-0">
                          <tm.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{a.name}</p>
                          {a.equipment_type && <p className="text-[10px] text-emerald-700 font-medium truncate">{a.equipment_type}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tm.badge}`}>{tm.label}</span>
                      {a.rig_type && a.rig_type !== 'n/a' && <span className="text-[10px] text-blue-600 font-semibold uppercase ml-1">{a.rig_type}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cm.tone}`}>
                        <cm.icon className="w-3 h-3" /> {cm.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {a.compliance_expiry_date ? (
                        <span className={exp !== null && exp < 0 ? 'text-red-600 font-semibold' : exp !== null && exp <= 30 ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                          {safeFormat(a.compliance_expiry_date, 'dd MMM yyyy')}
                          {exp !== null && <span className="text-[10px] text-slate-400 block">{exp < 0 ? `${Math.abs(exp)}d overdue` : `${exp}d left`}</span>}
                        </span>
                      ) : (a.asset_type === 'machinery' || a.asset_type === 'trailer') ? <span className="text-[11px] text-slate-400">Lifetime</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{a.next_service_date ? safeFormat(a.next_service_date, 'dd MMM') : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{a.serial_number || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {a.responsible_person ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {a.responsible_person}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {a.storage_location ? (
                        <span className="inline-flex items-center gap-1.5">
                          {a.colour && <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0" style={{ background: colourToHex(a.colour) }} />}
                          {a.storage_location}
                        </span>
                      ) : a.colour ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ background: colourToHex(a.colour) }} />
                          {a.colour}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${a.is_active !== false ? 'text-emerald-700' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.is_active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {a.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => onOpenPassport(a)} title="Open passport" className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition">
                          <ScanLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => onEdit(a)} title="Edit" className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(a)} title="Delete" className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}