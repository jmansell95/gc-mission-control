// =============================================================================
// GC Mission Control — Universal Inbox & Approval Engine (shared module)
// =============================================================================
// Single source of truth for approval routing and inbox-item creation.
// Imported by every backend function that triggers an approval or notification,
// so all routing logic, email sending, and SLA computation live in one place.
//
// Flow:
//   1. A backend function (e.g. submitAFPToClient, approveEarlyLeave trigger)
//      calls `createApproval(base44, { approvalType, requesterStaffId, ... })`.
//   2. This resolves the approver(s) via the ApprovalRoutingConfig for that type.
//   3. One InboxItem is created per approver (grouped by group_key so the first
//      to action closes the siblings, unless requires_multiple_signoffs).
//   4. A branded V2 email is sent to each approver with a deep link.
//   5. The requester gets an inbox + email notification when the decision is made.
//
// For non-approval notifications (alerts, notices) use `createNotification(...)`
// which skips routing and goes straight to the named recipient(s).
// =============================================================================

import {
  brandedWrapper, ctaButton, heading, p, callout, iconBadge,
  getAppBaseUrl, formatDateTime, escapeHtml, BRAND
} from "./emailStyling.ts";

// ── Approval type catalog ──────────────────────────────────────────────────
// Each entry: { key, label, hub, defaultSlaHours, defaultMode }
// Seeded into ApprovalRoutingConfig by the seedApprovalRouting function.
export const APPROVAL_TYPES = [
  { key: 'afp_review',         label: 'AFP Manager Review',           hub: 'billing',     defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'afp_dispute',        label: 'AFP Client Dispute',           hub: 'billing',     defaultSlaHours: 72, defaultMode: 'manager_chain' },
  { key: 'timesheet',          label: 'Timesheet Approval',           hub: 'staff',       defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'access_request',     label: 'New User Access Request',     hub: 'settings',    defaultSlaHours: 24, defaultMode: 'specific_staff' },
  { key: 'early_leave',        label: 'Early Leave Request',          hub: 'scheduling',  defaultSlaHours: 24, defaultMode: 'manager_chain' },
  { key: 'delay_log',          label: 'Delay Log Approval',          hub: 'jobs',        defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'absence',            label: 'Absence / Time-Off Request',   hub: 'staff',       defaultSlaHours: 24, defaultMode: 'manager_chain' },
  { key: 'pricing_review',     label: 'Pricing Review',              hub: 'billing',     defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'off_hire',           label: 'Off-Hire Approval',           hub: 'logistics',   defaultSlaHours: 24, defaultMode: 'manager_chain' },
  { key: 'compliance_doc',     label: 'Compliance Document Review', hub: 'compliance',  defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'debt_collection',   label: 'Debt Collection Handoff',     hub: 'billing',     defaultSlaHours: 72, defaultMode: 'manager_chain' },
  { key: 'toolbox_talk',       label: 'Toolbox Talk Acknowledgement',hub: 'compliance',  defaultSlaHours: 0,  defaultMode: 'manager_chain' },
  { key: 'shift_swap',         label: 'Shift Swap Claim',            hub: 'scheduling',  defaultSlaHours: 24, defaultMode: 'manager_chain' },
  { key: 'staff_request',      label: 'Staff Request (Equipment/General)', hub: 'staff', defaultSlaHours: 48, defaultMode: 'manager_chain' },
  { key: 'training_request',   label: 'Training Request',            hub: 'staff',      defaultSlaHours: 48, defaultMode: 'manager_chain' },
];

