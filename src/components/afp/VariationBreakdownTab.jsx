import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GitBranch, Plus, Trash2, Loader2, Package, CheckCircle2 } from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * VariationBreakdownTab — renders the component line items that make up a
 * single variation's total, filtered by vo_ref. Shows each component line
 * (labour, plant, materials, subcontractor) with description, qty, rate,
 * amount. A stat pill row shows the breakdown total vs the variation summary
 * total so discrepancies are visible.
 *
 * For historical AFPs, lines are parsed from VO-ref-named Excel sheets.
 * For live AFPs, lines are auto-populated from field data tagged with vo_ref.
 * Billing team can also manually add component lines.
 */
export default function VariationBreakdownTab({ afp, job, voRef, lineItems, canEdit, onAutoSave }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newLine, setNewLine] = useState({ item: '', unit: 'nr', qty: 1, rate: 0, category: 'other' });
  const [saving, setSaving] = useState(false);

  const breakdownItems = useMemo(
    () => lineItems.filter(li => li.sheet_name === 'variations' && li.vo_ref === voRef && li.is_variation_breakdown),
    [lineItems, voRef]
  );

  const summaryItem = useMemo(
    () => lineItems.find(li => li.sheet_name === 'variations' && li.vo_ref === voRef && !li.is_variation_breakdown),
    [lineItems, voRef]
  );

  const breakdownTotal = useMemo(
    () => breakdownItems.reduce((s, li) => s + (Number(li.amount) || 0), 0),
    [breakdownItems]
  );

  const summaryTotal = Number(summaryItem?.amount) || 0;
  const discrepancy = summaryTotal - breakdownTotal;

  const handleAddLine = async () => {
    if (!newLine.item || !afp) return;
    setSaving(true);
    try {
      const amount = (Number(newLine.qty) || 0) * (Number(newLine.rate) || 0);
      await base44.entities.AFPLineItem.create({
        afp_id: afp.id,
        job_id: job.id,
        sheet_name: 'variations',
        category: newLine.category,
        item: newLine.item,
        unit: newLine.unit,
        qty: Number(newLine.qty) || 0,
        rate: Number(newLine.rate) || 0,
        amount,
        unit_price: Number(newLine.rate) || 0,
        vo_ref: voRef,
        vo_date: summaryItem?.vo_date || '',
        is_variation_breakdown: true,
        applied_in_period: amount,
        source: 'manual',
        source_date: summaryItem?.vo_date || afp.period_end_date || new Date().toISOString().slice(0, 10),
        is_manual: true,
        dispute_status: 'none',
        original_amount: amount,
        agreed_amount: amount,
        sort_order: breakdownItems.length,
      });
      setNewLine({ item: '', unit: 'nr', qty: 1, rate: 0, category: 'other' });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', afp.id] });
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDeleteLine = async (id) => {
    try {
      await base44.entities.AFPLineItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', afp.id] });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-3">
      {/* Stat pills — breakdown total vs summary total */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="relative overflow-hidden rounded-xl stat-gradient-violet text-white px-3 py-3 shadow-sm">
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Breakdown Total</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={breakdownTotal} format={(v) => fmt(v)} />
          </p>
          <p className="text-[10px] text-white/60 font-medium mt-0.5">{breakdownItems.length} component lines</p>
        </div>
        <div className="relative overflow-hidden rounded-xl stat-gradient-brand text-white px-3 py-3 shadow-sm">
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Variation Total</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={summaryTotal} format={(v) => fmt(v)} />
          </p>
          <p className="text-[10px] text-white/60 font-medium mt-0.5">from summary line</p>
        </div>
        <div className={`relative overflow-hidden rounded-xl ${Math.abs(discrepancy) < 1 ? 'stat-gradient-emerald' : 'stat-gradient-amber'} text-white px-3 py-3 shadow-sm`}>
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Discrepancy</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={Math.abs(discrepancy)} format={(v) => fmt(v)} />
          </p>
          <p className="text-[10px] text-white/60 font-medium mt-0.5">{Math.abs(discrepancy) < 1 ? '✓ matches' : 'check breakdown'}</p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-violet-50/60 border-b border-violet-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wide">Variation {voRef} — Breakdown</h3>
            <span className="text-[10px] text-slate-400">({breakdownItems.length} lines)</span>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Add Component
            </button>
          )}
        </div>

        {/* Add line form */}
        {showAdd && canEdit && (
          <div className="p-3 bg-violet-50/30 border-b border-violet-100 space-y-2 animate-slide-up">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="Component description (e.g. Lead Driller — 2 days)"
                value={newLine.item}
                onChange={e => setNewLine(p => ({ ...p, item: e.target.value }))}
                className="col-span-12 sm:col-span-5 px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <select
                value={newLine.category}
                onChange={e => setNewLine(p => ({ ...p, category: e.target.value }))}
                className="col-span-6 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
              >
                <option value="other">Other</option>
                <option value="drilling">Drilling</option>
                <option value="plant_hire">Plant Hire</option>
                <option value="labour">Labour</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="materials">Materials</option>
                <option value="delivery">Delivery</option>
              </select>
              <input
                type="text"
                placeholder="Unit"
                value={newLine.unit}
                onChange={e => setNewLine(p => ({ ...p, unit: e.target.value }))}
                className="col-span-3 sm:col-span-1 px-2 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="number"
                placeholder="Qty"
                value={newLine.qty}
                onChange={e => setNewLine(p => ({ ...p, qty: e.target.value }))}
                className="col-span-3 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="number"
                placeholder="Rate"
                value={newLine.rate}
                onChange={e => setNewLine(p => ({ ...p, rate: e.target.value }))}
                className="col-span-3 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              <button
                onClick={handleAddLine}
                disabled={saving || !newLine.item}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition active:scale-95"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Line
              </button>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wide text-[9px]">
                <th className="text-left px-3 py-2 font-semibold">Description</th>
                <th className="text-left px-2 py-2 font-semibold">Category</th>
                <th className="text-right px-2 py-2 font-semibold">Unit</th>
                <th className="text-right px-2 py-2 font-semibold">Qty</th>
                <th className="text-right px-2 py-2 font-semibold">Rate</th>
                <th className="text-right px-2 py-2 font-semibold">Amount</th>
                {canEdit && <th className="text-center px-2 py-2 font-semibold w-8"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {breakdownItems.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center">
                    <Package className="w-8 h-8 text-violet-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No breakdown lines yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {canEdit ? 'Click "Add Component" to build the breakdown that makes up this variation\'s total.' : 'Breakdown lines will appear here once populated.'}
                    </p>
                  </td>
                </tr>
              ) : (
                breakdownItems.map((li) => (
                  <tr key={li.id} className="hover:bg-slate-50/40">
                    <td className="px-3 py-2 text-slate-700 font-medium">{li.item}</td>
                    <td className="px-2 py-2">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">{li.category || 'other'}</span>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-500">{li.unit || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{fmtQty(li.qty)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{fmt(li.rate)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-slate-700">{fmt(li.amount)}</td>
                    {canEdit && (
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleDeleteLine(li.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {breakdownItems.length > 0 && (
              <tfoot className="bg-violet-50/40 border-t-2 border-violet-100">
                <tr className="font-bold text-violet-700">
                  <td colSpan={5} className="px-3 py-2.5 text-right">Breakdown Total →</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{fmt(breakdownTotal)}</td>
                  {canEdit && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-100">
          {breakdownItems.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Package className="w-8 h-8 text-violet-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No breakdown lines yet</p>
            </div>
          ) : (
            breakdownItems.map((li) => (
              <div key={li.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{li.item}</p>
                  <p className="text-[10px] text-slate-400">{fmtQty(li.qty)} {li.unit} @ {fmt(li.rate)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(li.amount)}</span>
                  {canEdit && (
                    <button onClick={() => handleDeleteLine(li.id)} className="p-1 text-slate-300 hover:text-rose-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {breakdownItems.length > 0 && (
            <div className="px-3 py-2.5 bg-violet-50/40 flex items-center justify-between">
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">Breakdown Total</span>
              <span className="text-sm font-bold text-violet-700 tabular-nums">{fmt(breakdownTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}