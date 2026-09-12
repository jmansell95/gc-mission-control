import React from 'react';
import { X, Package } from 'lucide-react';
import { COMPLIANCE_META } from '@/utils/rigRollup';

const TYPE_ICON = { rig: '🛠️', machinery: '🔧', trailer: '📦', vehicle: '🚚', lifting: '⚓', portable_appliance: '🔌' };

/**
 * InlineBasketList — renders basket items directly in the scan view body so
 * they're visible immediately without expanding the sticky bar. Uses the same
 * row styling as the UnifiedScanBasket expanded sheet so both views feel like
 * one continuous list.
 */
export default function InlineBasketList({ items, onRemove }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="hub-glass rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Package className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-bold text-slate-800">Basket ({items.length})</h3>
      </div>
      <div className="space-y-2">
        {items.map(a => {
          const meta = COMPLIANCE_META[a.compliance_status || 'unknown'];
          const emoji = TYPE_ICON[a.asset_type] || '📦';
          const photo = a.panda_image_urls?.[0];
          const photoUrl = photo?.thumb || photo?.medium || photo?.url;
          return (
            <div key={a.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 animate-pop-in">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                {photoUrl ? <img src={photoUrl} alt={a.name} className="w-full h-full object-cover" /> : emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {a._qty > 1 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex-shrink-0">×{a._qty}</span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-[11px] text-slate-500 font-medium">{meta.label}</span>
                  {a.serial_number && <span className="text-[11px] text-slate-400 font-mono truncate">· {a.serial_number}</span>}
                </div>
              </div>
              <button onClick={() => onRemove(a.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0 touch-manipulation">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}