import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendWhatsAppToStaff } from '../../shared/whatsappSend.ts';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillSuccess, pillWarning, pillDanger,
  sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

const statusLabels = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled', decommissioning: 'Decommissioning' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const data = body.data;
    const old = body.old_data;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'job_status_change' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!data || !old) return Response.json({ skipped: true, reason: 'Missing data' });
    const newStatus = data.status;
    const oldStatus = old.status;
    if (newStatus === oldStatus) return Response.json({ skipped: true, reason: 'Status unchanged' });

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'No admins' });

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'job_status_change' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const oldLabel = statusLabels[oldStatus] || oldStatus || '—';
    const newLabel = statusLabels[newStatus] || newStatus || '—';
    const subject = cfg.subject ? cfg.subject.replace(/\{job_name\}/g, data.name || 'Job') : 'Job status updated: ' + (data.name || 'Job');

    const baseUrl = await getAppBaseUrl(base44);

    // Determine header variant based on new status
    const variant = newStatus === 'completed' ? 'emerald'
      : newStatus === 'on_hold' || newStatus === 'cancelled' ? 'rose'
      : newStatus === 'in_progress' ? 'brand'
      : 'blue';

    // Rich HTML body
    const oldPill = oldStatus === 'completed' ? pillSuccess(oldLabel)
      : oldStatus === 'on_hold' || oldStatus === 'cancelled' ? pillDanger(oldLabel)
      : pillInfo(oldLabel);
    const newPill = newStatus === 'completed' ? pillSuccess(newLabel)
      : newStatus === 'on_hold' || newStatus === 'cancelled' ? pillDanger(newLabel)
      : newStatus === 'in_progress' ? pillSuccess(newLabel)
      : pillInfo(newLabel);

    const detailsTable = infoTable([
      ['Job', data.name || '—'],
      ['Location', data.location || '—'],
      ['Previous Status', html(oldPill)],
      ['New Status', html(newPill)],
    ]);

    const bodyHtml =
      heading('Job status updated') +
      p('The status of a job has changed. Here are the details:') +
      sectionCard('Status Change', detailsTable, { titleBg: variant === 'rose' ? '#be123c' : variant === 'emerald' ? '#047857' : '#1d4ed8' }) +
      (data.status_reason ? callout(data.status_reason, newStatus === 'on_hold' || newStatus === 'cancelled' ? 'warning' : 'info') : '') +
      helpTip('What to do next', 'Open the planner to review this job. If the job is on hold or cancelled, check the crew rota and reassign any affected staff. If completed, start the decommissioning process to collect equipment from site.') +
      linkBlock(baseUrl, '/admin', 'Open Planner');

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{job_name\}/g, data.name || '—').replace(/\{location\}/g, data.location || '—')
            .replace(/\{old_status\}/g, oldLabel).replace(/\{new_status\}/g, newLabel)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner')
      : bodyHtml;

    let notified = 0;
    for (const u of admins) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email, subject,
          body: brandedWrapper(finalHtml, { ...cfg, headerVariant: variant, banner_subtitle: 'Status Update' })
        });
        notified++;
      } catch (e) {}
    }

    // WhatsApp crew notification on job cancellation / hold
    let waSent = 0;
    if (newStatus === 'on_hold' || newStatus === 'cancelled') {
      try {
        const waCfgList = await base44.asServiceRole.entities.AppSetting.filter({ key: 'whatsapp_config' }, '-created_date', 1);
        const waCfg = waCfgList?.[0]?.value || {};
        if (waCfg.notify_job_cancelled && waCfg.phone_number_id && waCfg.api_token) {
          const today = new Date().toISOString().slice(0, 10);
          const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: data.id, assigned_date: today }, '-created_date', 50);
          const staffIds = [...new Set(rotas.map(r => r.staff_id).filter(Boolean))];
          if (staffIds.length > 0) {
            const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
            const crew = allStaff.filter(s => staffIds.includes(s.id) && s.phone && s.is_active !== false);
            if (crew.length > 0) {
              const waText = `⚠️ JOB ${newStatus === 'cancelled' ? 'CANCELLED' : 'ON HOLD'}\n\n${data.name || 'Job'}\n${data.location || ''}\n\nYou are no longer required on site today. Contact your supervisor for reassignment.`;
              const waResults = await sendWhatsAppToStaff(base44, crew, waText);
              waSent = waResults.filter(r => r.ok).length;
            }
          }
        }
      } catch (e) { /* WhatsApp send failed — don't block the email notification */ }
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified, whatsapp_sent: waSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});