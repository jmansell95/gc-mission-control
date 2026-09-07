import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';
import { resolveHireCharge } from '../../shared/supplierRateMatcher.ts';

/**
 * Auto-Invoice Engine (Phase 2 billing automation).
 *
 * Assembles a draft Invoice for a job from its approved, chargeable data —
 * the same line-item composition the billing team sees in the manual "Raise
 * Invoice" modal, but restricted to work that has been signed off:
 *   • InvestigationLogs: staff logs must be manager_review_status='approved';
 *     AGS-imported logs are always billable (they don't pass manager review).
 *   • Timesheets: only status='approved', chargeable, non-break entries.
 *   • Cost items, hotel bookings, deliveries: included as-is (not gated).
 *
 * De-duplicates: if a draft invoice already exists for the job, it is skipped
 * so the engine never stacks duplicates. Jobs whose only invoices are sent or
 * paid get a fresh draft for any newly approved work.
 *
 * Modes:
 *   { job_id }        — generate for one job (manual / entity-trigger).
 *   { all_ready: true } — scan every job in 'decommissioning' / 'completed'
 *                        with billable data and no draft, and generate for each.
 *
 * Admins are emailed a digest of what was created in all_ready mode.
 */

const READY_STATUSES = ['decommissioning', 'completed'];

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const inD = new Date(checkIn + 'T00:00:00');
  const outD = new Date(checkOut + 'T00:00:00');
  return Math.max(0, Math.round((outD - inD) / 86400000));
}

function getTotalMetres(invLogs) {
  const byRef = {};
  (invLogs || [])
    .filter((l) => l.source === 'ags_import' && l.borehole_ref && l.depth_to != null)
    .forEach((l) => { if (byRef[l.borehole_ref] == null || l.depth_to > byRef[l.borehole_ref]) byRef[l.borehole_ref] = l.depth_to; });
  return Object.values(byRef).reduce((s, d) => s + d, 0);
}

// Build invoice line items — mirrors src/components/billing/GenerateInvoiceModal.buildInvoiceLines,
// but only counts approved staff logs / approved timesheets.
function buildInvoiceLines(job, d) {
  const costItems = d.costItems || [];
  const hotelBookings = d.hotelBookings || [];
  const deliveries = d.deliveries || [];
  const timesheets = d.timesheets || [];
  const invLogs = d.invLogs || [];
  const rigAssignments = d.rigAssignments || [];
  const lines = [];

  costItems
    .filter((c) => c.category !== 'client_supplied' && c.category !== 'contractor_supplied' && (Number(c.unit_cost) || 0) > 0)
    .forEach((c) => {
      // Hired equipment is billed at the resolved client charge (Our Rate Card
      // match or markup-on-cost), not the supplier's cost price — so hired
      // plant carries margin on the invoice, matching the financials engine.
      if (c.category === 'hired_equipment' && c.supplier_id && d.supplierRateItems && d.ourRateItems) {
        const hire = resolveHireCharge(c, d.supplierRateItems, d.ourRateItems, Number(job.markup_percentage) || 15);
        if (hire.client_charge > 0) {
          lines.push({
            description: `Hire — ${c.description || 'Plant'}`,
            quantity: Number(c.quantity) || 1,
            unit_label: c.unit_label || 'day',
            unit_cost: hire.client_unit_charge,
            line_total: hire.client_charge,
            category: 'Plant hire',
          });
          return;
        }
      }
      lines.push({
        description: c.description || c.reference_number || 'Equipment',
        quantity: Number(c.quantity) || 1,
        unit_label: c.unit_label || 'each',
        unit_cost: Number(c.unit_cost) || 0,
        line_total: (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1),
        category: c.category === 'labour' ? 'Labour' : 'Equipment',
      });
    });

  hotelBookings.forEach((b) => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const rooms = Number(b.room_count) || 1;
    const total = (Number(b.cost_per_night) || 0) * rooms * nights;
    if (total <= 0) return;
    lines.push({
      description: `Accommodation — ${b.hotel_name || 'Hotel'}${b.room_type ? ` (${b.room_type})` : ''}`,
      quantity: nights * rooms, unit_label: 'night',
      unit_cost: Number(b.cost_per_night) || 0, line_total: total, category: 'Accommodation',
    });
  });

  deliveries.filter((x) => x.chargeable !== false && (Number(x.charge_amount) || 0) > 0).forEach((x) => {
    lines.push({
      description: `Delivery — ${x.item_description || x.description || 'Site delivery'}`,
      quantity: 1, unit_label: 'sum',
      unit_cost: Number(x.charge_amount) || 0, line_total: Number(x.charge_amount) || 0, category: 'Delivery',
    });
  });

  const billableTs = timesheets.filter((t) => t.chargeable && !t.is_break && (Number(t.charge_amount) || 0) > 0);
  const tsTotal = billableTs.reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  if (tsTotal > 0) {
    lines.push({
      description: `Site work — ${billableTs.length} chargeable ${billableTs.length === 1 ? 'entry' : 'entries'}`,
      quantity: 1, unit_label: 'sum', unit_cost: tsTotal, line_total: tsTotal, category: 'Site work',
    });
  }

  const method = job.revenue_method || 'none';
  if (method === 'meterage_rate') {
    const manual = Number(job.meterage) || 0;
    const metres = manual > 0 ? manual : getTotalMetres(invLogs);
    const rate = Number(job.meterage_rate) || 0;
    lines.push({ description: `Drilling meterage — ${metres.toFixed(1)}m${manual > 0 ? '' : ' (auto from logs)'}`, quantity: Number(metres.toFixed(1)), unit_label: 'm', unit_cost: rate, line_total: metres * rate, category: 'Meterage' });
  } else if (method === 'unit_rate') {
    const units = invLogs.reduce((s, l) => s + (Number(l.units_completed) || 0), 0);
    const price = Number(job.unit_price) || 0;
    lines.push({ description: `Units completed — ${units}`, quantity: units, unit_label: 'unit', unit_cost: price, line_total: units * price, category: 'Unit rate' });
  } else if (method === 'day_rate') {
    lines.push({ description: 'Crew day rates (per rig assignment)', quantity: rigAssignments.length, unit_label: 'rig', unit_cost: 0, line_total: 0, category: 'Day rate — see report' });
  } else if (method === 'flat_fee') {
    const fee = Number(job.client_charge) || 0;
    lines.push({ description: 'Project fee (agreed flat fee)', quantity: 1, unit_label: 'sum', unit_cost: fee, line_total: fee, category: 'Flat fee' });
  }

  // Sub-contractor sell charges (client_charge_net per log)
  const subconLogs = d.subconLogs || [];
  subconLogs.forEach((sl) => {
    const charge = Number(sl.client_charge_net) || 0;
    if (charge <= 0) return;
    lines.push({
      description: 'Sub-contract — ' + (sl.subcontractor_name || 'Sub-con') + ' · ' + (sl.work_type || sl.description || 'work'),
      quantity: 1, unit_label: 'sum',
      unit_cost: charge, line_total: charge, category: 'Sub-contract',
    });
  });

  // Crew daily expenses (pass-through with markup)
  const dailyCosts = d.dailyCosts || [];
  const expenseByCat = {};
  dailyCosts.forEach((c) => {
    const charge = Number(c.client_charge) || Number(c.amount_net) || 0;
    if (charge <= 0) return;
    const cat = c.category || 'misc';
    if (!expenseByCat[cat]) expenseByCat[cat] = { total: 0, count: 0 };
    expenseByCat[cat].total += charge;
    expenseByCat[cat].count++;
  });
  Object.entries(expenseByCat).forEach(([cat, v]) => {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
    lines.push({
      description: 'Crew expenses — ' + label + ' (' + v.count + ' item' + (v.count === 1 ? '' : 's') + ')',
      quantity: 1, unit_label: 'sum',
      unit_cost: Math.round(v.total * 100) / 100, line_total: Math.round(v.total * 100) / 100, category: 'Expenses',
    });
  });

  return lines;
}

