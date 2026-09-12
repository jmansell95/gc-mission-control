import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Webhook, Plus, Trash2, Loader2, Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Zapier / Make Webhook Integration — register outbound webhook URLs
// that receive system events for no-code automation.

const EVENT_TYPES = [
  { id: 'job.created', label: 'Job Created' },
  { id: 'job.status_changed', label: 'Job Status Changed' },
  { id: 'job.completed', label: 'Job Completed' },
  { id: 'rota.published', label: 'Rota Published' },
  { id: 'rota.assignment_created', label: 'Rota Assignment Created' },
  { id: 'timesheet.submitted', label: 'Timesheet Submitted' },
  { id: 'timesheet.approved', label: 'Timesheet Approved' },
  { id: 'delivery.completed', label: 'Delivery Completed' },
  { id: 'invoice.generated', label: 'Invoice Generated' },
  { id: 'invoice.paid', label: 'Invoice Paid' },
  { id: 'compliance.expired', label: 'Compliance Expired' },
  { id: 'maintenance.booking_created', label: 'Maintenance Booking Created' },
  { id: 'asset.returned', label: 'Asset Returned' },
];

export default function ZapierWebhookSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { refetch } = useQuery({
    queryKey: ['zapier-webhook-config'],
    queryFn: async () => {
      const res = await base44.entities.AppSetting.filter({ key: 'zapier_webhooks' });
      const records = res.data || res || [];
      const config = records[0]?.value || { webhooks: [] };
      setWebhooks(config.webhooks || []);
      setLoading(false);
      return records[0];
    },
  });

  const saveConfig = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'zapier_webhooks' });
      const records = (existing.data || existing || []);
      const payload = { key: 'zapier_webhooks', label: 'Zapier/Make Webhooks', value: { webhooks } };
      if (records[0]) {
        await base44.entities.AppSetting.update(records[0].id, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      toast({ title: '✓ Webhook configuration saved' });
      queryClient.invalidateQueries({ queryKey: ['zapier-webhook-config'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async (url) => {
    setTesting(true);
    try {
      const payload = { event: 'test', data: { message: 'Test from GC Mission Control', timestamp: new Date().toISOString() }, entity_id: null };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ title: `Test sent — HTTP ${res.status}` });
    } catch (err) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const addWebhook = () => {
    setWebhooks([...webhooks, { url: '', events: [], is_active: true, label: '' }]);
  };

  const updateWebhook = (idx, field, value) => {
    setWebhooks(webhooks.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  };

  const removeWebhook = (idx) => {
    setWebhooks(webhooks.filter((_, i) => i !== idx));
  };

  const toggleEvent = (idx, eventId) => {
    setWebhooks(webhooks.map((w, i) => {
      if (i !== idx) return w;
      const events = w.events || [];
      return { ...w, events: events.includes(eventId) ? events.filter(e => e !== eventId) : [...events, eventId] };
    }));
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>;

  return (
    <div>
      <SettingsSectionHeader
        icon={Webhook}
        title="Zapier / Make Webhook Integration"
        description="Register outbound webhook URLs to receive system events for no-code automation with Zapier, Make (Integromat), n8n, and similar tools."
        actions={
          <div className="flex gap-2">
            <Button onClick={addWebhook} variant="outline" className="gap-1"><Plus className="w-4 h-4" /> Add Webhook</Button>
            <Button onClick={saveConfig} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="hub-glass rounded-2xl p-8 text-center">
            <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No webhooks registered</p>
            <p className="text-xs text-slate-400 mt-1">Add a webhook URL from Zapier, Make, or n8n to start receiving events.</p>
          </div>
        ) : webhooks.map((w, idx) => (
          <div key={idx} className="hub-glass rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-violet flex items-center justify-center flex-shrink-0">
                <Webhook className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <input value={w.label || ''} onChange={e => updateWebhook(idx, 'label', e.target.value)}
                  placeholder="Webhook label (e.g. 'Zapier - Slack alerts')"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold mb-1.5" />
                <input value={w.url} onChange={e => updateWebhook(idx, 'url', e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-xs" />
              </div>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={w.is_active} onChange={e => updateWebhook(idx, 'is_active', e.target.checked)} className="rounded" />
                  Active
                </label>
                <button onClick={() => testWebhook(w.url)} disabled={!w.url || testing}
                  className="p-1.5 rounded hover:bg-blue-50 transition disabled:opacity-30" title="Test webhook">
                  <Send className="w-4 h-4 text-blue-500" />
                </button>
                <button onClick={() => removeWebhook(idx)} className="p-1.5 rounded hover:bg-rose-50">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">Events to forward (empty = all events):</p>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map(ev => (
                  <button key={ev.id} onClick={() => toggleEvent(idx, ev.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                      (w.events || []).includes(ev.id)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {ev.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hub-glass rounded-2xl p-4 mt-4 bg-slate-50/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong>How it works:</strong> When a system event fires (e.g. a job is created, a timesheet is submitted),
          the backend calls the <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">zapierWebhook</code> function
          with the event name and payload. The function forwards it to all matching active webhook URLs as a POST request
          with a JSON body: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{'{ event, entity_id, data, timestamp, source }'}</code>.
          Use this in Zapier/Make to trigger any automation workflow.
        </p>
      </div>
    </div>
  );
}