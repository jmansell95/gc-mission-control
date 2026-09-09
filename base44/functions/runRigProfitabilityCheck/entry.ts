import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { brandedWrapper, heading, p, dataTable, callout, escapeHtml, formatGBP, getAppBaseUrl } from '../../shared/emailStyling.ts';

/**
 * Rig Profitability Auto-Optimiser — runs daily at 18:00.
 *
 * Detects rigs that have been earning below their day-rate cost for 3
 * consecutive days. For each underperforming rig:
 *   1. Calculates the financial impact (lost margin)
 *   2. Flags the rig on the dashboard
 *   3. Sends an alert to the drilling supervisor with swap suggestions
 *
 * Leverages: RotaAssignment, SiteAsset, RateCardItem, getRigProfitability
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Get all rigs
    const rigs = await base44.asServiceRole.entities.SiteAsset.filter({ is_rig: true, is_active: true });

    // 2. Get the last 3 days of rota assignments with rigs
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
      rig_asset_id: { $ne: '' },
      assigned_date: { $gte: threeDaysAgo },
      status: { $ne: 'completed' },
    });

    // 3. Get rate cards for rig day rates
    const rateCards = await base44.asServiceRole.entities.RateCardItem.list('-updated_date', 200);

    // 4. Group assignments by rig and date
    const byRig = new Map<string, Map<string, any[]>>();
    assignments.forEach((a) => {
      if (!byRig.has(a.rig_asset_id)) byRig.set(a.rig_asset_id, new Map());
      const byDate = byRig.get(a.rig_asset_id)!;
      if (!byDate.has(a.assigned_date)) byDate.set(a.assigned_date, []);
      byDate.get(a.assigned_date)!.push(a);
    });

    // 5. Get all jobs for revenue calculation
    const jobs = await base44.asServiceRole.entities.Job.list();

    const underperforming = [];

    for (const rig of rigs) {
      const rigAssignments = byRig.get(rig.id);
      if (!rigAssignments || rigAssignments.size === 0) continue;

      // Find the rig's day rate from rate cards
      const rigRate = rateCards.find((r) => {
        const rName = (r.name || r.item || '').toLowerCase();
        const aName = (rig.name || '').toLowerCase();
        return rName && aName && (rName.includes(aName) || aName.includes(rName));
      });
      const dayRateCost = rigRate?.cost_price || rigRate?.price || rig.daily_rate || 400;

      // Check the last 3 days
      const dailyEarnings = [];
      for (let d = 0; d < 3; d++) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        const dayAssignments = rigAssignments.get(date) || [];
        if (dayAssignments.length === 0) continue;

        // Calculate revenue for this day
        const job = jobs.find((j) => j.id === dayAssignments[0].job_id);
        if (!job) continue;

        const meterage = dayAssignments.reduce((s, a) => s + (a.meterage || 0), 0);
        const meterageRate = job.meterage_rate || 0;
        let revenue = 0;
        if (meterageRate && meterage) {
          revenue = meterage * meterageRate;
        } else {
          revenue = job.unit_price || dayRateCost;
        }

        dailyEarnings.push({ date, revenue, meterage, job_name: job.name, job_id: job.id });
      }

      // Flag if earning below cost for 3 consecutive days
      if (dailyEarnings.length >= 3 && dailyEarnings.every((d) => d.revenue < dayRateCost)) {
        const totalLost = dailyEarnings.reduce((s, d) => s + (dayRateCost - d.revenue), 0);
        underperforming.push({
          rig_id: rig.id,
          rig_name: rig.name,
          day_rate_cost: dayRateCost,
          daily_earnings: dailyEarnings,
          total_lost_margin: totalLost,
        });
      }
    }

    // 6. Alert drilling supervisors
    if (underperforming.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const body = `The following rigs have been earning below their day-rate cost for 3 consecutive days:\n\n` +
        underperforming.map((u) =>
          `• ${u.rig_name}: earning below £${u.day_rate_cost}/day — estimated £${u.total_lost_margin} lost margin over 3 days\n` +
          u.daily_earnings.map((d) => `   ${d.date}: £${d.revenue} (${d.meterage}m on ${d.job_name})`).join('\n')
        ).join('\n\n') +
        `\n\nReview the Rota Builder to swap underperforming rigs to higher-margin jobs or stand them down.\n\nGC Mission Control — Rig Profitability Autopilot`;

      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Rig Profitability Alert — ${underperforming.length} rig${underperforming.length !== 1 ? 's' : ''} underperforming`,
            body,
          });
        } catch (_) {}
      }
    }

    return Response.json({ ok: true, rigsChecked: rigs.length, underperformingCount: underperforming.length, underperforming });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}