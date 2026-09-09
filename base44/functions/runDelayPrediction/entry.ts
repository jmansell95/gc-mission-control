import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { brandedWrapper, heading, p, dataTable, callout, escapeHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

/**
 * AI Delay Prediction — runs daily at 07:00.
 *
 * Analyses historical JobDelayLog records to identify patterns, then uses an LLM
 * to predict which active jobs are at risk of delay in the next 2 weeks.
 * Sends a digest email to managers with risk-rated predictions and mitigation
 * suggestions.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Load historical delay logs (last 12 months)
    const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const delayLogs = await base44.asServiceRole.entities.JobDelayLog.filter({
      reported_at: { $gte: oneYearAgo },
    });

    if (delayLogs.length < 3) {
      return Response.json({ ok: true, skipped: true, reason: 'Not enough historical delay data for prediction' });
    }

    // 2. Load active jobs
    const activeJobs = await base44.asServiceRole.entities.Job.filter({
      status: { $in: ['in_progress', 'on_site', 'mobilising'] },
    });

    if (activeJobs.length === 0) {
      return Response.json({ ok: true, skipped: true, reason: 'No active jobs to predict' });
    }

    // 3. Aggregate delay patterns by type, job type, and location
    const byType = {};
    delayLogs.forEach((d) => {
      byType[d.delay_type] = (byType[d.delay_type] || 0) + 1;
    });

    const byJob = {};
    delayLogs.forEach((d) => {
      if (!byJob[d.job_id]) byJob[d.job_id] = { total: 0, types: {}, days: 0 };
      byJob[d.job_id].total++;
      byJob[d.job_id].types[d.delay_type] = (byJob[d.job_id].types[d.delay_type] || 0) + 1;
      byJob[d.job_id].days += d.impacted_days || 0;
    });

    // 4. Build a compact historical summary for the LLM
    const historicalSummary = {
      total_delays: delayLogs.length,
      by_type: byType,
      avg_impacted_days: delayLogs.reduce((s, d) => s + (d.impacted_days || 0), 0) / delayLogs.length,
      top_delayed_jobs: Object.entries(byJob)
        .sort((a, b) => b[1].days - a[1].days)
        .slice(0, 10)
        .map(([jid, d]) => ({ job_id: jid, delays: d.total, total_days_lost: d.days, top_types: d.types })),
    };

    // 5. Build active job context
    const jobContext = activeJobs.slice(0, 20).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      job_type: j.job_type || j.discipline || 'unknown',
      location: j.site_location || j.address || 'unknown',
      start_date: j.start_date,
      planned_end_date: j.planned_end_date || j.end_date,
      previous_delays: byJob[j.id] ? byJob[j.id].total : 0,
      previous_days_lost: byJob[j.id] ? byJob[j.id].days : 0,
    }));

    // 6. Ask the LLM to predict delay risk for each active job
    const prompt = `You are a construction delay prediction analyst for a UK ground investigation company.

Here is the historical delay data from the past 12 months:
${JSON.stringify(historicalSummary, null, 2)}

Here are the currently active jobs:
${JSON.stringify(jobContext, null, 2)}

For each active job, predict the delay risk for the next 2 weeks. Consider:
- Jobs with previous delays are higher risk
- Ground conditions delays are most common in winter (Nov-Feb)
- Weather delays correlate with season
- Mechanical failures are random but more likely on older rigs
- Utility clashes are common on urban sites

Return a JSON object with a "predictions" array. Each prediction must have:
- job_id: the job ID
- job_name: the job name
- risk_level: "low" | "medium" | "high"
- predicted_delay_type: the most likely delay type
- estimated_delay_days: number (0-5)
- confidence: "low" | "medium" | "high"
- reasoning: 1-2 sentences explaining the prediction
- mitigation: 1 sentence suggesting how to reduce the risk

Only include jobs with risk_level "medium" or "high". Skip low-risk jobs.`;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                job_id: { type: 'string' },
                job_name: { type: 'string' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                predicted_delay_type: { type: 'string' },
                estimated_delay_days: { type: 'number' },
                confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                reasoning: { type: 'string' },
                mitigation: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const predictions = (llmRes as any).predictions || [];

    if (predictions.length === 0) {
      return Response.json({ ok: true, jobsAnalysed: activeJobs.length, predictions: [], message: 'No medium/high risk jobs detected' });
    }

    // 7. Email managers the prediction digest
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const highRisk = predictions.filter((p) => p.risk_level === 'high');
    const medRisk = predictions.filter((p) => p.risk_level === 'medium');

    const baseUrl = await getAppBaseUrl(base44);
    const allPredictions = [...highRisk, ...medRisk];
    const rows = allPredictions.map((p) => [
      p.job_name,
      p.predicted_delay_type,
      `~${p.estimated_delay_days} days`,
      p.risk_level === 'high' ? `<strong style="color:#e11d48">HIGH</strong>` : `<strong style="color:#d97706">MEDIUM</strong>`,
      p.mitigation,
    ]);
    const content = heading('AI Delay Prediction Digest') +
      p(`${new Date().toLocaleDateString('en-GB')} — ${highRisk.length} high-risk and ${medRisk.length} medium-risk jobs identified from ${activeJobs.length} active jobs.`) +
      (highRisk.length > 0 ? callout(`${highRisk.length} high-risk job${highRisk.length !== 1 ? 's' : ''} require immediate attention.`, 'danger') : '') +
      dataTable(['Job', 'Predicted Delay', 'Est. Days', 'Risk', 'Mitigation'], rows) +
      p('Review these jobs in the Admin Dashboard and take proactive action where possible.') +
      (baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/admin', 'Open Dashboard')}</div>` : '');

    const html = brandedWrapper(content, { banner_subtitle: 'AI Delay Prediction', headerVariant: 'amber' });

    for (const admin of admins) {
      if (!admin.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `AI Delay Prediction — ${highRisk.length} high-risk, ${medRisk.length} medium-risk jobs`,
          html,
        });
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      jobsAnalysed: activeJobs.length,
      highRisk: highRisk.length,
      mediumRisk: medRisk.length,
      predictions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}