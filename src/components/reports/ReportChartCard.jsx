import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronRight } from 'lucide-react';
import { downloadCsv } from '@/utils/csvExport';
import ReportChart from './ReportChart';

const COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];

/**
 * Polished chart card with drill-down. `drillDown` is an object
 * { route, params } — clicking the card navigates to that route with
 * the params as query string so the target hub pre-filters.
 * When onSegmentClick is provided, chart segments open a drill-down drawer
 * instead of navigating.
 */
export default function ReportChartCard({ title, icon: Icon, data, type = 'bar', rows = [], drillDown, valuePrefix = '', onSegmentClick }) {
  const navigate = useNavigate();

  const handleDrillDown = () => {
    if (!drillDown) return;
    const qs = new URLSearchParams(drillDown.params || {}).toString();
    navigate(drillDown.route + (qs ? '?' + qs : ''));
  };

  const canDrill = !!drillDown;

  const handleSegment = (item) => {
    if (onSegmentClick) {
      // Filter rows matching this segment
      const segRows = rows.filter(r => {
        const val = item.name;
        return String(r[title.includes('Status') ? 'status' : ''] || '') === val || Object.values(r).some(v => String(v) === val);
      });
      onSegmentClick({ title: `${title} → ${item.name}`, records: segRows.length > 0 ? segRows : rows });
      return;
    }
    if (canDrill) handleDrillDown();
  };

  return (
    <div className="insight-card rounded-2xl p-4 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2E5A1A] flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => downloadCsv(title + '.csv', rows)} title="Export CSV"
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#2E5A1A] hover:bg-emerald-50 transition">
            <Download className="w-3.5 h-3.5" />
          </button>
          {canDrill && (
            <button onClick={handleDrillDown} title="View records"
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#2E5A1A] hover:bg-emerald-50 transition">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-64">
        {type === 'stat' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-4xl font-extrabold text-[#2E5A1A] tabular-nums">
              {valuePrefix}{Math.round(data[0]?.value || 0).toLocaleString()}
            </p>
          </div>
        ) : (
          <ReportChart
            data={data}
            type={type === 'pie' ? 'donut' : type}
            onSegmentClick={handleSegment}
            height={256}
          />
        )}
      </div>

      {canDrill && !onSegmentClick && (
        <button onClick={handleDrillDown}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#2E5A1A] transition opacity-0 group-hover:opacity-100">
          View records <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}