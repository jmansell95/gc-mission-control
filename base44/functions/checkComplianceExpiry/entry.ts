import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#0e7a4f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}
function styledHtml(rawBodyHtml, cfg) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Mission Control';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Mission Control';
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + rawBodyHtml + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}
async function getAppBaseUrl(base44) {
  try { const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' }); return (list[0] && list[0].app_base_url) || ''; } catch (e) { return ''; }
}

// Parse compliance date — supports YYYY-MM (staff) and YYYY-MM-DD (other categories)
function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

// Whole days from now until a YYYY-MM-DD date (negative = past).
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

// Derive the most likely statutory inspection type from the asset type.
function recordTypeForAsset(assetType) {
  if (assetType === 'portable_appliance') return 'pat_inspection';
  if (assetType === 'rig' || assetType === 'lifting') return 'loler_inspection';
  return 'puwer_inspection';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Part 1: ComplianceItem (staff / vehicle / company) expiry alerts ──
    let ciResult = { sent: false, alertCount: 0, notifiedRecipients: 0, skipped: null };
    try {
      const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'compliance_expiry' });
      const cfg = settings[0];
      if (!cfg || cfg.enabled === false) {
        ciResult.skipped = 'Alert disabled or not configured';
      } else if (!cfg.template) {
        ciResult.skipped = 'No template configured for compliance expiry';
      } else {
        const daysBefore = (cfg && cfg.days_before_warning) ? cfg.days_before_warning : 30;
        const complianceItems = await base44.asServiceRole.entities.ComplianceItem.list('-created_date', 500);
        const staff = await base44.asServiceRole.entities.Staff.list();
        const users = await base44.asServiceRole.entities.User.list();
        const admins = users.filter(u => u.role === 'admin');

        let recipients = [];
        if (cfg && cfg.recipient_emails) {
          recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          recipients = admins.map(u => u.email).filter(Boolean);
        }

        const now = new Date();
        const cutoff = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

        const alerts = [];
        complianceItems.forEach(c => {
          if (c.status_override === 'not_required' || c.status_override === 'missing') return;
          if (!c.expiry_date) return;
          const expiry = parseDate(c.expiry_date);
          if (!expiry || isNaN(expiry.getTime())) return;
          let status = null;
          if (expiry < now) status = 'EXPIRED';
          else if (expiry <= cutoff) status = 'Expiring soon';
          if (status) {
            const staffMember = staff.find(s => s.id === c.reference_id || s.name === c.reference_name);
            alerts.push({
              title: c.title,
              category: c.category,
              referenceName: c.reference_name || staffMember?.name || 'Unknown',
              expiryDate: c.expiry_date,
              status
            });
          }
        });

        if (alerts.length > 0 && recipients.length > 0) {
          alerts.sort((a, b) => {
            if (a.status === 'EXPIRED' && b.status !== 'EXPIRED') return -1;
            if (b.status === 'EXPIRED' && a.status !== 'EXPIRED') return 1;
            return a.expiryDate.localeCompare(b.expiryDate);
          });
          let alertList = '';
          alerts.forEach(a => {
            alertList += a.referenceName + ' — ' + a.title + ' (' + a.category + '):\n';
            alertList += '  ' + a.status + ' (expiry: ' + a.expiryDate + ')\n';
          });
          const subject = cfg.subject
            ? cfg.subject.replace(/\{alert_count\}/g, String(alerts.length))
            : 'Compliance Expiry Alert - ' + alerts.length + ' item(s) need attention';
          const text = cfg.template
            .replace(/\{alert_count\}/g, String(alerts.length))
            .replace(/\{alert_list\}/g, alertList);
          const baseUrl = await getAppBaseUrl(base44);
          const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
          for (const to of recipients) {
            await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: styledHtml(bodyHtml, cfg) });
          }
          ciResult = { sent: true, alertCount: alerts.length, notifiedRecipients: recipients.length };
        } else {
          ciResult = { sent: false, alertCount: 0, checked: complianceItems.length };
        }
      }
    } catch (e) { ciResult = { error: e.message }; }

    // ── Part 1b: Auto-create training bookings for staff compliance items expiring within 30 days ──
    let trainingResult = { checked: 0, bookingsCreated: 0, coursesCreated: 0, skipped: 0 };
    try {
      const allItems = await base44.asServiceRole.entities.ComplianceItem.list('-created_date', 500);
      const allStaff = await base44.asServiceRole.entities.Staff.list();
      const existingBookings = await base44.asServiceRole.entities.TrainingBooking.list('-created_date', 500);
      const allCourses = await base44.asServiceRole.entities.TrainingCourse.list('-created_date', 500);
      const now = new Date();
      const cutoff30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      for (const c of allItems) {
        if (c.category !== 'staff') continue;
        if (c.status_override === 'not_required' || c.status_override === 'missing') continue;
        if (!c.expiry_date) continue;
        const expiry = parseDate(c.expiry_date);
        if (!expiry || isNaN(expiry.getTime())) continue;
        if (expiry > cutoff30) continue; // only act within 30 days of expiry
        trainingResult.checked++;
        // Skip if a booked training already exists for this compliance item
        if (existingBookings.some(b => b.linked_compliance_id === c.id && b.status === 'booked')) {
          trainingResult.skipped++; continue;
        }
        const staffMember = allStaff.find(s => s.id === c.reference_id || s.name === c.reference_name);
        if (!staffMember) { trainingResult.skipped++; continue; }
        // Find a scheduled course matching the qualification type with a future start date
        const matchingCourse = allCourses.find(course =>
          course.category === c.qualification_type &&
          course.status === 'scheduled' &&
          course.start_date && new Date(course.start_date + 'T00:00:00') >= now
        );
        let courseId;
        if (matchingCourse) {
          courseId = matchingCourse.id;
        } else {
          // Create a placeholder renewal course 14 days out for the manager to confirm
          const startDate = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
          try {
            const created = await base44.asServiceRole.entities.TrainingCourse.create({
              title: c.title + ' Renewal — ' + staffMember.name,
              category: c.qualification_type || 'other',
              start_date: startDate,
              end_date: startDate,
              status: 'scheduled',
              description: 'Auto-created from 30-day compliance expiry alert for ' + staffMember.name + '. Book a real date and venue, then update this course.',
            });
            courseId = created.id;
            trainingResult.coursesCreated++;
          } catch (e) { trainingResult.skipped++; continue; }
        }
        try {
          await base44.asServiceRole.entities.TrainingBooking.create({
            course_id: courseId,
            staff_id: staffMember.id,
            staff_name: staffMember.name,
            status: 'booked',
            linked_compliance_id: c.id,
            notes: 'Auto-booked from 30-day compliance expiry alert. Confirm the course date and venue.',
          });
          trainingResult.bookingsCreated++;
        } catch (e) { trainingResult.skipped++; }
      }
    } catch (e) { trainingResult = { ...trainingResult, error: e.message }; }

    // ── Part 2: SiteAsset certificate expiry — alerts, recert tasks, deactivation ──
    let assetResult = { checked: 0, alertsSent: 0, tasksCreated: 0, tasksUpdated: 0, deactivated: 0 };
    try {
      const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 2000);
      const staff = await base44.asServiceRole.entities.Staff.list();
      const users = await base44.asServiceRole.entities.User.list();
      const admins = users.filter(u => u.role === 'admin');
      const existingTasks = await base44.asServiceRole.entities.ComplianceTask.list('-created_date', 500);
      const recentRecords = await base44.asServiceRole.entities.ServiceRecord.list('-date', 1000);
      const baseUrl = await getAppBaseUrl(base44);
      const assetsPath = baseUrl ? baseUrl.replace(/\/+$/, '') + '/assets' : '';

      const stageRank = { none: 0, '30d': 1, '7d': 2, expired: 3 };

      for (const asset of assets) {
        const days = daysUntil(asset.compliance_expiry_date);
        if (days === null) continue;
        assetResult.checked++;

        let stage = null;
        if (days < 0) stage = 'expired';
        else if (days <= 7) stage = '7d';
        else if (days <= 30) stage = '30d';
        if (!stage) continue;

        // Find existing open task for this asset
        const task = existingTasks.find(t => t.site_asset_id === asset.id && t.status === 'open');
        const currentStage = task?.alert_stage || 'none';
        const shouldAlert = stageRank[stage] > stageRank[currentStage];

        // Resolve recipients: compliance team (division admins) + responsible person (best-effort email)
        const divAdmins = asset.division_id ? admins.filter(u => u.division_id === asset.division_id) : admins;
        const complianceEmails = divAdmins.map(u => u.email).filter(Boolean);
        let respEmail = null;
        if (asset.responsible_person) {
          const s = staff.find(st => st.name === asset.responsible_person);
          if (s && s.email) respEmail = s.email;
        }
        const recipients = [...new Set([...complianceEmails, ...(respEmail ? [respEmail] : [])])];

        if (shouldAlert && recipients.length > 0) {
          const subj = stage === 'expired'
            ? `OVERDUE: ${asset.name} certificate has expired`
            : `Action needed: ${asset.name} certificate ${stage === '7d' ? 'expires in 7 days' : 'expires in 30 days'}`;
          const expiryStr = asset.compliance_expiry_date;
          let bodyText = `The ${asset.asset_type || 'asset'} "${asset.name}"${asset.fleet_number ? ` (FAA ${asset.fleet_number})` : ''} has a compliance certificate ${stage === 'expired' ? 'that EXPIRED on' : 'expiring on'} ${expiryStr}.\n\n`;
          bodyText += stage === 'expired'
            ? `This asset has been deactivated and cannot be assigned to jobs until a new passing inspection is logged.\n`
            : `Please arrange re-certification before this date to keep the asset available.\n`;
          if (asset.responsible_person) bodyText += `\nResponsible person: ${asset.responsible_person}\n`;
          bodyText += `\nOpen the Assets Hub to log the new inspection.`;
          const bodyHtml = styledHtml(escapeHtml(bodyText).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/assets', 'Open Assets Hub'), null);
          for (const to of recipients) {
            try { await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: subj, body: bodyHtml }); } catch (e) {}
          }
          // Push to compliance team admins (best-effort — requires native mobile build)
          for (const u of divAdmins) {
            try {
              await base44.asServiceRole.integrations.Core.SendPushNotification({
                user_id: u.id,
                title: subj,
                content: bodyText.slice(0, 200),
                action_url: assetsPath || undefined,
              });
            } catch (e) {}
          }
          assetResult.alertsSent++;
        }

        // Create / update the recert task
        const recordType = recordTypeForAsset(asset.asset_type);
        if (!task) {
          try {
            await base44.asServiceRole.entities.ComplianceTask.create({
              site_asset_id: asset.id,
              asset_name: asset.name,
              division_id: asset.division_id || undefined,
              task_type: 'recert',
              record_type: recordType,
              due_date: asset.compliance_expiry_date,
              status: 'open',
              assigned_to: asset.responsible_person || 'Compliance Team',
              alert_stage: stage,
              notes: stage === 'expired' ? 'Auto-created on expiry' : 'Auto-created on upcoming expiry',
            });
            assetResult.tasksCreated++;
          } catch (e) {}
        } else if (shouldAlert) {
          try {
            await base44.asServiceRole.entities.ComplianceTask.update(task.id, {
              alert_stage: stage,
              due_date: asset.compliance_expiry_date,
            });
            assetResult.tasksUpdated++;
          } catch (e) {}
        }

        // Auto-deactivate expired assets with no passing inspection since the expiry date
        if (days < 0 && asset.is_active !== false) {
          const recerted = recentRecords.some(r =>
            r.site_asset_id === asset.id &&
            ['loler_inspection', 'puwer_inspection', 'pat_inspection'].includes(r.record_type) &&
            r.result === 'pass' &&
            r.date && new Date(r.date + 'T00:00:00') >= new Date(asset.compliance_expiry_date + 'T00:00:00')
          );
          if (!recerted) {
            try {
              await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
                is_active: false,
                compliance_status: 'expired',
                compliance_last_checked: new Date().toISOString(),
              });
              assetResult.deactivated++;
            } catch (e) {}
          }
        }
      }
    } catch (e) { assetResult = { ...assetResult, error: e.message }; }

    return Response.json({ complianceItems: ciResult, trainingBookings: trainingResult, assets: assetResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});