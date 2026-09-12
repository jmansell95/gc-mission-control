import React from 'react';
import { TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import {
  BASE44_RECURRING, BASE44_ANNUAL_TOTAL, POWERAPPS_ANNUAL_TOTAL,
  TOTAL_BUILD_COST, BASE44_5YR_TCO, POWERAPPS_5YR_TCO, TCO_DELTA, TCO_YEARS,
  USER_COUNT, fmtGBP,
} from '@/utils/powerapps/migrationCostData';

export default function FinancialComparison() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-slate-900 text-sm">Financial Comparison — {USER_COUNT} Users</h3>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        <div className="hub-glass rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{fmtGBP(BASE44_ANNUAL_TOTAL)}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mt-0.5">Base44 / year</p>
        </div>
        <div className="hub-glass rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{fmtGBP(POWERAPPS_ANNUAL_TOTAL)}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mt-0.5">Power Apps / year</p>
        </div>
        <div className="hub-glass rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{fmtGBP(TOTAL_BUILD_COST)}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mt-0.5">One-time build</p>
        </div>
        <div className="hub-glass rounded-xl p-3 text-center border-2 border-red-200">
          <p className="text-2xl font-extrabold text-red-600 tabular-nums">+{fmtGBP(TCO_DELTA)}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mt-0.5">{TCO_YEARS}-yr TCO gap</p>
        </div>
      </div>

      {/* Line-item table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-semibold">Line Item</th>
              <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">Detail</th>
              <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">Base44</th>
              <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">Power Apps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {BASE44_RECURRING.map((row) => (
              <tr key={row.item} className="hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.item}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400 hidden sm:table-cell">{row.detail}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{row.base44 ? fmtGBP(row.base44) : <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{row.powerApps ? fmtGBP(row.powerApps) : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
            {/* Subtotal row */}
            <tr className="bg-slate-50 font-bold">
              <td className="px-4 py-3 text-slate-900" colSpan={2}>Annual recurring total</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{fmtGBP(BASE44_ANNUAL_TOTAL)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{fmtGBP(POWERAPPS_ANNUAL_TOTAL)}</td>
            </tr>
            {/* One-time build */}
            <tr className="bg-amber-50/60">
              <td className="px-4 py-3 font-semibold text-amber-800" colSpan={2}>One-time migration build</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-300">—</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">{fmtGBP(TOTAL_BUILD_COST)}</td>
            </tr>
            {/* TCO total */}
            <tr className="bg-primary text-white font-bold">
              <td className="px-4 py-3.5" colSpan={2}>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {TCO_YEARS}-Year Total Cost of Ownership
                </span>
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-lg">{fmtGBP(BASE44_5YR_TCO)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-lg">{fmtGBP(POWERAPPS_5YR_TCO)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Gap callout */}
      <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <p className="text-xs text-red-700">
          Power Apps costs <strong>{fmtGBP(TCO_DELTA)}</strong> more over {TCO_YEARS} years — a{' '}
          <strong>{((TCO_DELTA / BASE44_5YR_TCO) * 100).toFixed(0)}% increase</strong> over staying on Base44, with no additional functionality.
        </p>
      </div>
    </div>
  );
}