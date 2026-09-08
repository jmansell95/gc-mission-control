import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, p,
  infoTable, bulletList, sectionCard, linkBlock,
  formatGBP, progressBar, BRAND
} from '../../shared/emailStyling.ts';

// ============================================================
// sendWeeklyProgressReport — sends a weekly progress report
// email to the client contact for each portal-enabled job.
// ============================================================
// For each job with portal_enabled=true:
//   • Compiles a progress summary (status, milestones, photos,
//     billing status, upcoming schedule)
//   • Emails it to the client contact email
//
// Payload: { job_id } — send for one job
//          { all: true } — send for all portal-enabled jobs
//
// Runs as a scheduled automation (weekly) or manually from settings.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const baseUrl = await getAppBaseUrl(base44);

    // Load portal-enabled jobs
    let jobs = [];
    if (body.job_id) {
      const job = await base44.asServiceRole.entities.Job.get(body.job_id).catch(() => null);
      if (job) jobs = [job];
    } else {
      const allJobs = await base44.asServiceRole.entities.Job.list('-updated_date', 500);
      jobs = allJobs.filter(j => j.portal_enabled && j.status !== 'completed' && j.status !== 'cancelled');
    }

    if (jobs.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'No portal-enabled jobs to report on.' });
    }

    let sent = 0;
    const errors = [];

    for (const job of jobs) {
      try {
        // Load client for contact email
        let clientEmail = '';
        let clientName = '';
        if (job.client_id) {
          const client = await base44.asServiceRole.entities.Client.get(job.client_id).catch(() => null);
          if (client) {
            clientEmail = client.contact_email || client.email || '';
            clientName = client.name || '';
          }
        }
        if (!clientEmail) continue; // skip if no client email

        // Load milestones
        const milestones = await base44.asServiceRole.entities.JobMilestone.filter({ job_id: job.id }).catch(() => []);

        // Load recent photos
        const photos = await base44.asServiceRole.entities.SitePhoto.filter({ job_id: job.id }).catch(() => []);
        const recentPhotos = photos
          .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))
          .slice(0, 3);

        // Load recent rotas (this week)
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id, week_start: weekStartStr }).catch(() => []);

        // Load invoices
        const invoices = await base44.asServiceRole.entities.Invoice.filter({ job_id: job.id }).catch(() => []);

        // Build the report
        const statusLabel = (job.status || 'planning').replace(/_/g, ' ');
        const progressPct = job.meterage_target && job.meterage
          ? Math.min(100, Math.round((Number(job.meterage) / Number(job.meterage_target)) * 100))
          : 0;

        const milestoneItems = milestones.slice(0, 5).map(m => {
          const done = m.status === 'completed' || m.completed;
          const label = (m.title || m.name || 'Milestone') + (m.due_date ? ' — due ' + m.due_date : '');
          return (done ? '✅ ' : '⬜ ') + label;
        });
        const milestoneBlock = milestoneItems.length > 0
          ? sectionCard('Milestones', bulletList(milestoneItems), { titleBg: BRAND.primary })
          : '';

        let photoBlock = '';
        if (recentPhotos.length > 0) {
          const photoImgs = recentPhotos.filter(p => p.photo_url).map(p =>
            `<img src="${escapeHtml(p.photo_url)}" style="width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid ${BRAND.slate200};margin:2px" alt="Site photo" />`
          ).join('');
          photoBlock = sectionCard('Recent Site Photos', `<div style="font-size:0">${photoImgs}</div>`, { titleBg: BRAND.primary });
        }

        const invoiceTotal = invoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
        const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

        const infoRows = [
          ['Status', escapeHtml(statusLabel)],
          ['Location', escapeHtml(job.location || '—')],
        ];
        if (job.start_date && job.end_date) {
          infoRows.push(['Schedule', job.start_date + ' → ' + job.end_date]);
        }
        if (progressPct > 0) {
          infoRows.push(['Progress', progressPct + '% (' + job.meterage + 'm of ' + job.meterage_target + 'm target)']);
        }
        infoRows.push(['Crew This Week', rotas.length + ' shift' + (rotas.length === 1 ? '' : 's') + ' scheduled']);
        if (invoiceTotal > 0) {
          infoRows.push(['Billing', formatGBP(invoiceTotal) + ' total · ' + formatGBP(paidTotal) + ' paid']);
        }

        const progressBlock = progressPct > 0
          ? progressBar('Drilling Progress', progressPct)
          : '';

        const notesBlock = job.notes
          ? sectionCard('Notes', p(job.notes), { titleBg: BRAND.primary })
          : '';

        const portalLink = job.portal_token
          ? linkBlock(baseUrl, '/client-portal/' + job.portal_token, 'View Full Project Portal')
          : '';

        const bodyHtml =
          p('Hi ' + clientName + ',') +
          p("Here's your weekly progress update for " + job.name + ".") +
          infoTable(infoRows) +
          progressBlock +
          milestoneBlock +
          photoBlock +
          notesBlock +
          portalLink;

        const subject = `Weekly Progress: ${job.name} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: clientEmail,
          subject,
          body: brandedWrapper(bodyHtml, { headerVariant: 'brand', banner_subtitle: 'Project Update · ' + job.name }),
          from_name: 'GC Mission Control',
        });
        sent++;
      } catch (e) {
        errors.push({ job: job.name, error: e.message });
      }
    }

    return Response.json({
      ok: true,
      sent,
      checked: jobs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: sent > 0 ? `${sent} progress report${sent === 1 ? '' : 's'} sent.` : 'No reports sent (no client emails configured).',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}