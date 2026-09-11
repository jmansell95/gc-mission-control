import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getAppBaseUrl } from '../../shared/emailStyling.ts';
import { createApproval } from '../../shared/inboxEngine.ts';

/**
 * routeStaffRequest — routes a StaffRequest (equipment or general) to the
 * approvers configured in Approval Routing → 'staff_request'. Uses the
 * shared inbox engine's createApproval, which resolves approvers via the
 * ApprovalRoutingConfig (manager chain, permission group, or specific staff),
 * creates an InboxItem per approver, and sends a branded email.
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

    // Load requester name (denormalise onto the request if missing)
    let requesterName = staffReq.staff_name || 'Staff member';
    if (staffReq.staff_id) {
      const requesterList = await base44.asServiceRole.entities.Staff.filter({ id: staffReq.staff_id });
      if (requesterList[0]) {
        requesterName = requesterList[0].name || requesterName;
        if (!staffReq.staff_name) {
          try { await base44.asServiceRole.entities.StaffRequest.update(staffReq.id, { staff_name: requesterName }); } catch (_) {}
        }
      }
    }

    const typeLabel = requestType.replace(/_/g, ' ');
    const subjectLine = `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} request — ${requesterName}`;
    const deepLink = `/inbox?request=${staffReq.id}`;

    // Route via the approval engine using the 'staff_request' ApprovalRoutingConfig.
    // Approvers, fallbacks, SLA and multi-signoff are all resolved from that config.
    const result = await createApproval(base44, {
      approvalType: 'staff_request',
      requesterStaffId: staffReq.staff_id || null,
      title: subjectLine,
      body: `${requesterName} requested: ${staffReq.subject || typeLabel}.${staffReq.body ? ' ' + staffReq.body : ''}${staffReq.amount ? ` Amount: £${Number(staffReq.amount).toFixed(2)}` : ''}`,
      sourceHub: 'staff',
      sourceEntity: 'StaffRequest',
      sourceId: staffReq.id,
      deepLink,
      priority: 'normal',
    });

    return Response.json({ sent: true, created: result.created || 0, groupKey: result.groupKey || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});