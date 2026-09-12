import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import EditableCell from './EditableCell';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => {
  const v = Number(n || 0);
  if (isNaN(v) || !isFinite(v)) return '—';
  return v.toFixed(1) + '%';
};

/**
 * CVRLineItemsTable — the main CVR cost/value tracking table. Each row is a
 * cost category with tender value, variations, forecast final, costs, and P&L.
 * All financial cells are inline-editable; edits trigger recalculateCVR.
 */
export default function CVRLineItemsTable({ cvr, lineItems }) {
  const queryClient = useQueryClient();
  const [expandedRow, setExpandedRow] = useState(null);

  const updateLineItem = async (id, field, value) => {
    await base44.entities.CVRLineItem.update(id, { [field]: value });
    await base44.functions.invoke('recalculateCVR', { cvr_id: cvr.id });
    queryClient.invalidateQueries({ queryKey: ['cvr-line-items', cvr.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr', cvr.id] });
  };

  if (!lineItems || lineItems.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">No CVR line items yet</p>
        <p className="text-xs text-slate-400 mt-1">Upload a CVR spreadsheet to populate this table</p>
      </div>
    );
  }

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">CVR Line Items</h3>
          <p className="text-[11px] text-slate-400">{lineItems.length} cost categories · click any value to edit</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/80 sticky top-0">
            <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2.5 font-semibold">Description</th>
              <th className="text-right px-3 py-2.5 font-semibold">Tender</th>
              <th className="text-right px-3 py-2.5 font-semibold">Forecast Final</th>
              <th className="text-right px-3 py-2.5 font-semibold">Invoiced</th>
              <th className="text-right px-3 py-2.5 font-semibold">Committed</th>
              <th className="text-right px-3 py-2.5 font-semibold">Total Cost</th>
              <th className="text-right px-3 py-2.5 font-semibold">P&L</th>
              <th className="text-right px-3 py-2.5 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lineItems.map((li) => {
              const pl = li.profit_loss || 0;
              const isProfit = pl >= 0;
              const isAtRisk = li.profit_pct < 10 && li.profit_pct >= 0;
              return (
                <tr key={li.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-800 truncate max-w-[200px]">{li.description}</p>
                    {li.supplier && <p className="text-[10px] text-slate-400 truncate">{li.supplier}</p>}
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={li.tender_value} onSave={(v) => updateLineItem(li.id, 'tender_value', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-700 font-medium">
                    <EditableCell value={li.forecast_final_value} onSave={(v) => updateLineItem(li.id, 'forecast_final_value', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={li.invoiced_costs} onSave={(v) => updateLineItem(li.id, 'invoiced_costs', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={li.committed_costs} onSave={(v) => updateLineItem(li.id, 'committed_costs', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-700 font-medium">
                    <EditableCell value={li.total_cost} onSave={(v) => updateLineItem(li.id, 'total_cost', v)} />
                  </td>
                  <td className={`text-right px-3 py-2.5 font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isProfit ? '+' : ''}{fmt(pl)}
                  </td>
                  <td className={`text-right px-3 py-2.5 font-semibold ${isProfit ? (isAtRisk ? 'text-amber-600' : 'text-emerald-600') : 'text-rose-600'}`}>
                    {fmtPct(li.profit_pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
            <tr className="font-bold text-slate-800">
              <td className="px-3 py-2.5">Total</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(lineItems.reduce((s, li) => s + (li.tender_value || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(lineItems.reduce((s, li) => s + (li.forecast_final_value || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(lineItems.reduce((s, li) => s + (li.invoiced_costs || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(lineItems.reduce((s, li) => s + (li.committed_costs || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(lineItems.reduce((s, li) => s + (li.total_cost || 0), 0))}</td>
              <td className={`text-right px-3 py-2.5 tabular-nums ${((cvr?.profit_loss) || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {((cvr?.profit_loss) || 0) >= 0 ? '+' : ''}{fmt(cvr?.profit_loss)}
              </td>
              <td className={`text-right px-3 py-2.5 tabular-nums ${((cvr?.profit_pct) || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmtPct(cvr?.profit_pct)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}