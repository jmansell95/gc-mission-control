import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Send, Ban, Loader2, ChevronDown, ChevronRight, FileText,
  CheckCircle2, AlertCircle, Clock, Printer, Save, X, Pencil,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import InvoicePreviewModal from '@/components/billing/InvoicePreviewModal';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * DraftApprovalQueue — surfaces all draft invoices waiting for billing team
 * review before they're sent to the client. Each draft is expandable to show
 * its line items so the team can verify the charges before approving.
 *
 * Features:
 *  • Inline PDF preview modal (InvoicePreviewModal) — clean formatted invoice
 *  • Bulk select + Approve & Send — sticky bottom bar with count + total value
 *  • Inline line-item editing — edit qty/rate/description before approving
 *
 * This is the approval gate for the Auto-Invoice Engine: drafts are created
 * automatically from approved work, but they never reach the client until a
 * human reviews and clicks "Approve & Send" here.
 */
export default function DraftApprovalQueue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLines, setEditLines] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['draft-invoice-queue'],
    queryFn: () => base44.entities.Invoice.filter({ status: 'draft' }, '-created_date', 200),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draft-invoice-queue'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['billing-insights-invoices'] });
  };

  // ── Single approve ──
  const approve = async (inv) => {
    setBusyId(inv.id);
    try {
      await base44.entities.Invoice.update(inv.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      refresh();
      toast({ title: 'Invoice approved & sent', description: `${inv.invoice_number} is now with ${inv.client_name || 'the client'}.` });
    } catch (e) {
      toast({ title: 'Failed to send invoice', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  // ── Bulk approve & send ──
  const bulkApprove = async () => {
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await base44.entities.Invoice.update(id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        ok++;
      } catch { fail++; }
    }
    refresh();
    setSelectedIds([]);
    setShowBulkConfirm(false);
    setBulkBusy(false);
    if (fail === 0) {
      toast({ title: `${ok} invoice${ok === 1 ? '' : 's'} approved & sent`, description: 'All selected drafts are now with the client.' });
    } else {
      toast({ title: `${ok} sent, ${fail} failed`, description: 'Some invoices could not be sent. Check the list for errors.', variant: 'destructive' });
    }
  };

  const voidInvoice = async (inv) => {
    if (!confirm(`Void ${inv.invoice_number}? This cancels the invoice — it won't be sent to the client.`)) return;
    setBusyId(inv.id);
    try {
      await base44.entities.Invoice.update(inv.id, { status: 'void' });
      setSelectedIds(prev => prev.filter(id => id !== inv.id));
      refresh();
      toast({ title: 'Invoice voided', description: `${inv.invoice_number} cancelled.` });
    } catch (e) {
      toast({ title: 'Failed to void invoice', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  // ── Inline line-item editing ──
  const startEditing = (inv) => {
    setEditingId(inv.id);
    setEditLines(JSON.parse(JSON.stringify(inv.line_items || [])));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditLines([]);
  };

  const updateLine = (index, field, value) => {
    setEditLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Recalculate line_total when qty or unit_cost changes
      if (field === 'quantity' || field === 'unit_cost') {
        const qty = Number(next[index].quantity || 0);
        const cost = Number(next[index].unit_cost || 0);
        next[index].line_total = Math.round(qty * cost * 100) / 100;
      }
      return next;
    });
  };

  const saveLines = async (inv) => {
    setBusyId(inv.id);
    try {
      const net_total = editLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
      const vat_total = Math.round(net_total * (inv.vat_rate || 20) / 100 * 100) / 100;
      const gross_total = Math.round((net_total + vat_total) * 100) / 100;
      await base44.entities.Invoice.update(inv.id, {
        line_items: editLines,
        net_total,
        vat_total,
        gross_total,
      });
      refresh();
      setEditingId(null);
      setEditLines([]);
      toast({ title: 'Line items saved', description: `${inv.invoice_number} updated. Totals recalculated.` });
    } catch (e) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  // ── Selection ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.length === invoices.length ? [] : invoices.map(i => i.id));
  };

  const selectedInvoices = useMemo(
    () => invoices.filter(i => selectedIds.includes(i.id)),
    [invoices, selectedIds]
  );
  const selectedTotalGross = selectedInvoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const totalGross = invoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">No draft invoices waiting</p>
        <p className="text-xs text-slate-400 mt-1">All auto-generated drafts have been reviewed. New drafts appear here when the Auto-Invoice Engine runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Summary banner */}
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{invoices.length} draft {invoices.length === 1 ? 'invoice' : 'invoices'} awaiting approval</p>
          <p className="text-xs text-slate-500">Total value {gbp(totalGross)} · Review line items then approve to send to the client</p>
        </div>
        <button
          onClick={toggleSelectAll}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          {selectedIds.length === invoices.length ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {/* Draft list */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="divide-y divide-slate-100">
          {invoices.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const isSelected = selectedIds.includes(inv.id);
            const isEditing = editingId === inv.id;
            const lines = isEditing ? editLines : (inv.line_items || []);
            return (
              <div key={inv.id} className={`px-4 py-3 transition ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(inv.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary flex-shrink-0 cursor-pointer"
                  />
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="mt-0.5 p-1 rounded-lg hover:bg-slate-100 transition flex-shrink-0"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">{inv.invoice_number}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">DRAFT</span>
                      {inv.raised_by_name === 'Auto-Invoice Engine' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Auto-generated</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{inv.job_name || '—'}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                      <span>{inv.client_name || 'No client'}</span>
                      <span>·</span>
                      <span>Issued {inv.issue_date}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Due {inv.due_date}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-primary tabular-nums">{gbp(inv.gross_total)}</p>
                    <p className="text-[10px] text-slate-400">{(inv.line_items || []).length} {(inv.line_items || []).length === 1 ? 'line' : 'lines'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* PDF Preview */}
                    <button
                      title="Preview invoice"
                      onClick={() => setPreviewInvoice(inv)}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {/* Void */}
                    <button
                      title="Void"
                      onClick={() => voidInvoice(inv)}
                      disabled={busyId === inv.id || isEditing}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    {/* Approve & Send */}
                    <button
                      onClick={() => approve(inv)}
                      disabled={busyId === inv.id || isEditing}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {busyId === inv.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Send className="w-3.5 h-3.5" />}
                      Approve & Send
                    </button>
                  </div>
                </div>

                {/* Expandable line items */}
                {isExpanded && (
                  <div className="mt-3 ml-7 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden animate-slide-up">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-100/40 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-600">Line Items</p>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveLines(inv)}
                            disabled={busyId === inv.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                          >
                            {busyId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit lines
                        </button>
                      )}
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100/60 text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Description</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Unit Cost</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lines.map((l, i) => (
                          <tr key={i} className="text-slate-700">
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={l.description || ''}
                                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-emerald-600 bg-white"
                                />
                              ) : (
                                <>
                                  <p className="font-medium">{l.description || '—'}</p>
                                  {l.category && <span className="text-[10px] text-slate-400">{l.category}</span>}
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    value={l.quantity || 0}
                                    onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                                    className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs text-right tabular-nums focus:outline-none focus:border-emerald-600 bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={l.unit_label || ''}
                                    onChange={(e) => updateLine(i, 'unit_label', e.target.value)}
                                    placeholder="unit"
                                    className="w-12 px-1.5 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-emerald-600 bg-white"
                                  />
                                </div>
                              ) : (
                                <span className="tabular-nums">{Number(l.quantity || 0).toLocaleString('en-GB')} {l.unit_label || ''}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={l.unit_cost || 0}
                                  onChange={(e) => updateLine(i, 'unit_cost', Number(e.target.value))}
                                  className="w-20 px-1.5 py-1 border border-slate-200 rounded text-xs text-right tabular-nums focus:outline-none focus:border-emerald-600 bg-white"
                                />
                              ) : (
                                <span className="tabular-nums">{gbp(l.unit_cost)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {gbp(l.line_total)}
                            </td>
                          </tr>
                        ))}
                        {lines.length === 0 && (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">No line items</td></tr>
                        )}
                      </tbody>
                      {lines.length > 0 && (
                        <tfoot className="bg-slate-100/40">
                          <tr className="text-slate-600">
                            <td colSpan={3} className="px-3 py-2 text-right font-medium">Net</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums">
                              {gbp(isEditing ? editLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0) : inv.net_total)}
                            </td>
                          </tr>
                          <tr className="text-slate-600">
                            <td colSpan={3} className="px-3 py-2 text-right font-medium">VAT ({inv.vat_rate || 20}%)</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {gbp(isEditing
                                ? Math.round(editLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0) * (inv.vat_rate || 20) / 100 * 100) / 100
                                : inv.vat_total)}
                            </td>
                          </tr>
                          <tr className="text-primary">
                            <td colSpan={3} className="px-3 py-2 text-right font-bold">Gross Total</td>
                            <td className="px-3 py-2 text-right font-extrabold tabular-nums">
                              {gbp(isEditing
                                ? Math.round((editLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0) +
                                  Math.round(editLines.reduce((s, l) => s + (Number(l.line_total) || 0), 0) * (inv.vat_rate || 20) / 100 * 100) / 100) * 100) / 100
                                : inv.gross_total)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky bulk action bar */}
      {selectedIds.length > 0 && !showBulkConfirm && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
          <div className="mx-auto max-w-3xl m-4">
            <div className="hub-glass rounded-2xl shadow-2xl border-primary/20 px-5 py-3.5 flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-extrabold text-primary">{selectedIds.length}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedIds.length} selected</p>
                  <p className="text-xs text-slate-500">Total value {gbp(selectedTotalGross)}</p>
                </div>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
              >
                Clear
              </button>
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition glow-brand"
              >
                <Send className="w-3.5 h-3.5" />
                Approve & Send All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Send className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Approve & send {selectedIds.length} invoices?</h2>
                <p className="text-sm text-slate-600 mt-1">
                  You're about to send <strong className="text-slate-900">{selectedIds.length}</strong> draft invoice{selectedIds.length === 1 ? '' : 's'} with a total value of <strong className="text-primary">{gbp(selectedTotalGross)}</strong> to the respective clients. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowBulkConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">Cancel</button>
              <button
                onClick={bulkApprove}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {bulkBusy ? 'Sending…' : `Approve & Send ${selectedIds.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}
    </div>
  );
}