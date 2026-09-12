import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  GitBranch, Loader2, FileText, Lock, Unlock, Clock, AlertTriangle, CheckCircle2,
  TrendingUp, Scale, PoundSterling, CalendarClock, ArrowRight, RefreshCw, History,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_META = {
  draft:      { label: 'Draft',      tone: 'slate',   icon: FileText,   soft: 'bg-slate-100',   text: 'text-slate-700',   ring: 'ring-slate-200' },
  active:     { label: 'Active',     tone: 'emerald', icon: Lock,       soft: 'bg-emerald-100', text: 'text-emerald-700',  ring: 'ring-emerald-200' },
  superseded: { label: 'Superseded', tone: 'amber',   icon: History,    soft: 'bg-amber-100',  text: 'text-amber-700',    ring: 'ring-amber-200' },
  void:       { label: 'Void',       tone: 'rose',    icon: AlertTriangle, soft: 'bg-rose-100', text: 'text-rose-700',    ring: 'ring-rose-200' },
};

const RECON_META = {
  pending:      { label: 'Pending',      tone: 'amber',  soft: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  matched:      { label: 'Matched',       tone: 'blue',   soft: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  mismatched:  { label: 'Mismatched',    tone: 'rose',   soft: 'bg-rose-50',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  reconciled:   { label: 'Reconciled',    tone: 'emerald',soft: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
};

const REVENUE_LABEL = {
  none: 'Markup on Cost', day_rate: 'Day Rate', meterage_rate: 'Meterage Rate',
  unit_rate: 'Unit Rate', flat_fee: 'Flat Fee', composite: 'Composite',
};

/**
 * BillingPipelineDashboard — high-density command view of the entire billing
 * lifecycle. Groups contracts by stage (Draft → Active → Expiring → Archived),
 * surfaces renewals due within 90 days, tracks vendor-invoice reconciliation
 * status, and watches retention release eligibility.
 */
export default function BillingPipelineDashboard({ onNavigate, onSelectJob }) {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['billing-contracts', 'all'],
    queryFn: () => base44.entities.JobBillingContract.list('-created_date', 500),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: subconLogs = [] } = useQuery({
    queryKey: ['subcon-logs-pipeline'],
    queryFn: () => base44.entities.SubcontractorLog.list('-date', 500),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-pipeline'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 200),
  });

  const jobName = (id) => jobs.find(j => j.id === id)?.name || 'Unknown job';

  // Group contracts by status — latest version per job
  const byJob = useMemo(() => {
    const map = {};
    contracts.forEach(c => {
      if (!c.job_id) return;
      if (!map[c.job_id]) map[c.job_id] = [];
      map[c.job_id].push(c);
    });
    return Object.entries(map).map(([jobId, versions]) => {
      const sorted = versions.sort((a, b) => (b.version || 0) - (a.version || 0));
      return { jobId, versions: sorted, active: sorted.find(v => v.status === 'active') || sorted[0] };
    });
  }, [contracts]);

  const latestContracts = byJob.map(r => r.active).filter(Boolean);

  // Pipeline stage counts + values
  const pipeline = useMemo(() => {
    const stages = { draft: [], active: [], superseded: [], void: [] };
    latestContracts.forEach(c => {
      const key = stages[c.status] ? c.status : 'draft';
      stages[key].push(c);
    });
    return stages;
  }, [latestContracts]);

  const totalContractValue = latestContracts.reduce((s, c) => s + (c.total_contract_value_net || 0), 0);
  const totalInvoiced = latestContracts.reduce((s, c) => s + (c.total_invoiced_net || 0), 0);

  // Renewal Radar — active contracts with effective_to within 90 days
  const renewalsDue = useMemo(() => {
    const now = Date.now();
    const ninetyDays = 90 * 24 * 3600 * 1000;
    return latestContracts
      .filter(c => c.status === 'active' && c.effective_to)
      .map(c => {
        const dt = new Date(c.effective_to).getTime();
        return { contract: c, daysUntil: Math.ceil((dt - now) / (24 * 3600 * 1000)) };
      })
      .filter(r => r.daysUntil <= 90)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [latestContracts]);

  // Retention watch
  const retentionWatch = useMemo(() => {
    return latestContracts
      .filter(c => c.retention_percentage > 0 && (c.total_retention_held || 0) > 0)
      .map(c => ({
        contract: c,
        eligible: c.retention_status === 'release_eligible',
        held: c.total_retention_held || 0,
        released: c.retention_released || 0,
      }))
      .sort((a, b) => (a.eligible === b.eligible) ? b.held - a.held : (a.eligible ? -1 : 1));
  }, [latestContracts]);

  // Reconciliation status from subcon logs
  const reconStatus = useMemo(() => {
    const counts = { pending: 0, matched: 0, mismatched: 0, reconciled: 0 };
    subconLogs.forEach(l => {
      const k = l.reconciliation_status || 'pending';
      if (counts[k] !== undefined) counts[k]++;
    });
    return counts;
  }, [subconLogs]);

  // Revenue method mix (active contracts only)
  const methodMix = useMemo(() => {
    const mix = {};
    latestContracts.filter(c => c.status === 'active').forEach(c => {
      const m = c.revenue_method || 'none';
      mix[m] = (mix[m] || 0) + 1;
    });
    return Object.entries(mix).sort((a, b) => b[1] - a[1]);
  }, [latestContracts]);

  // Invoice status snapshot
  const invoiceSnapshot = useMemo(() => {
    const snap = { draft: 0, sent: 0, overdue: 0, paid: 0, void: 0 };
    invoices.forEach(i => { if (snap[i.status] !== undefined) snap[i.status]++; });
    return snap;
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SettingsSectionHeader icon={GitBranch} title="Billing Pipeline" description="Lifecycle command view of every billing contract — renewals, reconciliation & retention at a glance." />
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        icon={GitBranch}
        title="Billing Pipeline"
        description="Lifecycle command view of every billing contract — renewals, reconciliation & retention at a glance."
        actions={onNavigate ? (
          <button onClick={() => onNavigate('billing-contracts')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition">
            <FileText className="w-4 h-4" /> Manage Contracts
          </button>
        ) : null}
      />

      {/* Pipeline Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const list = pipeline[key] || [];
          const value = list.reduce((s, c) => s + (c.total_contract_value_net || 0), 0);
          const Icon = meta.icon;
          return (
            <div key={key} className={`hub-glass relative rounded-2xl p-4 overflow-hidden ring-1 ${meta.ring}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.soft}`}>
                  <Icon className={`w-4 h-4 ${meta.text}`} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 tabular-nums">{list.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{fmt(value)} value</p>
            </div>
          );
        })}
      </div>

      {/* Financial overview strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OverviewChip icon={PoundSterling} label="Total Contract Value" value={fmt(totalContractValue)} tone="emerald" />
        <OverviewChip icon={TrendingUp} label="Total Invoiced (Net)" value={fmt(totalInvoiced)} tone="blue" />
        <OverviewChip icon={Clock} label="Renewals Due (90d)" value={renewalsDue.length} tone={renewalsDue.length > 0 ? 'amber' : 'slate'} />
        <OverviewChip icon={Unlock} label="Retention Eligible" value={retentionWatch.filter(r => r.eligible).length} tone={retentionWatch.some(r => r.eligible) ? 'rose' : 'slate'} />
      </div>

      {/* Renewal Radar */}
      <section className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Renewal Radar</h3>
          <span className="text-xs text-slate-400">Active contracts expiring within 90 days</span>
        </div>
        {renewalsDue.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No contracts expiring in the next 90 days.
          </div>
        ) : (
          <div className="space-y-2">
            {renewalsDue.map(({ contract: c, daysUntil }) => (
              <div key={c.id} className="flex items-center gap-3 bg-amber-50/50 border border-amber-200 rounded-lg px-3 py-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${daysUntil < 0 ? 'bg-rose-100' : daysUntil < 30 ? 'bg-rose-100' : 'bg-amber-100'}`}>
                  <Clock className={`w-4 h-4 ${daysUntil < 30 ? 'text-rose-600' : 'text-amber-600'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{jobName(c.job_id)}</p>
                  <p className="text-[11px] text-slate-500">Expires {new Date(c.effective_to).toLocaleDateString('en-GB')} · v{c.version} · {REVENUE_LABEL[c.revenue_method] || c.revenue_method}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${daysUntil < 30 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
                  </p>
                  {c.total_contract_value_net > 0 && <p className="text-[10px] text-slate-400 tabular-nums">{fmt(c.total_contract_value_net)}</p>}
                </div>
                {onSelectJob && (
                  <button onClick={() => onSelectJob({ id: c.job_id, name: jobName(c.job_id) })} className="text-slate-300 hover:text-[#2E5A1A] flex-shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Two-column: Reconciliation + Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reconciliation Status */}
        <section className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scale className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Vendor Invoice Reconciliation</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(RECON_META).map(([key, meta]) => {
              const count = reconStatus[key] || 0;
              return (
                <div key={key} className={`rounded-lg p-3 ${meta.soft} border border-transparent`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${meta.text}`}>{count}</p>
                </div>
              );
            })}
          </div>
          {reconStatus.mismatched > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <p className="text-xs text-rose-700 font-medium">{reconStatus.mismatched} vendor invoice{reconStatus.mismatched === 1 ? '' : 's'} need review — amounts don't match logged costs.</p>
              {onNavigate && (
                <button onClick={() => onNavigate('invoicing')} className="ml-auto text-xs font-semibold text-rose-700 hover:underline">Review →</button>
              )}
            </div>
          )}
          {onNavigate && (
            <button onClick={() => onNavigate('invoicing')} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-[#2E5A1A] border border-slate-200 rounded-lg hover:border-[#2E5A1A]/30 transition">
              <RefreshCw className="w-3.5 h-3.5" /> Open Reconciliation Centre
            </button>
          )}
        </section>

        {/* Retention Watch */}
        <section className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Retention Watch</h3>
            <span className="text-xs text-slate-400 ml-auto">{retentionWatch.length} holding</span>
          </div>
          {retentionWatch.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> No retention currently held.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {retentionWatch.map(({ contract: c, eligible, held, released }) => (
                <div key={c.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${eligible ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{jobName(c.job_id)}</p>
                    <p className="text-[11px] text-slate-500">{c.retention_percentage}% retention · {fmt(held)} held{released > 0 ? ` · ${fmt(released)} released` : ''}</p>
                  </div>
                  {eligible ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">
                      <Unlock className="w-3 h-3" /> Eligible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 flex-shrink-0">
                      <Lock className="w-3 h-3" /> Holding
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {onNavigate && retentionWatch.some(r => r.eligible) && (
            <button onClick={() => onNavigate('billing-contracts')} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-50 transition">
              <Unlock className="w-3.5 h-3.5" /> Release Eligible Retention
            </button>
          )}
        </section>
      </div>

      {/* Revenue Method Mix + Invoice Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2E5A1A]" /> Active Contract Billing Methods
          </h3>
          {methodMix.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">No active contracts.</p>
          ) : (
            <div className="space-y-2">
              {methodMix.map(([method, count]) => {
                const total = methodMix.reduce((s, [, c]) => s + c, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={method} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 w-32 truncate">{REVENUE_LABEL[method] || method}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 tabular-nums w-12 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2E5A1A]" /> Invoice Status Snapshot
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: 'draft', label: 'Draft', tone: 'slate' },
              { key: 'sent', label: 'Sent', tone: 'blue' },
              { key: 'overdue', label: 'Overdue', tone: 'rose' },
              { key: 'paid', label: 'Paid', tone: 'emerald' },
              { key: 'void', label: 'Void', tone: 'slate' },
            ].map(s => (
              <div key={s.key} className="text-center">
                <p className={`text-xl font-bold tabular-nums ${
                  s.tone === 'rose' ? 'text-rose-600' : s.tone === 'emerald' ? 'text-emerald-600' :
                  s.tone === 'blue' ? 'text-blue-600' : 'text-slate-700'
                }`}>{invoiceSnapshot[s.key] || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
          {invoiceSnapshot.overdue > 0 && onNavigate && (
            <button onClick={() => onNavigate('invoicing')} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 border border-rose-200 rounded-lg hover:bg-rose-50 transition">
              <AlertTriangle className="w-3.5 h-3.5" /> {invoiceSnapshot.overdue} overdue invoice{invoiceSnapshot.overdue === 1 ? '' : 's'} — chase now
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function OverviewChip({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
    slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tones[tone] || tones.slate}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-sm font-bold text-slate-800 tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}