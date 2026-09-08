import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, heading, p, subheading,
  bulletList, statTileRow, sectionCard, callout, linkBlock, BRAND
} from '../../shared/emailStyling.ts';

// ---------------------------------------------------------------------------
// AI-Powered Weekly Operations Digest
// ---------------------------------------------------------------------------
// Uses InvokeLLM to read the week's jobs, rotas, timesheets, incidents and
// financials, then writes a natural-language executive summary emailed to
// directors every Friday.
//
// Highlights: what went well, what's at risk, and what needs attention next week.
// ---------------------------------------------------------------------------

export default async function main(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartStr = weekAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // Gather week's data
    const [jobs, rotas, timesheets, incidents, invoices] = await Promise.all([
      base44.asServiceRole.entities.Job.list('-created_date', 500),
      base44.asServiceRole.entities.RotaAssignment.list('-created_date', 500),
      base44.asServiceRole.entities.Timesheet.list('-created_date', 500),
      base44.asServiceRole.entities.SafetyReport.filter({ report_type: 'incident' }),
      base44.asServiceRole.entities.Invoice.list('-created_date', 200),
    ]);

    // Filter to this week
    const weekJobs = jobs.filter((j: any) => {
      const d = j.start_date || j.created_date;
      return d && d >= weekStartStr;
    });
    const weekRotas = rotas.filter((r: any) => r.assigned_date >= weekStartStr);
    const weekTimesheets = timesheets.filter((t: any) => t.date >= weekStartStr);
    const weekIncidents = incidents.filter((i: any) =>
      i.conducted_at && i.conducted_at >= weekAgo.toISOString()
    );
    const weekInvoices = invoices.filter((inv: any) =>
      inv.created_date && inv.created_date >= weekAgo.toISOString()
    );

    // Calculate summary stats
    const activeJobs = jobs.filter((j: any) => j.status === 'in_progress').length;
    const completedJobs = weekJobs.filter((j: any) => j.status === 'completed').length;
    const totalShifts = weekRotas.filter((r: any) => r.assignment_type === 'job').length;
    const leaveDays = weekRotas.filter((r: any) =>
      r.assignment_type === 'annual_leave' || r.assignment_type === 'sick'
    ).length;
    const submittedTimesheets = weekTimesheets.filter((t: any) =>
      t.status === 'submitted' || t.status === 'approved'
    ).length;
    const approvedTimesheets = weekTimesheets.filter((t: any) => t.status === 'approved').length;
    const criticalIncidents = weekIncidents.filter((i: any) =>
      i.severity === 'high' || i.severity === 'critical'
    ).length;
    const totalInvoiced = weekInvoices.reduce((s: number, inv: any) =>
      s + (inv.total_amount || 0), 0
    );

    const dataContext = JSON.stringify({
      week_range: `${weekStartStr} to ${todayStr}`,
      jobs: {
        active: activeJobs,
        new_this_week: weekJobs.length,
        completed_this_week: completedJobs,
        new_job_names: weekJobs.slice(0, 10).map((j: any) => j.name),
      },
      rotas: {
        total_shifts: totalShifts,
        leave_days: leaveDays,
      },
      timesheets: {
        submitted: submittedTimesheets,
        approved: approvedTimesheets,
        pending_review: submittedTimesheets - approvedTimesheets,
      },
      safety: {
        total_incidents: weekIncidents.length,
        critical: criticalIncidents,
        incident_types: weekIncidents.map((i: any) => i.incident_type),
      },
      financials: {
        invoices_issued: weekInvoices.length,
        total_invoiced_gbp: totalInvoiced,
      },
    });

    // Generate the AI digest
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the operations director of Ground Control, a UK geotechnical and ground investigation company. Write a concise weekly operations digest email for the directors based on this week's data. Structure it as:

1. **Week in Review** — 2-3 sentence summary
2. **What Went Well** — 2-3 bullet points
3. **At Risk** — 2-3 bullet points (jobs behind schedule, missing timesheets, safety concerns)
4. **Needs Attention Next Week** — 2-3 actionable bullet points
5. **Key Numbers** — brief stats summary

Keep it professional, concise, and actionable. Use GBP currency format.

Weekly data:
${dataContext}`,
      response_json_schema: {
        type: 'object',
        properties: {
          week_in_review: { type: 'string' },
          what_went_well: { type: 'array', items: { type: 'string' } },
          at_risk: { type: 'array', items: { type: 'string' } },
          needs_attention: { type: 'array', items: { type: 'string' } },
          key_numbers: { type: 'string' },
        },
      },
    });

    const digest = llmResponse || {};

    // Build the email body with v2 branded building blocks
    const statsTiles = statTileRow([
      { label: 'Active Jobs', value: String(activeJobs), icon: '📍', color: BRAND.primary },
      { label: 'New This Week', value: String(weekJobs.length), icon: '🆕', color: BRAND.blue },
      { label: 'Shifts', value: String(totalShifts), icon: '👷', color: BRAND.emerald },
      { label: 'Incidents', value: String(weekIncidents.length), icon: '⚠', color: weekIncidents.length > 0 ? BRAND.rose : BRAND.emerald },
    ]);

    const financeTiles = statTileRow([
      { label: 'Timesheets Submitted', value: String(submittedTimesheets), icon: '📝', color: BRAND.primary },
      { label: 'Approved', value: String(approvedTimesheets), icon: '✓', color: BRAND.emerald },
      { label: 'Invoices Issued', value: String(weekInvoices.length), icon: '🧾', color: BRAND.blue },
      { label: 'Total Invoiced', value: '£' + Number(totalInvoiced || 0).toLocaleString('en-GB'), icon: '£', color: BRAND.amber },
    ]);

    const wellList = (digest.what_went_well || []).length > 0
      ? bulletList(digest.what_went_well)
      : p('No specific highlights recorded this week.');

    const riskList = (digest.at_risk || []).length > 0
      ? bulletList(digest.at_risk)
      : p('No items at risk — all operations on track.');

    const attentionList = (digest.needs_attention || []).length > 0
      ? bulletList(digest.needs_attention)
      : p('No specific actions required next week.');

    const baseUrl = await getAppBaseUrl(base44);

    const bodyHtml =
      heading('Week in Review') +
      p(digest.week_in_review || 'No summary available for this week.') +
      statsTiles +
      sectionCard('✅ What Went Well', wellList, { titleBg: BRAND.emeraldDark }) +
      sectionCard('⚠️ At Risk', riskList, { titleBg: BRAND.roseDark }) +
      sectionCard('📋 Needs Attention Next Week', attentionList, { titleBg: BRAND.amberDark }) +
      financeTiles +
      sectionCard('Key Numbers', p(digest.key_numbers || 'No key numbers recorded.'), { titleBg: BRAND.primary }) +
      linkBlock(baseUrl, '/admin', 'Open Dashboard');

    const emailBody = brandedWrapper(bodyHtml, {
      headerVariant: 'brand',
      banner_subtitle: 'Weekly Operations Digest · ' + weekStartStr + ' — ' + todayStr,
    });

    // Fetch admin users to email the digest to
    const admins = await base44.asServiceRole.entities.User.list();
    const directorEmails = admins
      .filter((u: any) => u.role === 'admin')
      .map((u: any) => u.email)
      .filter(Boolean);

    let emailSent = false;
    if (directorEmails.length > 0) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: directorEmails.join(','),
          subject: `Weekly Operations Digest — ${weekStartStr} to ${todayStr}`,
          body: emailBody,
          from_name: 'GC Mission Control',
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
      }
    }

    return Response.json({
      success: true,
      digest,
      email_sent: emailSent,
      recipients: directorEmails.length,
      week_range: `${weekStartStr} to ${todayStr}`,
      stats: {
        active_jobs: activeJobs,
        new_jobs: weekJobs.length,
        completed_jobs: completedJobs,
        total_shifts: totalShifts,
        leave_days: leaveDays,
        submitted_timesheets: submittedTimesheets,
        approved_timesheets: approvedTimesheets,
        incidents: weekIncidents.length,
        critical_incidents: criticalIncidents,
        invoices_issued: weekInvoices.length,
        total_invoiced: totalInvoiced,
      },
    });
  } catch (error: any) {
    console.error('Weekly digest error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Weekly digest generation failed',
    }, { status: 500 });
  }
}