async function loadJobData(base44, jobId) {
  const [costItems, hotelBookings, deliveries, timesheets, invLogs, rigAssignments, dailyCosts, subconLogs] = await Promise.all([
    base44.asServiceRole.entities.JobCostItem.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.HotelBooking.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.DeliveryLog.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.Timesheet.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.DailyCost.filter({ job_id: jobId }).catch(() => []),
    base44.asServiceRole.entities.SubcontractorLog.filter({ job_id: jobId }).catch(() => []),
  ]);
  // Only approved staff logs; AGS imports always billable.
  const billableLogs = invLogs.filter((l) => l.source === 'ags_import' || l.manager_review_status === 'approved');
  const approvedTs = timesheets.filter((t) => t.status === 'approved');
  // Only approved/submitted daily costs and verified+ sub-con logs
  const billableCosts = dailyCosts.filter((c) => c.status === 'approved' || c.status === 'submitted');
  const billableSubcon = subconLogs.filter((l) => l.status === 'verified' || l.status === 'approved' || l.status === 'invoiced');

  // Supplier rate-card matching for plant hire — load supplier + our rate
  // card items so hired equipment is billed at the resolved client charge.
  let supplierRateItems: any[] = [];
  let ourRateItems: any[] = [];
  const hasHired = costItems.some((c) => c.category === 'hired_equipment' && c.supplier_id);
  if (hasHired) {
    try { supplierRateItems = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'supplier', is_active: true }, '-sort_order', 1000); } catch (_) {}
    try { ourRateItems = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, '-sort_order', 1000); } catch (_) {}
  }
  return {
    costItems, hotelBookings, deliveries, timesheets: approvedTs, invLogs: billableLogs,
    rigAssignments, dailyCosts: billableCosts, subconLogs: billableSubcon,
    supplierRateItems, ourRateItems,
  };
}