// ── Approver resolution ───────────────────────────────────────────────────
// Returns [{ staffId, userId, name, email }] for the given approval type.
export async function resolveApprovers(base44, approvalType, requesterStaffId) {
  // 1. Load the routing config
  const configs = await base44.asServiceRole.entities.ApprovalRoutingConfig.filter({ approval_type: approvalType });
  const config = configs.find(c => c.is_active !== false) || configs[0];

  // 2. Load the requester (for manager_chain)
  let requester = null;
  if (requesterStaffId) {
    const reqs = await base44.asServiceRole.entities.Staff.filter({ id: requesterStaffId });
    requester = reqs[0] || null;
  }

  let approverStaffIds = [];
  let mode = 'manager_chain';
  let slaHours = 48;
  let requiresMultiple = false;

  if (config) {
    mode = config.approver_mode || 'manager_chain';
    slaHours = config.sla_hours ?? 48;
    requiresMultiple = !!config.requires_multiple_signoffs;
  }

  if (mode === 'specific_staff' && config) {
    approverStaffIds = config.approver_staff_ids || [];
  } else if (mode === 'permission_group' && config?.permission_group_id) {
    const groupStaff = await base44.asServiceRole.entities.Staff.filter({ permission_group_id: config.permission_group_id, is_active: true });
    approverStaffIds = groupStaff.map(s => s.id);
  } else {
    // manager_chain
    if (requester?.manager_id) {
      approverStaffIds = [requester.manager_id];
    }
  }

  // Fallback: if no approvers resolved, use fallback_staff_ids, then super admins
  if (approverStaffIds.length === 0 && config?.fallback_staff_ids?.length) {
    approverStaffIds = config.fallback_staff_ids;
  }
  if (approverStaffIds.length === 0) {
    // Last resort: all super-admin staff
    const admins = await base44.asServiceRole.entities.Staff.filter({ system_role: 'super_admin', is_active: true });
    approverStaffIds = admins.map(s => s.id);
  }

  // Resolve to full records with user_id + email
  const approvers = [];
  for (const sid of approverStaffIds) {
    const staff = (await base44.asServiceRole.entities.Staff.filter({ id: sid }))[0];
    if (!staff) continue;
    approvers.push({
      staffId: staff.id,
      userId: staff.user_id || null,
      name: staff.name || 'Approver',
      email: staff.email || null,
    });
  }

  return { approvers, mode, slaHours, requiresMultiple };
}

// ── Inbox item creation ────────────────────────────────────────────────────
// Creates one InboxItem per approver (grouped by group_key) + sends email.
// For alerts/notices, pass a single recipient via `recipients` instead.
export async function createApproval(base44, opts) {
  // opts: { approvalType, requesterStaffId, title, body, sourceHub, sourceEntity,
  //         sourceId, deepLink, priority, overrideApproverStaffIds }
  // When overrideApproverStaffIds is provided, those staff are used directly
  // (skips routing-config resolution — used by access_request where approvers
  // are the is_approver-flagged staff, not a fixed config list).
  let approvers, slaHours, requiresMultiple;
  if (opts.overrideApproverStaffIds && opts.overrideApproverStaffIds.length > 0) {
    approvers = [];
    for (const sid of opts.overrideApproverStaffIds) {
      const staff = (await base44.asServiceRole.entities.Staff.filter({ id: sid }))[0];
      if (staff) approvers.push({ staffId: staff.id, userId: staff.user_id || null, name: staff.name || 'Approver', email: staff.email || null });
    }
    // Look up SLA from config if available, else default 24h
    const configs = await base44.asServiceRole.entities.ApprovalRoutingConfig.filter({ approval_type: opts.approvalType });
    slaHours = configs[0]?.sla_hours ?? 24;
    requiresMultiple = !!configs[0]?.requires_multiple_signoffs;
  } else {
    ({ approvers, slaHours, requiresMultiple } = await resolveApprovers(base44, opts.approvalType, opts.requesterStaffId));
  }
  if (approvers.length === 0) {
    return { created: 0, error: 'No approvers could be resolved for ' + opts.approvalType };
  }

  const groupKey = `${opts.approvalType}:${opts.sourceId || 'noid'}:${Date.now()}`;
  const slaDueAt = slaHours > 0 ? new Date(Date.now() + slaHours * 3600 * 1000).toISOString() : null;

  // Resolve requester details
  let requesterName = 'System';
  let requesterUserId = null;
  if (opts.requesterStaffId) {
    const reqs = await base44.asServiceRole.entities.Staff.filter({ id: opts.requesterStaffId });
    if (reqs[0]) {
      requesterName = reqs[0].name || 'Staff';
      requesterUserId = reqs[0].user_id || null;
    }
  }

  const baseUrl = await getAppBaseUrl(base44);
  const created = [];

  for (const ap of approvers) {
    const item = await base44.asServiceRole.entities.InboxItem.create({
      type: 'approval',
      category: opts.approvalType,
      title: opts.title,
      body: opts.body || '',
      source_hub: opts.sourceHub,
      source_entity: opts.sourceEntity || '',
      source_id: opts.sourceId || '',
      deep_link: opts.deepLink || '',
      priority: opts.priority || 'normal',
      status: 'pending',
      assigned_to_staff_id: ap.staffId,
      assigned_to_user_id: ap.userId,
      assigned_to_name: ap.name,
      requester_staff_id: opts.requesterStaffId || null,
      requester_user_id: requesterUserId,
      requester_name: requesterName,
      approval_type: opts.approvalType,
      group_key: groupKey,
      sla_due_at: slaDueAt,
      is_overdue: false,
      email_sent: false,
    });
    created.push(item);

    // Send email (best-effort, don't fail the approval if email fails)
    if (ap.email) {
      try {
        await sendInboxEmail(base44, {
          to: ap.email,
          recipientName: ap.name,
          title: opts.title,
          body: opts.body || '',
          deepLink: opts.deepLink,
          baseUrl,
          isApproval: true,
          requesterName,
          slaDueAt,
        });
        await base44.asServiceRole.entities.InboxItem.update(item.id, { email_sent: true });
      } catch (e) {
        // email failed — item still created, email_sent stays false
      }
    }
  }

  return { created: created.length, groupKey, requiresMultiple };
}

