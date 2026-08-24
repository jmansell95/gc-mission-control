import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { londonDateStr } from '@/utils/siteLogUtils';

const PRESETS = [
  { key: 'today', label: 'Today', getRange: () => ({ from: londonDateStr(0), to: londonDateStr(0) }) },
  { key: '7d', label: '7 days', getRange: () => ({ from: londonDateStr(-6), to: londonDateStr(0) }) },
  { key: '30d', label: '30 days', getRange: () => ({ from: londonDateStr(-29), to: londonDateStr(0) }) },
  { key: 'month', label: 'This month', getRange: () => {
    const d = new Date();
    const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).format(d) + '-01';
    return { from, to: londonDateStr(0) };
  }},
  { key: 'all', label: 'All time', getRange: () => ({ from: null, to: null }) },
];

/**
 * SiteLogDateRange — preset range pills + custom date inputs.
 * Default: last 7 days.
 */
export default function SiteLogDateRange({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');

  const handlePreset = (key) => {
    if (key === 'custom') {
      setShowCustom(true);
      onChange({ preset: 'custom', from: value.from || londonDateStr(-6), to: value.to || londonDateStr(0) });
    } else {
      setShowCustom(false);
      const p = PRESETS.find(p => p.key === key);
      onChange({ preset: key, ...p.getRange() });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => handlePreset(p.key)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${value.preset === p.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {p.label}
          </button>
        ))}
        <button onClick={() => handlePreset('custom')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${value.preset === 'custom' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <Calendar className="w-3 h-3" /> Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 animate-slide-up">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">From</label>
            <input type="date" value={value.from || ''} onChange={e => onChange({ ...value, preset: 'custom', from: e.target.value })}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-slate-400 mb-0.5">To</label>
            <input type="date" value={value.to || ''} onChange={e => onChange({ ...value, preset: 'custom', to: e.target.value })}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>
        </div>
      )}
    </div>
  );
}