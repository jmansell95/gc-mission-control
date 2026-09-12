import React from 'react';
import { X, Printer } from 'lucide-react';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * InvoicePreviewModal — renders a clean, formatted invoice document inside
 * a modal dialog. Shows the company header, bill-to block, line items table,
 * totals box, and payment terms — replacing the old plain-text print window.
 */
export default function InvoicePreviewModal({ invoice, onClose }) {
  if (!invoice) return null;
  const lines = invoice.line_items || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 print:block print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none print:max-w-none">
        {/* Modal header — hidden on print */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 print:hidden sticky top-0 bg-white z-10">
          <h2 className="text-sm font-bold text-slate-900">Invoice Preview — {invoice.invoice_number}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice document */}
        <div className="p-8 print:p-0">
          {/* Company header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-primary">
            <div>
              <h1 className="text-2xl font-extrabold text-primary tracking-tight">Ground Control</h1>
              <p className="text-xs text-slate-500 mt-1">Geotechnical & Environmental Specialists</p>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                Unit 1, Industrial Estate<br />
                Cambridge, CB1 0XX<br />
                VAT No: GB 123 4567 89
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">INVOICE</h2>
              <p className="text-sm font-bold text-slate-600 mt-1">{invoice.invoice_number}</p>
              <div className="mt-3 text-xs text-slate-500 space-y-0.5">
                <p><span className="font-semibold text-slate-700">Issued:</span> {invoice.issue_date || '—'}</p>
                <p><span className="font-semibold text-slate-700">Due:</span> {invoice.due_date || '—'}</p>
              </div>
            </div>
          </div>

          {/* Bill-to + Job info */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Bill To</p>
              <p className="text-sm font-bold text-slate-900">{invoice.client_name || '—'}</p>
              {invoice.job_name && (
                <p className="text-xs text-slate-500 mt-0.5">{invoice.job_name}</p>
              )}
              {invoice.job_reference && (
                <p className="text-xs text-slate-400 mt-0.5">Ref: {invoice.job_reference}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Project Reference</p>
              <p className="text-sm font-medium text-slate-700">{invoice.job_reference || invoice.job_name || '—'}</p>
              {invoice.revenue_method && invoice.revenue_method !== 'none' && (
                <p className="text-xs text-slate-400 mt-0.5 capitalize">
                  {invoice.revenue_method.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div className="mb-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="text-left px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wide">Description</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wide">Unit Cost</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-600 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800">{l.description || '—'}</p>
                      {l.category && <span className="text-[10px] text-slate-400 capitalize">{l.category}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                      {Number(l.quantity || 0).toLocaleString('en-GB')} {l.unit_label || ''}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{gbp(l.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{gbp(l.line_total)}</td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No line items</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals + Notes */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Net</span>
                <span className="font-semibold text-slate-800 tabular-nums">{gbp(invoice.net_total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">VAT ({invoice.vat_rate || 20}%)</span>
                <span className="font-semibold text-slate-800 tabular-nums">{gbp(invoice.vat_total)}</span>
              </div>
              <div className="flex justify-between text-base pt-2 border-t-2 border-primary">
                <span className="font-bold text-slate-900">Gross Total</span>
                <span className="font-extrabold text-primary tabular-nums">{gbp(invoice.gross_total)}</span>
              </div>
            </div>
          </div>

          {/* Payment terms */}
          {(invoice.notes || invoice.due_date) && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Payment Terms</p>
              {invoice.due_date && (
                <p className="text-xs text-slate-600">Payment due by {invoice.due_date}. Please remit to the address above.</p>
              )}
              {invoice.notes && (
                <p className="text-xs text-slate-500 mt-1">{invoice.notes}</p>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-slate-400 mt-6">Thank you for your business — Ground Control</p>
        </div>
      </div>
    </div>
  );
}