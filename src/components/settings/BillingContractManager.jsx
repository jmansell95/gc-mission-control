import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ScrollText, Loader2, FileText, Lock, Unlock, History, Plus, X, Save,
  ChevronDown, ChevronRight, TrendingUp, Percent, Ruler, Target, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  superseded: 'bg-amber-100 text-amber-700',
  void: 'bg-red-100 text-red-600',
};

/**
 * BillingContractManager — lists and manages JobBillingContract records.
 * Shows version history, status, and key billing terms per job. Admins
 * can create new contract versions (which supersedes the previous active one)
 * and view the rate snapshot.
 */
export default function BillingContractManager() {
  const queryClient = useQueryClient();
  const [expandedJob, setExpandedJob] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [releasingId, setReleasingId] = useState(null);
  const [releaseMsg, setReleaseMsg] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [activateMsg, setActivateMsg] = useState(null);

  const handleRelease = async (contract) => {
    setReleasingId(contract.id);
    setReleaseMsg(null);
    try {
      const res = await base44.functions.invoke('releaseRetention', { contract_id: contract.id });
      const d = res.data || {};
      if (d.ok && d.released > 0) {
        setReleaseMsg({ ok: true, msg: `Retention released — ${d.results[0]?.invoice_number || 'invoice raised'}` });
        queryClient.invalidateQueries({ queryKey: ['billing-contracts'] });
      } else {
        const r = d.results?.[0] || {};
        setReleaseMsg({ ok: false, msg: r.skipped === 'not_complete' ? 'Job/project not marked complete yet.' : r.skipped === 'no_retention_held' ? 'No retention held to release.' : (d.error || 'Release failed') });
      }
    } catch (e) {
      setReleaseMsg({ ok: false, msg: e.message || 'Release failed' });
    }
    setReleasingId(null);
    setTimeout(() => setReleaseMsg(null), 4000);
  };

  const handleActivate = async (contract) => {
    setActivatingId(contract.id);
    setActivateMsg(null);
    try {
      const res = await base44.functions.invoke('activateBillingContract', { contract_id: contract.id });
      const d = res.data || {};
      if (d.ok) {
        setActivateMsg({ ok: true, msg: `Contract activated — ${d.snapshot_items} rates snapshotted${d.superseded_version ? `, v${d.superseded_version} superseded` : ''}.` });
        queryClient.invalidateQueries({ queryKey: ['billing-contracts'] });
      } else {
        setActivateMsg({ ok: false, msg: d.error || 'Activation failed' });
      }
    } catch (e) {
      setActivateMsg({ ok: false, msg: e.message || 'Activation failed' });
    }
    setActivatingId(null);
    setTimeout(() => setActivateMsg(null), 5000);
  };

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['billing-contracts', 'all'],
    queryFn: () => base44.entities.JobBillingContract.list('-created_date', 200),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  // Group by job_id — show latest version per job
  const byJob = {};
  contracts.forEach(c => {
    if (!c.job_id) return;
    if (!byJob[c.job_id]) byJob[c.job_id] = [];
    byJob[c.job_id].push(c);
  });
  const jobRows = Object.entries(byJob).map(([jobId, versions]) => {
    const sorted = versions.sort((a, b) => (b.version || 0) - (a.version || 0));
    return { jobId, job: jobs.find(j => j.id === jobId), versions: sorted, active: sorted.find(v => v.status === 'active') || sorted[0] };
  });

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={ScrollText}
        title="Billing Contracts"
        description="Locked per-job billing terms with version control. Each contract freezes the rate snapshot, VAT, markup and POA items at activation — future rate card changes don't affect active contracts."
        actions={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"><Plus className="w-4 h-4" /> New Contract</button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : jobRows.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No billing contracts yet</p>
          <p className="text-xs text-slate-400 mt-1">Create a billing contract for a job to lock in its financial terms.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobRows.map(row => {
            const expanded = expandedJob === row.jobId;
            const c = row.active;
            if (!c) return null;
            return (
              <div key={row.jobId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedJob(expanded ? null : row.jobId)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition text-left">
                  {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{row.job?.name || 'Unknown job'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_BADGE[c.status] || STATUS_BADGE.draft}`}>{c.status}</span>
                      <span className="text-[10px] text-slate-400">v{c.version || 1}</span>
                      {c.revenue_method && <span className="text-[10px] text-slate-500 capitalize">{c.revenue_method.replace('_', ' ')}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {c.total_contract_value_net > 0 && <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(c.total_contract_value_net)}</p>}
                    {c.total_invoiced_net > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">{fmt(c.total_invoiced_net)} invoiced</p>}
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    {/* Activate button for drafts */}
                    {c.status === 'draft' && (
                      <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs text-blue-700 font-medium">Draft — not yet locked</span>
                        <button onClick={() => handleActivate(c)} disabled={activatingId === c.id}
                          className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                          {activatingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Activate & Lock
                        </button>
                      </div>
                    )}
                    {activateMsg && expanded && (
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 ${activateMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {activateMsg.msg}
                      </div>
                    )}
                    {/* Active badge with snapshot info */}
                    {c.status === 'active' && c.rate_snapshot && (
                      <div className="flex items-center gap-2 text-xs bg-emerald-50 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">Locked</span>
                        {(() => {
                          try { const s = JSON.parse(c.rate_snapshot); return <span className="text-emerald-600">{s.total_items || 0} rates snapshotted · {new Date(s.snapshot_date).toLocaleDateString('en-GB')}</span>; }
                          catch { return null; }
                        })()}
                      </div>
                    )}
                    {/* Key terms */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <TermChip icon={Percent} label="Markup" value={c.markup_percentage ? `${c.markup_percentage}%` : '—'} />
                      <TermChip icon={Ruler} label="Metre Rate" value={c.meterage_rate ? fmt(c.meterage_rate) + '/m' : '—'} />
                      <TermChip icon={Target} label="Target" value={c.meterage_target ? `${c.meterage_target}m` : '—'} />
                      <TermChip icon={TrendingUp} label="VAT" value={`${c.vat_rate || 20}%`} />
                    </div>
                    {/* Retention & milestones */}
                    {c.retention_percentage > 0 && (
                      <div className="flex items-center gap-2 text-xs bg-amber-50 rounded-lg px-3 py-2">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-amber-700 font-medium">{c.retention_percentage}% retention</span>
                        {c.total_retention_held > 0 ? (
                          <span className="text-amber-600">{fmt(c.total_retention_held)} held</span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Fully released</span>
                        )}
                        {c.retention_released > 0 && <span className="text-amber-500">· {fmt(c.retention_released)} released</span>}
                        {c.total_retention_held > 0 && (
                          <button onClick={() => handleRelease(c)} disabled={releasingId === c.id}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-md text-[11px] font-semibold hover:bg-amber-700 disabled:opacity-50 transition">
                            {releasingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />} Release
                          </button>
                        )}
                      </div>
                    )}
                    {releaseMsg && expanded && (
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 ${releaseMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {releaseMsg.msg}
                      </div>
                    )}
                    {c.milestone_billing_enabled && c.milestones?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">Billing Milestones</p>
                        {c.milestones.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                            <span className="font-medium text-slate-700">{m.label}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 capitalize">{m.trigger_type.replace('_', ' ')}</span>
                            <span className="ml-auto text-slate-600 font-semibold">{m.invoice_percentage}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* POA items */}
                    {c.poa_items?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase">Price on Application Items</p>
                        {c.poa_items.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-blue-50 rounded-lg px-3 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-slate-700 truncate flex-1">{p.description}</span>
                            <span className="text-slate-500">{p.unit}</span>
                            {p.agreed_price > 0
                              ? <span className="text-emerald-600 font-semibold tabular-nums">{fmt(p.agreed_price)}</span>
                              : <span className="text-blue-600 font-semibold">POA</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Version history */}
                    {row.versions.length > 1 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1"><History className="w-3 h-3" /> Version History</p>
                        {row.versions.map(v => (
                          <div key={v.id} className="flex items-center gap-2 text-xs px-3 py-1">
                            <span className={`px-1.5 py-0.5 rounded font-bold ${STATUS_BADGE[v.status]}`}>v{v.version}</span>
                            <span className="text-slate-500">{v.status}</span>
                            {v.activated_at && <span className="text-slate-400">· {new Date(v.activated_at).toLocaleDateString('en-GB')}</span>}
                            {v.superseded_by_version && <span className="text-slate-400">→ v{v.superseded_by_version}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewContractModal onClose={() => setShowNew(false)} jobs={jobs} />}
    </div>
  );
}

function TermChip({ icon: Icon, label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 text-slate-400" />
        <p className="text-[9px] text-slate-400 uppercase font-medium">{label}</p>
      </div>
      <p className="text-sm font-bold text-slate-700 tabular-nums">{value}</p>
    </div>
  );
}

function NewContractModal({ onClose, jobs }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    job_id: '', revenue_method: 'none', drilling_method: 'not_applicable',
    vat_rate: 20, markup_percentage: 15, meterage_rate: '', meterage_target: '',
    unit_price: '', flat_fee: '', retention_percentage: 0, subcontractor_default_markup: 15,
    client_reference: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.job_id) return;
    setSaving(true);
    try {
      const job = jobs.find(j => j.id === form.job_id);
      await base44.entities.JobBillingContract.create({
        ...form,
        job_id: form.job_id,
        project_id: job?.project_id || '',
        client_id: job?.client_id || '',
        version: 1,
        status: 'draft',
        contract_date: new Date().toISOString().slice(0, 10),
        total_contract_value_net: Number(form.flat_fee) || 0,
        total_invoiced_net: 0,
        total_retention_held: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['billing-contracts'] });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold text-slate-900">New Billing Contract</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Job *</label>
            <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} className={inputCls}>
              <option value="">Select a job…</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Billing Method</label>
              <select value={form.revenue_method} onChange={e => setForm({ ...form, revenue_method: e.target.value })} className={inputCls}>
                <option value="none">Markup on Cost</option>
                <option value="meterage_rate">Meterage Rate</option>
                <option value="day_rate">Day Rate</option>
                <option value="unit_rate">Unit Rate</option>
                <option value="flat_fee">Flat Fee</option>
                <option value="composite">Composite</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Drilling Method</label>
              <select value={form.drilling_method} onChange={e => setForm({ ...form, drilling_method: e.target.value })} className={inputCls}>
                <option value="not_applicable">N/A</option>
                <option value="cp">CP</option>
                <option value="rotary">Rotary</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VAT %</label>
              <input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Markup %</label>
              <input type="number" value={form.markup_percentage} onChange={e => setForm({ ...form, markup_percentage: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Retention %</label>
              <input type="number" value={form.retention_percentage} onChange={e => setForm({ ...form, retention_percentage: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Metre Rate (£/m)</label>
              <input type="number" step="0.01" value={form.meterage_rate} onChange={e => setForm({ ...form, meterage_rate: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Target (m)</label>
              <input type="number" value={form.meterage_target} onChange={e => setForm({ ...form, meterage_target: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client PO / Reference</label>
            <input type="text" value={form.client_reference} onChange={e => setForm({ ...form, client_reference: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2" className={inputCls} />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} disabled={!form.job_id || saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Contract (Draft)
          </button>
        </div>
      </div>
    </div>
  );
}