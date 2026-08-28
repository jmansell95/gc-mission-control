import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkJobBudgetAlerts — scheduled alert for budget overruns and
// margin drops on active jobs.
// ============================================================
// Loads active jobs (status in_progress / planning), invokes
// calculateJobFinancials for each, compares profit/margin/cost against
// configured thresholds, and emails an alert digest to admins.
//
// Config is stored in AppSetting keyed 'job_alert_config':
//   { enabled, budget_overrun_pct (default 10), min_margin_pct (default 15),
//     negative_profit_alert (default true), recipient_emails (optional override) }
//
// Payload: { action: "check" | "scheduled" }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = ['check', 'scheduled'].includes(body.action) ? body.action : 'check';

    // Load alert config
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'job_alert_config' });
    const cfg = settings[0]?.value || {};

    if (action === 'scheduled' && cfg.enabled === false) {
      return Response.json({ ok: true, skipped: true, reason: 'job budget alerts disabled' });
    }

    const budgetOverrunPct = Number(cfg.budget_overrun_pct) || 10;
    const minMarginPct = Number(cfg.min_margin_pct) || 15;
    const negativeProfitAlert = cfg.negative_profit_alert !== false;

    // Load active jobs
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeJobs = jobs.filter((j: any) => ['in_progress', 'planning'].includes(j.status));

    if (activeJobs.length === 0) {
      return Response.json({ ok: true, message: 'No active jobs to check.', alerts: 0 });
    }

    const alerts: any[] = [];

    for (const job of activeJobs) {
      try {
        const finRes = await base44.asServiceRole.functions.invoke('calculateJobFinancials', { job_id: job.id });
        const fin = finRes?.data || finRes;
        if (!fin || fin.error || !fin.summary) continue;

        const s = fin.summary;
        const budget = Number(job.budget_amount) || 0;
        const costNet = Number(s.total_cost_net) || 0;
        const revenueNet = Number(s.total_revenue_net) || 0;
        const profit = Number(s.profit) || 0;
        const marginPct = Number(s.margin_pct) || 0;

        const jobAlerts: any[] = [];

        // Budget overrun check
        if (budget > 0 && costNet > 0) {
          const overrunPct = Math.round(((costNet - budget) / budget) * 1000) / 10;
          if (overrunPct >= budgetOverrunPct) {
            jobAlerts.push({
              type: 'budget_overrun',
              severity: overrunPct >= 25 ? 'high' : 'medium',
              message: `Cost (${formatGBP(costNet)}) is ${overrunPct}% over budget (${formatGBP(budget)})`,
            });
          }
        }

        // Margin drop check
        if (revenueNet > 0 && marginPct < minMarginPct) {
          jobAlerts.push({
            type: 'low_margin',
            severity: marginPct < 0 ? 'high' : 'medium',
            message: `Margin is ${marginPct}% (below ${minMarginPct}% threshold) — revenue ${formatGBP(revenueNet)}, cost ${formatGBP(costNet)}`,
          });
        }

        // Negative profit check
        if (negativeProfitAlert && profit < 0 && revenueNet > 0) {
          jobAlerts.push({
            type: 'negative_profit',
            severity: 'high',
            message: `Job is running at a LOSS of ${formatGBP(Math.abs(profit))} — revenue ${formatGBP(revenueNet)} does not cover cost ${formatGBP(costNet)}`,
          });
        }

        // Predictive margin drop — projects final margin from daily burn rate
        // Only alerts when current margin looks OK but is projected to fall below threshold
        if (revenueNet > 0 && costNet > 0 && job.start_date && job.end_date) {
          const today = new Date();
          const start = new Date(job.start_date + 'T00:00:00');
          const end = new Date(job.end_date + 'T00:00:00');
          const totalDays = Math.max(1, Math.round((end - start) / 86400000));
          const elapsedDays = Math.max(1, Math.round((today - start) / 86400000));
          const remainingDays = Math.max(0, Math.round((end - today) / 86400000));

          if (remainingDays > 0 && elapsedDays > 0) {
            const dailyBurn = costNet / elapsedDays;
            const projectedCost = costNet + (dailyBurn * remainingDays);
            const projectedMargin = Math.round(((revenueNet - projectedCost) / revenueNet) * 1000) / 10;
            const currentMargin = marginPct;

            // Alert if projected margin drops below threshold but current is still above
            if (projectedMargin < minMarginPct && currentMargin >= minMarginPct) {
              jobAlerts.push({
                type: 'predictive_margin_drop',
                severity: projectedMargin < 0 ? 'high' : 'medium',
                message: `Margin projected to drop from ${currentMargin}% to ${projectedMargin}% — burning ${formatGBP(dailyBurn)}/day, ${remainingDays} days remaining (projected cost ${formatGBP(projectedCost)} vs revenue ${formatGBP(revenueNet)})`,
              });
            }
          }
        }

        if (jobAlerts.length > 0) {
          alerts.push({
            job_id: job.id,
            job_name: job.name,
            job_status: job.status,
            budget,
            cost_net: costNet,
            revenue_net: revenueNet,
            profit,
            margin_pct: marginPct,
            metres: s.total_metres || 0,
            alerts: jobAlerts,
          });
        }
      } catch (_) { /* skip individual job errors */ }
    }

    // Email alert digest to admins if any alerts found
    if (alerts.length > 0) {
      // Load admin users for email recipients
      const adminUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
      const recipientEmails = (cfg.recipient_emails && cfg.recipient_emails.length > 0)
        ? cfg.recipient_emails
        : adminUsers.map((u: any) => u.email).filter(Boolean);

      if (recipientEmails.length > 0) {
        const subject = `⚠️ Job Budget Alert: ${alerts.length} job${alerts.length === 1 ? '' : 's'} need attention`;
        const emailBody = buildAlertEmail(alerts);
        for (const email of recipientEmails) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject,
              body: emailBody,
            });
          } catch (_) { /* non-fatal — some emails may bounce */ }
        }
      }
    }

    return Response.json({
      ok: true,
      checked: activeJobs.length,
      alerts: alerts.length,
      high_severity: alerts.filter(a => a.alerts.some((al: any) => al.severity === 'high')).length,
      alert_jobs: alerts.map(a => ({ job_name: a.job_name, alert_count: a.alerts.length, top_severity: a.alerts[0].severity })),
      message: alerts.length === 0 ? `All ${activeJobs.length} active jobs within budget & margin thresholds.` : `${alerts.length} job(s) flagged — alert email sent.`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

function formatGBP(n: number): string {
  return '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escapeHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildAlertEmail(alerts: any[]): string {
  const rows = alerts.map(a => {
    const alertLines = a.alerts.map((al: any) => `    • [${escapeHtml(al.severity.toUpperCase())}] ${escapeHtml(al.message)}`).join('\n');
    return `  ${escapeHtml(a.job_name)} (${escapeHtml(a.job_status)})\n    Budget: ${formatGBP(a.budget)} | Cost: ${formatGBP(a.cost_net)} | Revenue: ${formatGBP(a.revenue_net)} | Profit: ${formatGBP(a.profit)} | Margin: ${a.margin_pct}%\n${alertLines}`;
  }).join('\n\n');

  return `<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #dc2626;">⚠️ Job Budget Alert</h2>
  <p>The following active jobs have exceeded your configured budget overrun or margin thresholds and need management attention:</p>
  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 6px; margin: 16px 0;">
<pre style="font-family: Arial, sans-serif; font-size: 13px; white-space: pre-wrap; margin: 0;">${rows}</pre>
  </div>
  <p style="color: #666; font-size: 12px;">This alert was generated automatically. Review each job's financial breakdown in the admin dashboard → Job Financials tab.</p>
</div>`;
}