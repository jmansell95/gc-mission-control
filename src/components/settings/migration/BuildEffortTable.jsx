import React from 'react';
import { Hammer, Clock, Users } from 'lucide-react';
import {
  BUILD_EFFORT, TOTAL_BUILD_HOURS, TOTAL_BUILD_COST,
  TIMELINE_WEEKS, TIMELINE_MONTHS, DEVELOPER_TEAM_SIZE, fmtGBP,
} from '@/utils/powerapps/migrationCostData';

export default function BuildEffortTable() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Hammer className="w-5 h-5 text-[#2E5A1A]" />
        <h3 className="font-bold text-slate-900 text-sm">Build-Effort Estimate</h3>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="hub-glass rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{TOTAL_BUILD_HOURS.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Dev hours</p>
        </div>
        <div className="hub-glass rounded-xl p-3 text-center">
          <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{TIMELINE_MONTHS}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Months ({DEVELOPER_TEAM_SIZE} devs)</p>
        </div>
        <div className="hub-glass rounded-xl p-3 text-center">
          <Hammer className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <p className="text-xl font-extrabold text-slate-900 tabular-nums">{fmtGBP(TOTAL_BUILD_COST)}</p>
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Build cost</p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-semibold">Component</th>
              <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Detail</th>
              <th className="text-center px-2 py-2.5 font-semibold">Qty</th>
              <th className="text-center px-2 py-2.5 font-semibold hidden sm:table-cell">Hrs/unit</th>
              <th className="text-right px-3 py-2.5 font-semibold">Total hrs</th>
              <th className="text-right px-4 py-2.5 font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {BUILD_EFFORT.map((row) => (
              <tr key={row.category} className="hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.category}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400 hidden md:table-cell max-w-xs">{row.detail}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-slate-600">{row.count}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-slate-400 hidden sm:table-cell">{row.hoursPerUnit}h</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-700">{row.totalHours}h</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">{fmtGBP(row.totalHours * row.rate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#2E5A1A] text-white font-bold">
              <td className="px-4 py-3" colSpan={4}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{TOTAL_BUILD_HOURS.toLocaleString()}h</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(TOTAL_BUILD_COST)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Critical-path timeline: <strong>{TIMELINE_WEEKS} weeks</strong> ({TIMELINE_MONTHS} months) with a team of {DEVELOPER_TEAM_SIZE} Power Platform developers.
          Phases run in parallel where dependencies allow — see the roadmap below.
        </p>
      </div>
    </div>
  );
}