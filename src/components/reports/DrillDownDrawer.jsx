import React, { useMemo } from 'react';
import { X, Download, ChevronRight } from 'lucide-react';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_COLS = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'created_date', label: 'Created' },
];

/**
 * DrillDownDrawer — right-side slide-in drawer showing the underlying records
 * behind a clicked stat tile, chart segment, or table row. Renders a compact
 * table with a CSV export button. Used by every clickable element across
 * all native reports.
 *
 * Props:
 *  - title: drawer heading (e.g. "Jobs by Status → in_progress")
 *  - breadcrumb: array of strings shown as a drill path (e.g. ['Suppliers','Holman','Job: Cambridge North'])
 *  - records: array of entity records
 *  - columns: optional [{ key, label }] — falls back to DEFAULT_COLS
 *  - onClose: () => void
 */
export default function DrillDownDrawer({ title, breadcrumb = [], records = [], columns, onClose }) {
  const { toast } = useToast();
  const cols = columns || DEFAULT_COLS;

  const rows = useMemo(() => records.map(r => {
    const row = {};
    cols.forEach(c => {
      const v = r[c.key];
      if (v == null) row[c.key] = '';
      else if (Array.isArray(v)) row[c.key] = v.join('; ');
      else if (typeof v === 'object') row[c.key] = JSON.stringify(v).substring(0, 80);
      else row[c.key] = String(v);
    });
    return row;
  }), [records, cols]);

  const handleExport = () => {
    if (rows.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    downloadStructuredCsv(`${(title || 'drilldown').replace(/\s+/g, '_')}.csv`, cols, rows);
    toast({ title: 'Exported', description: `${rows.length} records exported to CSV.` });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl h-full hub-glass shadow-2xl animate-drawer-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-900 truncate">{title || 'Drill-down'}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap text-xs text-slate-500">
              {breadcrumb.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                  <span className={i === breadcrumb.length - 1 ? 'font-semibold text-slate-700' : ''}>{b}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-slate-500">{records.length} record{records.length !== 1 ? 's' : ''}</span>
            <button onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#2E5A1A] text-xs font-semibold hover:bg-emerald-100 transition">
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>

        {/* Record table */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-slate-400">No underlying records found</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                <tr>
                  {cols.map(c => (
                    <th key={c.key} className="px-2.5 py-2 text-left font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {cols.map(c => (
                      <td key={c.key} className="px-2.5 py-2 border-b border-slate-100 text-slate-700 max-w-[200px] truncate">
                        {r[c.key]}
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
  );
}