import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { buildWebhookUrl } from '@/utils/appBaseUrl';
import { ShieldAlert, Loader2, Save, ExternalLink, CheckCircle2, XCircle, FileWarning, Copy, ChevronDown, ChevronUp, Webhook, KeyRound, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const ACCENT = '#2E5A1A';

function ScoreBadge({ pct, passFail }) {
  const pass = passFail === 'pass';
  const fail = passFail === 'fail';
  const cls = pass
    ? 'bg-emerald-100 text-emerald-700'
    : fail
      ? 'bg-rose-100 text-rose-700'
      : 'bg-slate-100 text-slate-600';
  return (
    <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ' + cls}>
      {pass ? <CheckCircle2 className="w-3 h-3" /> : fail ? <XCircle className="w-3 h-3" /> : <FileWarning className="w-3 h-3" />}
      {pct != null ? pct + '%' : passFail || 'pending'}
    </span>
  );
}

export default function MittiSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => {
      const list = await base44.entities.MittiConfig.filter({ key: 'global' });
      if (list && list[0]) return list[0];
      // Create the singleton if it doesn't exist yet
      const created = await base44.entities.MittiConfig.create({
        key: 'global', enabled: false, auto_link_to_jobs: true,
        webhook_secret: '', api_token: '', last_webhook_status: 'never',
      });
      return created;
    },
  });

  // Initialise the editable form once the config loads (React Query v5 removed onSuccess)
  useEffect(() => {
    if (config) {
      setForm({
        webhook_secret: config.webhook_secret || '',
        api_token: config.api_token || '',
        enabled: !!config.enabled,
        auto_link_to_jobs: config.auto_link_to_jobs !== false,
        vehicle_check_url: config.vehicle_check_url || '',
        powra_url: config.powra_url || '',
        equipment_check_url: config.equipment_check_url || '',
        safety_forms: Array.isArray(config.safety_forms) ? config.safety_forms : [],
      });
    }
  }, [config]);

  const { data: reports = [] } = useQuery({
    queryKey: ['safety-reports'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 50),
  });

  const webhookUrl = buildWebhookUrl('/api/functions/receiveMittiData');
  const isConfigured = !!(form?.webhook_secret);
  const [expandedPayload, setExpandedPayload] = useState(null);

  const copyToClipboard = (text) => { navigator.clipboard?.writeText(text); };

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncMitti');
      setSyncResult(res.data || res);
      queryClient.invalidateQueries({ queryKey: ['safety-reports'] });
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
    } catch (e) {
      setSyncResult({ error: e.message || 'Sync failed — check your API token.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await base44.entities.MittiConfig.update(config.id, {
        webhook_secret: form.webhook_secret,
        api_token: form.api_token,
        enabled: form.enabled,
        auto_link_to_jobs: form.auto_link_to_jobs,
        vehicle_check_url: form.vehicle_check_url,
        powra_url: form.powra_url,
        equipment_check_url: form.equipment_check_url,
        safety_forms: form.safety_forms || [],
      });
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
    } catch (e) {
      alert('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const openReports = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={ShieldAlert}
        title="Mitti (Mitti) Sync"
        description="Sync site safety audits & inspection forms from Mitti — every audit auto-links to its job and subcontractor"
      />

      {/* Get Started guide — shown until the webhook secret is set */}
      {!isConfigured && (
        <div className="rounded-xl border border-[#2E5A1A]/20 bg-gradient-to-br from-[#2E5A1A]/5 to-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-[#2E5A1A]" />
            <h3 className="font-bold text-slate-900">Get Started — 3 Steps</h3>
            <span className="ml-auto text-xs text-slate-400">Everything is built and ready — add your details when you have them</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#2E5A1A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Enter a webhook secret below</span> — any strong password-like string. You'll set the same value in Mitti.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#2E5A1A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Copy the Webhook Endpoint URL</span> below and add it in Mitti → Integrations → Webhooks, appending <code className="px-1 bg-slate-100 rounded">?webhook_secret=YOUR_SECRET</code>.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#2E5A1A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Enable the receiver</span> and Save. Your API token can be added later for pull-based sync — the system is ready whenever you are.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Status</p>
          <p className={'text-sm font-bold ' + (form.enabled ? 'text-emerald-600' : 'text-slate-400')}>{form.enabled ? 'Active' : 'Disabled'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Audits Stored</p>
          <p className="text-sm font-bold text-slate-800">{reports.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Open Actions</p>
          <p className="text-sm font-bold text-amber-600">{openReports}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Last Webhook</p>
          <p className="text-xs font-medium text-slate-600 truncate" title={config?.last_webhook_summary}>
            {config?.last_webhook_status === 'success' ? 'Success' : config?.last_webhook_status === 'failed' ? 'Failed' : 'Never'}
          </p>
        </div>
      </div>

      {/* Config form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Webhook className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="font-semibold text-slate-900">Webhook Configuration</h3>
          {isConfigured ? (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Secret set</span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700"><AlertCircle className="w-3 h-3" /> Awaiting secret</span>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input id="sc-enabled" type="checkbox" checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-600" />
            <label htmlFor="sc-enabled" className="text-sm font-medium text-slate-700">
              Enable Mitti webhook receiver
            </label>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input id="sc-autolink" type="checkbox" checked={form.auto_link_to_jobs}
              onChange={(e) => setForm({ ...form, auto_link_to_jobs: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-600" />
            <label htmlFor="sc-autolink" className="text-sm font-medium text-slate-700">
              Auto-link audits to jobs by site name
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret *</label>
            <input type="text" value={form.webhook_secret}
              onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
              placeholder="Enter a strong secret — set the same in Mitti"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">Mitti must send this secret as the <code className="px-1 bg-slate-100 rounded">webhook_secret</code> query param or <code className="px-1 bg-slate-100 rounded">x-webhook-secret</code> header.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Token (optional)</label>
            <input type="text" value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              placeholder="For future pull-based sync"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">Crew Safety Check Links (Mitti / SafetyCulture)</p>
            <p className="text-[11px] text-slate-400 mb-3">These links power the "Open Mitti" buttons crew see in their daily shift wizard. Leave blank to use the built-in defaults.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Daily Vehicle Check URL</label>
                <input type="text" value={form.vehicle_check_url}
                  onChange={(e) => setForm({ ...form, vehicle_check_url: e.target.value })}
                  placeholder="SafetyCulture inspection link — shown before crew leave for site"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">POWRA URL</label>
                <input type="text" value={form.powra_url}
                  onChange={(e) => setForm({ ...form, powra_url: e.target.value })}
                  placeholder="SafetyCulture inspection link — shown on arrival at site"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Equipment / Plant Check URL</label>
                <input type="text" value={form.equipment_check_url}
                  onChange={(e) => setForm({ ...form, equipment_check_url: e.target.value })}
                  placeholder="SafetyCulture inspection link — shown during site briefing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
            </div>
          </div>

          {/* Configurable safety forms list — big buttons in the Shift Wizard */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-700">Safety Forms Checklist (big buttons in Shift Wizard)</p>
              <button
                type="button"
                onClick={() => setForm({ ...form, safety_forms: [...(form.safety_forms || []), { id: 'form_' + Date.now(), step: 'checks', category: 'general', label: '', url: '', required: true }] })}
                className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg hover:opacity-90"
                style={{ background: ACCENT }}
              >
                + Add Form
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Each form appears as a large tappable button at the chosen Shift Wizard step. Leave the list empty to use the three fixed links above only.</p>
            <div className="space-y-3">
              {(form.safety_forms || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">No extra safety forms configured.</p>
              )}
              {(form.safety_forms || []).map((sf, idx) => (
                <div key={sf.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sf.label}
                      onChange={(e) => {
                        const next = [...form.safety_forms]; next[idx] = { ...sf, label: e.target.value }; setForm({ ...form, safety_forms: next });
                      }}
                      placeholder="Button label (e.g. Permit to Dig)"
                      className="flex-1 px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, safety_forms: form.safety_forms.filter((_, i) => i !== idx) })}
                      className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sf.url}
                    onChange={(e) => {
                      const next = [...form.safety_forms]; next[idx] = { ...sf, url: e.target.value }; setForm({ ...form, safety_forms: next });
                    }}
                    placeholder="SafetyCulture inspection URL"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] text-slate-500">Step:</label>
                    <select
                      value={sf.step}
                      onChange={(e) => {
                        const next = [...form.safety_forms]; next[idx] = { ...sf, step: e.target.value }; setForm({ ...form, safety_forms: next });
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                    >
                      <option value="checks">Daily Checks</option>
                      <option value="arrive">Arrive on Site</option>
                      <option value="briefing">Site Briefing</option>
                    </select>
                    <label className="text-[11px] text-slate-500">Category:</label>
                    <select
                      value={sf.category}
                      onChange={(e) => {
                        const next = [...form.safety_forms]; next[idx] = { ...sf, category: e.target.value }; setForm({ ...form, safety_forms: next });
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                    >
                      <option value="vehicle">Vehicle</option>
                      <option value="powra">POWRA</option>
                      <option value="equipment">Equipment</option>
                      <option value="general">General</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 ml-auto">
                      <input
                        type="checkbox"
                        checked={sf.required !== false}
                        onChange={(e) => {
                          const next = [...form.safety_forms]; next[idx] = { ...sf, required: e.target.checked }; setForm({ ...form, safety_forms: next });
                        }}
                        className="w-3.5 h-3.5 rounded accent-emerald-600"
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Endpoint URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 break-all">
                {webhookUrl}
              </code>
              <button onClick={() => copyToClipboard(webhookUrl)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition" title="Copy URL">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Add this URL in Mitti → Integrations → Webhooks, and append <code className="px-1 bg-slate-100 rounded">?webhook_secret=YOUR_SECRET</code>.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              style={{ background: ACCENT }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
            <button onClick={handleSyncNow} disabled={syncing || !form?.api_token}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition disabled:opacity-50"
              title={!form?.api_token ? 'Add an API token first' : 'Pull recent audits from Mitti now'}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Now
            </button>
          </div>
          {syncResult && (
            <div className={`text-sm rounded-lg px-3 py-2 ${syncResult.error ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}>
              {syncResult.error ? syncResult.error : `Sync complete: ${syncResult.stored || 0} new, ${syncResult.updated || 0} updated, ${syncResult.linked_jobs || 0} jobs linked.`}
            </div>
          )}
        </div>
      </div>

      {/* Webhook Debug Log — raw payload viewer */}
      {reports.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Webhook className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Webhook Debug Log</h3>
            <span className="text-xs text-slate-400 hidden sm:inline">Expand a row to inspect the raw Mitti payload</span>
          </div>
          <div className="divide-y divide-slate-100">
            {reports.slice(0, 10).map((r) => (
              <div key={r.id}>
                <button onClick={() => setExpandedPayload(expandedPayload === r.id ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition text-left">
                  {expandedPayload === r.id ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <p className="text-xs font-medium text-slate-700 flex-1 truncate">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{r.conducted_at ? new Date(r.conducted_at).toLocaleDateString('en-GB') : '—'}</span>
                </button>
                {expandedPayload === r.id && (
                  <pre className="px-4 pb-3 text-[11px] text-slate-600 bg-slate-50 overflow-x-auto max-h-64 overflow-y-auto border-t border-slate-100">{r.raw_payload || 'No raw payload stored'}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent reports */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent Safety Audits</h3>
        </div>
        {reports.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            <ShieldAlert className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            No audits received yet. Configure the webhook in Mitti to start syncing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Audit</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Auditor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Job / Site</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Result</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Actions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-xs">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                      <p className="text-[10px] text-slate-400">{r.audit_template_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.auditor_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.job_name ? <span className="font-medium text-slate-800">{r.job_name}</span> : r.site_name || '—'}
                    </td>
                    <td className="px-4 py-3"><ScoreBadge pct={r.score_percentage} passFail={r.pass_fail} /></td>
                    <td className="px-4 py-3">
                      {r.action_items && r.action_items.length > 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{r.action_items.length} open</span>
                      ) : <span className="text-[10px] text-slate-400">None</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.audit_report_url ? (
                        <a href={r.audit_report_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-xs">Open PDF</a>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}