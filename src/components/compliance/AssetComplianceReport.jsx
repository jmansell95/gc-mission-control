import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Printer, Mail, Send, X, Loader2, FileCheck2, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CATEGORY_LABELS = {
  rig: 'Drilling Rig',
  machinery: 'Machinery / Plant',
  trailer: 'Trailer',
  vehicle: 'Vehicle',
  lifting: 'Lifting Gear (LOLER)',
  portable_appliance: 'Portable Appliance (PAT)',
};

const STATUS_META = {
  compliant: { label: 'Compliant', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  expiring: { label: 'Expiring', icon: Clock, cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  expired: { label: 'Expired', icon: XCircle, cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  unknown: { label: 'Unknown', icon: AlertTriangle, cls: 'bg-slate-50 text-slate-600 ring-slate-200' },
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor((d - today) / 86400000);
}

export default function AssetComplianceReport() {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['site-assets-compliance-report'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 1000) });

  const filtered = useMemo(() => assets.filter(a => {
    const matchCat = categoryFilter === 'all' || a.asset_type === categoryFilter;
    const matchStatus = statusFilter === 'all' || a.compliance_status === statusFilter;
    return matchCat && matchStatus;
  }), [assets, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const expired = assets.filter(a => a.compliance_status === 'expired').length;
    const expiring = assets.filter(a => a.compliance_status === 'expiring').length;
    const compliant = assets.filter(a => a.compliance_status === 'compliant').length;
    const unknown = assets.filter(a => a.compliance_status === 'unknown' || !a.compliance_status).length;
    return { total, expired, expiring, compliant, unknown };
  }, [assets]);

  const buildHtml = () => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const rows = filtered.map(a => {
      const sm = STATUS_META[a.compliance_status] || STATUS_META.unknown;
      const days = daysUntil(a.compliance_expiry_date);
      const expiry = a.compliance_expiry_date ? new Date(a.compliance_expiry_date + 'T00:00:00').toLocaleDateString('en-GB') : '—';
      const dayBadge = days != null ? (days < 0 ? `<span style="color:#be123c;font-weight:600">${Math.abs(days)}d overdue</span>` : days <= 30 ? `<span style="color:#b45309;font-weight:600">${days}d left</span>` : `<span style="color:#047857">${days}d left</span>`) : '—';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${a.name || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${CATEGORY_LABELS[a.asset_type] || a.asset_type || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${a.serial_number || '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${expiry}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${dayBadge}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${sm.label}</td>
      </tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><title>LOLER / PUWER / PAT Compliance Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:18px;margin-bottom:2px}p.sub{color:#555;font-size:11px;margin:0 0 14px}.stats{display:flex;gap:8px;margin-bottom:16px}.stat{flex:1;background:#f8fafb;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}.stat .l{font-size:10px;color:#64748b;text-transform:uppercase}.stat .v{font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse}th{background:#2E5A1A;color:white;padding:7px 8px;text-align:left;font-size:11px}td{font-size:11px}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body>
    <h1>LOLER / PUWER / PAT Compliance Report</h1>
    <p class="sub">Generated ${today} · GC Mission Control · ${filtered.length} assets</p>
    <div class="stats">
      <div class="stat"><div class="l">Total Assets</div><div class="v">${stats.total}</div></div>
      <div class="stat"><div class="l">Compliant</div><div class="v" style="color:#047857">${stats.compliant}</div></div>
      <div class="stat"><div class="l">Expiring</div><div class="v" style="color:#b45309">${stats.expiring}</div></div>
      <div class="stat"><div class="l">Expired</div><div class="v" style="color:#be123c">${stats.expired}</div></div>
      <div class="stat"><div class="l">Unknown</div><div class="v" style="color:#64748b">${stats.unknown}</div></div>
    </div>
    <table><thead><tr><th>Asset</th><th>Category</th><th>Serial / Tag</th><th>Expiry Date</th><th>Remaining</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    </body></html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) { toast({ title: 'Please allow popups to print reports.', variant: 'destructive' }); return; }
    w.document.write(buildHtml());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const openEmail = async () => {
    const user = await base44.auth.me().catch(() => null);
    setRecipient(user?.email || '');
    setSubject(`LOLER / PUWER / PAT Compliance Report — ${new Date().toLocaleDateString('en-GB')}`);
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!recipient.trim()) return;
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({ to: recipient.trim(), subject, body: buildHtml() });
      toast({ title: 'Compliance report emailed' });
      setEmailOpen(false);
    } catch (e) {
      toast({ title: 'Could not send email', description: e?.message, variant: 'destructive' });
    }
    setSending(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-primary" /> LOLER / PUWER / PAT Compliance Report</h3>
          <p className="text-sm text-slate-500 mt-0.5">Full asset compliance register with expiry tracking — print or email for audits and HSE submissions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={openEmail} disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { l: 'Total', v: stats.total, c: 'text-slate-900' },
          { l: 'Compliant', v: stats.compliant, c: 'text-emerald-700' },
          { l: 'Expiring', v: stats.expiring, c: 'text-amber-600' },
          { l: 'Expired', v: stats.expired, c: 'text-rose-600' },
          { l: 'Unknown', v: stats.unknown, c: 'text-slate-500' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{s.l}</p>
            <p className={`text-2xl font-bold mt-0.5 tabular-nums ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary">
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading assets…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">No assets match the selected filters.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Asset</th>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Serial / Tag</th>
                  <th className="text-left px-4 py-3 font-semibold">Expiry</th>
                  <th className="text-left px-4 py-3 font-semibold">Remaining</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => {
                  const sm = STATUS_META[a.compliance_status] || STATUS_META.unknown;
                  const SIcon = sm.icon;
                  const days = daysUntil(a.compliance_expiry_date);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                      <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[a.asset_type] || a.asset_type}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.serial_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{a.compliance_expiry_date ? new Date(a.compliance_expiry_date + 'T00:00:00').toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-4 py-3">
                        {days == null ? <span className="text-slate-400">—</span>
                          : days < 0 ? <span className="text-rose-600 font-semibold">{Math.abs(days)}d overdue</span>
                          : days <= 30 ? <span className="text-amber-600 font-semibold">{days}d left</span>
                          : <span className="text-emerald-700">{days}d left</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${sm.cls}`}>
                          <SIcon className="w-3 h-3" /> {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !sending && setEmailOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Email Compliance Report</h3>
              <button onClick={() => !sending && setEmailOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient (registered app user)</label>
                <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="name@example.com"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSendEmail} disabled={sending || !recipient.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition text-sm font-semibold disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Report'}
                </button>
                <button onClick={() => !sending && setEmailOpen(false)} disabled={sending}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}