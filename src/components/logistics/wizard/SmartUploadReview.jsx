import React, { useState, useMemo } from 'react';
import { Loader2, FileText, Image as ImageIcon, ArrowRight, Check } from 'lucide-react';

const FIELD_OPTIONS = [
  { value: 'ignore', label: '— ignore —' },
  { value: 'description', label: 'Description' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unit_price', label: 'Unit Price' },
  { value: 'line_total', label: 'Line Total' },
];

const inputCls = 'w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A] text-sm';

/**
 * SmartUploadReview — the review/mapping step shown after a quote is uploaded.
 *
 * Left: visual preview of the uploaded PDF/image (rendered in-browser).
 * Right: editable table of the raw extracted rows.
 * Bottom: column-mapping builder — each detected column gets a dropdown to
 * assign it to a billable field (description, quantity, unit_price, line_total).
 *
 * On "Map & Extract": transforms raw rows using the mapping into the standard
 * { description, quantity, unit_price, line_total } format and calls onApply.
 */
export default function SmartUploadReview({
  fileUrl,
  fileName,
  rawRows,
  detectedColumns,
  rawText,
  onApply,
  onBack,
  onClose,
  applying,
}) {
  // Column mapping: { [columnName]: 'description' | 'quantity' | ... | 'ignore' }
  const [columnMapping, setColumnMapping] = useState(() => {
    const initial = {};
    detectedColumns.forEach((col) => {
      const lower = col.toLowerCase();
      if (lower.includes('desc') || lower.includes('item') || lower.includes('product')) initial[col] = 'description';
      else if (lower.includes('qty') || lower.includes('quant') || lower.includes('no') || lower === 'nr') initial[col] = 'quantity';
      else if (lower.includes('price') || lower.includes('rate') || lower.includes('cost')) initial[col] = 'unit_price';
      else if (lower.includes('total') || lower.includes('amount') || lower.includes('value')) initial[col] = 'line_total';
      else initial[col] = 'ignore';
    });
    return initial;
  });

  // Editable copy of raw rows
  const [editableRows, setEditableRows] = useState(() => rawRows.map((r) => ({ ...r })));

  const isImage = useMemo(() => {
    const name = (fileName || fileUrl || '').toLowerCase();
    return name.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/) || (fileUrl || '').includes('image');
  }, [fileUrl, fileName]);

  const handleCellEdit = (rowIdx, col, value) => {
    setEditableRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
  };

  const handleMappingChange = (col, value) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      // Enforce one-column-per-field — if this field was already mapped to
      // another column, reset that column to 'ignore'.
      if (value !== 'ignore') {
        Object.keys(next).forEach((k) => { if (next[k] === value) next[k] = 'ignore'; });
      }
      next[col] = value;
      return next;
    });
  };

  const handleApply = () => {
    // Find which columns map to which fields
    const fieldCols = {};
    Object.entries(columnMapping).forEach(([col, field]) => {
      if (field !== 'ignore') fieldCols[field] = col;
    });

    // Transform editable rows into the standard format
    const mappedRows = editableRows
      .map((r) => {
        const description = fieldCols.description ? String(r[fieldCols.description] || '').trim() : '';
        const quantityStr = fieldCols.quantity ? String(r[fieldCols.quantity] || '1').trim() : '1';
        const unitPriceStr = fieldCols.unit_price ? String(r[fieldCols.unit_price] || '0').trim() : '0';
        const lineTotalStr = fieldCols.line_total ? String(r[fieldCols.line_total] || '').trim() : '';

        // Parse numbers — strip currency symbols and commas
        const parseNum = (s) => {
          if (!s) return 0;
          const cleaned = String(s).replace(/[^0-9.\-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        };

        const quantity = parseNum(quantityStr) || 1;
        const unitPrice = parseNum(unitPriceStr);
        const lineTotal = lineTotalStr ? parseNum(lineTotalStr) : quantity * unitPrice;

        return { description, quantity, unit_price: unitPrice, line_total: lineTotal };
      })
      .filter((r) => r.description);

    if (mappedRows.length === 0) {
      onApply([], 'No rows with a description. Map a column to "Description" and try again.');
      return;
    }

    onApply(mappedRows, null);
  };

  const hasDescriptionMapped = Object.values(columnMapping).includes('description');

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Split preview + raw rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: visual preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
            {isImage ? <ImageIcon className="w-3.5 h-3.5 text-[#2E5A1A]" /> : <FileText className="w-3.5 h-3.5 text-[#2E5A1A]" />}
            Document Preview
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden" style={{ height: '420px' }}>
            {fileUrl ? (
              isImage ? (
                <img src={fileUrl} alt={fileName || 'Quote preview'} className="w-full h-full object-contain" />
              ) : (
                <object data={fileUrl} type="application/pdf" className="w-full h-full">
                  <iframe src={fileUrl} title="Quote preview" className="w-full h-full border-0" />
                </object>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No preview available</div>
            )}
          </div>
          {fileName && <p className="text-[11px] text-slate-400 truncate">{fileName}</p>}
        </div>

        {/* Right: raw extracted rows */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
            <FileText className="w-3.5 h-3.5 text-[#2E5A1A]" />
            Extracted Rows ({editableRows.length})
          </div>
          <div className="rounded-xl border border-slate-200 overflow-auto" style={{ maxHeight: '420px' }}>
            {editableRows.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                No rows extracted automatically.
                {rawText && <p className="mt-1 text-xs">Raw text is available — see below.</p>}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {detectedColumns.map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editableRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {detectedColumns.map((col) => (
                        <td key={col} className="px-1 py-1">
                          <input
                            type="text"
                            value={row[col] || ''}
                            onChange={(e) => handleCellEdit(rowIdx, col, e.target.value)}
                            className="w-full px-1.5 py-1 border border-transparent rounded text-xs hover:border-slate-200 focus:border-[#2E5A1A] focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Raw text fallback (collapsible) */}
      {rawText && editableRows.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-700 mb-1">Raw extracted text (no table detected — edit cells above or map columns below)</p>
          <pre className="text-[11px] text-slate-600 whitespace-pre-wrap max-h-32 overflow-auto">{rawText}</pre>
        </div>
      )}

      {/* Column mapping builder */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
          <ArrowRight className="w-3.5 h-3.5 text-[#2E5A1A]" />
          Column Mapping
          <span className="text-slate-400 font-normal normal-case tracking-normal">— assign each column to a billable field</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {detectedColumns.map((col) => (
            <div key={col} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2.5 py-2">
              <span className="text-xs font-semibold text-slate-700 truncate flex-1 min-w-0" title={col}>{col}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <select
                value={columnMapping[col] || 'ignore'}
                onChange={(e) => handleMappingChange(col, e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A] font-medium flex-shrink-0"
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {!hasDescriptionMapped && detectedColumns.length > 0 && (
          <p className="text-xs text-amber-600 font-medium">⚠ Map at least one column to "Description" to extract line items.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasDescriptionMapped || applying || editableRows.length === 0}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50"
        >
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {applying ? 'Matching…' : 'Map & Extract'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 bg-white text-slate-500 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition ml-auto"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}