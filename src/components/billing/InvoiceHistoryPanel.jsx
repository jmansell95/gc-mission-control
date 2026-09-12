import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Printer, Send, CheckCircle2, Ban, Loader2, Receipt } from 'lucide-react';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  void: 'bg-rose-100 text-rose-700 line-through',
};

function statusBadgeClass(status) {
  return 'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ' + (STATUS_STYLES[status] || 'bg-slate-100 text-slate-600');
}

function invoiceHtml(invoice, clients, companyName) {
  const client = clients.find((c) => c.id === invoice.client_id) || {};
  const rows = (invoice.line_items || []).map((l, i) => {
    const idx = i + 1;
    const desc = l.description || '';
    const qty = Number(l.quantity || 0).toLocaleString('en-GB');
    const unit = gbp(l.unit_cost);
    const total = gbp(l.line_total);
    return '<tr><td>' + idx + '</td><td>' + desc + '</td><td class="num">' + qty + '</td><td class="num">' + unit + '</td><td class="num">' + total + '</td></tr>';
  }).join('');
  const bodyRows = rows || '<tr><td colspan="5">No chargeable items</td></tr>';
  const contactLine = client.contact_name ? '<p>' + client.contact_name + '</p>' : '';
  const refLine = invoice.job_reference ? '<p>Ref: ' + invoice.job_reference + '</p>' : '';
  const vatPct = invoice.vat_rate || 20;
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + invoice.invoice_number + '</title>',
    '<style>',
    '*{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-sizing:border-box}body{margin:0;padding:40px;color:#1a2e15}',
    '.head{display:flex;justify-content:space-between;border-bottom:3px solid #2E5A1A;padding-bottom:16px;margin-bottom:24px}',
    '.brand{font-size:22px;font-weight:800;color:#2E5A1A}.brand small{display:block;font-size:11px;font-weight:500;color:#64748b;margin-top:2px}',
    '.inv-meta{text-align:right}.inv-meta h1{margin:0;font-size:26px;letter-spacing:.04em;color:#2E5A1A}.inv-meta .num{font-size:14px;font-weight:700;color:#475569}',
    '.parties{display:flex;justify-content:space-between;margin-bottom:24px;gap:40px}.parties h3{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:0 0 4px}.parties p{margin:0;font-size:13px}.parties .name{font-weight:700;font-size:14px}',
    'table{width:100%;border-collapse:collapse;margin-bottom:24px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:8px 10px;background:#f1f5f9;border-bottom:2px solid #e2e8f0}th.num,td.num{text-align:right}td{padding:10px;font-size:13px;border-bottom:1px solid #e2e8f0}',
    '.totals{margin-left:auto;width:280px}.totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}.totals .grand{border-top:2px solid #2E5A1A;margin-top:6px;padding-top:10px;font-weight:800;font-size:17px;color:#2E5A1A}',
    '.foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.5}@media print{body{padding:0}}',
    '</style></head><body>',
    '<div class="head"><div class="brand">' + companyName + '<small>Ground Investigation Services</small></div><div class="inv-meta"><h1>INVOICE</h1><div class="num">' + invoice.invoice_number + '</div></div></div>',
    '<div class="parties"><div><h3>From</h3><p class="name">' + companyName + '</p></div><div style="text-align:right"><h3>Bill To</h3><p class="name">' + (client.name || '—') + '</p>' + contactLine + '</div></div>',
    '<div class="parties"><div><h3>Project / Job</h3><p class="name">' + (invoice.job_name || '—') + '</p>' + refLine + '</div><div style="text-align:right"><h3>Issued</h3><p>' + invoice.issue_date + '</p></div></div>',
    '<table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead><tbody>' + bodyRows + '</tbody></table>',
    '<div class="totals"><div class="row"><span>Subtotal</span><span>' + gbp(invoice.net_total) + '</span></div><div class="row"><span>VAT (' + vatPct + '%)</span><span>' + gbp(invoice.vat_total) + '</span></div><div class="row grand"><span>Total Due</span><span>' + gbp(invoice.gross_total) + '</span></div></div>',
    '<div class="foot">Thank you for your business. Payment due within 30 days of issue date.</div>',
    '</body></html>',
  ].join('');
}

export default function InvoiceHistoryPanel({ companyName }) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);

  const { data: invoices = [], isLoading } = useScopedEntity('Invoice', { queryKey: ['invoices'], sort: '-created_date', limit: 100 });
  const { data: clients = [] } = useQuery({ queryKey: ['billing-clients'], queryFn: () => base44.entities.Client.list() });

  const reprint = (inv) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(invoiceHtml(inv, clients, companyName || 'Ground Control'));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const setStatus = async (inv, status) => {
    setBusyId(inv.id);
    try {
      const patch = { status };
      if (status === 'sent') patch.sent_at = new Date().toISOString();
      if (status === 'paid') patch.paid_at = new Date().toISOString();
      await base44.entities.Invoice.update(inv.id, patch);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      alert('Failed to update invoice: ' + (e.message || 'Unknown error'));
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">No invoices raised yet</p>
        <p className="text-xs mt-1">Generate an invoice from a job in the Invoice Summary tab.</p>
      </div>
    );
  }

  const totalGross = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Raised</p>
          <p className="text-lg font-bold text-slate-800">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Outstanding</p>
          <p className="text-lg font-bold text-amber-600">{gbp(outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Total (excl. void)</p>
          <p className="text-lg font-bold text-primary">{gbp(totalGross)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 font-medium">Job</th>
                <th className="text-left px-4 py-2.5 font-medium">Client</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Total</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{inv.invoice_number}</p>
                    <p className="text-[10px] text-slate-400">{inv.issue_date}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate text-slate-600">{inv.job_name || '—'}</td>
                  <td className="px-4 py-3 max-w-[140px] truncate text-slate-600">{inv.client_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(inv.status)}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">{gbp(inv.gross_total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Reprint" onClick={() => reprint(inv)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {inv.status === 'draft' && (
                        <button title="Mark sent" onClick={() => setStatus(inv, 'sent')} disabled={busyId === inv.id} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50">
                          {busyId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <button title="Mark paid" onClick={() => setStatus(inv, 'paid')} disabled={busyId === inv.id} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50">
                          {busyId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {inv.status !== 'void' && inv.status !== 'paid' && (
                        <button title="Void" onClick={() => setStatus(inv, 'void')} disabled={busyId === inv.id} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}