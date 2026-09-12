import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Download, FileJson, FileSpreadsheet, Loader2, Database, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const EXPORT_ENTITIES = [
  { name: 'Staff', label: 'Staff & Crew' },
  { name: 'Client', label: 'Clients' },
  { name: 'Contractor', label: 'Contractors' },
  { name: 'Job', label: 'Jobs / Projects' },
  { name: 'Vehicle', label: 'Vehicles' },
  { name: 'SiteAsset', label: 'Assets & Equipment' },
  { name: 'Division', label: 'Divisions' },
  { name: 'Team', label: 'Teams' },
  { name: 'RotaAssignment', label: 'Rota Assignments' },
  { name: 'Timesheet', label: 'Timesheets' },
  { name: 'Absence', label: 'Absences' },
  { name: 'StaffRequest', label: 'Staff Requests' },
  { name: 'StaffTask', label: 'Staff Tasks' },
  { name: 'Invoice', label: 'Invoices' },
  { name: 'AFP', label: 'AFPs' },
  { name: 'CVR', label: 'CVRs' },
  { name: 'SafetyReport', label: 'Safety Reports' },
  { name: 'ToolboxTalk', label: 'Toolbox Talks' },
  { name: 'ComplianceItem', label: 'Compliance Items' },
  { name: 'JobDocument', label: 'Job Documents' },
  { name: 'TrainingBooking', label: 'Training Bookings' },
  { name: 'HotelBooking', label: 'Hotel Bookings' },
  { name: 'DeliveryLog', label: 'Delivery Logs' },
  { name: 'SystemAuditLog', label: 'System Audit Log' },
  { name: 'FinancialAuditLog', label: 'Financial Audit Log' },
];

function toCSV(data) {
  if (!data || !data.length) return '';
  const headers = Object.keys(data[0]).filter(k => !k.startsWith('_') && k !== 'raw_payload');
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    return `"${String(val).replace(/"/g, '""')}"`;
  };
  return [headers.join(','), ...data.map(row => headers.map(h => escape(row[h])).join(','))].join('\n');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataExportTab() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(null);
  const [exportingAll, setExportingAll] = useState(false);

  const getCount = async (entityName) => {
    setLoading(entityName);
    try {
      const records = await base44.entities[entityName].list(1);
      return records.length;
    } catch {
      return -1;
    } finally {
      setLoading(null);
    }
  };

  const handleCountAll = async () => {
    const newCounts = {};
    for (const e of EXPORT_ENTITIES) {
      try {
        const records = await base44.entities[e.name].list(1);
        newCounts[e.name] = records.length;
      } catch {
        newCounts[e.name] = -1;
      }
    }
    setCounts(newCounts);
  };

  const handleExport = async (entityName, format) => {
    setLoading(`${entityName}-${format}`);
    try {
      const records = await base44.entities[entityName].list(500);
      const timestamp = new Date().toISOString().split('T')[0];
      if (format === 'json') {
        downloadFile(JSON.stringify(records, null, 2), `${entityName}_${timestamp}.json`, 'application/json');
      } else {
        downloadFile(toCSV(records), `${entityName}_${timestamp}.csv`, 'text/csv');
      }
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const allData = {};
      for (const e of EXPORT_ENTITIES) {
        try {
          const records = await base44.entities[e.name].list(500);
          allData[e.name] = records;
        } catch {
          allData[e.name] = { error: 'Export failed' };
        }
      }
      const timestamp = new Date().toISOString().split('T')[0];
      downloadFile(JSON.stringify(allData, null, 2), `full_data_export_${timestamp}.json`, 'application/json');
    } catch (err) {
      alert(`Full export failed: ${err.message}`);
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Exit plan notice */}
      <div className="hub-glass rounded-2xl p-4 bg-emerald-50/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">Data Portability & Exit Plan</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export every entity as standard CSV or JSON at any time. No proprietary lock-in — all data is portable
              and can be imported into any system. Use "Export All" for a complete data snapshot.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCountAll}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          Count All Records
        </button>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exportingAll}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {exportingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export All (JSON)
        </button>
      </div>

      {/* Entity list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EXPORT_ENTITIES.map(e => {
          const count = counts[e.name];
          return (
            <div key={e.name} className="hub-glass rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{e.label}</p>
                <p className="text-[10px] text-slate-400 font-mono">{e.name}</p>
                {count !== undefined && (
                  <p className={`text-[10px] font-medium mt-0.5 ${count > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {count > 0 ? `${count} records` : count === 0 ? 'No records' : 'Access restricted'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleExport(e.name, 'csv')}
                  disabled={loading === `${e.name}-csv`}
                  className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
                  title="Export as CSV"
                >
                  {loading === `${e.name}-csv` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(e.name, 'json')}
                  disabled={loading === `${e.name}-json`}
                  className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
                  title="Export as JSON"
                >
                  {loading === `${e.name}-json` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}