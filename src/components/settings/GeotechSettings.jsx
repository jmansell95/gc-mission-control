import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Database, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, UploadCloud, FileText, FileUp,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AGSAutoSyncSection from '@/components/keylogbook/AGSAutoSyncSection';
import MigrationHubTab from '@/components/settings/MigrationHubTab';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10';

const DEFAULT_OG_CONFIG = {
  token_url: 'https://ims.bentley.com/connect/token',
  api_url: 'https://api.bentley.com/geotechnical/imports',
  scope: 'geotechnical:modify',
  client_id: '',
  client_secret: '',
  project_id: '',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

/**
 * Streamlined Geotechnical settings — KeyLogBook (AGS import + auto-sync)
 * and OpenGround push sync on one clean page. Verbose help text collapsed
 * to single info lines; connection status, credentials, and last-sync all
 * visible without scrolling through walls of text.
 */
export default function GeotechSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Manual AGS upload ──
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-geotech'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const handleFile = (e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(''); };

  const runImport = async (force = false) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await base44.functions.invoke('importAGS', { file, job_id: jobId || null, force });
      setResult(res.data);
      toast({ title: 'AGS data imported', description: `${res.data.inserted} log entries added to ${res.data.job_name}.` });
      setFile(null);
    } catch (err) {
      const errData = err?.response?.data || err?.data || {};
      if (errData.needsConfirmation) {
        setConfirmOverwrite({ existingCount: errData.existingCount, newCount: errData.newCount });
      } else {
        setError(errData.error || err?.message || 'Import failed');
      }
    } finally { setBusy(false); }
  };

  // ── OpenGround config ──
  const [ogConfig, setOgConfig] = useState(DEFAULT_OG_CONFIG);
  const [ogSaving, setOgSaving] = useState(false);
  const [ogSaved, setOgSaved] = useState(false);
  const [ogTesting, setOgTesting] = useState(false);
  const [ogTestResult, setOgTestResult] = useState(null);

  const { data: ogSettingsRec } = useQuery({
    queryKey: ['openground-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'openground_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (ogSettingsRec?.[0]?.value) setOgConfig({ ...DEFAULT_OG_CONFIG, ...ogSettingsRec[0].value });
  }, [ogSettingsRec]);

  const ogConfigId = ogSettingsRec?.[0]?.id;
  const ogConnected = !!(ogConfig.client_id && ogConfig.client_secret);

  const handleOgSave = async () => {
    setOgSaving(true); setOgSaved(false);
    try {
      const payload = { key: 'openground_config', label: 'OpenGround Sync Configuration', value: ogConfig };
      if (ogConfigId) await base44.entities.AppSetting.update(ogConfigId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['openground-config'] });
      setOgSaved(true);
      setTimeout(() => setOgSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' });
    }
    setOgSaving(false);
  };

  const handleOgTest = async () => {
    setOgTesting(true); setOgTestResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { action: 'test' });
      const d = res.data || res;
      setOgTestResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown response' });
    } catch (e) {
      const d = e.response?.data || e;
      setOgTestResult({ ok: false, msg: d.error || d.message || e.message || 'Connection test failed' });
    }
    setOgTesting(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Geotechnical"
        description="KeyLogBook AGS sync and Bentley OpenGround push — borehole data flows in, approved logs push out."
        icon={Database}
      />

      <Tabs defaultValue="geotech" className="w-full">
        <TabsList className="mb-4 grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="geotech">Geotech Settings</TabsTrigger>
          <TabsTrigger value="migration">Migration Hub</TabsTrigger>
        </TabsList>
        <TabsContent value="geotech" className="space-y-5 focus:outline-none">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── KeyLogBook section ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
              <FileUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">KeyLogBook</h3>
              <p className="text-xs text-slate-500">AGS borehole data sync</p>
            </div>
          </div>
          <AGSAutoSyncSection />
        </div>

        {/* ── OpenGround section ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">OpenGround</h3>
              <p className="text-xs text-slate-500">Push approved logs to Bentley</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            {/* Connection status */}
            <div className={`rounded-xl border p-3.5 ${ogConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ogConnected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                  {ogConnected ? <Link2 className="w-4 h-4 text-emerald-600" /> : <Link2Off className="w-4 h-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{ogConnected ? 'Configured' : 'Not Connected'}</p>
                  <p className="text-xs text-slate-500">{ogConnected ? 'Test the connection or push from Log QC.' : 'Enter credentials below to enable push.'}</p>
                </div>
                <button onClick={handleOgTest} disabled={ogTesting || !ogConnected}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                  {ogTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test
                </button>
              </div>
              {ogTestResult && (
                <div className={`mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${ogTestResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>{ogTestResult.msg}</p>
                </div>
              )}
            </div>

            {/* Credentials — compact */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
                  <input type="text" value={ogConfig.client_id} onChange={e => setOgConfig({ ...ogConfig, client_id: e.target.value })}
                    placeholder="Bentley service app client ID" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
                  <input type="password" value={ogConfig.client_secret} onChange={e => setOgConfig({ ...ogConfig, client_secret: e.target.value })}
                    placeholder="••••••••" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Project ID</label>
                  <input type="text" value={ogConfig.project_id} onChange={e => setOgConfig({ ...ogConfig, project_id: e.target.value })}
                    placeholder="OpenGround project ID" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
                  <input type="text" value={ogConfig.scope} onChange={e => setOgConfig({ ...ogConfig, scope: e.target.value })}
                    placeholder="geotechnical:modify" className={`${inputCls} font-mono`} />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Credentials from the <a href="https://developer.bentley.com/apis/geotechnical/" target="_blank" rel="noopener" className="text-blue-600 underline">Bentley Developer portal</a>. Token & API URLs default to Bentley endpoints — only change if your org uses a custom endpoint.
              </p>
            </div>

            {/* Save + last sync */}
            <div className="flex items-center gap-2">
              <button onClick={handleOgSave} disabled={ogSaving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
                {ogSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              {ogSaved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
              {ogConfig.last_sync_at && (
                <span className="text-[11px] text-slate-400 ml-auto">
                  Last sync: {new Date(ogConfig.last_sync_at).toLocaleString('en-GB')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Manual AGS upload ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Manual AGS Upload</h3>
          <span className="text-xs text-slate-400">— re-import a file or upload if auto-sync isn't set up</span>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" /> Target job (optional)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">Leave blank to auto-match by job reference against the AGS <code className="text-slate-600">PROJ_ID</code>.</p>
          <select value={jobId} onChange={e => setJobId(e.target.value)} disabled={busy}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
            <option value="">Auto-match by job reference</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.job_reference ? ` · ${j.job_reference}` : ''}</option>)}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className={`flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'} ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
            <FileText className={`w-5 h-5 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-600 truncate">{file ? file.name : 'Choose .ags file…'}</span>
            <input type="file" accept=".ags,.txt,.csv" onChange={handleFile} className="hidden" />
          </label>
          <button onClick={() => { setConfirmOverwrite(null); runImport(false); }} disabled={!file || busy}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {busy ? 'Importing…' : 'Import AGS data'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">
                Imported {result.inserted} log entries into {result.job_name}
                {result.deleted > 0 && <span className="text-emerald-600 font-normal"> · replaced {result.deleted} previous entries</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
              {[
                { label: 'Boreholes', value: result.counts?.locations },
                { label: 'Strata', value: result.counts?.strata },
                { label: 'Core', value: result.counts?.core },
                { label: 'Samples', value: result.counts?.samples },
                { label: 'SPT', value: result.counts?.spt },
                { label: 'Installations', value: result.counts?.installations },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg border border-emerald-100 px-2.5 py-2 text-center">
                  <p className="text-base font-extrabold text-emerald-700 tabular-nums">{s.value || 0}</p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            {result.counts?.remarks > 0 && (
              <p className="text-xs text-emerald-700 pt-1">
                <span className="font-semibold">{result.counts.remarks}</span> driller activities parsed — pending review in Site Logs.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Overwrite safeguard confirmation dialog */}
      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Replace existing AGS data?</h2>
                <p className="text-sm text-slate-600 mt-1">
                  This file contains <strong className="text-slate-900">{confirmOverwrite.newCount}</strong> entries,
                  but <strong className="text-slate-900">{confirmOverwrite.existingCount}</strong> already exist for these boreholes.
                  Re-importing will <span className="text-red-600 font-medium">permanently delete</span> the existing data and replace it.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              This often happens when the AGS export only covers one borehole or one day. Check with the driller if a more complete export is available.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmOverwrite(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button onClick={() => { setConfirmOverwrite(null); runImport(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition">
                <UploadCloud className="w-4 h-4" /> Replace & Import
              </button>
            </div>
          </div>
        </div>
      )}

        </TabsContent>
        <TabsContent value="migration" className="focus:outline-none">
          <MigrationHubTab />
        </TabsContent>
      </Tabs>

    </div>
  );
}