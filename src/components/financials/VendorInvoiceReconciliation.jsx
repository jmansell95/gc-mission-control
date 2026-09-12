import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Loader2, CheckCircle2, AlertTriangle, X, Search,
  ArrowRightLeft, Building2, ChevronDown, ChevronRight, Lock, Upload, Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOLERANCE = 0.05; // £0.05 reconciliation tolerance

const RECON_STATUS = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  matched: { label: 'Matched', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  mismatched: { label: 'Mismatch', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  reconciled: { label: 'Reconciled', color: 'bg-emerald-100 text-emerald-700', icon: Lock },
};

// Portfolio-wide vendor invoice reconciliation widget. Lists SubcontractorLog
// entries where the supplier invoice has been received (invoice_received=true)
// but not yet reconciled. Lets finance enter the actual invoice amount and
// auto-matches against our logged purchase_cost_net.
export default function VendorInvoiceReconciliation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | mismatched | all
  const [expanded, setExpanded] = useState(null);
  const [reconForm, setReconForm] = useState({}); // { [logId]: { net, vat, gross, note } }
  const [autoMatching, setAutoMatching] = useState(false);
  const fileInputRef = React.useRef(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['subcon-recon-logs'],
    queryFn: () => base44.entities.SubcontractorLog.filter({ invoice_received: true }, '-date', 200),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['recon-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ['recon-contractors'],
    queryFn: () => base44.entities.Contractor.list(),
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
  });

  const filtered = useMemo(() => {
    let result = logs;
    if (filter === 'pending') {
      result = result.filter(l => (l.reconciliation_status || 'pending') === 'pending' || l.reconciliation_status === 'mismatched');
    } else if (filter === 'mismatched') {
      result = result.filter(l => l.reconciliation_status === 'mismatched');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.subcontractor_name || '').toLowerCase().includes(q) ||
        (l.invoice_number || '').toLowerCase().includes(q) ||
        (l.po_number || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filter, search]);

  const stats = useMemo(() => {
    const pending = logs.filter(l => (l.reconciliation_status || 'pending') === 'pending').length;
    const mismatched = logs.filter(l => l.reconciliation_status === 'mismatched').length;
    const reconciled = logs.filter(l => l.reconciliation_status === 'reconciled').length;
    const pendingValue = logs
      .filter(l => l.reconciliation_status !== 'reconciled')
      .reduce((s, l) => s + (Number(l.purchase_cost_net) || 0), 0);
    return { pending, mismatched, reconciled, pendingValue };
  }, [logs]);

  const getReconForm = (logId, log) => ({
    net: reconForm[logId]?.net ?? log.invoice_net_amount ?? '',
    vat: reconForm[logId]?.vat ?? log.invoice_vat_amount ?? '',
    gross: reconForm[logId]?.gross ?? log.invoice_gross_amount ?? '',
    note: reconForm[logId]?.note ?? '',
  });

  const setReconField = (logId, field, value) => {
    setReconForm(prev => ({
      ...prev,
      [logId]: { ...getReconForm(logId, {}), [field]: value },
    }));
  };

  const handleReconcile = async (log) => {
    const form = getReconForm(log.id, log);
    const invoiceNet = parseFloat(form.net);
    if (isNaN(invoiceNet)) {
      toast({ title: 'Enter the invoice net amount', variant: 'destructive' });
      return;
    }
    const invoiceVat = parseFloat(form.vat) || 0;
    const invoiceGross = parseFloat(form.gross) || (invoiceNet + invoiceVat);
    const diff = invoiceNet - (Number(log.purchase_cost_net) || 0);
    const isMatch = Math.abs(diff) <= TOLERANCE;

    try {
      await base44.entities.SubcontractorLog.update(log.id, {
        invoice_net_amount: Math.round(invoiceNet * 100) / 100,
        invoice_vat_amount: Math.round(invoiceVat * 100) / 100,
        invoice_gross_amount: Math.round(invoiceGross * 100) / 100,
        reconciliation_status: isMatch ? 'reconciled' : 'mismatched',
        reconciled_at: isMatch ? new Date().toISOString() : undefined,
        reconciled_by_name: isMatch ? (profile?.name || profile?.staff?.name || '') : undefined,
        reconciliation_note: form.note || (isMatch ? undefined : `Invoice £${invoiceNet.toFixed(2)} vs logged £${(Number(log.purchase_cost_net) || 0).toFixed(2)} — diff £${diff.toFixed(2)}`),
      });
      toast({
        title: isMatch ? 'Reconciled — amounts match' : 'Mismatch flagged for review',
        description: isMatch ? 'Log locked and reconciled.' : `Difference of ${fmt(Math.abs(diff))} flagged.`,
      });
      queryClient.invalidateQueries({ queryKey: ['subcon-recon-logs'] });
      setExpanded(null);
      setReconForm(prev => { const n = { ...prev }; delete n[log.id]; return n; });
    } catch (e) {
      toast({ title: 'Could not reconcile', variant: 'destructive' });
    }
  };

  const handleAutoMatch = async (file) => {
    if (!file) return;
    setAutoMatching(true);
    try {
      // Upload the file first
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = uploadRes?.file_url || uploadRes?.data?.file_url;
      if (!fileUrl) throw new Error('Upload failed');

      // Call the auto-match function
      const res = await base44.functions.invoke('autoMatchVendorInvoice', { file_url: fileUrl });
      const result = res.data || res;
      if (result.success) {
        toast({
          title: result.is_match ? 'Auto-matched & reconciled' : 'Mismatch flagged',
          description: result.message,
          variant: result.is_match ? 'default' : 'destructive',
        });
      } else {
        toast({
          title: 'Auto-match incomplete',
          description: result.error || result.message || 'Could not auto-match this invoice.',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['subcon-recon-logs'] });
    } catch (e) {
      toast({ title: 'Auto-match failed', description: e.message, variant: 'destructive' });
    } finally {
      setAutoMatching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleForceReconcile = async (log) => {
    try {
      await base44.entities.SubcontractorLog.update(log.id, {
        reconciliation_status: 'reconciled',
        reconciled_at: new Date().toISOString(),
        reconciled_by_name: profile?.name || profile?.staff?.name || '',
      });
      toast({ title: 'Reconciled with note' });
      queryClient.invalidateQueries({ queryKey: ['subcon-recon-logs'] });
      setExpanded(null);
    } catch (e) {
      toast({ title: 'Could not reconcile', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
          <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Vendor Invoice Reconciliation</h3>
          <p className="text-[11px] text-slate-400">Match supplier invoices against logged sub-con costs</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleAutoMatch(f); }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={autoMatching}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex-shrink-0"
        >
          {autoMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {autoMatching ? 'Matching…' : 'Auto-Match Invoice'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px bg-slate-100 border-b border-slate-100">
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-medium">Pending</p>
          <p className="text-sm font-bold text-amber-600 tabular-nums">{stats.pending}</p>
        </div>
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-medium">Mismatch</p>
          <p className="text-sm font-bold text-red-600 tabular-nums">{stats.mismatched}</p>
        </div>
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-medium">Reconciled</p>
          <p className="text-sm font-bold text-emerald-600 tabular-nums">{stats.reconciled}</p>
        </div>
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-medium">Pending Value</p>
          <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(stats.pendingValue)}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sub-con, invoice no, PO…"
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-indigo-400">
          <option value="pending">Pending / Mismatch</option>
          <option value="mismatched">Mismatched only</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nothing to reconcile — all caught up.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
          {filtered.map(log => {
            const job = jobs.find(j => j.id === log.job_id);
            const sub = contractors.find(c => c.id === log.subcontractor_id);
            const st = RECON_STATUS[log.reconciliation_status || 'pending'];
            const StIcon = st.icon;
            const isExpanded = expanded === log.id;
            const form = getReconForm(log.id, log);
            const loggedNet = Number(log.purchase_cost_net) || 0;
            const invoiceNet = parseFloat(form.net);
            const diff = !isNaN(invoiceNet) ? invoiceNet - loggedNet : null;
            const isMatch = diff !== null && Math.abs(diff) <= TOLERANCE;
            const isReconciled = log.reconciliation_status === 'reconciled';

            return (
              <div key={log.id} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpanded(isExpanded ? null : log.id)} disabled={isReconciled}
                    className="flex-shrink-0 disabled:cursor-default">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${st.color}`}>
                    <StIcon className="w-2.5 h-2.5" /> {st.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{log.subcontractor_name || sub?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      {log.date ? format(new Date(log.date), 'dd MMM') : ''}
                      {log.invoice_number && <span>· INV: {log.invoice_number}</span>}
                      {log.po_number && <span>· PO: {log.po_number}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">Logged</p>
                    <p className="text-xs font-bold text-slate-800 tabular-nums">{fmt(loggedNet)}</p>
                  </div>
                </div>

                {isExpanded && !isReconciled && (
                  <div className="mt-2 ml-6 space-y-2">
                    <div className="bg-slate-50 rounded-lg p-2.5 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] text-slate-500 font-medium mb-0.5 uppercase">Invoice Net</label>
                          <input type="number" step="0.01" value={form.net} onChange={e => setReconField(log.id, 'net', e.target.value)}
                            placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 font-medium mb-0.5 uppercase">Invoice VAT</label>
                          <input type="number" step="0.01" value={form.vat} onChange={e => setReconField(log.id, 'vat', e.target.value)}
                            placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 font-medium mb-0.5 uppercase">Invoice Gross</label>
                          <input type="number" step="0.01" value={form.gross} onChange={e => setReconField(log.id, 'gross', e.target.value)}
                            placeholder="0.00" className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>

                      {diff !== null && (
                        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium ${isMatch ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {isMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          {isMatch ? 'Amounts match — ready to reconcile' : `Difference: ${diff > 0 ? '+' : ''}${fmt(diff)} (invoice vs logged)`}
                        </div>
                      )}

                      <input type="text" value={form.note} onChange={e => setReconField(log.id, 'note', e.target.value)}
                        placeholder="Reconciliation note (optional)…"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500" />

                      <div className="flex items-center gap-2">
                        <button onClick={() => handleReconcile(log)} disabled={isNaN(parseFloat(form.net))}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {diff !== null && isMatch ? 'Reconcile' : 'Reconcile (flag mismatch)'}
                        </button>
                        {diff !== null && !isMatch && (
                          <button onClick={() => handleForceReconcile(log)}
                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                            Accept as-is
                          </button>
                        )}
                      </div>
                    </div>
                    {log.description && <p className="text-xs text-slate-600">{log.description}</p>}
                    {log.invoice_url && (
                      <a href={log.invoice_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        <FileText className="w-3 h-3" /> View invoice PDF
                      </a>
                    )}
                  </div>
                )}

                {isReconciled && (
                  <div className="mt-1 ml-6 text-[10px] text-slate-400">
                    Reconciled{log.reconciled_by_name ? ` by ${log.reconciled_by_name}` : ''}
                    {log.reconciled_at ? ` on ${format(new Date(log.reconciled_at), 'dd MMM')}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}