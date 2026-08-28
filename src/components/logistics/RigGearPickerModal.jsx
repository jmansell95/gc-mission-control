import React, { useState, useMemo } from 'react';
import { X, Layers, Plus, Loader2, Check, Package, Cog, Search, CalendarClock } from 'lucide-react';
import { findRigRateCardItem, rigFallbackDayRate } from './rigRateMatcher';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Pick a rig (SiteAsset with is_rig) and add it plus its linked gear to the job.
 * Rigs = SiteAsset records (is_rig === true, active).
 * Gear = SiteAsset records referenced by the rig's linked_equipment_ids.
 * Day rate is pulled from Our Rate Card via findRigRateCardItem, falling back
 * to the rig's daily_billing_rate (synced from Asset Panda).
 */
export default function RigGearPickerModal({ rigs = [], assets = [], rateCardItems = [], projectId = null, jobStartDate = '', jobEndDate = '', onAdd, onClose, adding = false }) {
  const [selectedRig, setSelectedRig] = useState(null);
  const [onSiteStart, setOnSiteStart] = useState(jobStartDate || '');
  const [onSiteEnd, setOnSiteEnd] = useState(jobEndDate || '');
  const [search, setSearch] = useState('');

  const filteredRigs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rigs;
    return rigs.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.serial_number || '').toLowerCase().includes(q) ||
      (r.fleet_number || '').toLowerCase().includes(q)
    );
  }, [rigs, search]);

  const handleAdd = () => {
    if (!selectedRig || !onSiteStart) return;
    onAdd(selectedRig, { onSiteStart, onSiteEnd });
  };

  const gearFor = (rig) => (rig.linked_equipment_ids || [])
    .map(id => assets.find(a => a.id === id))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !adding && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-700" />
            <h3 className="font-bold text-slate-900">Add Rig & Gear</h3>
          </div>
          <button onClick={() => !adding && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-500">Select a rig to add it and all its linked gear to the job. The day rate is pulled automatically from Our Rate Card — gear items are included at no extra cost.</p>
          {rigs.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, serial or fleet no…"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
          {rigs.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400">
              <Cog className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No rigs available. Sync rigs from Asset Panda and link their gear in Settings → Compliance Sync first.
            </div>
          )}
          {filteredRigs.length === 0 && search && (
            <div className="text-center py-6 text-sm text-slate-400">
              <Search className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              No rigs match "{search}".
            </div>
          )}
          {filteredRigs.map(rig => {
            const gear = gearFor(rig);
            const isSelected = selectedRig === rig.id;
            const rateCardItem = findRigRateCardItem(rig, rateCardItems, projectId);
            const dayRate = rateCardItem ? (Number(rateCardItem.price) || 0) : rigFallbackDayRate(rig);
            const dayCost = rateCardItem && rateCardItem.cost_price != null ? (Number(rateCardItem.cost_price) || 0) : null;
            const unit = rateCardItem?.unit || 'day';
            return (
              <button key={rig.id} onClick={() => { setSelectedRig(isSelected ? null : rig.id); if (!isSelected) { setOnSiteStart(jobStartDate || ''); setOnSiteEnd(jobEndDate || ''); } }}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Layers className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`} />
                  <p className="text-sm font-bold text-slate-900 flex-1 truncate">{rig.name}</p>
                  {rig.serial_number && <span className="text-[10px] text-slate-400 font-normal truncate">{rig.serial_number}</span>}
                  {rateCardItem && <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Rate Card</span>}
                  {isSelected && <Check className="w-4 h-4 text-blue-700 flex-shrink-0" />}
                </div>
                <div className="ml-6 space-y-0.5">
                  {gear.length === 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                      <Package className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span>No linked gear — link equipment to this rig in Settings → Compliance Sync</span>
                    </div>
                  ) : (
                    gear.map(g => (
                      <div key={g.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Package className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="truncate">{g.name}</span>
                        {g.serial_number && <span className="text-slate-400 flex-shrink-0">({g.serial_number})</span>}
                        <span className="text-slate-400 ml-auto flex-shrink-0">included</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="ml-6 mt-1.5 flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-slate-400">{gear.length} gear item{gear.length !== 1 ? 's' : ''} included</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-emerald-700">Charge: {fmt(dayRate)} / {unit}</span>
                  {dayCost != null && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-amber-600">Cost: {fmt(dayCost)} / {unit}</span>
                    </>
                  )}
                  {rateCardItem && <span className="text-slate-400 truncate">({rateCardItem.description})</span>}
                </div>
              </button>
            );
          })}
          {selectedRig && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-2.5 animate-pop-in">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-700" />
                <p className="text-xs font-semibold text-blue-800">On-site period</p>
              </div>
              <p className="text-[11px] text-blue-600">Choose the days you want this rig on site. Crew costs are calculated automatically: day rate × working days. Revenue comes from meterage × metres drilled.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">On site from</label>
                  <input type="date" value={onSiteStart} onChange={e => setOnSiteStart(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">On site to (blank = ongoing)</label>
                  <input type="date" value={onSiteEnd} onChange={e => setOnSiteEnd(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleAdd} disabled={!selectedRig || adding || !onSiteStart}
            className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add to Job</>}
          </button>
          <button onClick={() => !adding && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}