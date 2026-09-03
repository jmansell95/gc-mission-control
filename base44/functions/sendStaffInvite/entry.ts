import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// sendStaffInvite — sends the platform invite email to a staff
// member and marks their record. Called from the Staff Hub
// Invite button via base44.functions.invoke.
//
// This replaces the old client-side inviteUser call which
// silently swallowed errors — the admin saw "Invite sent" even
// when no email went out. This function surfaces the real result
// so the admin knows whether the platform actually sent it.
//
// The branded welcome email (Email 2) is sent automatically by
// the sendWelcomeEmail entity automation when the staff member
// registers and their user_id is linked — no action needed here.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const staffId = body?.staff_id;

    if (!staffId) {
      return Response.json({ sent: false, error: 'Staff ID is required' }, { status: 400 });
    }

    // Fetch the Staff record (caller's user context — admin has read access).
    const staff = await base44.entities.Staff.get(staffId);
    if (!staff) {
      return Response.json({ sent: false, error: 'Staff member not found' }, { status: 404 });
    }
    if (!staff.email) {
      return Response.json({ sent: false, error: 'Staff member has no email address' }, { status: 400 });
    }

    // Call inviteUser — sends the platform invite email with a registration link.
    // Per Base44 docs, inviting an existing user re-sends the invitation.
    let result = 'sent';
    try {
      await base44.users.inviteUser(staff.email, 'user');
    } catch (inviteErr) {
      const msg = String(inviteErr?.message || '');
      if (msg.match(/already|exists/i)) {
        // User already invited — platform re-sends per docs.
        result = 'resent';
      } else {
        // Real error — surface it so the admin knows the email didn't go out.
        return Response.json({ sent: false, error: msg }, { status: 500 });
      }
    }

    // Mark the staff record so the badge switches to "Invited".
    await base44.entities.Staff.update(staffId, { invite_sent: true });

    return Response.json({ sent: true, result, email: staff.email });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ sent: false, error: msg }, { status: 500 });
  }
}