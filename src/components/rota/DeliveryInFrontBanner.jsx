import React from 'react';
import { Truck, Package, ArrowRightLeft, FlaskConical, Layers } from 'lucide-react';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  supplier_delivery: { label: 'Supplier', icon: Package, cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  supplier_collection: { label: 'Collection', icon: Package, cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  sample_collection: { label: 'Sample', icon: FlaskConical, cls: 'bg-teal-100 text-teal-700 border-teal-300' },
  sample_delivery: { label: 'Sample', icon: FlaskConical, cls: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
};

/**
 * Compact banner card shown at the top of a rota grid cell when the driver
 * has an active (non-completed) delivery on a day they also have depot duty.
 * Mirrors the bank-holiday banner styling pattern.
 */
export default function DeliveryInFrontBanner({ deliveries = [], jobs = [] }) {
  if (deliveries.length === 0) return null;
  const first = deliveries[0];
  const cfg = typeConfig[first.delivery_type] || typeConfig.site_delivery;
  const Icon = cfg.icon;
  const job = jobs.find((j) => j.id === first.job_id);
  const addr =
    first.delivery_type === 'supplier_collection' || first.delivery_type === 'sample_collection'
      ? first.pickup_address
      : first.delivery_address;
  return (
    <div className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${cfg.cls}`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate flex-1">{job?.name || first.job_name || addr || 'Delivery run'}</span>
      {deliveries.length > 1 && (
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-white/70 text-[9px] flex-shrink-0">
          <Layers className="w-2.5 h-2.5" />+{deliveries.length - 1}
        </span>
      )}
    </div>
  );
}