import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';
import { useToast } from '@/components/ui/use-toast';
import {
  Zap, KeyRound, Link2, ToggleLeft, ToggleRight, Clock,
  CheckCircle2, AlertCircle, Loader2, Copy, Power, Radio,
  ShieldCheck, FileCode, Webhook, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import KeyLogBookSyncTest from './KeyLogBookSyncTest';
import KeyLogBookWebhookLogViewer from './KeyLogBookWebhookLogViewer';

function generateToken(prefix = 'klb') {
  const chars = '0123456789abcdef';
  let s = `${prefix}_`;
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

export default function AGSAutoSyncSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [bearerToken, setBearerToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [signingEnabled, setSigningEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSigning, setShowSigning] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['keylogbook-config'],
    queryFn: async () => {
      const list = await base44.entities.KeyLogBookConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  const { data: appSetting } = useQuery({
    queryKey: ['app-setting'],
    queryFn: async () => {
      const list = await base44.entities.AppSetting.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  useEffect(() => {
    if (config) {
      setBearerToken(config.ags_sync_secret || '');
      setSigningSecret(config.ags_webhook_signing_secret || '');
      setSigningEnabled(!!config.ags_webhook_signing_enabled);
      setEnabled(!!config.ags_sync_enabled);
    }
  }, [config]);

  const appBaseUrl = CANONICAL_APP_BASE_URL;
  const webhookUrl = `${appBaseUrl}/functions/importAGS`;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ags_sync_secret: bearerToken.trim(),
        ags_webhook_signing_secret: signingSecret.trim(),
        ags_webhook_signing_enabled: signingEnabled,
        ags_sync_enabled: enabled,
        ags_webhook_auth_method: 'bearer',
      };
      if (config?.id) {
        await base44.entities.KeyLogBookConfig.update(config.id, payload);
      } else {
        await base44.entities.KeyLogBookConfig.create({ key: 'global', ...payload });
      }
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
      toast({ title: 'Webhook settings saved', description: 'Configuration updated.' });
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

  const handleGenerateToken = () => setBearerToken(generateToken('klb'));
  const handleGenerateSigning = () => setSigningSecret(generateToken('klb_sig'));

  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Last webhook processed successfully' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Last webhook failed' },
    never: { icon: Radio, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No webhooks received yet' },
  };
  const lastStatus = config?.last_ags_sync_status || 'never';
  const StatusIcon = statusConfig[lastStatus].icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Webhook className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">KeyLogBook Webhook</h3>
          <p className="text-xs text-slate-500">
            The single KeyLogBook endpoint — handles borehole data AND the driller's daily diary/remarks. KeyLogBook pushes an AGS file whenever a hole is created, updated, or deleted; remarks are auto-priced and a draft timesheet is generated on receipt.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <Power className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Enable AGS webhook sync</p>
            <p className="text-xs text-slate-500">Master switch — incoming webhooks are rejected when off.</p>
          </div>
        </div>
        <button type="button" onClick={() => setEnabled(!enabled)}
          className={`flex-shrink-0 transition ${enabled ? 'text-amber-600' : 'text-slate-300'}`}>
          {enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>

      {/* Webhook endpoint URL */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-4 h-4 text-slate-400" /> Webhook endpoint URL
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Give this URL to your KeyLogBook developer. They configure it in their KLB webhook settings to receive hole events.
        </p>
        {webhookUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-slate-900 text-amber-300 rounded-lg text-xs font-mono break-all">
              {webhookUrl}
            </code>
            <button type="button" onClick={() => handleCopy('url', webhookUrl)}
              className="flex-shrink-0 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title="Copy URL">
              {copiedField === 'url' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Set your app's public base URL in <strong>Settings → Global Branding</strong> to generate the webhook URL automatically.
            </p>
          </div>
        )}
      </div>

      {/* Bearer token */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <KeyRound className="w-4 h-4 text-slate-400" /> Bearer token (authentication)
        </label>
        <p className="text-xs text-slate-500 mb-2">
          KeyLogBook sends this in the <code className="text-slate-600 bg-slate-100 px-1 rounded">Authorization: Bearer</code> header with every webhook. Enter the same value in your KLB webhook auth settings.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input type={showToken ? 'text' : 'password'} value={bearerToken} onChange={e => setBearerToken(e.target.value)}
              placeholder="Click generate to create a secure token"
              className="w-full px-3 py-2.5 pr-20 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-600 bg-white" />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button type="button" onClick={() => setShowToken(!showToken)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title={showToken ? 'Hide' : 'Show'}>
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => handleCopy('token', bearerToken)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Copy">
                {copiedField === 'token' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <button type="button" onClick={handleGenerateToken}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Generate
          </button>
        </div>
      </div>

      {/* Request signing (HMAC-SHA256) */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Request signing (HMAC-SHA256)</p>
              <p className="text-xs text-slate-500">Verify each webhook genuinely came from KeyLogBook. Recommended for security.</p>
            </div>
          </div>
          <button type="button" onClick={() => setSigningEnabled(!signingEnabled)}
            className={`flex-shrink-0 transition ${signingEnabled ? 'text-amber-600' : 'text-slate-300'}`}>
            {signingEnabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
          </button>
        </div>
        {signingEnabled && (
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Enter the signing secret that KeyLogBook generated for your webhook. The receiver independently calculates the HMAC-SHA256 signature and rejects mismatches.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input type={showSigning ? 'text' : 'password'} value={signingSecret} onChange={e => setSigningSecret(e.target.value)}
                  placeholder="Paste the KLB signing secret here"
                  className="w-full px-3 py-2.5 pr-20 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-600 bg-white" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button type="button" onClick={() => setShowSigning(!showSigning)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                    {showSigning ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => handleCopy('signing', signingSecret)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
                    {copiedField === 'signing' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={handleGenerateSigning}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition">
                <RefreshCw className="w-3.5 h-3.5" /> Generate
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">If you generate a secret here, enter it in your KLB webhook request-signing settings.</p>
          </div>
        )}
      </div>

      {/* Event types */}
      <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5 mb-1.5">
          <FileCode className="w-4 h-4" /> Event types to subscribe to
        </p>
        <p className="text-xs text-blue-700 mb-2">Tell your KeyLogBook developer to configure the webhook for these events:</p>
        <div className="flex flex-wrap gap-2">
          {['hole_created', 'hole_updated', 'hole_deleted'].map(evt => (
            <span key={evt} className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-mono font-semibold">
              {evt}
            </span>
          ))}
        </div>
      </div>

      {/* Last sync status */}
      {config?.last_ags_sync_at && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{statusConfig[lastStatus].label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{new Date(config.last_ags_sync_at).toLocaleString('en-GB')}</p>
            {config.last_ags_sync_summary && <p className="text-xs text-slate-600 mt-1">{config.last_ags_sync_summary}</p>}
          </div>
        </div>
      )}

      {/* Waiting state */}
      {!config?.last_ags_sync_at && enabled && (
        <div className="flex items-center gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
          <Radio className="w-4 h-4 text-blue-500 flex-shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-800">Waiting for first webhook…</p>
            <p className="text-xs text-blue-600 mt-0.5">Sync is enabled. Once KeyLogBook starts sending events, the last sync status will appear here.</p>
          </div>
        </div>
      )}

      {/* Manual test sync */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-slate-900">Test Sync</h4>
          <span className="text-xs text-slate-400">— verify your credentials are working</span>
        </div>
        <KeyLogBookSyncTest config={config} />
      </div>

      {/* Recent webhook requests */}
      <KeyLogBookWebhookLogViewer />

      {/* Save button */}
      <button onClick={handleSave} disabled={saving || isLoading}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Developer instructions */}
      <div className="bg-slate-900 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-300 mb-1.5 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> Give this to your KeyLogBook developer:
        </p>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">URL:</span><span className="text-slate-300 break-all">{webhookUrl || '<endpoint URL>'}</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Method:</span><span className="text-slate-300">POST</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Auth:</span><span className="text-slate-300">Authorization: Bearer {bearerToken ? '••••••' : '<token>'}</span></div>
          {signingEnabled && signingSecret && (
            <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Signing:</span><span className="text-slate-300">X-Hole-Signature: sha256=••••••</span></div>
          )}
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Events:</span><span className="text-slate-300">hole_created, hole_updated, hole_deleted</span></div>
          <div className="flex gap-2"><span className="text-slate-500 w-16 flex-shrink-0">Body:</span><span className="text-slate-300">JSON — event_type, hole_id, project_name, project_number, ags_file (Base64)</span></div>
        </div>
      </div>
    </div>
  );
}