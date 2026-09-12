import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Printer, FileCheck2, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { calcNights } from '@/utils/billingSummary';
import { getTotalMetres } from '@/utils/geotechBilling';

const gbp = (n) => '£' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Build itemised invoice line items for a job from its raw entity data.
 * Each line: { description, quantity, unit_label, unit_cost, line_total, category }
 */
export function buildInvoiceLines(job, data) {
  const { costItems = [], hotelBookings = [], deliveries = [], timesheets = [], invLogs = [], rigAssignments = [], rateItems = [], siteAssets = [] } = data;
  const lines = [];

  // Identify rig cost items so they can be excluded from the equipment lines
  // (rigs are costed separately via day rate × working days on the job detail page)
  const siteAssetMap = {};
  (siteAssets || []).forEach((a) => { siteAssetMap[a.id] = a; });
  const isRigItem = (c) => {
    if (!c.site_asset_id) return false;
    const a = siteAssetMap[c.site_asset_id];
    return a && (a.is_rig === true || a.asset_type === 'rig');
  };

  // Equipment & labour cost items — use negotiated price when confirmed (POA items)
  const chargeableCost = costItems.filter((c) =>
    c.category !== 'client_supplied' &&
    c.category !== 'contractor_supplied' &&
    !isRigItem(c) &&
    (
      (c.price_confirmed && c.negotiated_unit_cost != null ? Number(c.negotiated_unit_cost) : (Number(c.unit_cost) || 0)) > 0
    )
  );
  chargeableCost.forEach((c) => {
    const unitCost = c.price_confirmed && c.negotiated_unit_cost != null
      ? Number(c.negotiated_unit_cost)
      : (Number(c.unit_cost) || 0);
    const qty = Number(c.quantity) || 1;
    lines.push({
      description: c.description || c.reference_number || 'Equipment',
      quantity: qty,
      unit_label: c.unit_label || 'each',
      unit_cost: unitCost,
      line_total: unitCost * qty,
      category: c.category === 'labour' ? 'Labour' : 'Equipment',
    });
  });

  // Hotel bookings
  hotelBookings.forEach((b) => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const rooms = Number(b.room_count) || 1;
    const total = (Number(b.cost_per_night) || 0) * rooms * nights;
    if (total <= 0) return;
    lines.push({
      description: `Accommodation — ${b.hotel_name}${b.room_type ? ` (${b.room_type})` : ''}`,
      quantity: nights * rooms,
      unit_label: 'night',
      unit_cost: Number(b.cost_per_night) || 0,
      line_total: total,
      category: 'Accommodation',
    });
  });

  // Chargeable deliveries
  deliveries.filter((d) => d.chargeable !== false && (Number(d.charge_amount) || 0) > 0).forEach((d) => {
    lines.push({
      description: `Delivery — ${d.item_description || d.description || 'Site delivery'}`,
      quantity: 1,
      unit_label: 'sum',
      unit_cost: Number(d.charge_amount) || 0,
      line_total: Number(d.charge_amount) || 0,
      category: 'Delivery',
    });
  });

  // Chargeable approved timesheet task entries
  const billableTs = timesheets.filter((t) => t.chargeable && !t.is_break && (Number(t.charge_amount) || 0) > 0);
  const tsTotal = billableTs.reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  if (tsTotal > 0) {
    lines.push({
      description: `Site work — ${billableTs.length} chargeable ${billableTs.length === 1 ? 'entry' : 'entries'}`,
      quantity: 1,
      unit_label: 'sum',
      unit_cost: tsTotal,
      line_total: tsTotal,
      category: 'Site work',
    });
  }

  // Revenue-method based charge line (meterage / unit / day rate / flat fee)
  const method = job.revenue_method || 'none';
  if (method === 'meterage_rate') {
    const manual = Number(job.meterage) || 0;
    const metres = manual > 0 ? manual : getTotalMetres(invLogs);
    const rate = Number(job.meterage_rate) || 0;
    lines.push({ description: `Drilling meterage — ${metres.toFixed(1)}m ${manual > 0 ? '' : '(auto from logs)'}`, quantity: Number(metres.toFixed(1)), unit_label: 'm', unit_cost: rate, line_total: metres * rate, category: 'Meterage' });
  } else if (method === 'unit_rate') {
    const units = invLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
    const price = Number(job.unit_price) || 0;
    lines.push({ description: `Units completed — ${units} ${job.meterage ? '' : ''}`, quantity: units, unit_label: 'unit', unit_cost: price, line_total: units * price, category: 'Unit rate' });
  } else if (method === 'day_rate') {
    // Only rig assignments are billable under day-rate billing
    const rigs = (rigAssignments || []).filter((a) => a.asset_type === 'rig');
    lines.push({ description: 'Crew day rates (per rig assignment)', quantity: rigs.length, unit_label: 'rig', unit_cost: 0, line_total: 0, category: 'Day rate — see report' });
  } else if (method === 'flat_fee') {
    lines.push({ description: 'Project fee (agreed flat fee)', quantity: 1, unit_label: 'sum', unit_cost: Number(job.client_charge) || 0, line_total: Number(job.client_charge) || 0, category: 'Flat fee' });
  }

  return lines;
}

