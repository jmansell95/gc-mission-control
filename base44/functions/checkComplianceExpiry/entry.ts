import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillDanger, pillWarning, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow
} from '../../shared/emailStyling.ts';
import { createNotification } from '../../shared/inboxEngine.ts';

// Parse compliance date — supports YYYY-MM (staff) and YYYY-MM-DD (other categories)
function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

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

          const expiredCount = alerts.filter(a => a.status === 'EXPIRED').length;
          const expiringCount = alerts.length - expiredCount;

          const tableRows = alerts.map(a => {
            const pill = a.status === 'EXPIRED' ? html(pillDanger('EXPIRED')) : html(pillWarning('Expiring'));
            return [a.referenceName, a.title, a.category, a.expiryDate, pill];
          });

          const alertsTable = dataTable(['Name', 'Item', 'Category', 'Expiry', 'Status'], tableRows);

          const bodyHtml =
            heading('Compliance expiry alert') +
            p('The following compliance items have expired or are expiring within ' + daysBefore + ' days. Please arrange renewals to keep your team and equipment compliant.') +
            statTileRow([
              { label: 'Expired', value: String(expiredCount), icon: '⚠', color: '#e11d48' },
              { label: 'Expiring Soon', value: String(expiringCount), icon: '⏰', color: '#d97706' },
              { label: 'Total Alerts', value: String(alerts.length), icon: '📋', color: '#2E5A1A' },
            ]) +
            (expiredCount > 0 ? callout(expiredCount + ' item(s) have already EXPIRED and need immediate attention. Staff or equipment with expired compliance may not legally work on site.', 'danger') : '') +
            sectionCard('Compliance Items', alertsTable, { titleBg: '#be123c' }) +
            helpTip('What to do next', 'Open the Compliance Hub to review each item. For staff compliance, arrange renewal training via the Training Hub. For vehicle/equipment compliance, book a maintenance appointment via the Fleet Hub.') +
            linkBlock(await getAppBaseUrl(base44), '/compliance', 'Open Compliance Hub');

          const subject = cfg.subject
            ? cfg.subject.replace(/\{alert_count\}/g, String(alerts.length))
            : 'Compliance Expiry Alert — ' + alerts.length + ' item(s) need attention';

          for (const to of recipients) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to, subject,
              body: brandedWrapper(bodyHtml, { ...cfg, headerVariant: 'rose', banner_subtitle: 'Compliance Alert' })
            });
          }

          // ── Create inbox alert for compliance expiry ──
          try {
            const adminRecipients = admins.map(u => ({
              staffId: null, userId: u.id, name: u.full_name || u.email, email: u.email,
            }));
            await createNotification(base44, {
              recipients: adminRecipients,
              type: 'alert',
              category: 'compliance_expiry',
              title: `Compliance expiry — ${alerts.length} item(s) need attention`,
              body: `${expiredCount} expired, ${expiringCount} expiring soon. Open the Compliance Hub to review and arrange renewals.`,
              sourceHub: 'compliance',
              sourceEntity: 'ComplianceItem',
              sourceId: '',
              deepLink: '/compliance',
              priority: expiredCount > 0 ? 'urgent' : 'normal',
            });
          } catch (_) {}

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
        if (expiry > cutoff30) continue;
        trainingResult.checked++;
        if (existingBookings.some(b => b.linked_compliance_id === c.id && b.status === 'booked')) {
          trainingResult.skipped++; continue;
        }
        const staffMember = allStaff.find(s => s.id === c.reference_id || s.name === c.reference_name);
        if (!staffMember) { trainingResult.skipped++; continue; }
        const matchingCourse = allCourses.find(course =>
          course.category === c.qualification_type &&
          course.status === 'scheduled' &&
          course.start_date && new Date(course.start_date + 'T00:00:00') >= now
        );
        let courseId;
        if (matchingCourse) {
          courseId = matchingCourse.id;
        } else {
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

        const task = existingTasks.find(t => t.site_asset_id === asset.id && t.status === 'open');
        const currentStage = task?.alert_stage || 'none';
        const shouldAlert = stageRank[stage] > stageRank[currentStage];

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

          const pill = stage === 'expired' ? pillDanger('EXPIRED') : pillWarning(stage === '7d' ? '7 DAYS' : '30 DAYS');
          const detailsTable = infoTable([
            ['Asset', asset.name + (asset.fleet_number ? ' (FAA ' + asset.fleet_number + ')' : '')],
            ['Type', asset.asset_type || '—'],
            ['Expiry Date', expiryStr],
            ['Status', html(pill)],
            ['Responsible Person', asset.responsible_person || '—'],
          ]);

          const bodyHtml =
            heading(stage === 'expired' ? 'Asset certificate EXPIRED' : 'Asset certificate expiring soon') +
            p(stage === 'expired'
              ? 'This asset has been deactivated and cannot be assigned to jobs until a new passing inspection is logged.'
              : 'Please arrange re-certification before this date to keep the asset available.') +
            sectionCard('Asset Details', detailsTable, { titleBg: stage === 'expired' ? '#be123c' : '#b45309' }) +
            helpTip('What to do next', 'Open the Assets Hub to log the new inspection. Once a passing inspection is recorded, the asset will be reactivated automatically.') +
            linkBlock(baseUrl, '/assets', 'Open Assets Hub');

          const bodyHtmlWrapped = brandedWrapper(bodyHtml, { headerVariant: stage === 'expired' ? 'rose' : 'amber', banner_subtitle: 'Asset Compliance' });

          for (const to of recipients) {
            try { await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: subj, body: bodyHtmlWrapped }); } catch (e) {}
          }
          for (const u of divAdmins) {
            try {
              await base44.asServiceRole.integrations.Core.SendPushNotification({
                user_id: u.id,
                title: subj,
                content: `${asset.name} certificate ${stage === 'expired' ? 'EXPIRED' : 'expiring'} ${expiryStr}`,
                action_url: assetsPath || undefined,
              });
            } catch (e) {}
          }
          assetResult.alertsSent++;
        }

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