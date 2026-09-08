import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import DeliveryBoardCard from './DeliveryBoardCard';

const columns = [
  { key: 'pending', label: 'Scheduled', icon: Clock, accent: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Transit', icon: PlayCircle, accent: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, accent: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'failed', label: 'Failed', icon: AlertTriangle, accent: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
];

export default function DeliveryBoard({ deliveries, jobs, drivers, onSelectDelivery }) {
  const grouped = columns.reduce((acc, c) => { acc[c.key] = []; return acc; }, {});
  deliveries.forEach(d => {
    const key = grouped[d.status] !== undefined ? d.status : 'pending';
    grouped[key].push(d);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map(col => {
        const items = grouped[col.key] || [];
        const Icon = col.icon;
        return (
          <div key={col.key} className="flex flex-col rounded-2xl hub-glass min-h-[200px]">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${col.accent}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-800">{col.label}</h3>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.accent}`}>{items.length}</span>
            </div>
            <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              <AnimatePresence>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">No items</div>
                ) : (
                  items.map(d => (
                    <DeliveryBoardCard
                      key={d.id}
                      delivery={d}
                      job={jobs.find(j => j.id === d.job_id)}
                      driver={drivers.find(s => s.id === d.driver_staff_id)}
                      onClick={onSelectDelivery}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}