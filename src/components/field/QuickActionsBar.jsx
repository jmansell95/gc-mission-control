import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Truck, ClipboardList, CalendarClock } from 'lucide-react';

/**
 * QuickActionsBar — compact horizontal strip of the most-used field
 * actions, shown at the top of the Today page for one-tap access.
 * Reduces navigation depth for the highest-frequency field crew tasks.
 */
export default function QuickActionsBar() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Scan', icon: ScanLine, path: '/scanner', color: 'from-[#2E5A1A] to-[#1c4a12]' },
    { label: 'Deliveries', icon: Truck, path: '/deliveries', color: 'from-blue-500 to-blue-600' },
    { label: 'My Duties', icon: ClipboardList, path: '/my-duties', color: 'from-amber-500 to-orange-600' },
    { label: 'Schedule', icon: CalendarClock, path: '/staff-schedule', color: 'from-emerald-500 to-green-600' },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            type="button"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md active:scale-95 transition touch-manipulation flex-shrink-0"
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}