async function generateForJob(base44, job) {
  const existing = await base44.asServiceRole.entities.Invoice.filter({ job_id: job.id });
  if (existing.some((i) => i.status === 'draft')) {
    return { job_id: job.id, job_name: job.name, skipped: 'existing_draft' };
  }
  const data = await loadJobData(base44, job.id);
  const lines = buildInvoiceLines(job, data);
  if (lines.length === 0) return { job_id: job.id, job_name: job.name, skipped: 'no_chargeable_items' };

  const biz = (await base44.asServiceRole.entities.BusinessConfig.filter({ key: 'global' }))[0] || {};
  const vatRate = Number(job.vat_rate) || Number(biz.default_vat_rate) || 20;
  const netTotal = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const vatTotal = Math.round(netTotal * (vatRate / 100) * 100) / 100;
  const grossTotal = Math.round((netTotal + vatTotal) * 100) / 100;

  const year = new Date().getFullYear();
  const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
  const yearCount = allInvoices.filter((i) => (i.invoice_number || '').includes(`INV-${year}-`)).length + 1;
  const invoiceNumber = `INV-${year}-${String(yearCount).padStart(4, '0')}`;

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const client = job.client_id ? (await base44.asServiceRole.entities.Client.get(job.client_id).catch(() => null)) : null;

  const invoice = {
    invoice_number: invoiceNumber,
    job_id: job.id,
    division_id: job.division_id || '',
    job_name: job.name,
    job_reference: job.job_reference || '',
    client_id: job.client_id || '',
    client_name: client?.name || '',
    status: 'draft',
    issue_date: issueDate,
    due_date: dueDate,
    line_items: lines,
    net_total: Math.round(netTotal * 100) / 100,
    vat_rate: vatRate,
    vat_total: vatTotal,
    gross_total: grossTotal,
    revenue_method: job.revenue_method || 'none',
    raised_by_name: 'Auto-Invoice Engine',
  };
  const created = await base44.asServiceRole.entities.Invoice.create(invoice);
  return { job_id: job.id, job_name: job.name, invoice_number: invoiceNumber, net_total: invoice.net_total, gross_total: grossTotal, lines: lines.length, invoice_id: created.id };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Supports three callers:
    //   • Frontend:    { job_id } or { all_ready: true }
    //   • Entity auto:  { event, data: <InvestigationLog>, old_data }
    const job_id = body.job_id || (body.data && body.data.job_id);
    const all_ready = body.all_ready;
    // Entity-trigger guard: only act on a transition INTO approved. An update
    // that leaves an already-approved log approved (e.g. a typo fix) is a no-op.
    if (!body.job_id && body.data && body.old_data && body.old_data.manager_review_status === 'approved') {
      return Response.json({ ok: true, skipped: 'already_approved' });
    }

    // Auth: admin-only when invoked by a user (frontend button). Scheduled
    // runs arrive without a user session and are trusted.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (job_id) {
      const job = await base44.asServiceRole.entities.Job.get(job_id).catch(() => null);
      if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
      const result = await generateForJob(base44, job);
      return Response.json({ ok: true, result });
    }

    if (all_ready) {
      const jobs = await base44.asServiceRole.entities.Job.list('-updated_date', 500);
      const ready = jobs.filter((j) => READY_STATUSES.includes(j.status));
      const results = [];
      for (const job of ready) {
        try { results.push(await generateForJob(base44, job)); }
        catch (e) { results.push({ job_id: job.id, job_name: job.name, error: e.message }); }
      }
      const created = results.filter((r) => r.invoice_number);

      // Email admins a digest when drafts were created — uses the email template system.
      if (created.length > 0) {
        const baseUrl = await getAppBaseUrl(base44);
        const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'auto_invoice_digest' });
        const cfg = cfgList[0] || { accent_color: '#2E5A1A', banner_title: 'GC Mission Control — Auto-Invoice Digest', show_banner: true, footer_text: 'GC Mission Control' };
        if (cfg.enabled !== false) {
          let recipients = [];
          if (cfg.recipient_emails) {
            recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            const admins = (await base44.asServiceRole.entities.User.list()).filter((u) => u.role === 'admin');
            recipients = admins.map((a) => a.email).filter(Boolean);
          }

          const invoiceList = created.map((r) =>
            '   • ' + r.job_name + ' — ' + r.invoice_number + ' — £' + (Number(r.gross_total) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })
          ).join('\n');

          let text;
          if (cfg.template) {
            text = cfg.template
              .replace(/\{invoice_count\}/g, String(created.length))
              .replace(/\{invoice_list\}/g, invoiceList);
          } else {
            const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
            text = intro + 'The Auto-Invoice Engine created ' + created.length + ' new draft invoice' + (created.length === 1 ? '' : 's') + ' from approved work today:\n\n' + invoiceList + '\n\nReview and mark them sent from the Billing panel once checked.\n\nGC Mission Control';
          }

          const subject = cfg.subject
            ? cfg.subject.replace(/\{invoice_count\}/g, String(created.length))
            : 'Auto-Invoice Engine — ' + created.length + ' draft' + (created.length === 1 ? '' : 's') + ' created';

          const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');

          for (const to of recipients) {
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to,
                subject,
                body: styledHtml(bodyHtml, cfg),
              });
            } catch (_) {}
          }
        }
      }
      return Response.json({ ok: true, checked: ready.length, created: created.length, results });
    }

    return Response.json({ error: 'Provide job_id or all_ready:true' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}