import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

/**
 * routeStaffRequest — reads the request routing config (AppSetting key
 * 'request_routing') and creates an InboxItem for each matched recipient
 * (specific staff or staff matching the role keyword). Sends an email
 * notification to each recipient. Falls back to admins when no assignees
 * resolve and fallback_admins is true.
 *
 * Called from the frontend after a StaffRequest is created.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const reqData = body.data || body;
    const requestId = reqData.request_id || reqData.id;

    if (!requestId) return Response.json({ skipped: true, reason: 'No request ID' });

    // Load the StaffRequest
    let staffReq;
    try {
      const reqList = await base44.asServiceRole.entities.StaffRequest.filter({ id: requestId });
      staffReq = reqList[0];
    } catch (_) {
      return Response.json({ skipped: true, reason: 'StaffRequest not found' });
    }
    if (!staffReq) return Response.json({ skipped: true, reason: 'StaffRequest not found' });

    const requestType = staffReq.request_type || 'general';

    // Load the routing config
    const cfgList = await base44.asServiceRole.entities.AppSetting.filter({ key: 'request_routing' });
    const cfg = cfgList[0];
    const rules = cfg?.value?.rules || [];
    const rule = rules.find(r => r.request_type === requestType) || rules.find(r => r.request_type === 'general');

    // Resolve assignees — fetch all active staff once, filter in code
    let assigneeStaffIds: string[] = [];
    if (rule) {
      assigneeStaffIds = [...(rule.assignee_staff_ids || [])];
    }

    const allActiveStaff = await base44.asServiceRole.entities.Staff.filter({ is_active: true });

    // Add role-keyword matches
    if (rule?.assignee_role_key) {
      const keyword = rule.assignee_role_key.toLowerCase();
      const roleMatches = allActiveStaff
        .filter(s => (s.job_title || '').toLowerCase().includes(keyword))
        .map(s => s.id);
      assigneeStaffIds = [...new Set([...assigneeStaffIds, ...roleMatches])];
    }

    // De-duplicate
    const idSet = new Set(assigneeStaffIds);

    let recipients: { staffId: string; userId: string; name: string; email: string }[] = [];
    if (idSet.size > 0) {
      for (const s of allActiveStaff) {
        if (!idSet.has(s.id)) continue;
        if (s.is_active === false) continue;
        if (!s.user_id && !s.email) continue;
        recipients.push({
          staffId: s.id,
          userId: s.user_id || '',
          name: s.name || 'Staff',
          email: s.email || '',
        });
      }
    }

    // Fallback to admins
    if (recipients.length === 0 && rule?.fallback_admins !== false) {
      const users = await base44.asServiceRole.entities.User.list();
      const adminUsers = users.filter(u => u.role === 'admin' && u.email);
      recipients = adminUsers.map(u => ({
        staffId: '',
        userId: u.id,
        name: u.full_name || 'Admin',
        email: u.email,
      }));
    }

    if (recipients.length === 0) return Response.json({ skipped: true, reason: 'No recipients resolved' });

    // Load requester
    let requesterName = staffReq.staff_name || 'Staff member';
    if (staffReq.staff_id) {
      const requesterList = await base44.asServiceRole.entities.Staff.filter({ id: staffReq.staff_id });
      if (requesterList[0]) {
        requesterName = requesterList[0].name || requesterName;
        // Use requester's user_id for requester_user_id on inbox items
        if (!staffReq.staff_name) {
          try { await base44.asServiceRole.entities.StaffRequest.update(staffReq.id, { staff_name: requesterName }); } catch (_) {}
        }
      }
    }

    const typeLabel = requestType.replace(/_/g, ' ');
    const baseUrl = await getAppBaseUrl(base44);
    const subjectLine = `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} request — ${requesterName}`;
    const deepLink = `/inbox?request=${staffReq.id}`;

    // Build email body
    const detailsRows: [string, string][] = [
      ['From', requesterName],
      ['Type', typeLabel],
      ['Subject', staffReq.subject || '—'],
      ['Details', staffReq.body || '—'],
    ];
    if (staffReq.amount) detailsRows.push(['Amount', `£${Number(staffReq.amount).toFixed(2)}`]);

    const bodyHtml =
      heading(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} request from ${requesterName}`) +
      p('A staff member has submitted a request that needs your attention. Review the details below and action it from your inbox.') +
      sectionCard('Request Details', infoTable(detailsRows), { titleBg: '#2E5A1A' }) +
      helpTip('What to do next', 'Open your inbox to action this request. You can fulfil it, respond, or reject it from there.') +
      linkBlock(baseUrl, deepLink, 'Open Inbox');

    // Create inbox items + send emails
    let notified = 0;
    for (const r of recipients) {
      // Create InboxItem
      try {
        await base44.asServiceRole.entities.InboxItem.create({
          type: 'alert',
          category: `staff_request_${requestType}`,
          title: subjectLine,
          body: `${requesterName} requested: ${staffReq.subject || typeLabel}.${staffReq.body ? ' ' + staffReq.body : ''}`,
          source_hub: 'staff',
          source_entity: 'StaffRequest',
          source_id: staffReq.id,
          deep_link: deepLink,
          priority: 'normal',
          status: 'pending',
          assigned_to_staff_id: r.staffId || undefined,
          assigned_to_user_id: r.userId || undefined,
          assigned_to_name: r.name,
          requester_staff_id: staffReq.staff_id || undefined,
          requester_user_id: undefined,
          requester_name: requesterName,
        });
      } catch (_) { /* don't block on inbox failure */ }

      // Send email
      if (r.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: r.email,
            subject: subjectLine,
            body: brandedWrapper(bodyHtml, { headerVariant: 'brand', banner_subtitle: 'Staff Request' }),
          });
          notified++;
        } catch (_) {}
      }
    }

    return Response.json({ sent: true, notified, recipients: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});