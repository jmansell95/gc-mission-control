import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { PARITY_SUMMARY } from '@/utils/powerapps/migrationCostData';
import { ENTITIES } from '@/utils/azureMigrationData';

export default function ParityMatrixSummary() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Layers className="w-5 h-5 text-[#2E5A1A]" />
        <h3 className="font-bold text-slate-900 text-sm">Parity Matrix — What Maps Where</h3>
        <button onClick={() => setExpanded(!expanded)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition">
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Expand entities</>}
        </button>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        {Object.entries(PARITY_SUMMARY).map(([key, val]) => (
          <div key={key} className="hub-glass rounded-xl p-3">
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{val.count}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mt-0.5 capitalize">{key}</p>
            <p className="text-[10px] text-slate-400 mt-1 truncate" title={val.powerApps}>{val.powerApps}</p>
          </div>
        ))}
      </div>

      {/* Expanded entity table */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wide">
            Entity → Dataverse Table Mapping ({ENTITIES.length} entities)
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="text-left px-4 py-2 font-semibold">Entity</th>
                  <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Category</th>
                  <th className="text-left px-3 py-2 font-semibold">RLS</th>
                  <th className="text-left px-4 py-2 font-semibold hidden md:table-cell">Dataverse Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ENTITIES.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-1.5 font-medium text-slate-800">{e.name}</td>
                    <td className="px-3 py-1.5 text-slate-400 hidden sm:table-cell">{e.category}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        e.rls === 'complex' ? 'bg-red-50 text-red-600' :
                        e.rls === 'admin' ? 'bg-amber-50 text-amber-600' :
                        e.rls === 'public' ? 'bg-blue-50 text-blue-600' :
                        e.rls === 'ownership' ? 'bg-violet-50 text-violet-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>{e.rls}</span>
                    </td>
                    <td className="px-4 py-1.5 text-slate-400 font-mono hidden md:table-cell">{e.azureTarget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
            RLS: <span className="text-emerald-600">division</span> = division_id match ·{' '}
            <span className="text-red-600">complex</span> = $or (division + ownership + admin) ·{' '}
            <span className="text-amber-600">admin</span> = admin-only ·{' '}
            <span className="text-blue-600">public</span> = all authenticated ·{' '}
            <span className="text-violet-600">ownership</span> = created_by match
          </div>
        </div>
      )}
    </div>
  );
}