function buildInvoiceHtml(invoice, job, client, companyName) {
  const rows = (invoice.line_items || []).map((l, i) => {
    const idx = i + 1;
    const desc = l.description || '';
    const qty = Number(l.quantity || 0).toLocaleString('en-GB');
    const unit = gbp(l.unit_cost);
    const total = gbp(l.line_total);
    return '<tr><td>' + idx + '</td><td>' + desc + '</td><td class="num">' + qty + '</td><td class="num">' + unit + '</td><td class="num">' + total + '</td></tr>';
  }).join('');
  const bodyRows = rows || '<tr><td colspan="5">No chargeable items</td></tr>';
  const contactLine = client?.contact_name ? '<p>' + client.contact_name + '</p>' : '';
  const emailLine = client?.contact_email ? '<p>' + client.contact_email + '</p>' : '';
  const refLine = job?.job_reference ? '<p>Ref: ' + job.job_reference + '</p>' : '';
  const locLine = job?.location ? '<p>' + job.location + '</p>' : '';
  const notesLine = invoice.notes ? '<div class="foot">' + invoice.notes + '</div>' : '';
  const vatPct = invoice.vat_rate || 20;
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + invoice.invoice_number + '</title>',
    '<style>',
    '* { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; box-sizing: border-box; }',
    'body { margin: 0; padding: 40px; color: #1a2e15; }',
    '.head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #2E5A1A; padding-bottom: 16px; margin-bottom: 24px; }',
    '.brand { font-size: 22px; font-weight: 800; color: #2E5A1A; }',
    '.brand small { display:block; font-size: 11px; font-weight: 500; color: #64748b; margin-top:2px; }',
    '.inv-meta { text-align: right; }',
    '.inv-meta h1 { margin: 0; font-size: 26px; letter-spacing: 0.04em; color: #2E5A1A; }',
    '.inv-meta .num { font-size: 14px; font-weight: 700; color: #475569; }',
    '.parties { display:flex; justify-content:space-between; margin-bottom: 24px; gap: 40px; }',
    '.parties h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin: 0 0 4px; }',
    '.parties p { margin: 0; font-size: 13px; }',
    '.parties .name { font-weight: 700; font-size: 14px; }',
    'table { width:100%; border-collapse: collapse; margin-bottom: 24px; }',
    'th { text-align:left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; padding: 8px 10px; background:#f1f5f9; border-bottom: 2px solid #e2e8f0; }',
    'th.num, td.num { text-align: right; }',
    'td { padding: 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }',
    '.totals { margin-left:auto; width: 280px; }',
    '.totals .row { display:flex; justify-content:space-between; padding: 6px 0; font-size: 14px; }',
    '.totals .grand { border-top: 2px solid #2E5A1A; margin-top: 6px; padding-top: 10px; font-weight: 800; font-size: 17px; color:#2E5A1A; }',
    '.foot { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; }',
    '@media print { body { padding: 0; } }',
    '</style></head><body>',
    '<div class="head"><div class="brand">' + companyName + '<small>Ground Investigation Services</small></div><div class="inv-meta"><h1>INVOICE</h1><div class="num">' + invoice.invoice_number + '</div></div></div>',
    '<div class="parties"><div><h3>From</h3><p class="name">' + companyName + '</p></div><div style="text-align:right"><h3>Bill To</h3><p class="name">' + (client?.name || '—') + '</p>' + contactLine + emailLine + '</div></div>',
    '<div class="parties"><div><h3>Project / Job</h3><p class="name">' + (job?.name || '—') + '</p>' + refLine + locLine + '</div><div style="text-align:right"><h3>Issued</h3><p>' + invoice.issue_date + '</p><h3 style="margin-top:8px">Due</h3><p>' + (invoice.due_date || '—') + '</p></div></div>',
    '<table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead><tbody>' + bodyRows + '</tbody></table>',
    '<div class="totals"><div class="row"><span>Subtotal</span><span>' + gbp(invoice.net_total) + '</span></div><div class="row"><span>VAT (' + vatPct + '%)</span><span>' + gbp(invoice.vat_total) + '</span></div><div class="row grand"><span>Total Due</span><span>' + gbp(invoice.gross_total) + '</span></div></div>',
    notesLine,
    '<div class="foot">Thank you for your business. Payment due within 30 days of issue date.</div>',
    '</body></html>',
  ].join('');
}

