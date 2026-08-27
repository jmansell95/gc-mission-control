import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// sendBrandedInvite — sends a Ground Control branded invitation
// email (dark green) with a direct link to the register page so
// the invited user can set up their account and password.
//
// Unlike the platform's inviteUser email (which can't be branded),
// this sends a fully custom dark-green branded email. It links to
// /register where the user enters their email + password, verifies
// via OTP, and gets logged in — no dead-end at /login.
//
// Call from the frontend: base44.functions.invoke('sendBrandedInvite', { email, staff_name })
// Returns { sent: true } or { sent: false, error } if the platform
// blocks the send (e.g. no custom domain for non-registered users).
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = body?.email;
    const staffName = body?.staff_name || (email ? email.split('@')[0] : 'there');

    if (!email) {
      return Response.json({ sent: false, error: 'Email is required' }, { status: 400 });
    }

    const baseUrl = await getAppBaseUrl(base44);
    const registerUrl = baseUrl ? baseUrl.replace(/\/+$/, '') + '/register' : '/register';

    const bodyHtml =
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">Hi ' + escapeHtml(staffName) + ',</p>' +
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">You\'ve been invited to join <strong style="color:#2E5A1A">Ground Control — Mission Control</strong>, our platform for managing schedules, timesheets, and site operations.</p>' +
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">Click the button below to set up your account and create your password:</p>' +
      linkBlock(baseUrl, '/register', 'Set Up My Account') +
      '<p style="font-size:13px;color:#64748b;margin-top:20px">If the button doesn\'t work, copy and paste this link into your browser:<br>' +
      '<a href="' + escapeHtml(registerUrl) + '" style="color:#2E5A1A">' + escapeHtml(registerUrl) + '</a></p>' +
      '<p style="font-size:13px;color:#64748b">Use <strong>' + escapeHtml(email) + '</strong> as your email address when registering. You\'ll receive a verification code to complete the setup.</p>';

    const html = styledHtml(bodyHtml, {
      accent_color: '#2E5A1A',
      banner_title: 'Ground Control — Mission Control',
      footer_text: 'Ground Control — Mission Control',
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Welcome to Ground Control Mission Control — Set Up Your Account',
      body: html,
    });

    return Response.json({ sent: true, to: email });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ sent: false, error: msg }, { status: 500 });
  }
}