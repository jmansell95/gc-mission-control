import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, sectionCard, helpTip, heading, p, callout, html,
  bulletList, timeline
} from '../../shared/emailStyling.ts';

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

    // Build rich welcome HTML
    const onboardingSteps = [
      { title: 'Open the app', body: 'Tap the button below to open GC Mission Control on your phone or computer.' },
      { title: 'Complete your profile', body: 'Add your photo and phone number so your manager and crew can reach you.' },
      { title: 'View your schedule', body: 'Check your upcoming shifts and assignments on the Today page.' },
      { title: 'Sign the tracking consent', body: 'Review and sign the GPS tracking consent form in your profile settings.' },
    ];

    const bodyHtml =
      heading('Welcome to GC Mission Control') +
      p('Hi ' + staffName + ',') +
      p('You\'ve been successfully added to the GC Mission Control platform. This is where you\'ll see your daily schedule, log your hours, manage your compliance documents, and stay connected with your crew.') +
      sectionCard('Your Account', infoTable([
        ['Name', staffName],
        ['Email', staff.email],
        ['Role', staff.job_title || staff.worker_type || 'Team Member'],
      ]), { titleBg: '#2E5A1A' }) +
      heading('Getting started') +
      timeline(onboardingSteps) +
      helpTip('Need help?', 'If you can\'t log in or see a blank screen, make sure you\'ve set up your password using the link sent in the separate registration email. If you\'re still stuck, contact your manager or the office team.') +
      linkBlock(baseUrl, '/', 'Open GC Mission Control');

    // If custom template is set, use it instead
    const finalHtml = (cfg && cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{staff_name\}/g, staffName)
            .replace(/\{email\}/g, staff.email)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/', 'Open GC Mission Control')
      : bodyHtml;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'emerald', banner_subtitle: 'Welcome Aboard' }),
    });

    return Response.json({ sent: true, to: staff.email, staff_id: staff.id });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}