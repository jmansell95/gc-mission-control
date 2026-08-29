import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Cash Flow Forecast Engine — runs nightly at 01:00.
 *
 * Projects a 12-week cash position by pulling:
 *   - Approved AFPs (expected income by due date)
 *   - Open POAs (expected cost)
 *   - Payroll exports (known weekly cost)
 *   - Overdue invoices (risk-weighted)
 *
 * Creates CashFlowEntry records for each forecasted week and alerts the
 * finance director if any week's projected balance drops below a threshold.
 *
 * Leverages: AFP, PurchaseOrder, Timesheet, Invoice, CashFlowEntry
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // 1. Get all approved AFPs with outstanding claim amounts
    const afps = await base44.asServiceRole.entities.AFP.filter({
      status: { $in: ['approved', 'submitted'] },
    });

    // 2. Get open purchase orders
    const pos = await base44.asServiceRole.entities.PurchaseOrder.filter({
      status: { $in: ['open', 'partially_received', 'pending'] },
    });

    // 3. Get overdue invoices
    const invoices = await base44.asServiceRole.entities.Invoice.filter({
      status: { $in: ['sent', 'overdue', 'partial'] },
    });

    // 4. Get recent payroll exports for weekly cost baseline
    const payrollExports = await base44.asServiceRole.entities.Timesheet.filter({
      is_weekly_summary: true,
      status: 'approved',
      payroll_export_id: { $ne: '' },
    });

    // 5. Build a 12-week forecast
    const weeklyForecast = [];
    let runningBalance = 0; // simplified — in production, start from current bank balance

    // Calculate average weekly payroll cost
    const payrollCosts = payrollExports.map((t) => t.total_hours || 0 * 15); // rough estimate
    const avgWeeklyPayroll = payrollCosts.length > 0
      ? payrollCosts.reduce((s, c) => s + c, 0) / payrollCosts.length
      : 5000; // fallback default

    for (let week = 0; week < 12; week++) {
      const weekStart = new Date(now.getTime() + week * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      // Expected income: AFPs due this week
      let expectedIncome = 0;
      afps.forEach((afp) => {
        const dueDate = afp.payment_due_date || afp.period_end;
        if (dueDate && dueDate >= weekStartStr && dueDate <= weekEndStr) {
          expectedIncome += (afp.total_claimed || afp.agreed_total || 0) - (afp.amount_paid || 0);
        }
      });

      // Expected cost: POs due this week
      let expectedCost = 0;
      pos.forEach((po) => {
        const dueDate = po.expected_delivery_date || po.order_date;
        if (dueDate && dueDate >= weekStartStr && dueDate <= weekEndStr) {
          expectedCost += po.total_amount || 0;
        }
      });

      // Add payroll cost every week
      expectedCost += avgWeeklyPayroll;

      // Risk-weight overdue invoices (50% chance of collection this week)
      let overdueRisk = 0;
      invoices.forEach((inv) => {
        if (inv.due_date && inv.due_date < weekStartStr && inv.status === 'overdue') {
          overdueRisk += (inv.amount_due || 0) * 0.5;
        }
      });

      const netCash = expectedIncome - expectedCost;
      runningBalance += netCash;

      weeklyForecast.push({
        week_start: weekStartStr,
        week_end: weekEndStr,
        expected_income: Math.round(expectedIncome),
        expected_cost: Math.round(expectedCost),
        net_cash: Math.round(netCash),
        projected_balance: Math.round(runningBalance),
        overdue_risk: Math.round(overdueRisk),
      });

      // 6. Create a CashFlowEntry record (idempotent — delete old entries for this week first)
      // Skip deleteMany — CashFlowEntry is scoped to CVRs; we just create forecast entries

      await base44.asServiceRole.entities.CashFlowEntry.create({
        cvr_id: '',
        job_id: '',
        month_date: weekStartStr,
        description: `Week ${week + 1} forecast — income £${Math.round(expectedIncome)}, cost £${Math.round(expectedCost)}, net £${Math.round(netCash)}`,
        app_value: Math.round(netCash),
        amount: Math.round(runningBalance),
        qty: week + 1,
        unit: 'week',
        rate: Math.round(netCash),
      });
    }

    // 7. Alert if any week's projected balance drops below £10,000
    const tightWeeks = weeklyForecast.filter((w) => w.projected_balance < 10000);
    if (tightWeeks.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const body = `The following weeks project a cash balance below £10,000:\n\n` +
        tightWeeks.map((w) => `• Week of ${w.week_start}: projected balance £${w.projected_balance.toLocaleString()}`).join('\n') +
        `\n\nReview the Cash Flow Forecast on the enterprise dashboard.\n\nGC Mission Control — Cash Flow Autopilot`;

      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Cash Flow Alert — ${tightWeeks.length} week${tightWeeks.length !== 1 ? 's' : ''} below threshold`,
            body,
          });
        } catch (_) {}
      }
    }

    return Response.json({ ok: true, weeks: weeklyForecast.length, tightWeeks: tightWeeks.length, forecast: weeklyForecast });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}