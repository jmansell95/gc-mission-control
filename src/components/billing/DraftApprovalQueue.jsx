import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Send, Ban, Loader2, ChevronDown, ChevronRight, FileText,
  CheckCircle2, AlertCircle, Clock, Printer,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * DraftApprovalQueue — surfaces all draft invoices waiting for billing team
 * review before they're sent to the client. Each draft is expandable to show
 * its line items so the team can verify the charges before approving.
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

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['draft-invoice-queue'],
    queryFn: () => base44.entities.Invoice.filter({ status: 'draft' }, '-created_date', 200),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draft-invoice-queue'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['billing-insights-invoices'] });
  };

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

  const voidInvoice = async (inv) => {
    if (!confirm(`Void ${inv.invoice_number}? This cancels the invoice — it won't be sent to the client.`)) return;
    setBusyId(inv.id);
    try {
      await base44.entities.Invoice.update(inv.id, { status: 'void' });
      refresh();
      toast({ title: 'Invoice voided', description: `${inv.invoice_number} cancelled.` });
    } catch (e) {
      toast({ title: 'Failed to void invoice', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const reprint = (inv) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<pre style="font-family:monospace;padding:20px">${inv.invoice_number} — ${inv.job_name}\n\nNet: ${gbp(inv.net_total)}\nVAT: ${gbp(inv.vat_total)}\nGross: ${gbp(inv.gross_total)}</pre>`);
    win.document.close();
  };

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
      <div className="insight-card rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">No draft invoices waiting</p>
        <p className="text-xs text-slate-400 mt-1">All auto-generated drafts have been reviewed. New drafts appear here when the Auto-Invoice Engine runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="insight-card rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{invoices.length} draft {invoices.length === 1 ? 'invoice' : 'invoices'} awaiting approval</p>
          <p className="text-xs text-slate-500">Total value {gbp(totalGross)} · Review line items then approve to send to the client</p>
        </div>
      </div>

      {/* Draft list */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="divide-y divide-slate-100">
          {invoices.map((inv) => {
            const isExpanded = expandedId === inv.id;
            const lines = inv.line_items || [];
            return (
              <div key={inv.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
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
                    <p className="text-sm font-bold text-[#2E5A1A] tabular-nums">{gbp(inv.gross_total)}</p>
                    <p className="text-[10px] text-slate-400">{lines.length} {lines.length === 1 ? 'line' : 'lines'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      title="Reprint preview"
                      onClick={() => reprint(inv)}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      title="Void"
                      onClick={() => voidInvoice(inv)}
                      disabled={busyId === inv.id}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => approve(inv)}
                      disabled={busyId === inv.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#2E5A1A] text-white hover:bg-[#1c4a12] transition disabled:opacity-50"
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
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100/60 text-slate-500">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Description</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Unit</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lines.map((l, i) => (
                          <tr key={i} className="text-slate-700">
                            <td className="px-3 py-2">
                              <p className="font-medium">{l.description || '—'}</p>
                              {l.category && <span className="text-[10px] text-slate-400">{l.category}</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{Number(l.quantity || 0).toLocaleString('en-GB')} {l.unit_label || ''}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{gbp(l.unit_cost)}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{gbp(l.line_total)}</td>
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
                            <td className="px-3 py-2 text-right font-bold tabular-nums">{gbp(inv.net_total)}</td>
                          </tr>
                          <tr className="text-slate-600">
                            <td colSpan={3} className="px-3 py-2 text-right font-medium">VAT ({inv.vat_rate || 20}%)</td>
                            <td className="px-3 py-2 text-right tabular-nums">{gbp(inv.vat_total)}</td>
                          </tr>
                          <tr className="text-[#2E5A1A]">
                            <td colSpan={3} className="px-3 py-2 text-right font-bold">Gross Total</td>
                            <td className="px-3 py-2 text-right font-extrabold tabular-nums">{gbp(inv.gross_total)}</td>
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
    </div>
  );
}