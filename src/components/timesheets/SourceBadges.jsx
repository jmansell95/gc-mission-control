import React from 'react';
import { MapPin, FileText, Truck, ShieldCheck, Clock } from 'lucide-react';

export const SOURCE_META = {
  gps: { icon: MapPin, label: 'GPS', color: 'text-blue-600 bg-blue-50' },
  keylogbook: { icon: FileText, label: 'KeyLogBook', color: 'text-violet-600 bg-violet-50' },
  delivery: { icon: Truck, label: 'Delivery', color: 'text-amber-600 bg-amber-50' },
  mitti: { icon: ShieldCheck, label: 'Mitti', color: 'text-emerald-600 bg-emerald-50' },
  rota: { icon: Clock, label: 'Rota', color: 'text-slate-500 bg-slate-100' },
};

/**
 * Renders source pills (GPS / KeyLogBook / Delivery / Mitti / Rota) from a
 * comma-separated string (auto_built_sources).
 */
export default function SourceBadges({ sources, size = 'sm' }) {
  const list = (sources || '').split(',').filter(Boolean);
  if (list.length === 0) return null;
  const pad = size === 'xs' ? 'px-1 py-0.5' : 'px-1.5 py-0.5';
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {list.map((s) => {
        const meta = SOURCE_META[s] || { icon: Clock, label: s, color: 'text-slate-500 bg-slate-100' };
        const Icon = meta.icon;
        return (
          <span
            key={s}
            className={`inline-flex items-center gap-0.5 rounded-full font-semibold ${meta.color} ${pad} ${textSize}`}
          >
            <Icon className={iconSize} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}