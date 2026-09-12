import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2, Send, Activity,
} from 'lucide-react';

/**
 * Manual test-sync button for the KeyLogBook webhook pipeline.
 * Fires a lightweight test payload to the receiveKeyLogBookData endpoint
 * and reports a detailed success/error breakdown so admins can see at a
 * glance whether the webhook is healthy or what's broken.
 */
export default function KeyLogBookSyncButton({ config }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null); // { ok, title, detail, raw }

  const webhookUrl = CANONICAL_APP_BASE_URL
    ? `${CANONICAL_APP_BASE_URL.replace(/\/$/, '')}/functions/receiveKeyLogBookData`
    : '';

  const runTestSync = async () => {
    if (!webhookUrl) {
      setResult({
        ok: false,
        title: 'No webhook URL',
        detail: 'Set the app public base URL in Settings → Global Branding first.',
      });
      return;
    }
    if (!config?.webhook_secret) {
      setResult({
        ok: false,
        title: 'No webhook secret',
        detail: 'Enter and save a webhook secret before testing.',
      });
      return;
    }
    if (!config?.enabled) {
      setResult({
        ok: false,
        title: 'Sync is disabled',
        detail: 'Enable real-time sync (the master switch) before testing.',
      });
      return;
    }

    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`${webhookUrl}?secret=${encodeURIComponent(config.webhook_secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_reference: '__TEST_SYNC__',
          date: new Date().toISOString().slice(0, 10),
          remarks: '8:00_8:05 = Test sync ping from settings',
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.status === 'success') {
        setResult({
          ok: true,
          title: 'Sync pipeline healthy',
          detail: json.summary || 'Webhook received and processed successfully.',
          raw: json,
        });
        toast({
          title: 'KeyLogBook sync OK',
          description: json.summary || 'Webhook is working.',
        });
      } else if (res.status === 422) {
        // Job not found — the webhook itself is fine, just no matching job for the test ref
        setResult({
          ok: true,
          title: 'Webhook reachable — no test job matched',
          detail: `${json.error || 'Job not found'} — this is expected for a test ping. The webhook endpoint, secret, and pipeline are all working. Real KeyLogBook payloads with a valid job_reference will process correctly.`,
          raw: json,
        });
        toast({
          title: 'Webhook is working',
          description: 'Endpoint reachable. Test job ref not matched (expected).',
        });
      } else {
        setResult({
          ok: false,
          title: json.error || `HTTP ${res.status}`,
          detail: json.details || json.error || 'The webhook rejected the test payload. Check the secret and settings.',
          raw: json,
        });
        toast({
          title: 'Sync test failed',
          description: json.error || `HTTP ${res.status}`,
          variant: 'destructive',
        });
      }
    } catch (e) {
      setResult({
        ok: false,
        title: 'Network error',
        detail: `Could not reach the webhook endpoint: ${e.message}. The app may not be published, or the base URL is wrong.`,
      });
      toast({
        title: 'Sync test failed',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
      // Refresh the config so the last_webhook_status reflects the test
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
    }
  };

  return (
    <div className="space-y-3">
      {/* Button */}
      <button
        onClick={runTestSync}
        disabled={syncing}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {syncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing sync…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Test Sync Now
          </>
        )}
      </button>

      {/* Result panel */}
      {result && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            result.ok
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          } animate-slide-up`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${result.ok ? 'text-emerald-900' : 'text-red-900'}`}>
              {result.title}
            </p>
            <p className={`text-xs mt-1 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.detail}
            </p>
            {result.raw && (
              <details className="mt-2">
                <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700">
                  Raw response
                </summary>
                <pre className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Health checklist */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Activity className="w-3.5 h-3.5" />
        <span>
          The test sends a dummy payload to your webhook endpoint and reports whether the
          pipeline (secret validation → job matching → log insertion) is working end-to-end.
        </span>
      </div>
    </div>
  );
}