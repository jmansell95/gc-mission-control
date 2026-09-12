import React, { useState } from 'react';
import { Mountain, ChevronDown, ChevronRight, HardHat, Layers } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS = {
  cp: { label: 'CP', color: 'bg-blue-100 text-blue-700' },
  rotary: { label: 'Rotary', color: 'bg-orange-100 text-orange-700' },
  mixed: { label: 'Mixed', color: 'bg-purple-100 text-purple-700' },
  not_applicable: { label: 'N/A', color: 'bg-slate-100 text-slate-500' },
};

function MethodBadge({ method }) {
  const m = METHOD_LABELS[method] || METHOD_LABELS.not_applicable;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.color}`}>
      <HardHat className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

const SOURCE_BADGE = {
  project: 'bg-emerald-100 text-emerald-700',
  global: 'bg-blue-100 text-blue-700',
  job: 'bg-violet-100 text-violet-700',
  no_match: 'bg-amber-100 text-amber-700',
};
const SOURCE_LABEL = { project: 'Project', global: 'Global', job: 'Job Rate', no_match: 'No Match' };

/**
 * BoreholeRevenueTable — per-borehole depth-banded meterage revenue breakdown.
 * Each borehole expands to show every 10m depth band with its matched rate,
 * diameter, metres, rate/m, and line total. Below that, a collapsible rate
 * card reference table shows all available depth-banded drilling rates.
 */
export default function BoreholeRevenueTable({ boreholeRevenue = [], drillingRateCard, totalMetres, meterageRevenue }) {
  const [expandedBh, setExpandedBh] = useState(null);
  const [showRateCard, setShowRateCard] = useState(false);

  const allRates = [
    ...(drillingRateCard?.cp || []).map(r => ({ ...r, method: 'cp' })),
    ...(drillingRateCard?.rotary || []).map(r => ({ ...r, method: 'rotary' })),
  ];

  return (
    <div className="space-y-3">
      {/* === Per-Borehole Depth-Banded Revenue === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Mountain className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">Per-Borehole Revenue (Depth-Banded)</h3>
          <span className="ml-auto text-xs text-slate-400">
            {boreholeRevenue.length} boreholes · {Number(totalMetres || 0).toFixed(1)}m · {fmt(meterageRevenue)}
          </span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {boreholeRevenue.map((b) => {
            const isExpanded = expandedBh === b.borehole_ref;
            const hasBands = b.bands && b.bands.length > 0;
            return (
              <div key={b.borehole_ref}>
                <button
                  onClick={() => setExpandedBh(isExpanded ? null : b.borehole_ref)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition text-left"
                >
                  {hasBands ? (
                    isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : <div className="w-4 h-4 flex-shrink-0" />}
                  <span className="font-mono text-xs font-bold text-slate-700 flex-shrink-0 w-24 truncate">{b.borehole_ref}</span>
                  <MethodBadge method={b.method} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 truncate">{b.rate_description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(b.revenue)}</p>
                    <p className="text-[10px] text-slate-400">{b.metres.toFixed(1)}m drilled</p>
                  </div>
                </button>
                {isExpanded && hasBands && (
                  <div className="bg-slate-50/50 px-4 pb-3 pt-1">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[9px] uppercase text-slate-400 border-b border-slate-200">
                            <th className="text-left py-1.5 px-2 font-medium">Depth Band</th>
                            <th className="text-left py-1.5 px-2 font-medium">Diameter</th>
                            <th className="text-right py-1.5 px-2 font-medium">Metres</th>
                            <th className="text-right py-1.5 px-2 font-medium">Rate / m</th>
                            <th className="text-right py-1.5 px-2 font-medium">Line Total</th>
                            <th className="text-left py-1.5 px-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {b.bands.map((band, i) => (
                            <tr key={i} className={band.rate_source === 'no_match' ? 'bg-amber-50' : ''}>
                              <td className="py-1.5 px-2 font-mono font-medium text-slate-700">
                                {band.depth_from}m – {band.depth_to}m
                              </td>
                              <td className="py-1.5 px-2 text-slate-600">{band.diameter > 0 ? `${band.diameter}mm` : '—'}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">{band.metres.toFixed(1)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-700">
                                {band.rate_per_metre > 0 ? fmt(band.rate_per_metre) : <span className="text-amber-600">No rate</span>}
                              </td>
                              <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-slate-900">{fmt(band.revenue)}</td>
                              <td className="py-1.5 px-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_BADGE[band.rate_source] || SOURCE_BADGE.no_match}`}>
                                  {SOURCE_LABEL[band.rate_source] || 'No Match'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 bg-white">
                            <td colSpan={2} className="py-1.5 px-2 font-bold text-slate-800">Total</td>
                            <td className="py-1.5 px-2 text-right tabular-nums font-bold text-slate-800">{b.metres.toFixed(1)}m</td>
                            <td className="py-1.5 px-2"></td>
                            <td className="py-1.5 px-2 text-right tabular-nums font-bold text-slate-900">{fmt(b.revenue)}</td>
                            <td className="py-1.5 px-2"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === Drilling Rate Card Reference === */}
      {allRates.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowRateCard(!showRateCard)}
            className="w-full px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-left hover:bg-slate-50/50 transition"
          >
            {showRateCard ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-800">Drilling Rate Card Reference</h3>
            <span className="ml-auto text-xs text-slate-400">{allRates.length} depth-banded rates (CP + Rotary)</span>
          </button>
          {showRateCard && (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-[9px] uppercase text-slate-400 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium">Method</th>
                    <th className="text-left py-2 px-3 font-medium">Depth Band</th>
                    <th className="text-left py-2 px-3 font-medium">Diameter</th>
                    <th className="text-right py-2 px-3 font-medium">Rate / m</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...allRates].sort((a, b) => a.method.localeCompare(b.method) || a.diameter - b.diameter || a.depth_from - b.depth_from).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3"><MethodBadge method={r.method} /></td>
                      <td className="py-1.5 px-3 font-mono text-slate-700">{r.depth_from}m – {r.depth_to}m</td>
                      <td className="py-1.5 px-3 text-slate-600">{r.diameter}mm</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-slate-900">{fmt(r.price)}</td>
                      <td className="py-1.5 px-3 text-slate-500 truncate max-w-xs">{r.description}</td>
                      <td className="py-1.5 px-3">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_BADGE[r.source] || SOURCE_BADGE.global}`}>
                          {SOURCE_LABEL[r.source] || 'Global'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}