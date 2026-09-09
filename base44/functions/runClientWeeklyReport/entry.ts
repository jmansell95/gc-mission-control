import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, linkBlock,
  heading, p, sectionCard, helpTip, infoTable, html, BRAND
} from '../../shared/emailStyling.ts';

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

    const baseUrl = await getAppBaseUrl(base44);
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

      // 6. Send a V2-branded progress email to the client contact + project manager
      const clientList = job.client_id ? await base44.asServiceRole.entities.Client.filter({ id: job.client_id }) : [];
      const client = clientList[0];
      const clientEmail = client?.contact_email || '';
      const portalPath = job.portal_token ? '/client-portal/' + job.portal_token : '';

      const emailBody =
        heading('Weekly Progress Report') +
        p('Here is your weekly progress update for ' + (job.name || job.site_name || 'your project') + '.') +
        sectionCard('Week of ' + weekAgoStr + ' to ' + today,
          '<div style="font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap">' + escapeHtml(reportText).replace(/\n/g, '<br>') + '</div>',
          { titleBg: '#2E5A1A' }) +
        infoTable([
          ['Site Logs', String(logs.length)],
          ['Metres Drilled', meterage + 'm'],
          ['Crew Days', String(crewDays)],
          ['Photos', String(photos.length)],
          ['Milestones Completed', String(completedMilestones)],
        ]) +
        (portalPath ? helpTip('View full details', 'Click below to open the client portal and see the full project progress, photos, and milestones.') + linkBlock(baseUrl, portalPath, 'View Project Portal') : '') +
        helpTip('Questions?', 'If you have any questions about this report or the project progress, please contact your project manager.');

      const emailSubject = 'Weekly Progress Report — ' + (job.name || job.site_name || 'Project');
      const wrappedHtml = brandedWrapper(emailBody, { headerVariant: 'brand', banner_subtitle: 'Weekly Progress · ' + today });

      let emailSentTo = '';
      if (clientEmail) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({ to: clientEmail, subject: emailSubject, body: wrappedHtml });
          emailSentTo = clientEmail;
        } catch (e) { /* non-fatal — client email may not be a registered user */ }
      }

      reports.push({
        job_id: job.id,
        job_name: job.name || job.site_name,
        meterage,
        crew_days: crewDays,
        milestones_completed: completedMilestones,
        report_length: reportText.length,
        email_sent_to: emailSentTo,
      });
    }

    return Response.json({ ok: true, reportsGenerated: reports.length, reports });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}