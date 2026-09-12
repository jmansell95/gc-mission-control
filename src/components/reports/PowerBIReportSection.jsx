import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart3, Database, RefreshCw } from 'lucide-react';
import { downloadCsv } from '@/utils/csvExport';

const COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];

/**
 * Renders cached Power BI dataset records (PowerBIDataset entity) as native
 * recharts charts. Each record's chart_type / x_field / y_field drive the
 * visualisation. This is the Power BI integration surface inside the
 * Reporting Hub — no Power BI embed iframe, fully native.
 */
export default function PowerBIReportSection() {
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['powerbi-datasets'],
    queryFn: () => base44.entities.PowerBIDataset.list('-last_synced_at', 50),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-10 text-center">
        <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No Power BI data yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Configure Power BI in Enterprise Settings → Integrations, add your datasets and tables,
          then hit <strong>Sync Now</strong>. Pulled data renders here as native charts.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {datasets.map(ds => (
        <PowerBICard key={ds.id} ds={ds} />
      ))}
    </div>
  );
}

function PowerBICard({ ds }) {
  const rows = ds.rows || [];
  const x = ds.x_field;
  const y = ds.y_field;

  const chartData = rows.map(r => ({ name: String(r[x] ?? ''), value: Number(r[y]) || 0 }));

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{ds.label}</h3>
            <p className="text-[10px] text-slate-400">{ds.row_count} rows · {ds.table_name}</p>
          </div>
        </div>
        <button onClick={() => downloadCsv((ds.label || ds.table_name) + '.csv', rows)}
          className="text-xs font-semibold text-[#2E5A1A] hover:underline flex-shrink-0">Export</button>
      </div>

      <div className="h-64">
        {ds.chart_type === 'table' ? (
          <DataTable rows={rows} columns={ds.columns || []} />
        ) : ds.chart_type === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : ds.chart_type === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2E5A1A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : ds.chart_type === 'area' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#2E5A1A" fill="#8DC63F55" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2E5A1A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DataTable({ rows, columns }) {
  if (!rows.length) return <p className="text-xs text-slate-400 text-center py-8">No rows</p>;
  const cols = columns.length ? columns : Object.keys(rows[0]);
  return (
    <div className="overflow-auto h-full rounded-lg border border-slate-100">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>{cols.map(c => <th key={c} className="text-left font-bold text-slate-500 px-2 py-1.5">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {cols.map(c => <td key={c} className="px-2 py-1.5 text-slate-700">{String(r[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}