import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, UploadCloud, FileUp,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
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

export default function OpenGroundSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['openground-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'openground_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const connected = !!(config.client_id && config.client_secret);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'openground_config', label: 'OpenGround Sync Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['openground-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('syncOpenGround', { action: 'test' });
      const d = res.data || res;
      setTestResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown response' });
    } catch (e) {
      const d = e.response?.data || e;
      setTestResult({ ok: false, msg: d.error || d.message || e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Database}
        title="OpenGround Sync"
        description="Push approved borehole logs directly to your Bentley OpenGround cloud database. Review logs in Log QC, then sync — no manual AGS file downloads or browser uploads needed. Credentials are stored securely and used only for API calls."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'OpenGround API credentials saved — test the connection or push logs from Log QC.' : 'Enter your OpenGround API credentials below to enable direct data push.'}</p>
          </div>
          <button onClick={handleTest} disabled={testing || !connected}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>{testResult.msg}</p>
          </div>
        )}
      </div>

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">OpenGround API Credentials</h3>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-blue-800">How to get these credentials:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            <li>Log in to the <a href="https://connect.bentley.com" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">Bentley CONNECTION Client</a> or your organisation's OpenGround admin portal</li>
            <li>Register a <span className="font-medium">Service Application</span> in the Bentley Developer portal to get a <span className="font-medium">Client ID</span> and <span className="font-medium">Client Secret</span></li>
            <li>The <span className="font-medium">Project ID</span> is your OpenGround project's unique identifier (found in the project settings in OpenGround)</li>
            <li>Leave the Token URL and API URL at their defaults unless your organisation uses a custom Bentley endpoint</li>
          </ol>
          <p className="pt-1">Full API docs: <a href="https://developer.bentley.com/apis/geotechnical/" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">Bentley Geotechnical API Reference</a></p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
            <input type="text" value={config.client_id} onChange={e => setConfig({ ...config, client_id: e.target.value })}
              placeholder="Your Bentley service app client ID" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
            <input type="password" value={config.client_secret} onChange={e => setConfig({ ...config, client_secret: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project ID</label>
            <input type="text" value={config.project_id} onChange={e => setConfig({ ...config, project_id: e.target.value })}
              placeholder="Your OpenGround project ID" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">Found in OpenGround project settings. Sent as the X-Project-Id header.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
            <input type="text" value={config.scope} onChange={e => setConfig({ ...config, scope: e.target.value })}
              placeholder="geotechnical:modify" className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">OAuth2 scope for the token request. Default is geotechnical:modify.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Token URL (OAuth2)</label>
            <input type="text" value={config.token_url} onChange={e => setConfig({ ...config, token_url: e.target.value })}
              placeholder={DEFAULT_CONFIG.token_url} className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">Bentley IMS token endpoint. Leave at default unless instructed.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API URL (Import Endpoint)</label>
            <input type="text" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder={DEFAULT_CONFIG.api_url} className={`${inputCls} font-mono`} />
            <p className="text-[10px] text-slate-400 mt-1">Bentley Geotechnical import endpoint. Leave at default unless instructed.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <UploadCloud className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">How Push-to-OpenGround Works</h3>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p>Field crews log borehole progress, samples, SPTs and installations via the staff app or KeyLogBook.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p>A manager reviews and <span className="font-medium">approves</span> each log in Log QC (Compliance → Log QC tab).</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p>In Log QC, select a job and click <span className="font-medium">Push to OpenGround</span> — the system builds a complete AGS v3.1 file and uploads it directly to your OpenGround database via the Bentley API.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <p>The Senior Engineer sees the data in OpenGround immediately — no manual file downloads or browser uploads.</p>
          </div>
        </div>
        {!connected && <p className="text-[11px] text-amber-600 mt-3">Save your OpenGround credentials first to enable the push button in Log QC.</p>}
      </div>

      {/* Last sync info */}
      {(config.last_sync_at || config.last_sync_status) && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
          <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
          {config.last_sync_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>}
        </div>
      )}
    </div>
  );
}