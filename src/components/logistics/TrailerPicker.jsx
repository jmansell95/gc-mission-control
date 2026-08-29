import React from 'react';
import { Truck } from 'lucide-react';

/**
 * Compact optional trailer selector — matches the vehicle picker style.
 * Pulls from active SiteAsset records where asset_type='trailer'.
 *
 * Props:
 *   trailers   — array of SiteAsset records (already filtered to type=trailer, active)
 *   value      — selected trailer_id (string)
 *   onChange   — callback(trailer_id, trailer)
 */
export default function TrailerPicker({ trailers = [], value, onChange }) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        <Truck className="w-3 h-3" /> Trailer (optional)
      </label>
      <select
        value={value || ''}
        onChange={e => {
          const id = e.target.value;
          const trailer = trailers.find(t => t.id === id);
          onChange(id, trailer);
        }}
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 bg-white"
      >
        <option value="">No trailer</option>
        {trailers.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}{t.serial_number ? ` · ${t.serial_number}` : ''}{t.compliance_status === 'expired' ? ' · EXPIRED' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}