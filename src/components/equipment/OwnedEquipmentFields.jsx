import React, { useMemo, useState } from 'react';
import { Calendar, Receipt, User, ShieldCheck, ShieldAlert, ShieldX, Factory, Tag, AlertCircle } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { inputCls, fmt } from './shared';
import { resolveAssetPrice } from '@/components/logistics/rigRateMatcher';
import OwnedItemPicker from './OwnedItemPicker';

const assetTypeLabels = {
  rig: 'Drilling Rigs',
  machinery: 'Machinery',
  trailer: 'Trailers',
  vehicle: 'Vehicles',
  lifting: 'Lifting Gear',
};

const complianceBadge = {
  compliant: { icon: ShieldCheck, cls: 'text-emerald-600' },
  expiring: { icon: ShieldAlert, cls: 'text-amber-600' },
  expired: { icon: ShieldX, cls: 'text-red-600' },
  unknown: { icon: ShieldCheck, cls: 'text-slate-400' },
};

// Short text indicator shown inside <option> text — native dropdowns can't render icons
const complianceOptionText = {
  compliant: '✓ Compliant',
  expiring: '⚠ Expiring',
  expired: '✗ Expired',
  unknown: '',
};

export default function OwnedEquipmentFields({ form, setForm, ownedAssets = [], defaultDates, rateCardItems = [] }) {
  const [priceSource, setPriceSource] = useState(form.site_asset_id ? 'asset-panda' : form.rate_card_item_id ? 'rate-card' : '');
  const [rateFocused, setRateFocused] = useState(false);
  // Display the charge-out rate with 2 decimals when the field isn't being edited
  const rateDisplay = rateFocused
    ? form.unit_cost
    : (form.unit_cost && !isNaN(Number(form.unit_cost)) ? Number(form.unit_cost).toFixed(2) : form.unit_cost);

  // Master Price List items for owned equipment — Plant & Materials from our company rate card
  const ourRateItems = (rateCardItems || []).filter(
    (i) => i.is_active !== false && (i.rate_card_source || 'our_company') === 'our_company' && (i.category === 'plant' || i.category === 'materials')
  );

  // Group rate card items by subcategory (or category if no subcategory)
  const rateCardGroups = useMemo(() => {
    const groups = {};
    ourRateItems.forEach((item) => {
      const key = item.subcategory || (item.category === 'plant' ? 'Plant' : 'Materials');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Sort groups alphabetically, items by description within
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items: items.sort((a, b) => (a.description || '').localeCompare(b.description || '')) }));
  }, [ourRateItems]);

  // Group Asset Panda assets by asset_type
  const assetGroups = useMemo(() => {
    const groups = {};
    (ownedAssets || []).forEach((asset) => {
      const type = asset.asset_type || 'other';
      const label = assetTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
      if (!groups[label]) groups[label] = [];
      groups[label].push(asset);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items: items.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }));
  }, [ownedAssets]);

  const handlePick = (value) => {
    if (!value) { setPriceSource(''); return; }
    if (value.startsWith('rc-')) {
      const id = value.slice(3);
      const item = (rateCardItems || []).find((r) => r.id === id);
      if (!item) return;
      setPriceSource('rate-card');
      setForm({
        ...form,
        category: 'internal_equipment',
        description: item.description || form.description,
        unit_cost: String(item.price ?? ''),
        unit_label: item.unit || 'day',
        vat_exempt: false,
        rate_card_item_id: item.id,
        is_poa: item.price == null,
        supplier_id: '',
        site_asset_id: '',
        notes: item.notes || form.notes,
      });
    } else if (value.startsWith('ap-')) {
      const id = value.slice(3);
      const asset = (ownedAssets || []).find((a) => a.id === id);
      if (!asset) return;
      // Owned assets are inventory only (Asset Panda) — their billable rate
      // comes from the Master Price List via resolveAssetPrice, which respects
      // the admin's confirmed/proposed rate-card link status (the master
      // catalogue is the single source of truth for asset pricing).
      const price = resolveAssetPrice(asset, rateCardItems);
      const rc = price.rateCardItem;
      setPriceSource(price.source === 'rate-card' ? 'rate-card' : 'asset-panda');
      setForm({
        ...form,
        category: 'internal_equipment',
        description: asset.name || form.description,
        reference_number: asset.serial_number || form.reference_number,
        responsible_person: asset.responsible_person || form.responsible_person,
        unit_cost: price.chargeOut > 0 ? String(price.chargeOut) : (asset.daily_billing_rate != null ? String(asset.daily_billing_rate) : form.unit_cost),
        unit_label: price.unit || 'day',
        site_asset_id: asset.id,
        rate_card_item_id: rc?.id || '',
        is_poa: rc ? rc.price == null : false,
        supplier_id: '',
        quantity: asset.asset_type === 'rig' ? '1' : (form.quantity || '1'),
        notes: asset.tooling_notes || asset.notes || form.notes,
      });
    }
  };

  const linkedAsset = form.site_asset_id ? (ownedAssets || []).find((a) => a.id === form.site_asset_id) : null;
  const compBadge = linkedAsset?.compliance_status ? complianceBadge[linkedAsset.compliance_status] : null;
  // Rigs are unique serial-numbered assets — quantity is always 1 and locked.
  const isRigAsset = linkedAsset?.asset_type === 'rig';

  const isHiredByDay = form.unit_label === 'day';
  const itemCount = Number(form.quantity) || 1;
  const daysFromForm = () => {
    if (form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      return d > 0 ? d : 1;
    }
    return null;
  };
  const days = isHiredByDay ? (daysFromForm() ?? 1) : 1;
  const lineTotal = (Number(form.unit_cost) || 0) * itemCount * days;

  return (
    <div className="space-y-3">
      {/* Grouped picker — Master Price List + Asset Panda */}
      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Tag className="w-3 h-3 text-blue-600" /> Pick from Master Price List or Asset Panda inventory
        </label>
        <OwnedItemPicker
          value={form.site_asset_id ? `ap-${form.site_asset_id}` : form.rate_card_item_id ? `rc-${form.rate_card_item_id}` : ''}
          onChange={handlePick}
          rateCardGroups={rateCardGroups}
          assetGroups={assetGroups}
          rateCardItems={rateCardItems}
        />
        {rateCardGroups.length === 0 && assetGroups.length === 0 && (
          <p className="text-xs text-slate-400 italic mt-1">No rate card items or Asset Panda assets found. Enter details manually below. Rate card items can be added in Settings → Rate Card; Asset Panda assets will appear once synced.</p>
        )}
      </div>

      {/* Source badge + compliance status */}
      {priceSource === 'rate-card' && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Price from Master Price List — chargeable to the client.
        </div>
      )}
      {priceSource === 'asset-panda' && linkedAsset && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-indigo-700 bg-indigo-50 rounded-md px-3 py-2 border border-indigo-200 flex items-center gap-1.5">
            <Factory className="w-3.5 h-3.5" /> Owned Equipment · {assetTypeLabels[linkedAsset.asset_type] || linkedAsset.asset_type}
          </div>
          {form.rate_card_item_id && (() => {
            const rc = (rateCardItems || []).find((r) => r.id === form.rate_card_item_id);
            if (!rc) return null;
            return (
              <div className="text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2 border border-blue-200 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Rate: {rc.price != null ? fmt(rc.price) : rc.price_text || 'POA'}{rc.unit ? `/${rc.unit}` : ''} <span className="text-slate-400">· from Master Price List</span>
              </div>
            );
          })()}
          {compBadge && (
            <div className={`text-xs rounded-md px-2.5 py-2 border border-slate-200 flex items-center gap-1.5 ${compBadge.cls}`}>
              <compBadge.icon className="w-3.5 h-3.5" /> {linkedAsset.compliance_status}
              {linkedAsset.compliance_expiry_date && <span className="text-slate-400">· exp {linkedAsset.compliance_expiry_date}</span>}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </div>

      {form.responsible_person && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><User className="w-3 h-3 text-slate-400" /> Responsible Person</label>
          <input value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} className={inputCls} />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
        <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} className={inputCls} />
      </div>

      {isHiredByDay && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3 h-3 text-emerald-700" /> Hire start
              {defaultDates && defaultDates.start && (
                <button type="button" onClick={() => setForm({ ...form, start_date: defaultDates.start, end_date: defaultDates.end })} className="text-emerald-600 hover:text-emerald-800 font-medium ml-1">Use job dates</button>
              )}
            </label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hire end</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Charge-out rate (net) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">£</span>
            <input type="number" min="0" step="0.01" value={rateDisplay} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} onFocus={() => setRateFocused(true)} onBlur={() => setRateFocused(false)} placeholder="0.00" className={`${inputCls} pl-7`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
          <select value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} className={inputCls}>
            <option value="day">per day</option>
            <option value="hour">per hour</option>
            <option value="m">per metre</option>
            <option value="each">each</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity{isHiredByDay ? ' (items to deploy)' : ''}{isRigAsset && ' (locked — 1 rig)'}</label>
          <input type="number" min="1" step="1" value={isRigAsset ? '1' : form.quantity} onChange={(e) => !isRigAsset && setForm({ ...form, quantity: e.target.value })} disabled={isRigAsset} placeholder="1" className={`${inputCls} ${isRigAsset ? 'bg-slate-100 cursor-not-allowed' : ''}`} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        VAT exempt (zero-rated item)
      </label>

      {form.is_poa && (
        <div className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2 border border-amber-200 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> Price on Application — this rate card item has no fixed price. Confirm the agreed rate later from the Pending Pricing panel.
        </div>
      )}

      {/* Internal cost hint — shown when a rate card item with cost_price is linked */}
      {form.rate_card_item_id && (() => {
        const rc = (rateCardItems || []).find((r) => r.id === form.rate_card_item_id);
        if (!rc || rc.cost_price == null) return null;
        const chargeOut = Number(form.unit_cost) || 0;
        const internalCost = Number(rc.cost_price) || 0;
        const margin = chargeOut > 0 ? ((chargeOut - internalCost) / chargeOut) * 100 : null;
        return (
          <div className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2 border border-amber-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Internal cost: {fmt(internalCost)}/{rc.unit || 'day'}{margin != null ? ` · ${margin.toFixed(0)}% margin` : ''}
          </div>
        );
      })()}

      {Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line revenue: {itemCount} item{itemCount > 1 ? 's' : ''}{isHiredByDay && days > 1 ? ` × ${days} days` : ''} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}