import React, { useMemo, useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet,
  ArrowRight, AlertCircle, Table, Columns, Eye,
} from 'lucide-react';

/**
 * ImportPreviewPane — Shared field-matching preview component used by both
 * the planner import and the prehistoric import.
 *
 * Props:
 *   open: boolean
 *   onClose: function
 *   title: string
 *   fileName: string
 *   sheets: Array<{
 *     sheet_name, entity, headers: string[], sample_rows: Array<object>,
 *     row_count, field_map: { header → field }, available_fields: string[]
 *   }>
 *   statusBreakdown?: { planning, in_progress, completed, on_hold, cancelled } — planner only
 *   activeOnly?: boolean, onToggleActiveOnly?: function — planner only
 *   onConfirm: function(mappings) — called with the finalised mappings
 *   applying?: boolean
 *   supportedEntities?: string[]
 *   entitySelectable?: boolean — whether the user can change the detected entity per sheet
 *   extraSummary?: React node — planner-specific summary tiles
 *   confirmLabel?: string
 */

const VALIDATION_COLORS = {
  matched: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Matched' },
  ambiguous: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Ambiguous' },
  unmapped: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200', label: 'Unmapped' },
  empty: { bg: 'bg-slate-100', text: 'text-slate-500', ring: 'ring-slate-200', label: 'Empty' },
};

function getValidationStatus(header, mappedField, sampleValues) {
  const nonEmpty = sampleValues.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'empty';
  if (!mappedField) return 'unmapped';
  // Ambiguous if header contains multiple words and match is weak (heuristic)
  const headerLower = header.toLowerCase();
  const fieldLower = mappedField.replace(/_/g, ' ');
  if (headerLower === fieldLower) return 'matched';
  if (headerLower.includes(fieldLower) || fieldLower.includes(headerLower)) return 'matched';
  return 'ambiguous';
}

function ValidationBadge({ status }) {
  const cfg = VALIDATION_COLORS[status] || VALIDATION_COLORS.unmapped;
  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}>
      {cfg.label}
    </span>
  );
}

