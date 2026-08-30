import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// AI-Powered Weekly Operations Digest
// ---------------------------------------------------------------------------
// Uses InvokeLLM to read the week's jobs, rotas, timesheets, incidents and
// financials, then writes a natural-language executive summary emailed to
// directors every Friday.
//
// Highlights: what went well, what's at risk, and what needs attention next week.
// ---------------------------------------------------------------------------

export default async function main(req: any, res: any) {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartStr = weekAgo.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // Gather week's data
    const [jobs, rotas, timesheets, incidents, invoices] = await Promise.all([
      base44.entities.Job.list('-created_date', 500),
      base44.entities.RotaAssignment.list('-created_date', 500),
      base44.entities.Timesheet.list('-created_date', 500),
      base44.entities.SafetyReport.filter({ report_type: 'incident' }),
      base44.entities.Invoice.list('-created_date', 200),
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
    const llmResponse = await base44.integrations.Core.InvokeLLM({
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

    // Build the email body
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #2E5A1A, #1c4a12); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Weekly Operations Digest</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">${weekStartStr} — ${todayStr}</p>
        </div>

        <h2 style="color: #2E5A1A; font-size: 18px; margin-bottom: 8px;">Week in Review</h2>
        <p style="color: #334155; line-height: 1.6; margin-bottom: 24px;">${digest.week_in_review || ''}</p>

        <h2 style="color: #2E5A1A; font-size: 18px; margin-bottom: 8px;">✅ What Went Well</h2>
        <ul style="color: #334155; line-height: 1.8; margin-bottom: 24px;">
          ${(digest.what_went_well || []).map((item: string) => `<li>${item}</li>`).join('')}
        </ul>

        <h2 style="color: #dc2626; font-size: 18px; margin-bottom: 8px;">⚠️ At Risk</h2>
        <ul style="color: #334155; line-height: 1.8; margin-bottom: 24px;">
          ${(digest.at_risk || []).map((item: string) => `<li>${item}</li>`).join('')}
        </ul>

        <h2 style="color: #d97706; font-size: 18px; margin-bottom: 8px;">📋 Needs Attention Next Week</h2>
        <ul style="color: #334155; line-height: 1.8; margin-bottom: 24px;">
          ${(digest.needs_attention || []).map((item: string) => `<li>${item}</li>`).join('')}
        </ul>

        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #2E5A1A; font-size: 16px; margin: 0 0 8px;">Key Numbers</h2>
          <p style="color: #334155; margin: 0; line-height: 1.6;">${digest.key_numbers || ''}</p>
        </div>

        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
          GC Mission Control — Automated Weekly Digest · Generated ${todayStr}
        </p>
      </div>
    `;

    // Fetch admin users to email the digest to
    const admins = await base44.entities.User.list();
    const directorEmails = admins
      .filter((u: any) => u.role === 'admin')
      .map((u: any) => u.email)
      .filter(Boolean);

    let emailSent = false;
    if (directorEmails.length > 0) {
      try {
        await base44.integrations.Core.SendEmail({
          to: directorEmails.join(','),
          subject: `Weekly Operations Digest — ${weekStartStr} to ${todayStr}`,
          body: emailBody,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
      }
    }

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: error.message || 'Weekly digest generation failed',
    });
  }
}