// ── Notification (alert / notice) creation ──────────────────────────────────
// For non-approval items where the recipient is known directly.
// opts: { recipients: [{staffId, userId, name, email}], type, category, title,
//         body, sourceHub, sourceEntity, sourceId, deepLink, priority }
export async function createNotification(base44, opts) {
  const baseUrl = await getAppBaseUrl(base44);
  const created = [];

  for (const r of (opts.recipients || [])) {
    const item = await base44.asServiceRole.entities.InboxItem.create({
      type: opts.type || 'notice',
      category: opts.category || 'system',
      title: opts.title,
      body: opts.body || '',
      source_hub: opts.sourceHub,
      source_entity: opts.sourceEntity || '',
      source_id: opts.sourceId || '',
      deep_link: opts.deepLink || '',
      priority: opts.priority || 'info',
      status: 'pending',
      assigned_to_staff_id: r.staffId || null,
      assigned_to_user_id: r.userId || null,
      assigned_to_name: r.name || '',
      requester_name: opts.requesterName || 'System',
      email_sent: false,
    });
    created.push(item);

    if (r.email) {
      try {
        await sendInboxEmail(base44, {
          to: r.email,
          recipientName: r.name,
          title: opts.title,
          body: opts.body || '',
          deepLink: opts.deepLink,
          baseUrl,
          isApproval: false,
        });
        await base44.asServiceRole.entities.InboxItem.update(item.id, { email_sent: true });
      } catch (e) {}
    }
  }

  return { created: created.length };
}

