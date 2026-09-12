import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Download,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_SERVICE_INTERVALS, DEFAULT_COMPLIANCE_CATEGORIES,
  autoComplianceStatus, autoNextServiceDate, autoMaintenanceStatus,
} from '@/utils/assetSmartDefaults';

/**
 * BulkAssetUpload — upload a CSV/Excel file to create multiple SiteAsset
 * records at once. Columns: name, asset_type, serial_number, equipment_type,
 * compliance_category, storage_location, responsible_person, colour,
 * compliance_expiry_date, last_service_date, service_interval_hours, notes.
 *
 * Only "name" is required. Everything else is optional with smart defaults.
 */
const TEMPLATE_HEADERS = [
  'name', 'asset_type', 'serial_number', 'equipment_type',
  'compliance_category', 'storage_location', 'responsible_person',
  'colour', 'compliance_expiry_date', 'last_service_date',
  'service_interval_hours', 'notes',
];

const VALID_TYPES = ['rig', 'machinery', 'trailer', 'lifting', 'portable_appliance'];

export default function BulkAssetUpload({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFile = async (f) => {
    setFile(f);
    setParsed(false);
    setRows([]);
    setResults(null);
    try {
      const text = await f.text();
      // Simple CSV parser — handles quoted fields
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: 'File too small', description: 'Need a header row + at least one data row.', variant: 'destructive' });
        return;
      }
      const parseLine = (line) => {
        const cells = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
          cur += ch;
        }
        cells.push(cur);
        return cells.map(c => c.trim());
      };
      const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
      const dataRows = lines.slice(1).map(line => {
        const cells = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => { if (TEMPLATE_HEADERS.includes(h)) obj[h] = cells[i] || ''; });
        return obj;
      }).filter(r => r.name);
      setRows(dataRows);
      setParsed(true);
      if (dataRows.length === 0) {
        toast({ title: 'No valid rows', description: 'Each row needs at least a "name" column.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Could not read file', description: e.message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(',') + '\n' +
      'Rig 1,rig,RIG-001,Truck-mounted Rig,Plant,Dartford Depot,John Smith,Blue,,2026-01-15,250,\n' +
      'Sling S-04,lifting,SL-04,1t Sling,Lifting Gear,Van,Mike Jones,,,,\n' +
      'Excavator CAT 320,machinery,CAT320-01,Excavator,Plant,Yard,,Yellow,,2026-03-01,,500,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset-bulk-upload-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setImporting(true);
    const created = [];
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const type = VALID_TYPES.includes(r.asset_type) ? r.asset_type : 'machinery';
        const expiry = r.compliance_expiry_date || '';
        const lastService = r.last_service_date || '';
        const status = expiry ? autoComplianceStatus(expiry) : 'unknown';
        const nextService = lastService ? autoNextServiceDate(lastService, type) : '';
        const interval = (type === 'rig' || type === 'machinery')
          ? (Number(r.service_interval_hours) || DEFAULT_SERVICE_INTERVALS[type] || (type === 'rig' ? 250 : 500))
          : null;
        const payload = {
          name: r.name,
          asset_type: type,
          is_rig: type === 'rig',
          rig_type: type === 'rig' ? 'n/a' : 'n/a',
          equipment_type: r.equipment_type || '',
          compliance_category: r.compliance_category || DEFAULT_COMPLIANCE_CATEGORIES[type] || '',
          serial_number: r.serial_number || '',
          colour: r.colour || '',
          storage_location: r.storage_location || '',
          responsible_person: r.responsible_person || '',
          compliance_status: status,
          compliance_expiry_date: expiry || null,
          last_service_date: lastService || null,
          next_service_date: nextService || null,
          is_active: true,
          notes: r.notes || '',
          service_interval_hours: interval,
          operating_hours: 0,
          hours_at_last_service: 0,
          linked_equipment_ids: [],
        };
        payload.maintenance_status = autoMaintenanceStatus(payload);
        await base44.entities.SiteAsset.create(payload);
        created.push(r.name);
      } catch (e) {
        errors.push({ row: i + 1, name: r.name, error: e.message });
      }
    }
    setResults({ created, errors });
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    setImporting(false);
    if (created.length > 0) {
      toast({ title: `${created.length} asset(s) imported`, description: errors.length > 0 ? `${errors.length} failed` : 'All succeeded.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => !importing && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" /> Bulk Upload Assets
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Upload a CSV to create multiple assets at once</p>
          </div>
          <button onClick={() => !importing && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {results ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">{results.created.length} asset(s) created successfully</span>
              </div>
              {results.created.length > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-xs font-medium text-emerald-700 mb-1">Created:</p>
                  <p className="text-xs text-emerald-600">{results.created.join(', ')}</p>
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {results.errors.length} failed:
                  </p>
                  {results.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Row {e.row} ({e.name}): {e.error}</p>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">Need a template? Download a pre-filled CSV with example rows.</p>
                <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>

              {!file ? (
                <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition">
                  <Upload className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Click to select a CSV file</p>
                  <p className="text-xs text-slate-400">Columns: name, asset_type, serial_number, ...</p>
                  <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{parsed ? `${rows.length} valid row(s) detected` : 'Parsing...'}</p>
                    </div>
                    <button onClick={() => { setFile(null); setRows([]); setParsed(false); }} className="text-slate-400 hover:text-red-500 transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {parsed && rows.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-600">Preview — {rows.length} asset(s)</p>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50/50 sticky top-0">
                            <tr className="text-left text-[10px] uppercase text-slate-400">
                              <th className="px-2 py-1.5 font-semibold">Name</th>
                              <th className="px-2 py-1.5 font-semibold">Type</th>
                              <th className="px-2 py-1.5 font-semibold">Serial</th>
                              <th className="px-2 py-1.5 font-semibold">Expiry</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {rows.slice(0, 50).map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50/30">
                                <td className="px-2 py-1.5 font-medium text-slate-700 truncate max-w-[120px]">{r.name}</td>
                                <td className="px-2 py-1.5 text-slate-500">{r.asset_type || 'machinery'}</td>
                                <td className="px-2 py-1.5 text-slate-500 truncate max-w-[80px]">{r.serial_number || '—'}</td>
                                <td className="px-2 py-1.5 text-slate-500">{r.compliance_expiry_date || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!results && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
            <button onClick={() => !importing && onClose()} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
            <button onClick={handleImport} disabled={!parsed || rows.length === 0 || importing}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${rows.length || ''} Asset(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}