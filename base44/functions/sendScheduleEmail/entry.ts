import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl, dataTable, p, heading, BRAND } from '../../shared/emailStyling.ts';

const DEFAULT_SCHEDULE_TEMPLATE = "Hi {staff_name},\n\nHere is your weekly schedule for {week_start}. You have {assignment_count} shift(s) this week. Please review the details below.";

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d) {
  const date = new Date(d + 'T00:00:00');
  return DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
}
function fmtWeek(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return fmtDate(weekStart) + ' – ' + DAY_NAMES[end.getDay()] + ' ' + end.getDate() + ' ' + MONTHS[end.getMonth()] + ' ' + end.getFullYear();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { weekStart, staffId, recipientEmail } = await req.json();

    // Only the configured staff_schedule template is sent — no default fallback.
    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_schedule' });
    const cfg = cfgList[0];
    if (cfg && cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Schedule alert disabled' });
    }
    const template = (cfg && cfg.template) || DEFAULT_SCHEDULE_TEMPLATE;

    const staff = staffId ? await base44.asServiceRole.entities.Staff.get(staffId).catch(() => null) : null;
    const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start: weekStart });
    const filteredRotas = staffId ? rotas.filter(r => r.staff_id === staffId) : rotas;

    const jobIds = [...new Set(filteredRotas.map(r => r.job_id))];
    const jobs = await Promise.all(jobIds.map(id => base44.asServiceRole.entities.Job.get(id).catch(() => null)));
    const vehicleIds = [...new Set(filteredRotas.map(r => r.vehicle_id).filter(Boolean))];
    const vehicles = await Promise.all(vehicleIds.map(id => base44.asServiceRole.entities.Vehicle.get(id).catch(() => null)));

    const weekLabel = fmtWeek(weekStart);
    const assignmentCount = filteredRotas.length;
    const intro = template
      .replace(/\{staff_name\}/g, staff ? staff.name : '')
      .replace(/\{week_start\}/g, weekLabel)
      .replace(/\{assignment_count\}/g, String(assignmentCount));

    const tableRows = [];
    for (const r of filteredRotas) {
      const job = jobs.find(j => j && j.id === r.job_id);
      const vehicle = vehicles.find(v => v && v.id === r.vehicle_id);
      if (!job) continue;
      const times = (r.start_time || r.end_time) ? (r.start_time || '—') + '–' + (r.end_time || '—') : '—';
      tableRows.push([
        fmtDate(r.assigned_date),
        job.name,
        job.location || '—',
        times,
        vehicle ? vehicle.registration_number : '—',
      ]);
    }
    const table = dataTable(['Date', 'Job', 'Location', 'Times', 'Vehicle'], tableRows, { accent: (cfg && cfg.accent_color) || BRAND.primary });

    const subject = (cfg && cfg.subject)
      ? cfg.subject.replace(/\{staff_name\}/g, staff ? staff.name : '').replace(/\{week_start\}/g, weekLabel)
      : ((staff ? staff.name + "'s Weekly Schedule – " : 'Weekly Rota – ') + weekLabel);

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = '<p style="font-size:14px;color:#475569;margin:0 0 16px 0;white-space:pre-wrap">' + escapeHtml(intro).replace(/\n/g, '<br>') + '</p>' +
      table + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body: styledHtml(bodyHtml, cfg),
      from_name: 'GC Mission Control'
    });

    return Response.json({ success: true, message: 'Schedule emailed to ' + recipientEmail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});