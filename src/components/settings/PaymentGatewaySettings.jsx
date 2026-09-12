import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Webhook, Copy, Shield, Globe,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  secret_key: '',
  publishable_key: '',
  webhook_secret: '',
  currency: 'gbp',
  auto_mark_paid: true,
  portal_payments_enabled: true,
  last_webhook_at: null,
  last_webhook_status: null,
  last_webhook_summary: '',
};

const WEBHOOK_RELATIVE = '/functions/stripeWebhook';

export default function PaymentGatewaySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const genSecret = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  const { data: settingsRec } = useQuery({
    queryKey: ['stripe-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'stripe_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const webhookUrl = buildWebhookUrl(WEBHOOK_RELATIVE);
  const connected = !!config.secret_key;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'stripe_config', label: 'Stripe Payment Gateway Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['stripe-config'] });
      queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { 'Authorization': `Bearer ${config.secret_key}` },
      });
      if (res.ok) {
        const data = await res.json();
        const bal = data.available?.find(b => b.currency === 'gbp');
        setTestResult({ ok: true, msg: `Connected — Stripe account verified. Available balance: £${(bal?.amount || 0) / 100}` });
      } else {
        const data = await res.json();
        setTestResult({ ok: false, msg: data.error?.message || 'Invalid API key — check your secret key.' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={CreditCard}
        title="Stripe Payment Gateway"
        description="Accept client invoice payments directly in the client portal via Stripe. Clients click the Pay Invoice button on the portal, enter their card details, and the invoice is automatically marked as paid. Configure your Stripe API keys and webhook endpoint below."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Stripe API keys saved — clients can pay invoices in the portal.' : 'Enter your Stripe API keys below to enable portal payments.'}</p>
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
          <h3 className="text-sm font-bold text-slate-800">Stripe API Keys</h3>
        </div>
        <p className="text-xs text-slate-500">Get your API keys from the Stripe Dashboard under Developers then API Keys. Use the secret key for backend operations and the publishable key for the client portal checkout. Test keys (starting with sk_test_) work in the Stripe sandbox.</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Secret Key</label>
            <input type="password" value={config.secret_key} onChange={e => setConfig({ ...config, secret_key: e.target.value })}
              placeholder="sk_live_... or sk_test_..." className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Publishable Key</label>
            <input type="text" value={config.publishable_key} onChange={e => setConfig({ ...config, publishable_key: e.target.value })}
              placeholder="pk_live_... or pk_test_..." className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
            <select value={config.currency} onChange={e => setConfig({ ...config, currency: e.target.value })} className={inputCls}>
              <option value="gbp">GBP (£)</option>
              <option value="eur">EUR (€)</option>
              <option value="usd">USD ($)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.portal_payments_enabled} onChange={e => setConfig({ ...config, portal_payments_enabled: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-blue-600" /> Portal Payments</p>
              <p className="text-[11px] text-slate-400">Show Pay Invoice button on the client portal</p>
            </div>
          </label>
          <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.auto_mark_paid} onChange={e => setConfig({ ...config, auto_mark_paid: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /> Auto-Mark Paid</p>
              <p className="text-[11px] text-slate-400">Automatically mark invoices as paid when Stripe confirms payment</p>
            </div>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Webhook receiver */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Webhook Receiver</h3>
        </div>
        <p className="text-xs text-slate-500">Add this endpoint to your Stripe Dashboard under Developers then Webhooks. Subscribe to payment_intent.succeeded and invoice.payment_succeeded events to auto-mark invoices as paid.</p>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={webhookUrl} className={`${inputCls} bg-slate-50 font-mono text-xs`} />
          <button onClick={handleCopyWebhook} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Signing Secret</label>
          <div className="flex gap-2">
            <input type="text" value={config.webhook_secret} onChange={e => setConfig({ ...config, webhook_secret: e.target.value })}
              placeholder="whsec_..." className={`${inputCls} font-mono`} />
            <button onClick={() => setConfig({ ...config, webhook_secret: genSecret() })}
              className="flex items-center gap-1 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
              <Shield className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Find this in the Stripe Dashboard webhook endpoint details. Used to verify that webhook events come from Stripe.</p>
        </div>
        {config.last_webhook_at && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last webhook event</p>
            <p className="text-xs text-slate-500">{config.last_webhook_summary || 'No summary'}</p>
            <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_webhook_at).toLocaleString('en-GB')}</p>
          </div>
        )}
      </div>
    </div>
  );
}