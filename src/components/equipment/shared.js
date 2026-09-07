import { Truck, ShoppingCart, Wrench, HardHat, Hammer } from 'lucide-react';

export const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

export const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Effective billing total for a job cost item. For day-rate items, billing =
// day_rate × quantity × days on site (from start_date → end_date). Non-day-rate
// items use quantity only. Rigs have quantity 1, so their total comes entirely
// from day_rate × days. Gear items linked to a rig are £0 (included in the
// rig day rate), so their total is 0 regardless.
export const billingTotal = (item) => {
  const rate = Number(item?.unit_cost) || 0;
  const qty = Number(item?.quantity) || 1;
  if (item?.unit_label === 'day' && item?.start_date && item?.end_date) {
    const start = new Date(item.start_date + 'T00:00:00');
    const end = new Date(item.end_date + 'T00:00:00');
    const ms = end.getTime() - start.getTime();
    const days = Math.floor(ms / 86400000) + 1;
    if (days > 0) return rate * qty * days;
  }
  return rate * qty;
};

// Labour / Extra Crew removed — crew costs are AFP-driven, not added as
// billable items. Existing labour JobCostItem records are preserved but
// no new ones can be created from the EquipmentForm flow.
export const categoryConfig = {
  hired_equipment: { label: 'Hired Equipment', icon: Truck, desc: 'Hired from a supplier', color: 'amber' },
  purchased_equipment: { label: 'Purchased Equipment', icon: ShoppingCart, desc: 'Bought for this job (needs PO + order slip)', color: 'purple' },
  internal_equipment: { label: 'Owned Equipment', icon: Wrench, desc: 'Priced from the Master Price List (Plant & Materials)', color: 'blue' },
  contractor_supplied: { label: 'Contractor Supplied', icon: HardHat, desc: 'Supplied by the contractor — no cost tracked', color: 'indigo' },
  client_supplied: { label: 'Client Supplied', icon: Hammer, desc: 'Delivered by client — informational only', color: 'slate' },
};