import React from 'react';
import { format } from 'date-fns';
import { Truck, Package, ArrowRightLeft, CheckCircle2, Clock, PlayCircle, AlertTriangle, ShieldCheck, ArrowDownToLine, ArrowRightLeft as HandoverIcon, FlaskConical } from 'lucide-react';
import PrintPickList from '@/components/logistics/PrintPickList';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, badge: 'bg-emerald-50 text-emerald-700' },
  supplier_collection: { label: 'Collection', icon: Package, badge: 'bg-blue-50 text-blue-700' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, badge: 'bg-purple-50 text-purple-700' },
  sample_collection: { label: 'Sample Collect', icon: FlaskConical, badge: 'bg-teal-50 text-teal-700' },
  sample_delivery: { label: 'Sample to Lab', icon: FlaskConical, badge: 'bg-cyan-50 text-cyan-700' },
};

const statusBadge = {
  pending: { label: 'Scheduled', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Transit', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700' }
};

export default function DeliveryTable({ deliveries, jobs, drivers, onSelectDelivery }) {
  return (
    <div className="hub-glass rounded-hub overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/60 text-left">
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Type</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Job</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Items</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Driver</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Destination</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Signed by</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Handover</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide">Pick List</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deliveries.map(d => {
              const type = typeConfig[d.delivery_type] || typeConfig.site_delivery;
              const status = statusBadge[d.status] || statusBadge.pending;
              const TypeIcon = type.icon;
              const job = jobs.find(j => j.id === d.job_id);
              const driverName = d.driver_staff_name || drivers.find(s => s.id === d.driver_staff_id)?.name || '—';
              const dest = d.delivery_type === 'supplier_collection' ? d.pickup_address : d.delivery_address;
              const isOverdue = d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') < new Date();
              return (
                <tr key={d.id} onClick={() => onSelectDelivery?.(d)} className={`cursor-pointer hover:bg-slate-50 transition ${isOverdue ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${type.badge}`}>
                      <TypeIcon className="w-3 h-3" />{type.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.cls}`}>{status.label}</span>
                    {isOverdue && <span className="block text-[10px] text-amber-600 font-bold mt-0.5">overdue</span>}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">{d.job_name || job?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate">{d.items || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[100px] truncate">{driverName}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate">{dest || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</td>
                  <td className="px-3 py-2.5">
                    {d.signed_by_name && d.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <ShieldCheck className="w-3 h-3" />{d.signed_by_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.handover_to_staff_name ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        <HandoverIcon className="w-2.5 h-2.5" />→ {d.handover_to_staff_name}
                      </span>
                    ) : d.handover_from_staff_name ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        <ArrowDownToLine className="w-2.5 h-2.5" />from {d.handover_from_staff_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <PrintPickList delivery={d} job={job} driverName={driverName} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}