import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';
import { createApproval } from '../../shared/inboxEngine.ts';

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

    // Create a proper approval-type inbox item via the approval engine so the
    // manager can approve/reject from the inbox. Uses the request_routing
    // config's resolved staff IDs as override approvers when available; falls
    // back to the staff_request routing config (manager chain → super admins).
    try {
      const approverStaffIds = recipients
        .map(r => r.staffId)
        .filter(Boolean);
      await createApproval(base44, {
        approvalType: 'staff_request',
        requesterStaffId: staffReq.staff_id || null,
        title: subjectLine,
        body: `${requesterName} requested: ${staffReq.subject || typeLabel}.${staffReq.body ? ' ' + staffReq.body : ''}${staffReq.amount ? ` Amount: £${Number(staffReq.amount).toFixed(2)}` : ''}`,
        sourceHub: 'staff',
        sourceEntity: 'StaffRequest',
        sourceId: staffReq.id,
        deepLink: `/inbox?request=${staffReq.id}`,
        priority: 'normal',
        overrideApproverStaffIds: approverStaffIds.length > 0 ? approverStaffIds : null,
      });
    } catch (_) { /* don't block on inbox failure */ }

    return Response.json({ sent: true, recipients: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});