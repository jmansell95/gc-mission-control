import React, { useState } from 'react';
import { Database, ChevronDown } from 'lucide-react';

/**
 * Collapsible panel showing all raw Asset Panda field values (label → value)
 * pulled during sync. Only visible on Panda-synced assets.
 */
export default function RawPandaDataPanel({ rawFields }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(rawFields || {}).filter(([, v]) => v);
  if (entries.length === 0) return null;

  return (
    <div className="hub-glass rounded-2xl p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Database className="w-4 h-4 text-primary flex-shrink-0" />
        <h3 className="text-sm font-extrabold text-slate-900 flex-1">Raw Asset Panda Data</h3>
        <span className="text-xs text-slate-400 font-medium">{entries.length} fields</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between py-1.5 border-b border-slate-50 last:border-0 gap-2"
            >
              <span className="text-xs text-slate-500 truncate flex-shrink-0 max-w-[45%]">{label}</span>
              <span className="text-xs font-semibold text-slate-800 text-right break-words min-w-0">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}