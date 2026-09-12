import React, { useMemo } from 'react';
import { Layers, Package } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtQty = (n) => (Number(n || 0)).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * AFPCompensationItems — renders CI01-03 compensation item line items in a
 * compact grouped view. Each item shows the source sheet (CI01/CI02/CI03),
 * description, qty, rate, and amount.
 */
export default function AFPCompensationItems({ lineItems }) {
  const ciItems = useMemo(
    () => lineItems.filter(li => li.sheet_name === 'compensation_item'),
    [lineItems]
  );

  // Group by item_ref (which holds the source sheet name e.g. CI01)
  const grouped = useMemo(() => {
    const groups = {};
    for (const li of ciItems) {
      const key = li.item_ref || 'CI';
      if (!groups[key]) groups[key] = [];
      groups[key].push(li);
    }
    return Object.entries(groups).sort();
  }, [ciItems]);

  const total = useMemo(() => ciItems.reduce((s, li) => s + (Number(li.amount) || 0), 0), [ciItems]);

  if (ciItems.length === 0) return null;

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Compensation Items</h3>
          <span className="text-[10px] text-slate-400">({ciItems.length} lines)</span>
        </div>
        <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(total)}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {grouped.map(([sheet, items]) => (
          <div key={sheet}>
            <div className="px-3 py-1.5 bg-slate-50/40 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{sheet}</span>
              <span className="text-[10px] text-slate-400">· {items.length} items</span>
            </div>
            {items.map((li) => (
              <div key={li.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{li.item}</p>
                  <p className="text-[10px] text-slate-400">{fmtQty(li.qty)} {li.unit} @ {fmt(li.rate)}</p>
                </div>
                <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">{fmt(li.amount)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}