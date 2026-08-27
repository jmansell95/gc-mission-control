import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, linkBlock, styledHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

// ============================================================
// sendBrandedInvite — sends a Ground Control branded invitation
// email (dark green) with a direct link to the account setup
// page where the user enters their verification code.
//
// This function is called AFTER the user has been registered via
// base44.auth.register() (which creates their account and sends
// an OTP email). Because the user is now a registered user, the
// platform allows SendEmail to reach them — no custom domain
// required.
//
// The email contains:
//   - A welcome message in Ground Control dark-green branding
//   - The user's temporary password (for future logins)
//   - A link to /setup-account?email=xxx where they enter the
//     verification code from the separate OTP email
//
// Call: base44.functions.invoke('sendBrandedInvite', { email, staff_name, temp_password })
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = body?.email;
    const staffName = body?.staff_name || (email ? email.split('@')[0] : 'there');
    const tempPassword = body?.temp_password || '';

    if (!email) {
      return Response.json({ sent: false, error: 'Email is required' }, { status: 400 });
    }

    const baseUrl = await getAppBaseUrl(base44);
    const setupUrl = baseUrl ? baseUrl.replace(/\/+$/, '') + '/setup-account?email=' + encodeURIComponent(email) : '/setup-account?email=' + encodeURIComponent(email);

    let passwordLine = '';
    if (tempPassword) {
      passwordLine =
        '<p style="font-size:15px;line-height:1.6;color:#1e293b">Your temporary password is: <strong style="font-family:monospace;font-size:16px;background:#f1f5f9;padding:2px 8px;border-radius:4px;color:#2E5A1A">' + escapeHtml(tempPassword) + '</strong></p>' +
        '<p style="font-size:13px;color:#64748b">You\'ll need this if you log out and want to log back in. You can change it from your profile once you\'re in.</p>';
    }

    const bodyHtml =
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">Hi ' + escapeHtml(staffName) + ',</p>' +
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">You\'ve been invited to join <strong style="color:#2E5A1A">Ground Control — Mission Control</strong>, our platform for managing schedules, timesheets, and site operations.</p>' +
      '<p style="font-size:15px;line-height:1.6;color:#1e293b">Click the button below to verify your account and get started:</p>' +
      linkBlock(baseUrl, '/setup-account?email=' + encodeURIComponent(email), 'Verify My Account') +
      passwordLine +
      '<p style="font-size:13px;color:#64748b;margin-top:20px">You\'ll also receive a separate email with a 6-digit verification code — enter it on the setup page to activate your account.</p>' +
      '<p style="font-size:13px;color:#64748b">If the button doesn\'t work, copy and paste this link into your browser:<br>' +
      '<a href="' + escapeHtml(setupUrl) + '" style="color:#2E5A1A">' + escapeHtml(setupUrl) + '</a></p>';

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