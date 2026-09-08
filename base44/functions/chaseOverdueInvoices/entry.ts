import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillDanger, pillWarning, pillInfo, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow, formatGBP, formatDate
} from '../../shared/emailStyling.ts';

// Automated invoice chasing — sends escalating reminder emails for overdue invoices.
// Escalation schedule:
//   7-14 days overdue  → reminder_1 (friendly nudge)
//   15-28 days overdue → reminder_2 (firmer, mentions late payment interest)
//   29+ days overdue   → final_notice (final notice before debt collection)
// Reminders are spaced at least 7 days apart. Runs on a schedule (admin-only).

const STAGE_CONFIG = {
  reminder_1: {
    subject: 'Payment Reminder: Invoice {INV} — {CLIENT}',
    heading: 'Friendly Payment Reminder',
    variant: 'amber',
  },
  reminder_2: {
    subject: 'Second Notice: Invoice {INV} — {CLIENT}',
    heading: 'Second Payment Notice',
    variant: 'rose',
  },
  final_notice: {
    subject: 'FINAL NOTICE: Invoice {INV} — {CLIENT}',
    heading: 'Final Notice — Action Required',
    variant: 'rose',
  },
};

function daysOverdue(dueDate, today) {
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

function determineStage(daysOver, currentStage) {
  if (daysOver >= 29) return 'final_notice';
  if (daysOver >= 15) return 'reminder_2';
  if (daysOver >= 7) return 'reminder_1';
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toISOString().split('T')[0];
    const baseUrl = await getAppBaseUrl(base44);

    const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'overdue' });

    const clientIds = [...new Set(overdueInvoices.map(i => i.client_id).filter(Boolean))];
    const clients = clientIds.length > 0
      ? await base44.asServiceRole.entities.Client.filter({ id: { $in: clientIds } })
      : [];
    const clientMap = new Map(clients.map(c => [c.id, c]));

    let sent = 0;
    let skipped = 0;
    const results = [];

    for (const inv of overdueInvoices) {
      const days = daysOverdue(inv.due_date, today);
      const targetStage = determineStage(days, inv.chase_stage);
      if (!targetStage) { skipped++; continue; }

      const stageOrder = ['none', 'reminder_1', 'reminder_2', 'final_notice'];
      const currentStageIdx = stageOrder.indexOf(inv.chase_stage || 'none');
      const targetStageIdx = stageOrder.indexOf(targetStage);
      if (targetStageIdx <= currentStageIdx) {
        if (inv.last_chase_at) {
          const lastChase = new Date(inv.last_chase_at);
          const daysSinceChase = Math.floor((new Date() - lastChase) / (1000 * 60 * 60 * 24));
          if (daysSinceChase < 7) { skipped++; continue; }
        } else {
          skipped++;
          continue;
        }
      }

      const config = STAGE_CONFIG[targetStage];
      const client = clientMap.get(inv.client_id);
      const clientEmail = client?.contact_email || '';
      const amount = formatGBP(inv.gross_total || inv.net_total || 0);

      // Build rich client email
      const stagePill = targetStage === 'final_notice' ? pillDanger('FINAL NOTICE')
        : targetStage === 'reminder_2' ? pillWarning('Second Notice')
        : pillInfo('Reminder');

      const detailsTable = infoTable([
        ['Invoice Number', inv.invoice_number],
        ['Client', inv.client_name || '—'],
        ['Amount Due', amount],
        ['Due Date', formatDate(inv.due_date)],
        ['Days Overdue', String(days)],
        ['Stage', html(stagePill)],
      ]);

      const bodyTexts = {
        reminder_1: 'We hope this email finds you well. This is a friendly reminder that payment for the above invoice is now overdue. If you have already sent payment, please disregard this notice.',
        reminder_2: 'We are writing to follow up on the above invoice which remains unpaid. Please arrange payment at your earliest convenience to avoid any disruption to services. If payment has already been made, please send proof of payment so we can update our records.',
        final_notice: 'This is our final notice regarding the above invoice. Despite previous reminders, payment has not yet been received. Please arrange payment within 7 days. If we do not receive payment, we may need to escalate this matter to our debt recovery process.',
      };

      const clientBodyHtml =
        heading(config.heading) +
        p(bodyTexts[targetStage]) +
        sectionCard('Invoice Details', detailsTable, { titleBg: config.variant === 'rose' ? '#be123c' : '#b45309' }) +
        (targetStage === 'final_notice' ? callout('If you are experiencing payment difficulties, please contact us immediately to discuss a payment plan.', 'warning') : '') +
        helpTip('How to pay', 'Please contact our accounts team to arrange payment. If you have already paid, please send proof of payment so we can update our records and remove this notice.') +
        linkBlock(baseUrl, '/billing', 'View Invoice');

      const subject = config.subject
        .replace(/\{INV\}/g, inv.invoice_number)
        .replace(/\{CLIENT\}/g, inv.client_name || '');

      const clientHtml = brandedWrapper(clientBodyHtml, { headerVariant: config.variant, banner_subtitle: 'Payment Reminder' });

      let emailSent = false;
      if (clientEmail) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: clientEmail,
            subject,
            body: clientHtml,
          });
          emailSent = true;
        } catch (e) {
          // Client email not a registered user — fall through to admin notification
        }
      }

      // Admin notification
      const adminSubject = emailSent
        ? `[Chase Sent] ${targetStage.replace('_', ' ')}: ${inv.invoice_number} — ${inv.client_name}`
        : `[Action Needed] ${targetStage.replace('_', ' ')}: ${inv.invoice_number} — ${inv.client_name || 'Unknown client'}`;

      const adminBodyHtml =
        heading(emailSent ? 'Chase sent to client' : 'Manual chase needed — no client email') +
        (emailSent
          ? p('A ' + targetStage.replace('_', ' ') + ' reminder was automatically sent to <strong>' + escapeHtml(clientEmail) + '</strong> for invoice ' + escapeHtml(inv.invoice_number) + '.')
          : p('Invoice ' + escapeHtml(inv.invoice_number) + ' is ' + days + ' days overdue but no client email is on file. Please contact the client manually.')) +
        sectionCard('Invoice Details', infoTable([
          ['Invoice', inv.invoice_number],
          ['Client', inv.client_name || '—'],
          ['Amount', amount],
          ['Due Date', formatDate(inv.due_date)],
          ['Days Overdue', String(days)],
          ['Client Email', clientEmail || 'Not on file'],
        ]), { titleBg: emailSent ? '#2E5A1A' : '#be123c' }) +
        (emailSent ? '' : callout('Please contact the client manually to chase payment. The invoice details are shown above for reference.', 'warning')) +
        helpTip('What to do next', 'Open the Financial Hub to view the full invoice and payment history. If the client needs a payment plan, record the agreement in the invoice notes.') +
        linkBlock(baseUrl, '/billing', 'Open Financial Hub');

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: adminSubject,
          body: brandedWrapper(adminBodyHtml, { headerVariant: emailSent ? 'brand' : 'rose', banner_subtitle: 'Invoice Chase Log' }),
        });
      } catch (e) { /* non-fatal */ }

      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        chase_stage: targetStage,
        chase_count: (inv.chase_count || 0) + 1,
        last_chase_at: new Date().toISOString(),
      });

      sent++;
      results.push({
        invoice: inv.invoice_number,
        client: inv.client_name,
        stage: targetStage,
        days_overdue: days,
        amount: inv.gross_total || inv.net_total,
        email_sent_to_client: emailSent,
      });
    }

    return Response.json({
      success: true,
      checked: overdueInvoices.length,
      sent,
      skipped,
      date: today,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}