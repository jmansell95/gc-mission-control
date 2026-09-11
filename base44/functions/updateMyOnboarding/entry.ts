import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Self-service profile save — runs as the service role so RLS doesn't
 * block non-admin users from updating their own Staff record.
 *
 * The Staff entity's RLS update rule only allows admins and directors.
 * Field staff completing onboarding or editing their profile hit
 * "permission denied" on a direct Staff.update call. This function
 * bypasses RLS by using asServiceRole, but only ever updates the
 * self-editable fields — so users can't escalate their own permissions.
 *
 * Used by:
 *  - src/pages/Onboarding.jsx (first-login setup: phone + photo + onboarding_complete)
 *  - src/components/staff/StaffProfileEditDrawer.jsx (profile edits: phone, photo, prefs)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Only these fields may be self-edited. Anything else in the payload
    // is silently ignored — prevents privilege escalation.
    const allowed = {};
    const pick = (key) => {
      if (body[key] !== undefined) allowed[key] = body[key];
    };
    pick('phone');
    pick('avatar_url');
    pick('onboarding_complete');
    pick('email_notifications_enabled');
    pick('delivery_dashboard_enabled');
    pick('phone_gps_consent');
    pick('tracking_enabled');
    pick('tracking_consent_signed_at');
    pick('tracking_consent_signature_data_url');
    pick('tracking_consent_version');
    pick('tracking_consent_declined_at');
    pick('last_capture_error');
    pick('last_capture_error_at');

    if (Object.keys(allowed).length === 0) {
      return Response.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    // Find the caller's Staff record by user_id (IDOR-safe — we never
    // accept a staff_id from the client). Fall back to email match.
    let staff = [];
    if (user.id) {
      try { staff = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id }); } catch (_) {}
    }
    if (staff.length === 0 && user.email) {
      try { staff = await base44.asServiceRole.entities.Staff.filter({ email: user.email }); } catch (_) {}
    }
    if (staff.length === 0) {
      return Response.json({ error: 'No staff profile found for this account' }, { status: 404 });
    }

    const updated = await base44.asServiceRole.entities.Staff.update(staff[0].id, allowed);
    return Response.json({ success: true, staff: { id: updated.id, ...allowed } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});