import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, Save, Check, Download, Eye, Lock } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  provider: 'csv',
  pay_element_standard: 'Basic Salary',
  pay_element_overtime: 'Overtime',
  lock_after_export: true,
};

/**
 * PayrollExportSettings — exports approved weekly timesheets to a payroll
 * provider (CSV / Xero / Sage 50). Lets admins configure the provider and
 * pay-element mapping, preview the export queue, and download the file.
 */
export default function PayrollExportSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['payroll-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'payroll_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'payroll_config', label: 'Payroll Export Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['payroll-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setMsg({ ok: false, text: e.message || 'Save failed' }); }
    setSaving(false);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await base44.functions.invoke('exportPayroll', { action: 'preview' });
      const d = res.data || {};
      setPreview({ ok: !!d.ok, count: d.count || 0, rows: d.rows || [], message: d.message || '' });
    } catch (e) { setPreview({ ok: false, rows: [], message: e.message }); }
    setPreviewing(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setMsg(null);
    try {
      const res = await base44.functions.invoke('exportPayroll', { action: 'generate' });
      // The function returns raw CSV text on success
      const text = typeof res.data === 'string' ? res.data : (res.data?.message || JSON.stringify(res.data));
      if (typeof res.data === 'string') {
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll-export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMsg({ ok: true, text: 'Payroll file downloaded. Records locked from re-export.' });
        queryClient.invalidateQueries({ queryKey: ['payroll-pending'] });
        setPreview(null);
      } else {
        setMsg({ ok: false, text: text || 'No pending timesheets to export.' });
      }
    } catch (e) { setMsg({ ok: false, text: e.message || 'Export failed' }); }
    setDownloading(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={FileSpreadsheet}
        title="Payroll Export"
        description="Export approved weekly timesheets to your payroll provider (CSV, Xero or Sage 50). Locks records after export to prevent re-export."
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Payroll Provider</label>
            <select value={config.provider} onChange={e => setConfig({ ...config, provider: e.target.value })} className={inputCls}>
              <option value="csv">CSV (Generic)</option>
              <option value="xero">Xero Payroll</option>
              <option value="sage">Sage 50 Payroll</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Standard Pay Element</label>
            <input value={config.pay_element_standard} onChange={e => setConfig({ ...config, pay_element_standard: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Overtime Pay Element</label>
            <input value={config.pay_element_overtime} onChange={e => setConfig({ ...config, pay_element_overtime: e.target.value })} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
          <input type="checkbox" checked={config.lock_after_export} onChange={e => setConfig({ ...config, lock_after_export: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Lock timesheets after export</p>
            <p className="text-[11px] text-slate-500">Prevents the same week being exported twice into payroll</p>
          </div>
        </label>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          {saved && <Check className="w-4 h-4 text-white" />}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Export Queue Preview</h3>
        </div>
        <button onClick={handlePreview} disabled={previewing} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Preview Pending Timesheets
        </button>
        {preview && (
          <div className="mt-3">
            {preview.ok ? (
              <>
                <p className="text-xs text-slate-500 mb-2">{preview.count} approved weekly timesheet(s) ready to export.</p>
                <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold text-slate-600">Employee</th>
                        <th className="text-left p-2 font-semibold text-slate-600">Week</th>
                        <th className="text-right p-2 font-semibold text-slate-600">Std Hrs</th>
                        <th className="text-right p-2 font-semibold text-slate-600">OT Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2 text-slate-700">{r.employee_name}</td>
                          <td className="p-2 text-slate-500">{r.week_start}</td>
                          <td className="p-2 text-right text-slate-700 tabular-nums">{r.standard_hours}</td>
                          <td className="p-2 text-right text-slate-700 tabular-nums">{r.overtime_hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">{preview.message || 'No pending timesheets.'}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Generate Payroll File</h3>
        </div>
        <button onClick={handleDownload} disabled={downloading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Payroll CSV
        </button>
        <p className="text-[11px] text-slate-400 mt-2">Downloads a {config.provider === 'xero' ? 'Xero-format' : config.provider === 'sage' ? 'Sage 50-format' : 'generic'} CSV and locks all exported timesheets.</p>
        {msg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{msg.text}</div>
        )}
      </div>
    </div>
  );
}