import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, TrendingUp } from 'lucide-react';
import EditableCell from './EditableCell';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => {
  const v = Number(n || 0);
  if (isNaN(v) || !isFinite(v)) return '—';
  return v.toFixed(1) + '%';
};

/**
 * CVRVariationsTab — the Variation Order account table. Each row is a VO with
 * agreed value, cost breakdown (prelim, labour, plant, material, etc.), total
 * cost, and profit margin. All financial cells are inline-editable.
 */
export default function CVRVariationsTab({ cvr, variations }) {
  const queryClient = useQueryClient();

  const updateVO = async (id, field, value) => {
    await base44.entities.VariationOrder.update(id, { [field]: value });
    await base44.functions.invoke('recalculateCVR', { cvr_id: cvr.id });
    queryClient.invalidateQueries({ queryKey: ['cvr-variations', cvr.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr', cvr.id] });
  };

  if (!variations || variations.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">No variation orders yet</p>
        <p className="text-xs text-slate-400 mt-1">Variations will appear here when the CVR includes a VO Account sheet</p>
      </div>
    );
  }

  const totalAgreed = variations.reduce((s, v) => s + (v.agreed_value || 0), 0);
  const totalCost = variations.reduce((s, v) => s + (v.total_cost || 0), 0);
  const totalMargin = totalAgreed - totalCost;

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">Variation Orders</h3>
        <p className="text-[11px] text-slate-400">{variations.length} VOs · {fmt(totalAgreed)} agreed · {fmt(totalMargin)} margin</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/80 sticky top-0">
            <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2.5 font-semibold">VO No.</th>
              <th className="text-left px-3 py-2.5 font-semibold">Description</th>
              <th className="text-right px-3 py-2.5 font-semibold">Agreed</th>
              <th className="text-right px-3 py-2.5 font-semibold">Labour</th>
              <th className="text-right px-3 py-2.5 font-semibold">Plant</th>
              <th className="text-right px-3 py-2.5 font-semibold">Material</th>
              <th className="text-right px-3 py-2.5 font-semibold">Total Cost</th>
              <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
              <th className="text-right px-3 py-2.5 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {variations.map((vo) => {
              const margin = vo.profit_margin || 0;
              const isProfit = margin >= 0;
              return (
                <tr key={vo.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-3 py-2.5 font-bold text-slate-700 tabular-nums">VO.{vo.vo_number}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-slate-700 truncate max-w-[200px]">{vo.description}</p>
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-700 font-medium">
                    <EditableCell value={vo.agreed_value} onSave={(v) => updateVO(vo.id, 'agreed_value', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={vo.labour_cost} onSave={(v) => updateVO(vo.id, 'labour_cost', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={vo.plant_cost} onSave={(v) => updateVO(vo.id, 'plant_cost', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-600">
                    <EditableCell value={vo.material_cost} onSave={(v) => updateVO(vo.id, 'material_cost', v)} />
                  </td>
                  <td className="text-right px-3 py-2.5 text-slate-700 font-medium">
                    <EditableCell value={vo.total_cost} onSave={(v) => updateVO(vo.id, 'total_cost', v)} />
                  </td>
                  <td className={`text-right px-3 py-2.5 font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isProfit ? '+' : ''}{fmt(margin)}
                  </td>
                  <td className={`text-right px-3 py-2.5 font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {fmtPct(vo.profit_margin_pct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
            <tr className="font-bold text-slate-800">
              <td className="px-3 py-2.5" colSpan={2}>Total</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totalAgreed)}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(variations.reduce((s, v) => s + (v.labour_cost || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(variations.reduce((s, v) => s + (v.plant_cost || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(variations.reduce((s, v) => s + (v.material_cost || 0), 0))}</td>
              <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totalCost)}</td>
              <td className={`text-right px-3 py-2.5 tabular-nums ${totalMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totalMargin >= 0 ? '+' : ''}{fmt(totalMargin)}
              </td>
              <td className={`text-right px-3 py-2.5 tabular-nums ${totalMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmtPct(totalAgreed !== 0 ? (totalMargin / totalAgreed) * 100 : 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}