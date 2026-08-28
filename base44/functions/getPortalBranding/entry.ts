import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULTS = {
  client_portal: {
    welcome_title: '',
    welcome_subtitle: 'Client Portal',
    accent_color: '#2E5A1A',
    footer_text: 'Ground Control',
    intro_message: '',
    enabled: true,
  },
  subcontractor_onboarding: {
    welcome_title: 'Sub-contractor Onboarding',
    welcome_subtitle: 'Complete your details below',
    accent_color: '#2E5A1A',
    footer_text: 'Ground Control · Sub-contractor Onboarding Portal',
    intro_message: 'Welcome! Please complete your company, insurance and CIS details below. Our team will review and confirm your approval to work on our sites.',
    enabled: true,
  },
};

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const portalType = body.portal_type;
    if (!portalType || !DEFAULTS[portalType]) {
      return Response.json({ error: 'Invalid portal_type' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // ---- GET: return branding merged with defaults (public, no auth) ----
    if (!body.action || body.action === 'get') {
      const records = await base44.asServiceRole.entities.PortalBranding.filter({ portal_type: portalType });
      const stored = records[0] || {};
      return Response.json({
        branding: {
          ...DEFAULTS[portalType],
          ...stored,
          portal_type: portalType,
        }
      });
    }

    // ---- SAVE: upsert branding (admin only) ----
    if (body.action === 'save') {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

      const records = await base44.asServiceRole.entities.PortalBranding.filter({ portal_type: portalType });
      const patch = {
        portal_type: portalType,
        welcome_title: body.welcome_title ?? '',
        welcome_subtitle: body.welcome_subtitle ?? '',
        accent_color: body.accent_color || '#2E5A1A',
        logo_url: body.logo_url ?? null,
        logo_name: body.logo_name ?? null,
        show_logo: !!body.show_logo,
        footer_text: body.footer_text ?? '',
        support_phone: body.support_phone ?? '',
        support_email: body.support_email ?? '',
        intro_message: body.intro_message ?? '',
        enabled: body.enabled !== false,
      };
      let saved;
      if (records[0]?.id) {
        saved = await base44.asServiceRole.entities.PortalBranding.update(records[0].id, patch);
      } else {
        saved = await base44.asServiceRole.entities.PortalBranding.create(patch);
      }
      return Response.json({ ok: true, branding: saved });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});