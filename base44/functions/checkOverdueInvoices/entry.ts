import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createNotification } from '../../shared/inboxEngine.ts';

// Nightly check — flips 'sent' invoices to 'overdue' when the due date has passed.
// Runs on a schedule (admin-only service role).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch all sent invoices
    const sentInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'sent' });

    let flipped = 0;
    const flippedInvoices = [];
    for (const inv of sentInvoices) {
      if (inv.due_date && inv.due_date < today) {
        await base44.asServiceRole.entities.Invoice.update(inv.id, { status: 'overdue' });
        flippedInvoices.push(inv);
        flipped++;
      }
    }

    // ── Create inbox alert for each overdue invoice ──
    if (flippedInvoices.length > 0) {
      try {
        const users = await base44.asServiceRole.entities.User.list();
        const adminRecipients = users.filter(u => u.role === 'admin' && u.email).map(u => ({
          staffId: null, userId: u.id, name: u.full_name || u.email, email: u.email,
        }));
        for (const inv of flippedInvoices) {
          await createNotification(base44, {
            recipients: adminRecipients,
            type: 'alert',
            category: 'invoice_overdue',
            title: `Invoice ${inv.invoice_number || inv.id} is now overdue`,
            body: `Invoice ${inv.invoice_number || ''} for ${inv.client_name || 'client'} (£${Number(inv.total || 0).toFixed(2)}) was due ${inv.due_date} and is now overdue. Please chase payment.`,
            sourceHub: 'billing',
            sourceEntity: 'Invoice',
            sourceId: inv.id,
            deepLink: '/billing?tab=invoices',
            priority: 'urgent',
          });
        }
      } catch (_) { /* don't block on inbox failure */ }
    }

    return Response.json({
      success: true,
      checked: sentInvoices.length,
      flipped_to_overdue: flipped,
      date: today,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}