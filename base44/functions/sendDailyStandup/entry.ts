import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { format } from 'npm:date-fns@3.6.0';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillDanger, pillWarning, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow
} from '../../shared/emailStyling.ts';

// Daily Stand-up — runs every morning and emails admins/supervisors a
// plain-English digest of what needs attention today.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const e = base44.asServiceRole.entities;
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = (() => { const d = new Date(today + 'T00:00:00'); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); })();

    const [assets, safetyReports, rotas, staff, vehicles] = await Promise.all([
      e.SiteAsset.list('-created_date', 500),
      e.SafetyReport.filter({ status: 'open' }),
      e.RotaAssignment.filter({ assigned_date: today }),
      e.Staff.filter({ is_active: true }),
      e.Vehicle.list(),
    ]);

    // 1. Rigs overdue or due soon for maintenance
    const rigs = assets.filter(a => (a.is_rig === true || a.asset_type === 'rig'));
    const rigAlerts = rigs.filter(r => r.maintenance_status === 'overdue' || r.maintenance_status === 'due_soon' || r.compliance_status === 'expired');

    // 2. Critical safety actions
    const criticalActions = [];
    safetyReports.forEach(r => {
      (r.action_items || []).forEach(a => {
        if (a.priority === 'critical' || a.priority === 'high') {
          criticalActions.push({ audit: r.audit_title || r.site_name, description: a.description, priority: a.priority, due: a.due_date });
        }
      });
    });

    // 3. Crew on site today
    const crewToday = [...new Set(rotas.map(r => r.staff_id))].length;
    const activeJobs = [...new Set(rotas.map(r => r.job_id))].length;

    // 4. Vehicles with service/MOT due soon
    const vehicleAlerts = vehicles.filter(v =>
      (v.mot_expiry && v.mot_expiry <= today) ||
      (v.service_due_date && v.service_due_date <= today)
    );

    const dateStr = format(new Date(), 'EEEE dd MMMM yyyy');

    // Load email template from settings
    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'daily_standup' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const baseUrl = await getAppBaseUrl(base44);

    // Build rich HTML digest
    const statsTiles = statTileRow([
      { label: 'Crew On Site', value: String(crewToday), icon: '👷', color: '#2E5A1A' },
      { label: 'Active Jobs', value: String(activeJobs), icon: '📋', color: '#2563eb' },
      { label: 'Rig Alerts', value: String(rigAlerts.length), icon: '⛏', color: rigAlerts.length > 0 ? '#e11d48' : '#059669' },
      { label: 'Safety Actions', value: String(criticalActions.length), icon: '⚠', color: criticalActions.length > 0 ? '#e11d48' : '#059669' },
    ]);

    // Rig alerts table
    let rigTable = '';
    if (rigAlerts.length > 0) {
      const rigRows = rigAlerts.slice(0, 10).map(r => {
        const pill = r.compliance_status === 'expired' ? html(pillDanger('Expired'))
          : r.maintenance_status === 'overdue' ? html(pillDanger('Overdue'))
          : html(pillWarning('Due Soon'));
        return [r.name, r.maintenance_status || r.compliance_status || '—', r.next_service_date || '—', pill];
      });
      rigTable = sectionCard('Rig Maintenance Alerts', dataTable(['Rig', 'Status', 'Next Service', 'Priority'], rigRows), { titleBg: '#be123c' });
    }

    // Safety actions table
    let safetyTable = '';
    if (criticalActions.length > 0) {
      const safetyRows = criticalActions.slice(0, 10).map(a => {
        const pill = a.priority === 'critical' ? html(pillDanger('Critical')) : html(pillWarning('High'));
        return [a.audit || '—', a.description, a.due || '—', pill];
      });
      safetyTable = sectionCard('Critical/High Safety Actions', dataTable(['Audit', 'Action', 'Due Date', 'Priority'], safetyRows), { titleBg: '#be123c' });
    }

    // Vehicle alerts table
    let vehicleTable = '';
    if (vehicleAlerts.length > 0) {
      const vehicleRows = vehicleAlerts.slice(0, 8).map(v => {
        const motStatus = v.mot_expiry && v.mot_expiry <= today ? html(pillDanger('MOT Overdue')) : '';
        const serviceStatus = v.service_due_date && v.service_due_date <= today ? html(pillWarning('Service Due')) : '';
        return [v.registration_number || v.name, motStatus || '—', serviceStatus || '—'];
      });
      vehicleTable = sectionCard('Vehicle Alerts', dataTable(['Vehicle', 'MOT', 'Service'], vehicleRows), { titleBg: '#b45309' });
    }

    const allClear = rigAlerts.length === 0 && criticalActions.length === 0 && vehicleAlerts.length === 0;

    const bodyHtml =
      heading('Daily stand-up digest') +
      p('Here\'s your morning operations summary for ' + dateStr + '. This replaces the morning phone round-robin — everything you need to start the day is below.') +
      statsTiles +
      (allClear ? callout('All clear — no critical alerts today. Have a safe and productive day.', 'success') : '') +
      rigTable +
      safetyTable +
      vehicleTable +
      helpTip('What to do next', 'Address any critical or overdue items first. Open the planner to check today\'s crew assignments. Brief your team on any safety actions that need immediate attention.') +
      linkBlock(baseUrl, '/admin', 'Open Dashboard');

    const subject = cfg.subject
      ? cfg.subject.replace(/\{date\}/g, format(new Date(), 'dd MMM yyyy'))
      : `☀️ Daily Stand-up — ${format(new Date(), 'dd MMM yyyy')}`;

    // If custom template is set, use it instead of the rich HTML
    const finalHtml = (cfg.template)
      ? (() => {
          const rigAlertLines = rigAlerts.slice(0, 10).map(r =>
            `   • ${r.name} — ${r.maintenance_status || r.compliance_status}${r.next_service_date ? ` (next: ${r.next_service_date})` : ''}`
          ).join('\n') || '   All rigs healthy ✓';
          const safetyActionLines = criticalActions.slice(0, 10).map(a =>
            `   • [${a.priority.toUpperCase()}] ${a.description}${a.due ? ` (due ${a.due})` : ''}`
          ).join('\n') || '   No critical safety actions ✓';
          const vehicleAlertLines = vehicleAlerts.slice(0, 8).map(v =>
            `   • ${v.registration_number || v.name} — MOT ${v.mot_expiry || 'N/A'}, service ${v.service_due_date || 'N/A'}`
          ).join('\n') || '   All vehicles compliant ✓';
          const DEFAULT_STANDUP_TEMPLATE = `=== DAILY STAND-UP DIGEST ===\nDate: {date}\n\nCREW ON SITE TODAY: {crew_on_site} staff across {active_jobs} active job(s)\n\nRIG MAINTENANCE ALERTS: {rig_alert_count}\n{rig_alerts}\n\nCRITICAL/HIGH SAFETY ACTIONS: {safety_action_count}\n{safety_actions}\n\nVEHICLE ALERTS: {vehicle_alert_count}\n{vehicle_alerts}\n\nGenerated by GC Mission Control`;
          const text = (cfg.template || DEFAULT_STANDUP_TEMPLATE)
            .replace(/\{date\}/g, dateStr)
            .replace(/\{crew_on_site\}/g, String(crewToday))
            .replace(/\{active_jobs\}/g, String(activeJobs))
            .replace(/\{rig_alert_count\}/g, String(rigAlerts.length))
            .replace(/\{rig_alerts\}/g, rigAlertLines)
            .replace(/\{safety_action_count\}/g, String(criticalActions.length))
            .replace(/\{safety_actions\}/g, safetyActionLines)
            .replace(/\{vehicle_alert_count\}/g, String(vehicleAlerts.length))
            .replace(/\{vehicle_alerts\}/g, vehicleAlertLines);
          return escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
        })()
      : bodyHtml;

    let recipients = [];
    if (cfg.recipient_emails) {
      recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (recipients.length === 0) {
      const users = await base44.asServiceRole.entities.User.list();
      recipients = users.filter(u => u.role === 'admin').map(u => u.email);
    }
    let emailed = 0;
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'brand', banner_subtitle: 'Morning Digest · ' + format(new Date(), 'dd MMM') }),
        });
        emailed++;
      } catch (err) { /* skip */ }
    }

    return Response.json({
      success: true,
      date: today,
      crew_today: crewToday,
      active_jobs: activeJobs,
      rig_alerts: rigAlerts.length,
      critical_actions: criticalActions.length,
      vehicle_alerts: vehicleAlerts.length,
      admins_emailed: emailed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}