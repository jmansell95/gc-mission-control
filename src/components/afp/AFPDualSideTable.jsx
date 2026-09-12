import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, FileText, Layers } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtQty = (n) => (Number(n || 0)).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * AFPDualSideTable — renders Measured Works line items in the three-column-group
 * layout from the real AFP Excel: Application in the Period (our claim), Client
 * Assessment in the Period (client's valuation), and Balance Remaining.
 *
 * Our Application columns are read-only (populated from field data / import).
 * The Client Assessment columns are editable (billing team enters them when the
 * client responds). Balance is auto-calculated as contracted - gross.
 *
 * Falls back gracefully when dual-side fields are absent (legacy AFPs).
 */
export default function AFPDualSideTable({ afp, lineItems, canEdit, onAutoSave }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(new Set());

  // Only measured_works items belong in this table
  const mwItems = useMemo(
    () => lineItems.filter(li => li.sheet_name === 'measured_works'),
    [lineItems]
  );

  // Roll-up totals
  const totals = useMemo(() => {
    let claimed = 0, assessed = 0, balance = 0;
    for (const li of mwItems) {
      claimed += Number(li.applied_in_period) || 0;
      assessed += Number(li.assessed_in_period) || 0;
      balance += Number(li.balance_value) || 0;
    }
    return { claimed, assessed, balance };
  }, [mwItems]);

  const handleAssessedChange = async (li, field, value) => {
    const numVal = Number(value) || 0;
    const updates = { [field]: numVal };
    // Auto-derive dispute status from whether assessed differs from applied
    const applied = Number(li.applied_in_period) || 0;
    if (field === 'assessed_in_period') {
      if (numVal === 0 && applied > 0) updates.dispute_status = 'rejected';
      else if (numVal < applied) updates.dispute_status = 'counter_offered';
      else if (numVal === applied) updates.dispute_status = 'agreed';
      else updates.dispute_status = 'agreed';
      updates.agreed_amount = numVal;
    }
    try {
      if (onAutoSave) {
        onAutoSave(li.id, updates);
      } else {
        await base44.entities.AFPLineItem.update(li.id, updates);
        queryClient.invalidateQueries({ queryKey: ['afp-line-items', afp?.id] });
      }
    } catch (e) { console.error(e); }
  };

  if (mwItems.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 text-center">
        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No Measured Works lines in this AFP</p>
      </div>
    );
  }

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Measured Works</h3>
          <span className="text-[10px] text-slate-400">({mwItems.length} lines)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-500">Claimed <strong className="text-slate-700 tabular-nums">{fmt(totals.claimed)}</strong></span>
          <span className="text-blue-600">Assessed <strong className="tabular-nums">{fmt(totals.assessed)}</strong></span>
          <span className="text-emerald-600">Balance <strong className="tabular-nums">{fmt(totals.balance)}</strong></span>
        </div>
      </div>

      {/* Desktop table — three column groups with tints */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wide text-[9px]">
              <th className="text-left px-2 py-2 font-semibold" rowSpan={2}>Ref</th>
              <th className="text-left px-2 py-2 font-semibold" rowSpan={2}>Description</th>
              <th className="text-right px-2 py-2 font-semibold" rowSpan={2}>Unit</th>
              <th className="text-right px-2 py-2 font-semibold" rowSpan={2}>Rate</th>
              {/* Application in the Period — neutral tint */}
              <th colSpan={4} className="text-center px-2 py-1.5 font-bold bg-slate-100/60 text-slate-600 border-l border-slate-200">Application in the Period</th>
              {/* Client Assessment — blue tint */}
              <th colSpan={4} className="text-center px-2 py-1.5 font-bold bg-blue-50 text-blue-600 border-l border-slate-200">Client Assessment in the Period</th>
              {/* Balance Remaining — green tint */}
              <th colSpan={2} className="text-center px-2 py-1.5 font-bold bg-emerald-50 text-emerald-600 border-l border-slate-200">Balance Remaining</th>
            </tr>
            <tr className="text-slate-400 uppercase tracking-wide text-[9px]">
              {/* Application sub-headers */}
              <th className="text-right px-1.5 py-1.5 font-semibold bg-slate-50/40 border-l border-slate-200">Qty Complete</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-slate-50/40">Gross Applied</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-slate-50/40">Previous</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-slate-50/40">Applied in Period</th>
              {/* Assessment sub-headers */}
              <th className="text-right px-1.5 py-1.5 font-semibold bg-blue-50/40 border-l border-slate-200">Assessed Qty</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-blue-50/40">Gross Assessed</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-blue-50/40">Previous</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-blue-50/40">Assessed in Period</th>
              {/* Balance sub-headers */}
              <th className="text-right px-1.5 py-1.5 font-semibold bg-emerald-50/40 border-l border-slate-200">Qty</th>
              <th className="text-right px-1.5 py-1.5 font-semibold bg-emerald-50/40">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mwItems.map((li) => {
              const balanceQty = Math.max(0, (Number(li.qty) || 0) - (Number(li.qty_complete) || 0));
              const balanceValue = Math.max(0, (Number(li.amount) || 0) - (Number(li.gross_applied) || 0));
              return (
                <tr key={li.id} className="hover:bg-slate-50/40">
                  <td className="px-2 py-2 text-slate-400 font-mono text-[10px]">{li.item_ref || '—'}</td>
                  <td className="px-2 py-2 text-slate-700 font-medium whitespace-normal break-words" title={li.item}>{li.item}</td>
                  <td className="px-2 py-2 text-right text-slate-500">{li.unit || '—'}</td>
                  <td className="px-2 py-2 text-right text-slate-500 tabular-nums">{fmt(li.rate)}</td>
                  {/* Application columns */}
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-600 bg-slate-50/20 border-l border-slate-100">{fmtQty(li.qty_complete)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-600 bg-slate-50/20">{fmt(li.gross_applied)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-400 bg-slate-50/20">{fmt(li.previous_applied)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums font-bold text-slate-700 bg-slate-50/20">{fmt(li.applied_in_period)}</td>
                  {/* Assessment columns — editable */}
                  <td className="px-1.5 py-2 text-right bg-blue-50/20 border-l border-slate-100">
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={li.assessed_qty || ''}
                        onBlur={(e) => handleAssessedChange(li, 'assessed_qty', e.target.value)}
                        className="w-16 px-1 py-0.5 text-right text-xs border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-400 tabular-nums"
                        placeholder="—"
                      />
                    ) : <span className="tabular-nums text-blue-700">{fmtQty(li.assessed_qty)}</span>}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-blue-700 bg-blue-50/20">{fmt(li.gross_assessed)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-blue-400 bg-blue-50/20">{fmt(li.previous_assessed)}</td>
                  <td className="px-1.5 py-2 text-right bg-blue-50/20">
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={li.assessed_in_period || ''}
                        onBlur={(e) => handleAssessedChange(li, 'assessed_in_period', e.target.value)}
                        className="w-20 px-1 py-0.5 text-right text-xs border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-400 tabular-nums font-bold"
                        placeholder="—"
                      />
                    ) : <span className="tabular-nums font-bold text-blue-700">{fmt(li.assessed_in_period)}</span>}
                  </td>
                  {/* Balance columns — auto-calculated */}
                  <td className="px-1.5 py-2 text-right tabular-nums text-emerald-700 bg-emerald-50/20 border-l border-slate-100">{fmtQty(balanceQty)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums font-bold text-emerald-700 bg-emerald-50/20">{fmt(balanceValue)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
            <tr className="font-bold text-slate-800">
              <td colSpan={7} className="px-2 py-2 text-right">AFP {afp?.afp_number || ''} Totals →</td>
              <td className="px-1.5 py-2 text-right tabular-nums text-slate-700 bg-slate-100/40">{fmt(totals.claimed)}</td>
              <td colSpan={3} className="px-1.5 py-2 text-right text-blue-600 bg-blue-50/40">Assessed →</td>
              <td className="px-1.5 py-2 text-right tabular-nums text-blue-700 bg-blue-50/40">{fmt(totals.assessed)}</td>
              <td className="px-1.5 py-2 text-right tabular-nums text-emerald-600 bg-emerald-50/40">{fmtQty(0)}</td>
              <td className="px-1.5 py-2 text-right tabular-nums text-emerald-700 bg-emerald-50/40">{fmt(totals.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden divide-y divide-slate-100">
        {mwItems.map((li) => {
          const balanceQty = Math.max(0, (Number(li.qty) || 0) - (Number(li.qty_complete) || 0));
          const balanceValue = Math.max(0, (Number(li.amount) || 0) - (Number(li.gross_applied) || 0));
          return (
            <div key={li.id} className="px-3 py-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {li.item_ref && <span className="text-[10px] font-mono text-slate-400">{li.item_ref}</span>}
                  <p className="text-xs font-semibold text-slate-700 truncate">{li.item}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{li.unit} @ {fmt(li.rate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-slate-50 p-1.5">
                  <p className="text-slate-400 uppercase font-semibold">Applied</p>
                  <p className="font-bold text-slate-700 tabular-nums">{fmt(li.applied_in_period)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <p className="text-blue-400 uppercase font-semibold">Assessed</p>
                  {canEdit ? (
                    <input
                      type="number"
                      defaultValue={li.assessed_in_period || ''}
                      onBlur={(e) => handleAssessedChange(li, 'assessed_in_period', e.target.value)}
                      className="w-full px-1 py-0.5 text-right text-xs border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-400 tabular-nums font-bold"
                      placeholder="—"
                    />
                  ) : <p className="font-bold text-blue-700 tabular-nums">{fmt(li.assessed_in_period)}</p>}
                </div>
                <div className="rounded-lg bg-emerald-50 p-1.5">
                  <p className="text-emerald-400 uppercase font-semibold">Balance</p>
                  <p className="font-bold text-emerald-700 tabular-nums">{fmt(balanceValue)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}