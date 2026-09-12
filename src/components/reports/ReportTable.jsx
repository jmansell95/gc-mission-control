import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { EmptyState } from '@/components/StateViews';
import { downloadStructuredCsv } from '@/utils/csvExport';

const PAGE_SIZE = 50;

export default function ReportTable({ report, emptyIcon: Icon, filename = 'report.csv' }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!report) return null;
  if (report.rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <EmptyState icon={Icon} title="No data" message="No timesheets match the selected filters. Try widening the date range." />
      </div>
    );
  }
  const alignClass = (a) => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  const handleExportCsv = () => {
    const cols = report.columns.map(c => ({ key: c.key, label: c.label }));
    const rowObjects = report.rows.map(row =>
      Object.fromEntries(report.columns.map((c, i) => [c.key, row[i] ?? '']))
    );
    downloadStructuredCsv(filename, cols, rowObjects);
  };

  // Paginate rows to prevent browser freeze on large reports
  const visibleRows = report.rows.slice(0, visibleCount);
  const hasMore = visibleCount < report.rows.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{report.rows.length} rows{hasMore ? ` · showing ${visibleRows.length}` : ''}</span>
        <button onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-primary/30 hover:text-primary transition">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {report.columns.map(c => (
                <th key={c.key} className={`px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap ${alignClass(c.align)}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {row.map((val, j) => (
                  <td key={j} className={`px-4 py-2.5 text-slate-700 whitespace-nowrap ${alignClass(report.columns[j]?.align)}`}>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {report.totals && (
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold text-slate-900">
                {report.totals.map((val, j) => (
                  <td key={j} className={`px-4 py-3 whitespace-nowrap ${alignClass(report.columns[j]?.align)}`}>{val}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-center">
          <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-primary/30 hover:text-primary transition">
            <ChevronDown className="w-4 h-4" /> Load {Math.min(PAGE_SIZE, report.rows.length - visibleCount)} more rows
          </button>
        </div>
      )}
    </div>
  );
}