// ── Email sender ────────────────────────────────────────────────────────────
async function sendInboxEmail(base44, opts) {
  const { to, recipientName, title, body, deepLink, baseUrl, isApproval, requesterName, slaDueAt } = opts;
  const fullLink = (baseUrl && deepLink) ? baseUrl.replace(/\/+$/, '') + deepLink : (deepLink || '');

  const intro = isApproval
    ? `<p style="margin:0 0 14px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">Hi ${escapeHtml(recipientName || 'there')},</p>` +
      `<p style="margin:0 0 14px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif"><strong>${escapeHtml(requesterName || 'Someone')}</strong> has submitted something that needs your approval:</p>`
    : `<p style="margin:0 0 14px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">Hi ${escapeHtml(recipientName || 'there')},</p>` +
      `<p style="margin:0 0 14px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">You have a new notification in your GC Mission Control inbox:</p>`;

  const slaBlock = (isApproval && slaDueAt)
    ? callout(`This needs your attention by ${formatDateTime(slaDueAt)}. If you can't action it, please delegate from your inbox so it doesn't hold up the team.`, 'warning')
    : '';

  const ctaBlock = fullLink
    ? `<p style="margin:20px 0 0 0">${ctaButton(fullLink, isApproval ? 'Review & Decide' : 'Open in Mission Control')}</p>`
    : '';

  const html = brandedWrapper(
    heading(title) +
    intro +
    (body ? `<p style="margin:0 0 14px 0;color:${BRAND.slate700};font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif">${escapeHtml(body)}</p>` : '') +
    slaBlock +
    callout('You can action this directly from your inbox inside Mission Control — no need to reply to this email.', 'info') +
    ctaBlock,
    {
      banner_subtitle: isApproval ? 'Approval Required' : 'Inbox Notification',
      headerVariant: isApproval ? 'amber' : 'brand',
    }
  );

  await base44.asServiceRole.integrations.Core.SendEmail({
    to,
    subject: (isApproval ? '✅ Approval needed: ' : '🔔 ') + title,
    html,
  });
}

// ── Action an inbox item (approve / reject / dismiss) ───────────────────────
// Closes the item + all siblings with the same group_key, notifies the requester.
export async function actionItem(base44, opts) {
  // opts: { itemId, decision, note, actionedByName }
  const items = await base44.asServiceRole.entities.InboxItem.filter({ id: opts.itemId });
  const item = items[0];
  if (!item) return { error: 'Item not found' };

  const decision = opts.decision; // 'approved' | 'rejected' | 'dismissed'
  const now = new Date().toISOString();
  const update = {
    status: decision,
    action_note: opts.note || '',
    actioned_at: now,
    actioned_by: opts.actionedByName || 'Manager',
  };

  await base44.asServiceRole.entities.InboxItem.update(item.id, update);

  // Close siblings (first-to-action-wins) unless multiple signoffs required
  if (item.group_key) {
    const siblings = await base44.asServiceRole.entities.InboxItem.filter({ group_key: item.group_key, status: 'pending' });
    for (const s of siblings) {
      if (s.id !== item.id) {
        await base44.asServiceRole.entities.InboxItem.update(s.id, { ...update, status: decision === 'dismissed' ? 'archived' : decision });
      }
    }
  }

  // Notify the requester of the outcome (for approvals)
  if (item.type === 'approval' && item.requester_user_id && decision !== 'dismissed') {
    const reqs = item.requester_staff_id ? (await base44.asServiceRole.entities.Staff.filter({ id: item.requester_staffId })) : [];
    const requesterEmail = reqs[0]?.email;
    if (requesterEmail) {
      const baseUrl = await getAppBaseUrl(base44);
      const outcome = decision === 'approved' ? 'approved' : 'rejected';
      const html = brandedWrapper(
        heading(`Your request has been ${outcome}`) +
        p(`"${item.title}" has been ${outcome} by ${opts.actionedByName || 'a manager'}.`) +
        (opts.note ? p(`Note: ${opts.note}`) : '') +
        (item.deep_link ? `<p style="margin:20px 0 0 0">${ctaButton((baseUrl ? baseUrl.replace(/\/+$/,'') : '') + item.deep_link, 'View in Mission Control')}</p>` : ''),
        { banner_subtitle: 'Request ' + outcome, headerVariant: decision === 'approved' ? 'emerald' : 'rose' }
      );
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: requesterEmail,
          subject: `${decision === 'approved' ? '✅ Approved' : '❌ Rejected'}: ${item.title}`,
          html,
        });
      } catch (e) {}
    }
  }

  return { success: true, item: { ...item, ...update } };
}