export default function GenerateInvoiceModal({ open, onClose, job, client, data, companyName, raisedByName }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const hasData = data && Object.keys(data).length > 0;

  // Existing invoices — used to compute the next sequential invoice number
  const { data: existing = [] } = useQuery({
    queryKey: ['invoices', job?.id],
    queryFn: () => base44.entities.Invoice.filter({ job_id: job?.id }),
    enabled: open && !!job?.id,
  });
  const { data: bizConfig } = useQuery({
    queryKey: ['business-config'],
    queryFn: async () => { const list = await base44.entities.BusinessConfig.filter({ key: 'global' }); return list[0] || null; },
  });

  // Self-sufficient data fetch — only when the caller didn't pass a pre-built `data` object.
  // Lets the modal be launched from anywhere with just a job (e.g. the AfP pipeline).
  const { data: fCostItems = [] } = useQuery({ queryKey: ['inv-cost-items', job?.id], queryFn: () => base44.entities.JobCostItem.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fHotels = [] } = useQuery({ queryKey: ['inv-hotels', job?.id], queryFn: () => base44.entities.HotelBooking.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fDeliveries = [] } = useQuery({ queryKey: ['inv-deliveries', job?.id], queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fTimesheets = [] } = useQuery({ queryKey: ['inv-timesheets', job?.id], queryFn: () => base44.entities.Timesheet.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fInvLogs = [] } = useQuery({ queryKey: ['inv-invlogs', job?.id], queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fRigAssignments = [] } = useQuery({ queryKey: ['inv-rig-assignments', job?.id], queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job?.id }), enabled: open && !!job?.id && !hasData });
  const { data: fRateItems = [] } = useQuery({ queryKey: ['inv-rate-items'], queryFn: () => base44.entities.RateCardItem.filter({ is_active: true }), enabled: open && !!job?.id && !hasData });
  const { data: fSiteAssets = [] } = useQuery({ queryKey: ['inv-site-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500), enabled: open && !!job?.id && !hasData });
  const { data: fClient } = useQuery({ queryKey: ['inv-client', job?.client_id], queryFn: async () => { if (!job?.client_id) return null; const list = await base44.entities.Client.filter({ id: job.client_id }); return list[0] || null; }, enabled: open && !!job?.id && !client });
  const { data: fProfile } = useQuery({ queryKey: ['inv-me'], queryFn: () => base44.auth.me().catch(() => null), enabled: open && !!job?.id && !raisedByName });

  const resolvedData = hasData ? data : {
    costItems: fCostItems, hotelBookings: fHotels, deliveries: fDeliveries, timesheets: fTimesheets,
    invLogs: fInvLogs, rigAssignments: fRigAssignments, rateItems: fRateItems, siteAssets: fSiteAssets,
  };
  const resolvedClient = client || fClient || null;
  const resolvedCompany = companyName || bizConfig?.company_name || 'Ground Control';
  const resolvedRaisedBy = raisedByName || fProfile?.name || '';

  const lines = useMemo(() => (job ? buildInvoiceLines(job, resolvedData) : []), [job, resolvedData]);
  const vatRate = Number(job?.vat_rate) || Number(bizConfig?.default_vat_rate) || 20;
  const netTotal = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const vatTotal = netTotal * (vatRate / 100);
  const grossTotal = netTotal + vatTotal;

  const year = new Date().getFullYear();
  const nextNumber = useMemo(() => {
    const yearCount = (existing || []).filter((i) => (i.invoice_number || '').includes(`INV-${year}-`)).length + 1;
    return `INV-${year}-${String(yearCount).padStart(4, '0')}`;
  }, [existing, year]);

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const handleRaise = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const invoice = {
        invoice_number: nextNumber,
        job_id: job.id,
        division_id: job.division_id || '',
        job_name: job.name,
        job_reference: job.job_reference || '',
        client_id: resolvedClient?.id || job.client_id || '',
        client_name: resolvedClient?.name || '',
        status: 'draft',
        issue_date: issueDate,
        due_date: dueDate,
        line_items: lines,
        net_total: netTotal,
        vat_rate: vatRate,
        vat_total: vatTotal,
        gross_total: grossTotal,
        revenue_method: job.revenue_method || 'none',
        raised_by_name: resolvedRaisedBy || '',
      };
      const created = await base44.entities.Invoice.create(invoice);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['afp-pipeline-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['afp-pipeline-jobs'] });
      openPrint(created);
      onClose();
    } catch (e) {
      console.error('Invoice create error:', e);
      alert('Failed to raise invoice: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const openPrint = (invoice) => {
    const html = buildInvoiceHtml(invoice, job, resolvedClient, resolvedCompany);
    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked — please allow pop-ups to print the invoice.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" />
            Raise Invoice — {job.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-slate-500">Invoice No.</span>
            <span className="font-bold text-slate-800">{nextNumber}</span>
          </div>

          {/* Line items preview */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Unit</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No chargeable items found for this job.</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <span className="text-slate-800 font-medium">{l.description}</span>
                      {l.category && <span className="ml-2 text-[10px] text-slate-400">· {l.category}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{l.quantity} {l.unit_label}</td>
                    <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{gbp(l.unit_cost)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800 tabular-nums">{gbp(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="ml-auto w-full sm:w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium tabular-nums">{gbp(netTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT ({vatRate}%)</span><span className="font-medium tabular-nums">{gbp(vatTotal)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-bold text-primary">Total Due</span><span className="font-bold text-primary tabular-nums">{gbp(grossTotal)}</span></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button onClick={handleRaise} disabled={saving || lines.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
              Raise & Print Invoice
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
          </div>
          <p className="text-[11px] text-slate-400 text-center">The invoice is created as a draft and opened for printing. Mark it sent or paid from the Invoices panel.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}