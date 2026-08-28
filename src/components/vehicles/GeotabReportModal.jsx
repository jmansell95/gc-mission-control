import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart, X, Loader2, MapPin, Gauge, Route, Clock, Download } from 'lucide-react';

export default function GeotabReportModal({ onClose }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['geotab-report', fromDate, toDate],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'report',
        limit: 2000,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      return res.data || res;
    },
  });

  const vehicles = report?.vehicles || [];
  const filtered = vehicles;

  const handleExport = () => {
    const headers = ['Registration', 'Vehicle Name', 'Total Readings', 'Distance (km)', 'Last Seen', 'Last Position', 'Speed (km/h)', 'Engine', 'Driver'];
    const rows = filtered.map(v => [
      v.registration_number,
      v.vehicle_name,
      v.total_readings,
      v.distance_km,
      v.last_seen ? new Date(v.last_seen).toLocaleString('en-GB') : '',
      `${v.last_lat}, ${v.last_lng}`,
      v.last_speed_kph,
      v.last_ignition_on ? 'On' : 'Off',
      v.last_driver_name || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geotab-fleet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3 rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <FileBarChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Fleet Location Report</h3>
              <p className="text-[11px] text-slate-400">Per-vehicle GPS activity summary from Geotab</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Date filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
            <p className="text-xs text-slate-400">{filtered.length} vehicles</p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin mb-3" />
              <p className="text-sm text-slate-500">Generating report...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <FileBarChart className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No location data available. Sync from Geotab first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase text-slate-400">
                    <th className="py-2 px-2 font-semibold">Registration</th>
                    <th className="py-2 px-2 font-semibold">Vehicle</th>
                    <th className="py-2 px-2 font-semibold text-right">Readings</th>
                    <th className="py-2 px-2 font-semibold text-right">Distance</th>
                    <th className="py-2 px-2 font-semibold">Last Seen</th>
                    <th className="py-2 px-2 font-semibold">Status</th>
                    <th className="py-2 px-2 font-semibold">Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(v => (
                    <tr key={v.vehicle_id || v.registration_number} className="hover:bg-slate-50">
                      <td className="py-2.5 px-2 font-mono font-bold text-slate-900">{v.registration_number}</td>
                      <td className="py-2.5 px-2 text-slate-600">{v.vehicle_name}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{v.total_readings}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{v.distance_km} km</td>
                      <td className="py-2.5 px-2 text-xs text-slate-500">{v.last_seen ? new Date(v.last_seen).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${v.last_ignition_on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.last_ignition_on ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {v.last_ignition_on ? `${v.last_speed_kph} km/h` : 'Off'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-500">{v.last_driver_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}