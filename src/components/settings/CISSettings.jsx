import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Loader2, Save, Check, AlertTriangle, RefreshCw, KeyRound, UserCheck, UserX } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const DEFAULT_CONFIG = { client_id: '', client_secret: '', tpp_id: '' };

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  verified_net: { label: 'Verified — Net (30%)', cls: 'bg-amber-100 text-amber-700' },
  verified_gross: { label: 'Verified — Gross', cls: 'bg-emerald-100 text-emerald-700' },
  unknown: { label: 'Unknown to HMRC', cls: 'bg-rose-100 text-rose-700' },
  failed: { label: 'Verification Failed', cls: 'bg-rose-100 text-rose-700' },
};

/**
 * CISSettings — HMRC Construction Industry Scheme subcontractor verification.
 * Admins store their HMRC CIS API credentials, test the connection, and verify
 * individual subcontractors. Results (deduction rate, verification number)
 * are stamped onto each Contractor record.
 */
export default function CISSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState({});
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['cis-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'cis_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;

  const { data: contractors = [], refetch } = useQuery({
    queryKey: ['cis-contractors'],
    queryFn: () => base44.entities.Contractor.filter({}, '-created_date', 500),
  });

  const needingVerification = contractors.filter(c => c.utr && c.cis_status !== 'verified_net' && c.cis_status !== 'verified_gross');
  const verified = contractors.filter(c => c.cis_status === 'verified_net' || c.cis_status === 'verified_gross');

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'cis_config', label: 'HMRC CIS Verification Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['cis-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setTestResult({ ok: false, msg: e.message || 'Save failed' }); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('verifyCIS', { action: 'test' });
      setTestResult({ ok: !!res.data?.ok, msg: res.data?.message || res.data?.error || 'Unknown' });
    } catch (e) { setTestResult({ ok: false, msg: e.message }); }
    setTesting(false);
  };

  const handleVerify = async (contractorId) => {
    setVerifyingId(contractorId);
    try {
      const res = await base44.functions.invoke('verifyCIS', { contractor_id: contractorId });
      const d = res.data || {};
      setVerifyMsg({ [contractorId]: { ok: !!d.ok, msg: d.message || d.error || 'Unknown' } });
      refetch();
    } catch (e) {
      setVerifyMsg({ [contractorId]: { ok: false, msg: e.message } });
    }
    setVerifyingId(null);
  };

  const handleVerifyAll = async () => {
    if (needingVerification.length === 0) return;
    if (!confirm(`Verify all ${needingVerification.length} subcontractor(s) awaiting verification against HMRC? This may take a minute.`)) return;
    setVerifyingAll(true);
    setBulkResult(null);
    try {
      const res = await base44.functions.invoke('verifyCIS', { action: 'verify_all' });
      const d = res.data || {};
      setBulkResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown', errors: d.errors || [] });
      refetch();
    } catch (e) {
      setBulkResult({ ok: false, msg: e.message || 'Bulk verification failed' });
    }
    setVerifyingAll(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={ShieldCheck}
        title="CIS Verification"
        description="Verify subcontractors against HMRC's Construction Industry Scheme register. Returns the deduction rate (30% net / 0% gross) and stamps each contractor record."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${config.client_id ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.client_id ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            <KeyRound className={`w-5 h-5 ${config.client_id ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{config.client_id ? 'Credentials Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{config.client_id ? 'HMRC CIS API credentials entered — ready to verify.' : 'Enter your HMRC CIS API credentials below to enable verification.'}</p>
          </div>
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {testResult.msg}
          </div>
        )}
      </div>

      {/* HMRC credentials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">HMRC CIS API Credentials</h3>
        <p className="text-xs text-slate-500">Register your application at <a href="https://developer.service.hmrc.gov.uk" target="_blank" rel="noreferrer" className="text-primary underline">developer.service.hmrc.gov.uk</a> to obtain a client ID and secret for the CIS API.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
            <input value={config.client_id} onChange={e => setConfig({ ...config, client_id: e.target.value })} placeholder="your-hmrc-client-id" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
            <input type="password" value={config.client_secret} onChange={e => setConfig({ ...config, client_secret: e.target.value })} placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Your Company UTR (TPP ID)</label>
            <input value={config.tpp_id} onChange={e => setConfig({ ...config, tpp_id: e.target.value })} placeholder="1234567890" className={`${inputCls} font-mono`} />
            <p className="text-[11px] text-slate-400 mt-1">Your own company's UTR — used as the contractor identifier in verification requests.</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Credentials
          {saved && <Check className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Contractors needing verification */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserX className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800">Awaiting Verification</h3>
          <span className="ml-auto text-xs text-slate-400">{needingVerification.length} subcontractor(s) with a UTR</span>
          {needingVerification.length > 0 && config.client_id && (
            <button onClick={handleVerifyAll} disabled={verifyingAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
              {verifyingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Verify All
            </button>
          )}
        </div>
        {bulkResult && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${bulkResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <div className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {bulkResult.msg}</div>
            {bulkResult.errors?.length > 0 && (
              <div className="mt-1.5 text-[11px] text-slate-600 space-y-0.5">
                {bulkResult.errors.slice(0, 5).map((e, i) => (<div key={i}>• {e.name}: {e.error || e.status}</div>))}
              </div>
            )}
          </div>
        )}
        {needingVerification.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No subcontractors awaiting verification.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {needingVerification.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">UTR: {c.utr || '—'}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_META[c.cis_status]?.cls || 'bg-slate-100 text-slate-600'}`}>{STATUS_META[c.cis_status]?.label || c.cis_status}</span>
                <button onClick={() => handleVerify(c.id)} disabled={!config.client_id || verifyingId === c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-40">
                  {verifyingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />} Verify
                </button>
              </div>
            ))}
          </div>
        )}
        {Object.keys(verifyMsg).map(id => (
          <div key={id} className={`mt-2 rounded-lg px-3 py-2 text-xs ${verifyMsg[id].ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{verifyMsg[id].msg}</div>
        ))}
      </div>

      {/* Verified subcontractors */}
      {verified.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Verified Subcontractors</h3>
            <span className="ml-auto text-xs text-slate-400">{verified.length} verified</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {verified.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                <span className="text-slate-700 font-medium truncate flex-1">{c.name}</span>
                <span className={`font-semibold px-2 py-0.5 rounded-full ${STATUS_META[c.cis_status]?.cls}`}>{STATUS_META[c.cis_status]?.label}</span>
                <span className="text-slate-400 font-mono">{c.cis_verification_number || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}