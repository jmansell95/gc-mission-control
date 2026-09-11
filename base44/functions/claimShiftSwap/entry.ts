import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { createApproval } from '../../shared/inboxEngine.ts';

/**
 * claimShiftSwap — a crew member claims a shift on the swap board.
 *
 * Updates the ShiftSwap status to 'claimed' and creates an inbox approval
 * routed to the offering staff member's manager (so they can approve or
 * reject the swap from their Universal Inbox).
 *
 * Input:  { swap_id: string }
 * Output: { success: boolean }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { swap_id } = body;
    if (!swap_id) return Response.json({ error: 'swap_id is required' }, { status: 400 });

    // Load the shift swap
    const swaps = await base44.entities.ShiftSwap.filter({ id: swap_id });
    const swap = swaps[0];
    if (!swap) return Response.json({ error: 'Shift swap not found' }, { status: 404 });
    if (swap.status !== 'offered') {
      return Response.json({ error: 'Shift swap is no longer available' }, { status: 400 });
    }

    // Resolve the claiming staff member from the authenticated user
    const myStaff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
    const claimingStaff = myStaff[0];
    if (!claimingStaff) {
      return Response.json({ error: 'Your staff profile was not found' }, { status: 404 });
    }

    // Update the swap to 'claimed'
    await base44.entities.ShiftSwap.update(swap_id, {
      status: 'claimed',
      claiming_staff_id: claimingStaff.id,
      claiming_staff_name: claimingStaff.name,
      claimed_at: new Date().toISOString(),
    });

    // Resolve the offering staff member's manager for approval routing
    let overrideApproverStaffIds: string[] | null = null;
    if (swap.offering_staff_id) {
      const offeringStaffList = await base44.asServiceRole.entities.Staff.filter({ id: swap.offering_staff_id });
      const offeringStaff = offeringStaffList[0];
      if (offeringStaff?.manager_id) {
        overrideApproverStaffIds = [offeringStaff.manager_id];
      }
    }

    // Create inbox approval for the manager
    try {
      await createApproval(base44, {
        approvalType: 'shift_swap',
        requesterStaffId: claimingStaff.id,
        title: `Shift swap claim — ${claimingStaff.name} wants ${swap.job_name || 'shift'} on ${swap.assigned_date}`,
        body: `${claimingStaff.name} has claimed the shift offered by ${swap.offering_staff_name} for ${swap.job_name || 'shift'} on ${swap.assigned_date}.${swap.reason ? ' Reason for offer: ' + swap.reason : ''} Please approve or reject this swap.`,
        sourceHub: 'scheduling',
        sourceEntity: 'ShiftSwap',
        sourceId: swap_id,
        deepLink: '/staff-schedule',
        priority: 'normal',
        overrideApproverStaffIds,
      });
    } catch (_) {
      // don't fail the claim on inbox failure
    }

    return Response.json({ success: true, swap_id });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}