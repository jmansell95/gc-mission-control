import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createApproval } from '../../shared/inboxEngine.ts';

/**
 * submitAFPToClient — marks an AFP as submitted to the client and auto-creates
 * the next AFP in the chain (period_start = submitted AFP's period_end + 1 day).
 * Also creates an inbox approval routed to the configured AFP reviewer(s) so a
 * manager is notified to review the submitted AFP.
 *
 * Input:  { afp_id: string }
 * Output: { success, afp, next_afp }
 */

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { afp_id } = body;
    if (!afp_id) return Response.json({ error: 'afp_id is required' }, { status: 400 });

    const afp = await base44.entities.AFP.get(afp_id);
    if (!afp) return Response.json({ error: 'AFP not found' }, { status: 404 });
    if (afp.status !== 'draft') return Response.json({ error: 'AFP must be in draft status to submit' }, { status: 400 });

    const userName = user.full_name || user.email || 'System';
    const now = new Date().toISOString();

    // Capture original totals at submission time
    const lineItems = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const originalTotal = lineItems.reduce((s, li) => s + (li.amount || 0), 0);

    // Update AFP: set original amounts on line items and mark as submitted
    await base44.entities.AFP.update(afp_id, {
      status: 'submitted',
      original_total: originalTotal,
      agreed_total: originalTotal,
      last_updated_at: now,
      last_updated_by: userName,
    });

    // Set original_amount on all line items (snapshot at submission time)
    const updates = lineItems.map(li => ({
      id: li.id,
      original_amount: li.amount,
      agreed_amount: li.amount,
    }));
    if (updates.length > 0) {
      await base44.entities.AFPLineItem.bulkUpdate(updates);
    }

    // Auto-create next AFP if period_end_date is set
    let nextAfp = null;
    if (afp.period_end_date) {
      // Default: day after the submitted AFP's period end
      const defaultStart = new Date(afp.period_end_date);
      defaultStart.setDate(defaultStart.getDate() + 1);
      let nextStartStr = defaultStart.toISOString().slice(0, 10);

      // PRD: set the new AFP start date to the last date items were recorded.
      // Query field data for the job and find the most recent date AFTER the
      // current AFP's period end — the new AFP starts from where the data is.
      try {
        const periodEnd = afp.period_end_date;
        const [logs, timesheets, deliveries, subcons, costs] = await Promise.all([
          base44.entities.InvestigationLog.filter({ job_id: afp.job_id }, '-date', 100),
          base44.entities.Timesheet.filter({ job_id: afp.job_id }, '-date', 100),
          base44.entities.DeliveryLog.filter({ job_id: afp.job_id }, '-scheduled_date', 100),
          base44.entities.SubcontractorLog.filter({ job_id: afp.job_id }, '-date', 100),
          base44.entities.DailyCost.filter({ job_id: afp.job_id }, '-date', 100),
        ]);
        const allDates: string[] = [];
        for (const r of [...logs, ...timesheets, ...deliveries, ...subcons, ...costs]) {
          const d = (r.date || r.shift_date || r.scheduled_date || r.delivery_date || '').slice(0, 10);
          if (d && d > periodEnd) allDates.push(d);
        }
        if (allDates.length > 0) {
          allDates.sort();
          nextStartStr = allDates[allDates.length - 1];
        }
      } catch (_) { /* fall back to default */ }

      // Determine next AFP number
      const allAfps = await base44.entities.AFP.filter({ job_id: afp.job_id });
      const nextNumber = allAfps.length + 1;

      nextAfp = await base44.entities.AFP.create({
        job_id: afp.job_id,
        job_name: afp.job_name,
        job_reference: afp.job_reference,
        division_id: afp.division_id,
        afp_number: nextNumber,
        period_start_date: nextStartStr,
        status: 'draft',
        client_po: afp.client_po,
        gc_job_number: afp.gc_job_number,
        client_name: afp.client_name,
        contract_value: afp.contract_value,
      });

      // Link next AFP to current
      await base44.entities.AFP.update(afp_id, { next_afp_id: nextAfp.id });
    }

    // ── Create inbox approval for the billing manager to review this AFP ──
    // Resolve the submitter's Staff record so the approval engine can route
    // via their manager chain (or the configured AFP reviewer group).
    try {
      const myStaff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
      const requesterStaffId = myStaff[0]?.id || null;
      await createApproval(base44, {
        approvalType: 'afp_review',
        requesterStaffId,
        title: `AFP #${afp.afp_number || ''} for ${afp.job_name || afp.job_reference || 'job'} needs your review`,
        body: `Submitted by ${userName}. Total claimed: £${Number(originalTotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}. Period: ${afp.period_start_date || '—'} to ${afp.period_end_date || '—'}. Please review and approve.`,
        sourceHub: 'billing',
        sourceEntity: 'AFP',
        sourceId: afp_id,
        deepLink: `/billing?afp=${afp_id}`,
        priority: 'normal',
      });
    } catch (_) { /* don't fail the submission if the inbox item fails */ }

    return Response.json({
      success: true,
      afp: { ...afp, status: 'submitted', original_total: originalTotal },
      next_afp: nextAfp,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}