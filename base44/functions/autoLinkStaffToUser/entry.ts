import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ============================================================
// autoLinkStaffToUser — triggered when a Staff record is created
// (via workflow) or called manually. If a platform User with a
// matching email exists and is pending (or has no access_status),
// auto-approves them and links the Staff record's user_id.
//
// This is the "Staff record auto-gate": an admin creates a Staff
// record with the person's email → the matching pending user is
// automatically approved → on their next login they pass the gate
// and land on onboarding — no manual approval step needed.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));

    // Workflow passes { data: staffRecord, event: {...} }
    // Frontend passes { staff_id: "..." }
    let staffId: string | null = null;
    let staffEmail: string | null = null;

    if (body.data?.email) {
      staffId = body.data.id || null;
      staffEmail = body.data.email || null;
    } else if (body.staff_id) {
      try {
        const staff = await sr.entities.Staff.get(body.staff_id);
        staffId = staff.id;
        staffEmail = staff.email || null;
      } catch (_) {
        return Response.json({ skipped: 'staff_not_found' });
      }
    }

    if (!staffEmail) return Response.json({ skipped: 'no_email' });

    // Find matching platform User by email (case-insensitive)
    const users = await sr.entities.User.list('-created_date', 500);
    const matchingUser = users.find(
      (u: any) => u.email && u.email.toLowerCase() === staffEmail!.toLowerCase()
    );

    if (!matchingUser) return Response.json({ skipped: 'no_matching_user' });

    // Already approved — just link if not already linked
    if (matchingUser.access_status === 'approved') {
      if (staffId) {
        try { await sr.entities.Staff.update(staffId, { user_id: matchingUser.id }); } catch (_) {}
      }
      return Response.json({ skipped: 'already_approved', user_id: matchingUser.id });
    }

    // Auto-approve and link
    try {
      await sr.entities.User.update(matchingUser.id, { access_status: 'approved' });
    } catch (e) {
      return Response.json({ error: 'Failed to update user access_status' }, { status: 500 });
    }

    if (staffId) {
      try { await sr.entities.Staff.update(staffId, { user_id: matchingUser.id }); } catch (_) {}
    }

    return Response.json({
      success: true,
      user_id: matchingUser.id,
      user_email: matchingUser.email,
      action: 'auto_approved',
    });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}