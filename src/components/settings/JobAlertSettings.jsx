import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Loader2, Save, Check, AlertTriangle, Bell, Play } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  enabled: true,
  budget_overrun_pct: 10,
  min_margin_pct: 15,
  negative_profit_alert: true,
  recipient_emails: [],
};

/**
 * JobAlertSettings — automated budget & margin alerts for active jobs.
 * Admins configure thresholds (budget overrun %, minimum margin %, negative
 * profit), and the system emails an alert digest to admins when any active
 * job breaches them. A scheduled automation runs the check nightly.
 */
export default function JobAlertSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [recipientInput, setRecipientInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['job-alert-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'job_alert_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'job_alert_config', label: 'Job Budget Alert Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['job-alert-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setResult({ ok: false, msg: e.message || 'Save failed' }); }
    setSaving(false);
  };

  const handleAddRecipient = () => {
    const e = recipientInput.trim().toLowerCase();
    if (e && /\S+@\S+\.\S+/.test(e) && !config.recipient_emails.includes(e)) {
      setConfig({ ...config, recipient_emails: [...config.recipient_emails, e] });
      setRecipientInput('');
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('checkJobBudgetAlerts', { action: 'check' });
      const d = res.data || {};
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown', checked: d.checked, alerts: d.alerts, high: d.high_severity });
    } catch (e) { setResult({ ok: false, msg: e.message }); }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Gauge}
        title="Job Budget Alerts"
        description="Automated alerts when active jobs breach budget overrun, margin, or profit-loss thresholds. Runs nightly and emails a digest to admins."
      />

      {/* Enable toggle */}
      <label className="flex items-center gap-2.5 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer">
        <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Enable budget & margin alerts</p>
          <p className="text-[11px] text-slate-500">When on, the scheduled automation checks all active jobs nightly and emails a digest if any breach thresholds.</p>
        </div>
      </label>

      {/* Thresholds */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Alert Thresholds</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Budget Overrun (%)</label>
            <input type="number" value={config.budget_overrun_pct} onChange={e => setConfig({ ...config, budget_overrun_pct: Number(e.target.value) })} className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">Alert when job cost exceeds budget by this %.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Minimum Margin (%)</label>
            <input type="number" value={config.min_margin_pct} onChange={e => setConfig({ ...config, min_margin_pct: Number(e.target.value) })} className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">Alert when profit margin drops below this %.</p>
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-rose-50 rounded-lg border border-rose-200 cursor-pointer">
          <input type="checkbox" checked={config.negative_profit_alert} onChange={e => setConfig({ ...config, negative_profit_alert: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700">Alert on negative profit (loss-making jobs)</p>
            <p className="text-[11px] text-slate-500">Flags any active job where revenue does not cover cost.</p>
          </div>
        </label>

        {/* Recipients */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Alert Recipients (optional)</label>
          <p className="text-[11px] text-slate-400 mb-2">Leave empty to email all admin users. Add specific emails to override.</p>
          <div className="flex gap-2">
            <input value={recipientInput} onChange={e => setRecipientInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRecipient()} placeholder="email@example.com" className={inputCls} />
            <button onClick={handleAddRecipient} className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Add</button>
          </div>
          {config.recipient_emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {config.recipient_emails.map(e => (
                <span key={e} className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 text-xs">
                  {e}
                  <button onClick={() => setConfig({ ...config, recipient_emails: config.recipient_emails.filter(r => r !== e) })} className="text-slate-400 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          {saved && <Check className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Run now */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Play className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Run Check Now</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">Manually trigger the budget check across all active jobs. The nightly automation does this automatically.</p>
        <button onClick={handleRunNow} disabled={running} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Budget Check Now
        </button>
        {result && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {result.msg}</p>
            {result.ok && result.checked !== undefined && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Checked</p><p className="font-bold text-slate-700 tabular-nums">{result.checked}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Alerts</p><p className="font-bold text-amber-700 tabular-nums">{result.alerts}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">High</p><p className="font-bold text-rose-700 tabular-nums">{result.high}</p></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}