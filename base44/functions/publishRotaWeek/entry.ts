import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { brandedWrapper, heading, p, dataTable, ctaButton, escapeHtml, getAppBaseUrl as getBaseUrl } from '../../shared/emailStyling.ts';

const DEFAULT_SCHEDULE_TEMPLATE = "Hi {staff_name},\n\nHere is your weekly schedule for {week_start}. You have {assignment_count} assignment(s) this week. Please review the details below.";

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
// Parse compliance dates — staff items use YYYY-MM, others use YYYY-MM-DD
function parseComplianceDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}
async function getAppBaseUrl(base44) {
  try { const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' }); return (list[0] && list[0].app_base_url) || ''; } catch (e) { return ''; }
}

function buildEmail(staff, rotas, jobs, vehicles, cfg, weekStart, baseUrl) {
  const weekLabel = fmtWeek(weekStart);
  const assignmentCount = rotas.length;

  // Only the configured template is sent as the intro — no default greeting.
  const intro = cfg.template
    .replace(/\{staff_name\}/g, staff.name)
    .replace(/\{week_start\}/g, weekLabel)
    .replace(/\{assignment_count\}/g, String(assignmentCount));

  const tableRows = rotas.map(r => {
    const job = jobs.find((j) => j && j.id === r.job_id);
    const vehicle = vehicles.find((v) => v && v.id === r.vehicle_id);
    if (!job) return null;
    const times = (r.start_time || r.end_time) ? (r.start_time || '—') + '–' + (r.end_time || '—') : '—';
    return [fmtDate(r.assigned_date), job.name, job.location, times, vehicle ? vehicle.registration_number : '—'];
  }).filter(Boolean);

  const introHtml = '<p style="margin:0 0 16px 0;color:#334155;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">' + escapeHtml(intro).replace(/\n/g, '<br>') + '</p>';
  const table = dataTable(['Date', 'Job', 'Location', 'Times', 'Vehicle'], tableRows);
  const cta = baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/staff-schedule', 'View your schedule')}</div>` : '';
  const content = introHtml + table + cta;
  const html = brandedWrapper(content, { banner_title: (cfg && cfg.banner_title) || 'GC Mission Control', banner_subtitle: 'Weekly Schedule', footer_text: (cfg && cfg.footer_text) || 'GC Mission Control', show_banner: !(cfg && cfg.show_banner === false) });

  const subject = (cfg && cfg.subject)
    ? cfg.subject.replace(/\{staff_name\}/g, staff.name).replace(/\{week_start\}/g, weekLabel)
    : (staff.name + "'s Weekly Schedule – " + weekLabel);
  return { html, subject };
}

function buildManagerEmail(rotas, jobs, vehicles, cfg, weekStart, baseUrl) {
  const weekLabel = fmtWeek(weekStart);
  const tableRows = rotas.map(r => {
    const job = jobs.find((j) => j && j.id === r.job_id);
    const vehicle = vehicles.find((v) => v && v.id === r.vehicle_id);
    if (!job) return null;
    const times = (r.start_time || r.end_time) ? (r.start_time || '—') + '–' + (r.end_time || '—') : '—';
    return [fmtDate(r.assigned_date), r._staffName || '—', job.name, job.location, times, vehicle ? vehicle.registration_number : '—'];
  }).filter(Boolean);

  const content = heading('Weekly Rota Published') +
    p('The weekly rota has been published for ' + weekLabel + '. Below is the full schedule for all assigned staff.') +
    dataTable(['Date', 'Staff', 'Job', 'Location', 'Times', 'Vehicle'], tableRows) +
    (baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/admin', 'Open planner')}</div>` : '');
  const html = brandedWrapper(content, { banner_title: (cfg && cfg.banner_title) || 'GC Mission Control', banner_subtitle: 'Rota Published', footer_text: (cfg && cfg.footer_text) || 'GC Mission Control', show_banner: !(cfg && cfg.show_banner === false) });
  return { html, subject: 'Weekly Rota Published – ' + weekLabel };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { weekStart, force } = await req.json().catch(() => ({}));
    if (!weekStart) return Response.json({ error: 'weekStart required' }, { status: 400 });

    // ── Compliance gate ──
    // Block the rota from going live if any assigned staff or assets have
    // expired compliance (CSCS/CPCS cards, rig certificates, etc.).
    // The manager can override with force: true after reviewing the list.
    const preRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start: weekStart });
    if (preRotas.length > 0) {
      const preStaffIds = [...new Set(preRotas.map((r) => r.staff_id))];
      const preJobIds = [...new Set(preRotas.map((r) => r.job_id).filter(Boolean))];
      const [complianceItems, assetAssignments, allAssets, staffList] = await Promise.all([
        base44.asServiceRole.entities.ComplianceItem.list('-created_date', 500),
        base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 500),
        base44.asServiceRole.entities.SiteAsset.list('-created_date', 500),
        Promise.all(preStaffIds.map((id) => base44.asServiceRole.entities.Staff.get(id).catch(() => null))),
      ]);
      const todayStr = new Date().toISOString().split('T')[0];
      const violations = [];

      // Staff compliance — expired CSCS / CPCS / NPORS cards etc.
      preStaffIds.forEach((staffId) => {
        const member = staffList.find((s) => s && s.id === staffId);
        complianceItems
          .filter((c) => c.category === 'staff' && c.reference_id === staffId && c.status_override === 'auto')
          .forEach((c) => {
            if (!c.expiry_date) return;
            const expiry = parseComplianceDate(c.expiry_date);
            if (expiry && !isNaN(expiry.getTime()) && expiry < new Date(todayStr + 'T00:00:00')) {
              violations.push({
                type: 'staff',
                staffId,
                staffName: (member && member.name) || c.reference_name || 'Unknown',
                title: c.title,
                expiryDate: c.expiry_date,
              });
            }
          });
      });

      // Asset compliance — expired rigs / equipment certificates
      preJobIds.forEach((jobId) => {
        assetAssignments
          .filter((a) => a.job_id === jobId)
          .forEach((a) => {
            const asset = allAssets.find((ast) => ast.id === a.asset_id);
            const liveStatus = (asset && asset.compliance_status) || a.compliance_status || 'unknown';
            const expiry = (asset && asset.compliance_expiry_date) || null;
            const isEvergreen =
              (asset && (asset.asset_type === 'machinery' || asset.asset_type === 'trailer')) ||
              a.asset_type === 'machinery' || a.asset_type === 'trailer';
            let effectiveStatus = liveStatus;
            if (!isEvergreen && expiry && liveStatus !== 'expired') {
              if (expiry < todayStr) effectiveStatus = 'expired';
            }
            if (effectiveStatus === 'expired') {
              violations.push({
                type: 'asset',
                jobId,
                assetName: a.asset_name || (asset && asset.name) || 'Unknown',
                assetType: a.asset_type || (asset && asset.asset_type),
                expiryDate: expiry,
              });
            }
          });
      });

      if (violations.length > 0 && !force) {
        return Response.json({ error: 'compliance_violations', violations }, { status: 422 });
      }
    }

    // Upsert the RotaWeek as published
    const existing = await base44.asServiceRole.entities.RotaWeek.filter({ week_start: weekStart });
    const now = new Date().toISOString();
    if (existing[0]) {
      await base44.asServiceRole.entities.RotaWeek.update(existing[0].id, { status: 'published', published_at: now, superseded: false });
    } else {
      await base44.asServiceRole.entities.RotaWeek.create({ week_start: weekStart, status: 'published', published_at: now });
    }

    // Supersede all other published weeks so staff only see this one
    await base44.asServiceRole.entities.RotaWeek.updateMany(
      { status: 'published', week_start: { $ne: weekStart } },
      { $set: { superseded: true } }
    );

    // ── Materialise continuous depot duty ──
    // For each active RecurringDepotDuty rule, create yard_depot RotaAssignment
    // records for each matching weekday in the published week where no
    // assignment already exists, so the staff schedule + DepotShiftWizard have
    // a real record to work for that week.
    try {
      const depotRules = await base44.asServiceRole.entities.RecurringDepotDuty.filter({ is_active: true });
      if (depotRules.length > 0) {
        const existingWeekRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start: weekStart });
        const existingKey = new Set(existingWeekRotas.map((r) => r.staff_id + '|' + r.assigned_date));
        const weekStartObj = new Date(weekStart + 'T00:00:00');
        const weekDates: { dateStr: string; dow: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStartObj);
          d.setDate(d.getDate() + i);
          weekDates.push({ dateStr: d.toISOString().split('T')[0], dow: d.getDay() });
        }
        const newDepotAssignments: any[] = [];
        for (const rule of depotRules) {
          if (!rule.staff_id) continue;
          const days = Array.isArray(rule.days_of_week) && rule.days_of_week.length > 0 ? rule.days_of_week : [1, 2, 3, 4, 5];
          for (const wd of weekDates) {
            if (!days.includes(wd.dow)) continue;
            if (rule.start_date && wd.dateStr < rule.start_date) continue;
            if (rule.end_date && wd.dateStr > rule.end_date) continue;
            if (existingKey.has(rule.staff_id + '|' + wd.dateStr)) continue;
            const dObj = new Date(wd.dateStr + 'T00:00:00');
            const day = dObj.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const monday = new Date(dObj);
            monday.setDate(dObj.getDate() + diff);
            newDepotAssignments.push({
              job_id: '',
              assignment_type: 'yard_depot',
              staff_id: rule.staff_id,
              division_id: rule.division_id || '',
              assigned_date: wd.dateStr,
              vehicle_id: '',
              rig_asset_id: '',
              week_start: monday.toISOString().split('T')[0],
              start_time: rule.start_time || '',
              end_time: rule.end_time || '',
              notes: rule.notes || '',
              is_overtime: false,
              rate_multiplier: null,
              work_weekends: false,
              status: 'assigned',
            });
            existingKey.add(rule.staff_id + '|' + wd.dateStr);
          }
        }
        if (newDepotAssignments.length > 0) {
          await base44.asServiceRole.entities.RotaAssignment.bulkCreate(newDepotAssignments);
        }
      }
    } catch (e) { /* non-fatal — don't block rota publish for depot materialisation */ }

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_schedule' });
    const cfg = cfgList[0];
    // Only skip emails when the alert has been explicitly disabled.
    if (cfg && cfg.enabled === false) {
      return Response.json({ success: true, published: true, emailed: 0, skipped: 0, disabled: true });
    }
    // Fall back to a default template so staff always receive their schedule.
    const effectiveCfg = Object.assign({}, cfg || {}, {
      template: (cfg && cfg.template) || DEFAULT_SCHEDULE_TEMPLATE
    });

    const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start: weekStart });
    const staffIds = [...new Set(rotas.map((r) => r.staff_id))];
    const jobIds = [...new Set(rotas.map((r) => r.job_id).filter(Boolean))];
    const vehicleIds = [...new Set(rotas.map((r) => r.vehicle_id).filter(Boolean))];
    const [staffList, jobs, vehicles] = await Promise.all([
      Promise.all(staffIds.map((id) => base44.asServiceRole.entities.Staff.get(id).catch(() => null))),
      Promise.all(jobIds.map((id) => base44.asServiceRole.entities.Job.get(id).catch(() => null))),
      Promise.all(vehicleIds.map((id) => base44.asServiceRole.entities.Vehicle.get(id).catch(() => null)))
    ]);

    const baseUrl = await getAppBaseUrl(base44);
    let emailed = 0, skipped = 0;
    for (const s of staffList) {
      if (!s || !s.email) { skipped++; continue; }
      if (s.email_notifications_enabled === false) { skipped++; continue; }
      const myRotas = rotas.filter((r) => r.staff_id === s.id && jobs.find((j) => j && j.id === r.job_id));
      if (myRotas.length === 0) continue;
      const { html, subject } = buildEmail(s, myRotas, jobs, vehicles, effectiveCfg, weekStart, baseUrl);
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: s.email, subject, body: html, from_name: 'GC Mission Control' });
        emailed++;
      } catch (e) {
        skipped++;
      }
    }

    // Send a full-schedule copy to configured recipients (managers/admins)
    const recipients = (cfg && cfg.recipient_emails) ? String(cfg.recipient_emails).split(',').map((e) => e.trim()).filter(Boolean) : [];
    let copies = 0;
    if (recipients.length > 0) {
      const allRotas = rotas.filter((r) => jobs.find((j) => j && j.id === r.job_id));
      if (allRotas.length > 0) {
        const withNames = allRotas.map((r) => {
          const st = staffList.find((s) => s && s.id === r.staff_id);
          return Object.assign({}, r, { _staffName: st ? st.name : '—' });
        });
        const { html: mgrHtml, subject: mgrSubject } = buildManagerEmail(withNames, jobs, vehicles, effectiveCfg, weekStart, baseUrl);
        for (const email of recipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject: mgrSubject, body: mgrHtml, from_name: 'GC Mission Control' });
            copies++;
          } catch (e) {}
        }
      }
    }

    // Auto-move all involved jobs from 'planning' to 'in_progress'
    let jobsActivated = 0;
    const newlyActiveJobs: any[] = [];
    if (jobIds.length > 0) {
      const jobsToUpdate = jobs.filter((j) => j && j.status === 'planning');
      if (jobsToUpdate.length > 0) {
        await base44.asServiceRole.entities.Job.updateMany(
          { _id: { $in: jobsToUpdate.map((j) => j.id) } },
          { $set: { status: 'in_progress', status_changed_at: now } }
        );
        jobsActivated = jobsToUpdate.length;
        newlyActiveJobs.push(...jobsToUpdate);
      }
    }

    // ── Auto-create AFP #1 for each newly-activated job ──
    // When a job goes live (rota published → in_progress), automatically
    // create the first AFP with period_start = job start date and populate
    // it with live field data — zero manual steps for the billing team.
    let afpsCreated = 0;
    for (const job of newlyActiveJobs) {
      try {
        const existingAfps = await base44.asServiceRole.entities.AFP.filter({ job_id: job.id });
        if (existingAfps.length > 0) continue; // already has AFPs

        const afp = await base44.asServiceRole.entities.AFP.create({
          job_id: job.id,
          job_name: job.name,
          job_reference: job.job_reference || '',
          division_id: job.division_id || '',
          afp_number: 1,
          period_start_date: job.start_date || weekStart,
          period_end_date: '',
          submission_deadline: '',
          status: 'draft',
          client_name: job.client_name || '',
          client_po: job.job_reference || '',
          gc_job_number: job.job_reference || '',
          contract_value: job.budget_amount || 0,
          total_claimed: 0,
          original_total: 0,
          disputed_total: 0,
          agreed_total: 0,
          dispute_status: 'none',
        });

        // Immediately populate with field data
        try {
          await base44.asServiceRole.functions.invoke('populateAFPFromFieldData', { afp_id: afp.id });
        } catch (e) { /* non-fatal — billing team can refresh later */ }
        afpsCreated++;
      } catch (e) { /* non-fatal — don't block rota publish for AFP creation */ }
    }

    return Response.json({ success: true, published: true, emailed, skipped, copies, disabled: false, jobsActivated, afpsCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});