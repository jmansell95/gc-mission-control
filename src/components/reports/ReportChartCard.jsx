import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Download, ChevronRight } from 'lucide-react';
import { downloadCsv } from '@/utils/csvExport';
// Note: chart cards still use the legacy downloadCsv for raw row dumps.
// The structured CSV export is used by the main report export buttons.

const COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];

/**
 * Polished chart card with drill-down. `drillDown` is an object
 * { route, params } — clicking the card navigates to that route with
 * the params as query string so the target hub pre-filters.
 */
export default function ReportChartCard({ title, icon: Icon, data, type = 'bar', rows = [], drillDown, valuePrefix = '' }) {
  const navigate = useNavigate();

  const handleDrillDown = () => {
    if (!drillDown) return;
    const qs = new URLSearchParams(drillDown.params || {}).toString();
    navigate(drillDown.route + (qs ? '?' + qs : ''));
  };

  const canDrill = !!drillDown;

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

      <div className={`h-64 ${canDrill ? 'cursor-pointer' : ''}`} onClick={canDrill ? handleDrillDown : undefined}>
        {type === 'stat' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-4xl font-extrabold text-[#2E5A1A] tabular-nums">
              {valuePrefix}{Math.round(data[0]?.value || 0).toLocaleString()}
            </p>
          </div>
        ) : type === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 11 }}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : type === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2E5A1A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : type === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#2E5A1A" fill="#8DC63F55" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2E5A1A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {canDrill && (
        <button onClick={handleDrillDown}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#2E5A1A] transition opacity-0 group-hover:opacity-100">
          View records <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}