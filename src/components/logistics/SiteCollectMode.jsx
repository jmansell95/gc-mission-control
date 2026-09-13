import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, ScanLine, MapPin, Clock, PlayCircle, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * SiteCollectMode — shows the driver's pending/active site collection
 * tasks. Tapping one opens the SiteCollectionScanner for QR-based item
 * collection. Rendered as a mode inside the Asset Scanner page.
 */
export default function SiteCollectMode({ staff, onOpenScanner }) {
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['my-collection-tasks', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      const list = await base44.entities.DeliveryLog.filter({ driver_staff_id: staff.id });
      return list
        .filter(d => d.delivery_type === 'supplier_collection')
        .filter(d => d.status === 'pending' || d.status === 'in_progress')
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
    },
    enabled: !!staff?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Package className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium text-base">No collection tasks assigned</p>
        <p className="text-slate-400 text-sm mt-1">Your supervisor will assign site collection tasks to you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <ScanLine className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-bold text-slate-900">Tap a task to scan items on site</p>
      </div>
      {deliveries.map(d => (
        <button
          key={d.id}
          onClick={() => onOpenScanner(d)}
          className="w-full flex items-center gap-3 field-card p-4 hover:border-blue-400 transition active:scale-[0.98] text-left"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${d.status === 'in_progress' ? 'bg-blue-600' : 'bg-blue-100'}`}>
            {d.status === 'in_progress' ? (
              <PlayCircle className="w-6 h-6 text-white" />
            ) : (
              <Package className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{d.job_name || 'Collection task'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
              {d.pickup_address && (
                <>
                  <span className="text-slate-300">·</span>
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 truncate">{d.pickup_address}</span>
                </>
              )}
            </div>
            {d.items && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{d.items.split(',').slice(0, 2).join(', ')}{d.items.split(',').length > 2 ? '…' : ''}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {d.status === 'in_progress' ? 'ACTIVE' : 'PENDING'}
            </span>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        </button>
      ))}
    </div>
  );
}