import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, ArrowRightLeft, FlaskConical, MapPin, Navigation, ChevronRight, Layers } from 'lucide-react';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  supplier_delivery: { label: 'Supplier Delivery', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  supplier_collection: { label: 'Collection', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, accent: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  sample_collection: { label: 'Sample Collection', icon: FlaskConical, accent: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200' },
  sample_delivery: { label: 'Sample to Lab', icon: FlaskConical, accent: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200' },
};

/**
 * Delivery hero card for the staff Today view. Surfaces the active delivery
 * as the action-first hero when the driver also has depot duty that day
 * (delivery-in-front state). Links through to the Driver Hub for the full
 * start / sign-off flow.
 */
export default function DeliveryHeroToday({ deliveries = [], jobs = [] }) {
  const navigate = useNavigate();
  if (deliveries.length === 0) return null;
  const first = deliveries[0];
  const cfg = typeConfig[first.delivery_type] || typeConfig.site_delivery;
  const Icon = cfg.icon;
  const job = jobs.find((j) => j.id === first.job_id);
  const addr =
    first.delivery_type === 'supplier_collection' || first.delivery_type === 'sample_collection'
      ? first.pickup_address
      : first.delivery_address;
  const destLabel =
    first.delivery_type === 'supplier_collection' || first.delivery_type === 'sample_collection'
      ? 'Collect from'
      : 'Deliver to';
  return (
    <div className="field-card overflow-hidden">
      <div className={`h-1.5 ${cfg.accent}`} />
      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${cfg.badge}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          {deliveries.length > 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              <Layers className="w-3 h-3" />
              {deliveries.length} drops today
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 leading-tight">
          {job?.name || first.job_name || 'Delivery run'}
        </h3>
        {addr && (
          <div className="mt-2 flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-emerald-50 text-emerald-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{destLabel}</p>
              <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{addr}</p>
            </div>
          </div>
        )}
        {first.items && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{first.items}</p>}
        <div className="mt-3 flex gap-2">
          {addr && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition touch-manipulation shadow-sm"
            >
              <Navigation className="w-5 h-5" /> Navigate
            </a>
          )}
          <button
            onClick={() => navigate('/deliveries')}
            className="flex items-center justify-center gap-1.5 flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 active:scale-95 transition touch-manipulation shadow-sm"
          >
            Driver Hub <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}