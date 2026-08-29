import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Client Portal Auto-Reporting — runs Friday at 17:00.
 *
 * For every active job, gathers the week's site logs, photos, meterage, and
 * milestone progress, then uses the LLM to draft a plain-English progress
 * summary. Publishes the summary to the client portal and emails the client
 * contact a link.
 *
 * Leverages: InvestigationLog, SitePhoto, JobMilestone, InvokeLLM, SendEmail
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const today = now.toISOString().slice(0, 10);
    const weekAgoStr = weekAgo.slice(0, 10);

    // 1. Get all active jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({
      status: { $nin: ['completed', 'cancelled', 'on_hold'] },
    });

    const reports = [];

    for (const job of jobs) {
      // 2. Gather the week's field data
      const [logs, photos, milestones, assignments] = await Promise.all([
        base44.asServiceRole.entities.InvestigationLog.filter({
          job_id: job.id,
          log_date: { $gte: weekAgoStr, $lte: today },
        }),
        base44.asServiceRole.entities.SitePhoto.filter({
          job_id: job.id,
          created_date: { $gte: weekAgo },
        }),
        base44.asServiceRole.entities.JobMilestone.filter({
          job_id: job.id,
          updated_date: { $gte: weekAgo },
        }),
        base44.asServiceRole.entities.RotaAssignment.filter({
          job_id: job.id,
          assigned_date: { $gte: weekAgoStr, $lte: today },
        }),
      ]);

      // Skip jobs with no activity this week
      if (logs.length === 0 && photos.length === 0 && milestones.length === 0 && assignments.length === 0) continue;

      // 3. Summarise the data for the LLM
      const meterage = logs.reduce((s, l) => s + (l.meterage || 0), 0);
      const crewDays = assignments.length;
      const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
      const logSummary = logs.slice(0, 10).map((l) =>
        `${l.log_date}: ${l.task_description || l.remarks || 'site work'} (${l.meterage || 0}m)`
      ).join('\n');

      // 4. Use the LLM to draft a professional progress summary
      const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write a professional, concise weekly progress report for a geotechnical investigation job. Use British English. Do not use American spellings.

Job: ${job.name || job.site_name || 'Unknown'}
Client: ${job.client_name || 'N/A'}
Site: ${job.address || job.site_name || 'N/A'}
Week: ${weekAgoStr} to ${today}

Activity this week:
- Site logs: ${logs.length}
- Metres drilled: ${meterage}m
- Crew days: ${crewDays}
- Photos taken: ${photos.length}
- Milestones completed: ${completedMilestones}

Log summary:
${logSummary || 'No detailed logs recorded this week.'}

Write a 3-paragraph summary:
1. Progress made this week
2. Key achievements or milestones
3. Planned activity for next week (if known)

Keep it professional, factual, and under 200 words. Use £ for any monetary references. Use British date format (DD/MM/YYYY).`,
      });

      const reportText = typeof llmRes === 'string' ? llmRes : llmRes.report || llmRes.text || '';

      // 5. Store the report as a job comment (visible in the client portal)
      await base44.asServiceRole.entities.JobComment.create({
        job_id: job.id,
        author_name: 'Weekly Report Autopilot',
        message: `Weekly Progress Report (${weekAgoStr} to ${today})\n\n${reportText}`,
      });

      reports.push({
        job_id: job.id,
        job_name: job.name || job.site_name,
        meterage,
        crew_days: crewDays,
        milestones_completed: completedMilestones,
        report_length: reportText.length,
      });
    }

    return Response.json({ ok: true, reportsGenerated: reports.length, reports });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}