function StatusChip({ label, count, active, onClick, color }) {
  const colorMap = {
    emerald: 'bg-emerald-500 text-white',
    teal: 'bg-teal-500 text-white',
    slate: 'bg-slate-400 text-white',
    amber: 'bg-amber-500 text-white',
    rose: 'bg-rose-500 text-white',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
        active ? `${colorMap[color]} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
    </button>
  );
}

export default function ImportPreviewPane({
  open, onClose, title, fileName, sheets,
  statusBreakdown, activeOnly, onToggleActiveOnly,
  onConfirm, applying = false, supportedEntities = [],
  entitySelectable = false, extraSummary = null, confirmLabel = 'Confirm & Import',
}) {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  // mappings: { [sheetName]: { entity: string, fieldMap: { [header]: string } } }
  const [mappings, setMappings] = useState(() => {
    const init = {};
    for (const s of sheets || []) {
      init[s.sheet_name] = { entity: s.entity || '', fieldMap: { ...(s.field_map || {}) } };
    }
    return init;
  });

  // Reset state when sheets change
  React.useEffect(() => {
    const init = {};
    for (const s of sheets || []) {
      init[s.sheet_name] = { entity: s.entity || '', fieldMap: { ...(s.field_map || {}) } };
    }
    setMappings(init);
    setActiveSheetIdx(0);
  }, [sheets]);

  // Compute validation summary across all sheets (must run before any early return)
  const validationSummary = useMemo(() => {
    let matched = 0, ambiguous = 0, unmapped = 0, empty = 0;
    for (const s of sheets || []) {
      const m = mappings[s.sheet_name];
      if (!m) continue;
      for (const header of s.headers || []) {
        const sampleValues = (s.sample_rows || []).map((r) => r[header]);
        const status = getValidationStatus(header, m.fieldMap[header], sampleValues);
        if (status === 'matched') matched++;
        else if (status === 'ambiguous') ambiguous++;
        else if (status === 'unmapped') unmapped++;
        else empty++;
      }
    }
    return { matched, ambiguous, unmapped, empty };
  }, [sheets, mappings]);

  if (!open) return null;

  const activeSheet = sheets?.[activeSheetIdx];
  const activeMapping = activeSheet ? mappings[activeSheet.sheet_name] : null;

  const updateFieldMap = (header, newField) => {
    if (!activeSheet) return;
    setMappings((prev) => ({
      ...prev,
      [activeSheet.sheet_name]: {
        ...prev[activeSheet.sheet_name],
        fieldMap: { ...prev[activeSheet.sheet_name].fieldMap, [header]: newField },
      },
    }));
  };

  const updateEntity = (newEntity) => {
    if (!activeSheet) return;
    setMappings((prev) => ({
      ...prev,
      [activeSheet.sheet_name]: { ...prev[activeSheet.sheet_name], entity: newEntity },
    }));
  };

  const totalRows = (sheets || []).reduce((s, sh) => s + (sh.row_count || 0), 0);

  const handleConfirm = () => {
    onConfirm(mappings);
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950/60 backdrop-blur-md">
      {/* Sticky header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
            <Columns className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800 truncate">{title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
              <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{fileName}</span>
              <span className="text-slate-300">·</span>
              <span>{(sheets || []).length} sheets</span>
              <span className="text-slate-300">·</span>
              <span>{totalRows.toLocaleString()} rows</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Validation summary badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 font-medium">
              <CheckCircle2 className="w-3 h-3" /> {validationSummary.matched}
            </span>
            {validationSummary.ambiguous > 0 && (
              <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 font-medium">
                <AlertCircle className="w-3 h-3" /> {validationSummary.ambiguous}
              </span>
            )}
            {validationSummary.unmapped > 0 && (
              <span className="flex items-center gap-1 text-xs bg-rose-50 text-rose-700 rounded-full px-2.5 py-1 font-medium">
                <AlertTriangle className="w-3 h-3" /> {validationSummary.unmapped}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Status filter chips — planner only */}
      {statusBreakdown && (
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 mr-1">Status filter:</span>
          <StatusChip label="Active" count={(statusBreakdown.planning || 0) + (statusBreakdown.in_progress || 0)} active={activeOnly} onClick={() => onToggleActiveOnly?.(true)} color="emerald" />
          <StatusChip label="Completed" count={statusBreakdown.completed || 0} active={!activeOnly} onClick={() => onToggleActiveOnly?.(false)} color="slate" />
          {(statusBreakdown.on_hold > 0 || statusBreakdown.cancelled > 0) && (
            <>
              <span className="text-xs text-slate-400 ml-1">Also excluded:</span>
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-1 font-medium">{statusBreakdown.on_hold || 0} on hold</span>
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-1 font-medium">{statusBreakdown.cancelled || 0} cancelled</span>
            </>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {activeOnly ? 'Only planning + in-progress jobs will be imported' : 'All statuses will be imported'}
          </span>
        </div>
      )}

      {/* Extra summary (planner tiles) */}
      {extraSummary && (
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 max-h-40 overflow-y-auto">
          {extraSummary}
        </div>
      )}

      {/* Main body — sheet tabs + mapping table + sample preview */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left: sheet tabs */}
        <div className="flex-shrink-0 lg:w-56 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white overflow-x-auto lg:overflow-y-auto">
          <div className="flex lg:flex-col gap-1 p-2 min-w-max lg:min-w-0">
            {(sheets || []).map((s, i) => {
              const m = mappings[s.sheet_name];
              const isActive = i === activeSheetIdx;
              return (
                <button
                  key={s.sheet_name}
                  onClick={() => setActiveSheetIdx(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition flex-shrink-0 lg:flex-shrink ${
                    isActive ? 'bg-[#2E5A1A] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Table className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>{s.sheet_name}</p>
                    <p className={`text-[10px] truncate ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                      {m?.entity || 'unmapped'} · {s.row_count || 0} rows
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: field-mapping table */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-50/50 p-4">
          {activeSheet && activeMapping ? (
            <div className="space-y-4">
              {/* Entity selector */}
              <div className="hub-glass rounded-xl p-3 flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">Detected entity:</span>
                {entitySelectable ? (
                  <select
                    value={activeMapping.entity}
                    onChange={(e) => updateEntity(e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]"
                  >
                    <option value="">— Not mapped —</option>
                    {supportedEntities.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-bold text-slate-800">{activeMapping.entity || '— Not mapped —'}</span>
                )}
                <span className="text-xs text-slate-400 ml-auto">{activeSheet.headers?.length || 0} columns · {activeSheet.row_count || 0} data rows</span>
              </div>

              {/* Mapping table */}
              <div className="hub-glass rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                  <Columns className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-700">Column → Field Mapping</h3>
                  <span className="text-xs text-slate-400 ml-auto">Click a field to change the mapping</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                  {(activeSheet.headers || []).map((header) => {
                    const mappedField = activeMapping.fieldMap[header] || '';
                    const sampleValues = (activeSheet.sample_rows || []).map((r) => r[header]);
                    const status = getValidationStatus(header, mappedField, sampleValues);
                    return (
                      <div key={header} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <ValidationBadge status={status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{header}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            Sample: {sampleValues.slice(0, 2).filter((v) => v !== '').join(', ') || '—'}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <select
                          value={mappedField}
                          onChange={(e) => updateFieldMap(header, e.target.value)}
                          className={`text-sm rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-[#2E5A1A] min-w-[160px] ${
                            mappedField ? 'bg-white text-slate-700 border-slate-200' : 'bg-rose-50 text-rose-500 border-rose-200'
                          }`}
                        >
                          <option value="">— Skip —</option>
                          {(activeSheet.available_fields || []).map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {(!activeSheet.headers || activeSheet.headers.length === 0) && (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No headers detected in this sheet.</div>
                  )}
                </div>
              </div>

              {/* Sample data preview */}
              {(activeSheet.sample_rows || []).length > 0 && (
                <div className="hub-glass rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Sample Data Preview (first {activeSheet.sample_rows.length} rows)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 sticky top-0">
                        <tr>
                          {activeSheet.headers?.map((h) => (
                            <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                              {h}
                              <span className="block text-[10px] text-slate-400 font-normal">→ {activeMapping.fieldMap[h] || 'skip'}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeSheet.sample_rows.map((row, ri) => (
                          <tr key={ri} className="hover:bg-slate-50">
                            {activeSheet.headers?.map((h) => (
                              <td key={h} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate">{row[h] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              No sheets to preview.
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer — confirm bar */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {validationSummary.matched} matched · {validationSummary.ambiguous} ambiguous · {validationSummary.unmapped} unmapped
          {validationSummary.unmapped > 0 && <span className="text-rose-500 font-medium ml-1">(unmapped columns will be skipped)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={applying}
            className="command-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition hover:shadow-lg"
          >
            {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><CheckCircle2 className="w-4 h-4" /> {confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>
  );
}