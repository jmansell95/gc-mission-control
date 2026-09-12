import React from 'react';
import { Drill, Clock, HardHat, Hotel, Package, Truck, MapPin } from 'lucide-react';
import AFPDisputeRow from './AFPDisputeRow';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const SHEET_META = {
  ewr_rotary_drilling: { label: 'Rotary Drilling', icon: Drill, color: 'text-blue-600', bg: 'bg-blue-50' },
  ewr_cp_drilling: { label: 'CP Drilling', icon: Drill, color: 'text-amber-600', bg: 'bg-amber-50' },
  ewr_rotary_dayworks: { label: 'Rotary Dayworks', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  ewr_cp_dayworks: { label: 'CP Dayworks', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ewr_enabling_crew: { label: 'Enabling Crew', icon: HardHat, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ewr_accommodation: { label: 'Accommodation', icon: Hotel, color: 'text-violet-600', bg: 'bg-violet-50' },
  ewr_misc: { label: 'Misc', icon: Package, color: 'text-slate-600', bg: 'bg-slate-50' },
  ewr_hires: { label: 'Hires', icon: Truck, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ewr_mileage: { label: 'Mileage', icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-50' },
};

/**
 * EWRSheetTab — renders the line items for a single EWR sheet (e.g. Rotary
 * Drilling, CP Drilling, Dayworks, Enabling Crew, Accommodation, etc.) in an
 * editable table. Each row uses AFPDisputeRow so the billing team can edit
 * quantities, rates, dispute status, and delete lines.
 */
export default function EWRSheetTab({ sheetName, lineItems, afp, canEdit, canDispute, canSelect, selectedItems, onToggleSelect, onAutoSave, onDelete }) {
  const meta = SHEET_META[sheetName] || SHEET_META.ewr_misc;
  const Icon = meta.icon;
  const items = lineItems.filter(li => li.sheet_name === sheetName);
  const total = items.reduce((s, li) => s + (li.agreed_amount != null ? Number(li.agreed_amount) : (li.amount || 0)), 0);

  if (items.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 text-center">
        <Icon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No {meta.label} items in this AFP</p>
      </div>
    );
  }

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${meta.color}`} />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{meta.label}</h3>
        <span className="text-[10px] text-slate-400">({items.length} lines)</span>
        <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">{fmt(total)}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map(li => (
          <AFPDisputeRow
            key={li.id}
            item={li}
            canEdit={canEdit}
            canDispute={canDispute}
            canSelect={canSelect}
            selected={selectedItems?.has(li.id)}
            onSelect={() => onToggleSelect?.(li.id)}
            onUpdate={(updates) => onAutoSave(li.id, updates)}
            onAutoSave={onAutoSave}
            onDelete={() => onDelete(li.id)}
          />
        ))}
      </div>
    </div>
  );
}