import React from 'react';
import { Plus, FileText, UserPlus, AlertTriangle, Truck, Wrench } from 'lucide-react';

/**
 * One-click action shortcuts for power users. Renders a horizontal strip of
 * quick-action buttons at the top of the dashboard for the most common admin
 * operations. Each button calls onAction with the action key.
 */
const ACTIONS = [
  { key: 'new-job', label: 'New Job', icon: Plus, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
  { key: 'add-staff', label: 'Add Staff', icon: UserPlus, color: 'bg-blue-500', hover: 'hover:bg-blue-600' },
  { key: 'raise-invoice', label: 'Raise Invoice', icon: FileText, color: 'bg-violet-500', hover: 'hover:bg-violet-600' },
  { key: 'log-incident', label: 'Log Incident', icon: AlertTriangle, color: 'bg-rose-500', hover: 'hover:bg-rose-600' },
  { key: 'new-delivery', label: 'New Delivery', icon: Truck, color: 'bg-teal-500', hover: 'hover:bg-teal-600' },
  { key: 'add-asset', label: 'Add Asset', icon: Wrench, color: 'bg-amber-500', hover: 'hover:bg-amber-600' },
];

export default function QuickActionBar({ onAction }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      {ACTIONS.map(a => {
        const Icon = a.icon;
        return (
          <button
            key={a.key}
            onClick={() => onAction?.(a.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 ${a.color} text-white rounded-xl text-ui-caption font-semibold ${a.hover} transition shadow-sm active:scale-95`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}