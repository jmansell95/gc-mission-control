import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// sendWelcomeEmail — triggered when a Staff record's user_id is
// set (i.e. the invited staff member has registered and their
// account is now linked). Sends a branded welcome email using
// the 'staff_invitation' template, which is fully editable from
// Settings → Email Alerts.
//
// The platform's own invite email (sent by inviteUser) carries the
// registration link and uses a standard template that can't be
// redesigned. This function sends a branded welcome to the user
// once they've joined, so the first branded thing they see is
// your custom message.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload: { event, data, old_data, payload_too_large }
    const body = await req.json().catch(() => ({}));
    const staff = body?.data || body?.event?.data || null;

    if (!staff || !staff.email) {
      return Response.json({ skipped: true, reason: 'No staff email in payload' });
    }

    // Only send if user_id is now set (the account is linked)
    if (!staff.user_id) {
      return Response.json({ skipped: true, reason: 'user_id not set yet' });
    }

    // Only fire on the first link: skip if user_id was already set before
    // this update (prevents duplicate sends on unrelated Staff updates).
    const oldUserId = body?.old_data?.user_id;
    if (oldUserId) {
      return Response.json({ skipped: true, reason: 'user_id was already set — not a first link' });
    }

    // Load the staff_invitation email template
    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_invitation' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Staff invitation template disabled' });
    }

    const staffName = staff.name || staff.email.split('@')[0];
    const baseUrl = await getAppBaseUrl(base44);

    const subject = cfg.subject
      ? cfg.subject.replace(/\{staff_name\}/g, staffName).replace(/\{email\}/g, staff.email)
      : `Welcome to GC Mission Control`;

    const text = (cfg.template || 'Hi {staff_name},\n\nYou have been invited to join the GC Mission Control app. Use the login link sent to {email} to set up your account and start viewing your schedule and logging timesheets.\n\nGC Mission Control')
      .replace(/\{staff_name\}/g, staffName)
      .replace(/\{email\}/g, staff.email);

    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/', 'Open GC Mission Control');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: styledHtml(bodyHtml, cfg),
    });

    return Response.json({ sent: true, to: staff.email, staff_id: staff.id });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}