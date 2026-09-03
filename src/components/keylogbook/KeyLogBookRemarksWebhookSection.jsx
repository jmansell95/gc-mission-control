import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';
import { useToast } from '@/components/ui/use-toast';
import {
  Radio, KeyRound, Link2, ToggleLeft, ToggleRight, Power,
  CheckCircle2, AlertCircle, Loader2, Copy, Send, User,
} from 'lucide-react';

function generateToken(prefix = 'klb_rem') {
  const chars = '0123456789abcdef';
  let s = `${prefix}_`;
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * KeyLogBook Real-Time Remarks Webhook config + connection test.
 *
 * This is the LIVE driller-remarks webhook (receiveKeyLogBookData) — separate
 * from the AGS file webhook. When KeyLogBook sends a driller's time-stamped
 * daily diary here, it creates site activity logs with accurate start/end
 * times and the driller's name, then auto-generates a timesheet.
 */
export default function KeyLogBookRemarksWebhookSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['keylogbook-config'],
    queryFn: async () => {
      const list = await base44.entities.KeyLogBookConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  useEffect(() => {
    if (config) {
      setEnabled(!!config.enabled);
      setWebhookSecret(config.webhook_secret || '');
    }
  }, [config]);

  const appBaseUrl = CANONICAL_APP_BASE_URL;
  const webhookUrl = `${appBaseUrl}/functions/receiveKeyLogBookData`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled,
        webhook_secret: webhookSecret.trim(),
      };
      if (config?.id) {
        await base44.entities.KeyLogBookConfig.update(config.id, payload);
      } else {
        await base44.entities.KeyLogBookConfig.create({ key: 'global', ...payload });
      }
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
      toast({ title: 'Remarks webhook saved', description: 'Configuration updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleCopy = (field, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateSecret = () => setWebhookSecret(generateToken('klb_rem'));

  const handleTest = async () => {
    if (!webhookSecret.trim()) {
      toast({ title: 'No secret set', description: 'Generate and save a webhook secret first.', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const testPayload = {
        job_reference: 'TEST',
        date: new Date().toISOString().slice(0, 10),
        lead_driller_name: 'Connection Test',
        remarks: '08:00_08:01 = Webhook connection test (safe to ignore)',
      };
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-klb-signature': webhookSecret.trim(),
        },
        body: JSON.stringify(testPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || data.error === 'Could not match an existing job.') {
        setTestResult({
          ok: true,
          message: 'Webhook is reachable and the secret was accepted. (Test payload skipped — no "TEST" job exists, which is expected.)',
        });
      } else if (res.status === 401 || res.status === 403) {
        setTestResult({
          ok: false,
          message: data.error || 'Rejected — check the secret matches and sync is enabled.',
        });
      } else {
        setTestResult({ ok: false, message: data.error || `HTTP ${res.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'Network error — the endpoint may be unreachable.' });
    }
    setTesting(false);
  };

  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Last remarks webhook processed successfully' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Last remarks webhook failed' },
    never: { icon: Radio, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No remarks webhooks received yet' },
  };
  const lastStatus = config?.last_webhook_status || 'never';
  const StatusIcon = statusConfig[lastStatus].icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
          <Radio className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Real-Time Remarks Webhook</h3>
          <p className="text-xs text-slate-500">
            KeyLogBook pushes the driller's live time-stamped daily diary here throughout the day — creates site activity logs with accurate clock times and auto-generates the timesheet.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <Power className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Enable remarks webhook</p>
            <p className="text-xs text-slate-500">Master switch — incoming driller remarks are rejected when off.</p>
          </div>
        </div>
        <button type="button" onClick={() => setEnabled(!enabled)}
          className={`flex-shrink-0 transition ${enabled ? 'text-[#2E5A1A]' : 'text-slate-300'}`}>
          {enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>

      {/* Webhook endpoint URL */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-4 h-4 text-slate-400" /> Webhook endpoint URL
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Give this URL to your KeyLogBook developer. This is separate from the AGS webhook — it receives the driller's real-time remarks.
        </p>
        {webhookUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-slate-900 text-emerald-300 rounded-lg text-xs font-mono break-all">
              {webhookUrl}
            </code>
            <button type="button" onClick={() => handleCopy('rem-url', webhookUrl)}
              className="flex-shrink-0 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title="Copy URL">
              {copiedField === 'rem-url' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Set your app's public base URL in <strong>Settings → Global Branding</strong> to generate the webhook URL.
            </p>
          </div>
        )}
      </div>

      {/* Webhook secret */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <KeyRound className="w-4 h-4 text-slate-400" /> Webhook secret
        </label>
        <p className="text-xs text-slate-500 mb-2">
          KeyLogBook sends this in the <code className="text-slate-600 bg-slate-100 px-1 rounded">x-klb-signature</code> header (or <code className="text-slate-600 bg-slate-100 px-1 rounded">?secret=</code> query param). Enter the same value in your KLB webhook settings.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input type={showSecret ? 'text' : 'password'} value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
              placeholder="Click generate to create a secure secret"
              className="w-full px-3 py-2.5 pr-20 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#2E5A1A] bg-white" />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button type="button" onClick={() => setShowSecret(!showSecret)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title={showSecret ? 'Hide' : 'Show'}>
                {showSecret ? <span className="text-xs">Hide</span> : <span className="text-xs">Show</span>}
              </button>
              <button type="button" onClick={() => handleCopy('rem-secret', webhookSecret)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Copy">
                {copiedField === 'rem-secret' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button type="button" onClick={handleGenerateSecret}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-emerald-100 text-[#2E5A1A] rounded-lg text-xs font-semibold hover:bg-emerald-200 transition">
            Generate
          </button>
        </div>
      </div>

      {/* Connection test */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[#2E5A1A]" />
          <h4 className="text-sm font-bold text-slate-900">Connection Test</h4>
          <span className="text-xs text-slate-400">— verify the endpoint is reachable and the secret is accepted</span>
        </div>
        <button type="button" onClick={handleTest} disabled={testing || !webhookSecret.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition">
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {testing ? 'Sending test…' : 'Send Test Webhook'}
        </button>
        {testResult && (
          <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${testResult.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />}
            <p className="text-xs text-slate-700">{testResult.message}</p>
          </div>
        )}
      </div>

      {/* Last webhook status */}
      {config?.last_webhook_at && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{statusConfig[lastStatus].label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{new Date(config.last_webhook_at).toLocaleString('en-GB')}</p>
            {config.last_webhook_summary && <p className="text-xs text-slate-600 mt-1">{config.last_webhook_summary}</p>}
          </div>
        </div>
      )}

      {/* Waiting state */}
      {!config?.last_webhook_at && enabled && (
        <div className="flex items-center gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
          <Radio className="w-4 h-4 text-blue-500 flex-shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-800">Waiting for first remarks webhook…</p>
            <p className="text-xs text-blue-600 mt-0.5">Sync is enabled. Once KeyLogBook starts sending driller remarks, the last status will appear here.</p>
          </div>
        </div>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={saving || isLoading}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Remarks Webhook'}
      </button>

      {/* Developer instructions */}
      <div className="bg-slate-900 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Give this to your KeyLogBook developer:
        </p>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">URL:</span><span className="text-slate-300 break-all">{webhookUrl || '<endpoint URL>'}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Method:</span><span className="text-slate-300">POST</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Auth:</span><span className="text-slate-300">x-klb-signature: {webhookSecret ? '••••••' : '<secret>'}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Body:</span><span className="text-slate-300">JSON — job_reference, date, lead_driller_name, remarks</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Remarks:</span><span className="text-slate-300">"7:30_8:45 = Start briefing... 8:45_9:00 = ..."</span></div>
        </div>
      </div>
    </div>
  );
}