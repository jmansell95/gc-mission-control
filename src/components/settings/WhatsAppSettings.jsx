import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Webhook, Copy, Shield, Send,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = {
  api_url: 'https://graph.facebook.com/v18.0',
  phone_number_id: '',
  business_account_id: '',
  api_token: '',
  webhook_secret: '',
  notify_job_cancelled: true,
  notify_rig_breakdown: true,
  notify_new_rota: true,
  notify_compliance_expired: true,
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
  last_webhook_at: null,
};

const WEBHOOK_RELATIVE = '/functions/whatsappWebhook';

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const genSecret = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

  const { data: settingsRec } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'whatsapp_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const webhookUrl = buildWebhookUrl(WEBHOOK_RELATIVE);
  const connected = !!(config.api_token && config.phone_number_id);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'whatsapp_config', label: 'WhatsApp Business API Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
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
      // Verify the token by fetching the phone number details
      const testUrl = `${config.api_url}/${config.phone_number_id}?access_token=${config.api_token}`;
      const res = await fetch(testUrl);
      const data = await res.json();
      if (data.id) {
        setTestResult({ ok: true, msg: `Connected — phone number "${data.display_phone_number || data.id}" is verified.` });
      } else {
        setTestResult({ ok: false, msg: data.error?.message || 'Invalid credentials — check your API token and phone number ID.' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setSendResult(null);
    try {
      const res = await base44.functions.invoke('sendCrewWhatsApp', { action: 'test', to: testPhone });
      const data = res?.data ?? res;
      setSendResult(data);
      if (data.ok) {
        toast({ title: 'Test message sent', description: 'WhatsApp message delivered successfully.' });
      } else {
        toast({ title: 'Send failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      setSendResult({ ok: false, error: e.message || 'Failed to send' });
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    }
    setSendingTest(false);
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
        icon={MessageCircle}
        title="WhatsApp Business API"
        description="Send critical alerts to crew members via WhatsApp Business API — job cancellations, rig breakdowns, new rota publications, and compliance expiry warnings. Configure your Meta Business Suite credentials and webhook below. Messages are sent instantly, cutting through email noise."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'WhatsApp Business API credentials saved — alerts can be sent.' : 'Enter your Meta Business Suite credentials below.'}</p>
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
          <h3 className="text-sm font-bold text-slate-800">Meta Business Suite Credentials</h3>
        </div>
        <p className="text-xs text-slate-500">Set up WhatsApp Business in the <code className="bg-slate-100 px-1 rounded">Meta Business Suite</code>. Go to WhatsApp Manager → API Setup to get your phone number ID and access token. The business account ID is in Meta Business Suite → Business Settings.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="text" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://graph.facebook.com/v18.0" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number ID</label>
            <input type="text" value={config.phone_number_id} onChange={e => setConfig({ ...config, phone_number_id: e.target.value })}
              placeholder="123456789012345" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Business Account ID</label>
            <input type="text" value={config.business_account_id} onChange={e => setConfig({ ...config, business_account_id: e.target.value })}
              placeholder="987654321" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Access Token</label>
            <input type="password" value={config.api_token} onChange={e => setConfig({ ...config, api_token: e.target.value })}
              placeholder="EAAG..." className={`${inputCls} font-mono`} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Alert preferences */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Alert Preferences</h3>
        </div>
        <p className="text-xs text-slate-500">Choose which events trigger a WhatsApp message to crew members.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'notify_job_cancelled', label: 'Job Cancelled', desc: 'When a job is cancelled or put on hold' },
            { key: 'notify_rig_breakdown', label: 'Rig / Plant Breakdown', desc: 'When a rig or vehicle breaks down' },
            { key: 'notify_new_rota', label: 'New Rota Published', desc: 'When the weekly rota is published' },
            { key: 'notify_compliance_expired', label: 'Compliance Expired', desc: 'When a staff member\'s ticket expires' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={config[item.key]} onChange={e => setConfig({ ...config, [item.key]: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#2E5A1A]" />
              <div>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Send test message */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Send Test Message</h3>
        </div>
        <p className="text-xs text-slate-500">Verify outbound messaging by sending a test WhatsApp message to a crew member's phone. Use international format (e.g. 447123456789).</p>
        <div className="flex gap-2">
          <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="447123456789" className={`${inputCls} font-mono`} />
          <button onClick={handleSendTest} disabled={sendingTest || !connected || !testPhone}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition flex-shrink-0">
            {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Test
          </button>
        </div>
        {sendResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${sendResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {sendResult.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
            <p>{sendResult.ok ? `Message sent — ID: ${sendResult.message_id || 'confirmed'}` : sendResult.error || 'Send failed'}</p>
          </div>
        )}
      </div>

      {/* Webhook receiver */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">Webhook Receiver</h3>
        </div>
        <p className="text-xs text-slate-500">Add this URL to your Meta App's WhatsApp webhook configuration. Subscribe to <code className="bg-slate-100 px-1 rounded">messages</code> and <code className="bg-slate-100 px-1 rounded">message_status</code> events to receive delivery receipts and inbound replies.</p>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={webhookUrl} className={`${inputCls} bg-slate-50 font-mono text-xs`} />
          <button onClick={handleCopyWebhook} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Verify Token</label>
          <div className="flex gap-2">
            <input type="text" value={config.webhook_secret} onChange={e => setConfig({ ...config, webhook_secret: e.target.value })}
              placeholder="Verify token for Meta webhook setup" className={`${inputCls} font-mono`} />
            <button onClick={() => setConfig({ ...config, webhook_secret: genSecret() })}
              className="flex items-center gap-1 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition flex-shrink-0">
              <Shield className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Enter this exact token in the Meta App webhook setup "Verify Token" field.</p>
        </div>
      </div>
    </div>
  );
}