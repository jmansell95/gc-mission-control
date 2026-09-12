import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ClipboardList, Plus, Search, Loader2, Trash2, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, RefreshCw, ArrowRight, Download, Upload, Edit3, X, Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB');

const STATUS_META = {
  not_started: { label: 'Not Started', icon: Clock, cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', icon: TrendingUp, cls: 'bg-blue-100 text-blue-700' },
  complete: { label: 'Complete', icon: CheckCircle2, cls: 'bg-primary/15 text-primary' },
  variation: { label: 'Variation', icon: ArrowRight, cls: 'bg-violet-100 text-violet-700' },
  overrun: { label: 'Overrun', icon: AlertTriangle, cls: 'bg-rose-100 text-rose-700' },
};

export default function BOQManager({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [variationReason, setVariationReason] = useState({});
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef(null);

  const { data: boqLines = [], isLoading } = useQuery({
    queryKey: ['boq-lines', job.id],
    queryFn: () => base44.entities.JobBillOfQuantities.filter({ job_id: job.id }, 'sort_order'),
  });

  const { data: rateItems = [] } = useQuery({
    queryKey: ['boq-rate-items', job.project_id],
    queryFn: async () => {
      if (job.project_id) {
        const projectItems = await base44.entities.RateCardItem.filter({ project_id: job.project_id, is_active: true }, 'sort_order', 500);
        if (projectItems.length > 0) return projectItems;
      }
      return base44.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, 'sort_order', 500);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boqLines;
    return boqLines.filter((l) =>
      l.description?.toLowerCase().includes(q) ||
      l.sor_ref?.toLowerCase().includes(q) ||
      l.subcategory?.toLowerCase().includes(q)
    );
  }, [boqLines, search]);

  const totals = useMemo(() => {
    const agreed = boqLines.reduce((s, l) => s + (Number(l.agreed_line_total) || 0), 0);
    const actualValue = boqLines.reduce((s, l) =>
      s + (Number(l.actual_quantity) || 0) * (Number(l.agreed_unit_price) || 0), 0);
    const overrunCount = boqLines.filter((l) => l.status === 'overrun').length;
    return { agreed, actualValue, overrunCount, lineCount: boqLines.length };
  }, [boqLines]);

  const refreshVariations = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('checkBOQVariations', { job_id: job.id });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'BOQ updated', description: 'Actual quantities recalculated from logged work.' });
    } catch (e) {
      toast({ title: 'Refresh failed', description: e?.message, variant: 'destructive' });
    }
    setRefreshing(false);
  };

  const approveVariation = async (line) => {
    const reason = variationReason[line.id];
    if (!reason?.trim()) {
      toast({ title: 'Reason required', description: 'Enter a justification for the variation.', variant: 'destructive' });
      return;
    }
    setApprovingId(line.id);
    try {
      const approverName = authUser?.full_name || authUser?.email || 'Admin';
      // Create a new variation BOQ line for the surplus
      await base44.entities.JobBillOfQuantities.create({
        job_id: job.id,
        project_id: job.project_id || null,
        rate_card_item_id: line.rate_card_item_id || null,
        sor_ref: line.sor_ref || '',
        description: `${line.description} — Variation`,
        category: line.category || 'labour',
        subcategory: line.subcategory || '',
        unit: line.unit || 'nr',
        agreed_quantity: Number(line.variation_quantity) || 0,
        agreed_unit_price: Number(line.agreed_unit_price) || 0,
        agreed_line_total: ((Number(line.variation_quantity) || 0) * (Number(line.agreed_unit_price) || 0)),
        actual_quantity: 0,
        remaining_quantity: Number(line.variation_quantity) || 0,
        variation_quantity: 0,
        status: 'complete',
        is_variation: true,
        variation_of_id: line.id,
        variation_reason: reason.trim(),
        approved_by_name: approverName,
        approved_at: new Date().toISOString(),
        sort_order: line.sort_order || 0,
      });
      // Mark the original line as 'variation' (approved)
      await base44.entities.JobBillOfQuantities.update(line.id, { status: 'variation' });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      setVariationReason((p) => ({ ...p, [line.id]: '' }));
      toast({ title: 'Variation approved', description: `+${fmtQty(line.variation_quantity)} ${line.unit || ''} added as approved scope.` });
    } catch (e) {
      toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' });
    }
    setApprovingId(null);
  };

  const deleteLine = async (line) => {
    if (!confirm(`Remove "${line.description}" from the BOQ?`)) return;
    try {
      await base44.entities.JobBillOfQuantities.delete(line.id);
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'BOQ line removed' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  const startEdit = (line) => {
    setEditingId(line.id);
    setEditQty(String(line.agreed_quantity || ''));
    setEditPrice(String(line.agreed_unit_price || ''));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQty('');
    setEditPrice('');
  };

  const saveEdit = async (line) => {
    const qty = Number(editQty) || 0;
    const price = Number(editPrice) || 0;
    if (qty <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      await base44.entities.JobBillOfQuantities.update(line.id, {
        agreed_quantity: qty,
        agreed_unit_price: price,
        agreed_line_total: Math.round(qty * price * 100) / 100,
        remaining_quantity: Math.round((qty - (Number(line.actual_quantity) || 0)) * 100) / 100,
      });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'BOQ line updated', description: line.description });
      cancelEdit();
    } catch (e) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
    setSavingEdit(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('boqImportExport', { mode: 'export', job_id: job.id });
      if (res?.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BOQ_${job.name?.replace(/[^a-z0-9]/gi, '_') || 'export'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'BOQ exported', description: `${res.data.line_count} lines downloaded as CSV.` });
      }
    } catch (e) {
      toast({ title: 'Export failed', description: e?.message, variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.functions.invoke('boqImportExport', {
        mode: 'import',
        file_url: uploadRes.file_url,
        job_id: job.id,
        project_id: job.project_id || null,
      });
      if (res?.data?.ok) {
        queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
        toast({
          title: 'BOQ imported',
          description: `${res.data.imported} lines imported · ${res.data.matched_rates} matched to rate card · ${res.data.skipped} skipped.`,
        });
      } else {
        toast({ title: 'Import failed', description: res?.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Import failed', description: err?.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Hidden file input for CSV import */}
      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">Bill of Quantities</h3>
          <p className="text-xs text-slate-500">Contracted scope vs actual logged work — variations flagged automatically</p>
        </div>
        <button onClick={handleExport} disabled={exporting || boqLines.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
          title="Download BOQ as CSV">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Export
        </button>
        <button onClick={handleImportClick} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
          title="Import BOQ from CSV">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import
        </button>
        <button onClick={refreshVariations} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition disabled:opacity-50">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg text-xs font-medium transition">
          <Plus className="w-3.5 h-3.5" /> Add Line
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-100">
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Contract Value</p>
          <p className="text-base font-bold text-slate-900">{fmt(totals.agreed)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Earned (Actual)</p>
          <p className="text-base font-bold text-primary">{fmt(totals.actualValue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">BOQ Lines</p>
          <p className="text-base font-bold text-slate-900">{totals.lineCount}</p>
        </div>
        <div className={`rounded-lg border p-2.5 ${totals.overrunCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Overruns</p>
          <p className={`text-base font-bold ${totals.overrunCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{totals.overrunCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SOR ref, description or section…"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          {boqLines.length === 0 ? 'No BOQ lines yet — add SOR items to define contracted scope.' : 'No lines match your search.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {filtered.map((line) => {
            const meta = STATUS_META[line.status] || STATUS_META.not_started;
            const StatusIcon = meta.icon;
            const pct = line.agreed_quantity > 0 ? Math.min(100, (line.actual_quantity / line.agreed_quantity) * 100) : 0;
            const isOver = line.status === 'overrun';
            return (
              <div key={line.id} className={`p-3 ${isOver ? 'bg-rose-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {line.sor_ref && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">{line.sor_ref}</span>}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.cls}`}>
                        <StatusIcon className="w-2.5 h-2.5" /> {meta.label}
                      </span>
                      {line.is_variation && <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-semibold">Variation</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{line.description}</p>
                    {line.subcategory && <p className="text-[11px] text-slate-400 truncate">{line.subcategory}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      {editingId === line.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                            placeholder="Qty" className="w-20 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <span className="text-slate-400">{line.unit || ''}</span>
                          <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="Price" className="w-24 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <span className="font-semibold text-primary">{fmt((Number(editQty) || 0) * (Number(editPrice) || 0))}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-slate-500">{fmtQty(line.actual_quantity)} / {fmtQty(line.agreed_quantity)} {line.unit || ''}</span>
                          <span className="text-slate-600 font-medium">@ {fmt(line.agreed_unit_price)}/{line.unit || 'ea'}</span>
                          <span className="font-semibold text-slate-900">{fmt((line.actual_quantity || 0) * (line.agreed_unit_price || 0))}</span>
                        </>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isOver ? 'bg-rose-500' : pct >= 100 ? 'bg-primary' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingId === line.id ? (
                      <>
                        <button onClick={() => saveEdit(line)} disabled={savingEdit}
                          className="p-1.5 text-primary hover:bg-primary/10 rounded transition disabled:opacity-50" title="Save">
                          {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={cancelEdit} disabled={savingEdit}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(line)} disabled={line.is_variation}
                          className="p-1.5 text-slate-300 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition" title="Edit quantity / price">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteLine(line)} disabled={line.is_variation}
                          className="p-1.5 text-slate-300 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Overrun approval panel */}
                {isOver && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <p className="text-xs font-semibold text-rose-800">
                        Overrun: +{fmtQty(line.variation_quantity)} {line.unit || ''} beyond contracted scope
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={variationReason[line.id] || ''}
                        onChange={(e) => setVariationReason((p) => ({ ...p, [line.id]: e.target.value }))}
                        placeholder="Variation reason (e.g. Client requested deeper drilling)…"
                        className="flex-1 px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      <button
                        onClick={() => approveVariation(line)}
                        disabled={approvingId === line.id}
                        className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-xs font-medium transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {approvingId === line.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve Variation'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Line Modal */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) setShowAdd(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add BOQ Line from Schedule of Rates</DialogTitle>
          </DialogHeader>
          <AddBOQLineForm
            job={job}
            rateItems={rateItems}
            onAdded={() => { queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] }); setShowAdd(false); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddBOQLineForm({ job, rateItems, onAdded }) {
  const { toast } = useToast();
  const [selectedRateId, setSelectedRateId] = useState('');
  const [qty, setQty] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredRates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateItems.slice(0, 50);
    return rateItems.filter((r) =>
      r.description?.toLowerCase().includes(q) ||
      r.subcategory?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [rateItems, search]);

  const selected = rateItems.find((r) => r.id === selectedRateId);
  const unitPrice = priceOverride ? Number(priceOverride) : (selected?.price || 0);
  const lineTotal = (Number(qty) || 0) * unitPrice;

  const save = async () => {
    if (!selected || !qty) {
      toast({ title: 'Select a rate and enter quantity', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.JobBillOfQuantities.create({
        job_id: job.id,
        project_id: job.project_id || null,
        rate_card_item_id: selected.id,
        sor_ref: selected.sor_ref || '',
        description: selected.description,
        category: selected.category || 'labour',
        subcategory: selected.subcategory || '',
        unit: selected.unit || 'nr',
        agreed_quantity: Number(qty),
        agreed_unit_price: unitPrice,
        agreed_line_total: Math.round(lineTotal * 100) / 100,
        actual_quantity: 0,
        remaining_quantity: Number(qty),
        variation_quantity: 0,
        status: 'not_started',
        is_variation: false,
        sort_order: selected.sort_order || 0,
      });
      toast({ title: 'BOQ line added', description: `${selected.description} — ${qty} ${selected.unit || ''}` });
      onAdded();
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
          placeholder="Search rate card items…"
          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto divide-y divide-slate-100">
        {filteredRates.map((r) => (
          <button key={r.id} onClick={() => setSelectedRateId(r.id)}
            className={`w-full text-left p-2.5 hover:bg-primary/5 transition ${selectedRateId === r.id ? 'bg-primary/10 border-l-4 border-primary' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">{r.category?.[0]?.toUpperCase()}</span>
              <p className="text-sm font-medium text-slate-800 flex-1 truncate">{r.description}</p>
              <span className="text-sm font-semibold text-slate-900">£{r.price}</span>
              <span className="text-[10px] text-slate-400">/{r.unit}</span>
            </div>
            {r.subcategory && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{r.subcategory}</p>}
          </button>
        ))}
        {filteredRates.length === 0 && <p className="text-center py-6 text-slate-400 text-sm">No rate items found</p>}
      </div>
      {selected && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3">
          <div className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{selected.description}</span>
            <span className="text-slate-400"> · {selected.subcategory || selected.category}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Quantity</label>
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Unit Price (£)</label>
              <input type="number" value={priceOverride} onChange={(e) => setPriceOverride(e.target.value)}
                placeholder={String(selected.price || '')}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Line Total</label>
              <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-primary">
                {fmt(lineTotal)}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Unit: {selected.unit || 'nr'} · Override price only for negotiated rates</p>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={save} disabled={saving || !selected || !qty}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add to BOQ
        </button>
      </div>
    </div>
  );
}