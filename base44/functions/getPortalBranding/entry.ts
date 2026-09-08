import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULTS = {
  client_portal: {
    welcome_title: '',
    welcome_subtitle: 'Client Portal',
    accent_color: '#2E5A1A',
    footer_text: 'Ground Control',
    intro_message: '',
    enabled: true,
    widgets: [
      { id: 'w_progress', type: 'progress', title: 'Project Progress', enabled: true, order: 0 },
      { id: 'w_schedule', type: 'schedule', title: 'Schedule', enabled: true, order: 1 },
      { id: 'w_team', type: 'team', title: 'Project Team', enabled: true, order: 2 },
      { id: 'w_milestones', type: 'milestones', title: 'Milestones', enabled: true, order: 3 },
      { id: 'w_documents', type: 'documents', title: 'Documents', enabled: true, order: 4 },
      { id: 'w_photos', type: 'photos', title: 'Site Photos', enabled: true, order: 5 },
      { id: 'w_comments', type: 'comments', title: 'Comments', enabled: true, order: 6 },
      { id: 'w_signin', type: 'site_signin', title: 'Sign In to Site', enabled: false, order: 7 },
    ],
    site_signin_enabled: false,
    site_signin_instructions: 'Tap sign in when you arrive on site so the site team knows you\'re here.',
    subcontractor_logs_enabled: false,
    subcontractor_logs_instructions: '',
    keylogbook_prompt_enabled: false,
    keylogbook_prompt_text: '',
    keylogbook_yes_message: '',
    keylogbook_no_message: '',
  },
  subcontractor_onboarding: {
    welcome_title: 'Sub-contractor Onboarding',
    welcome_subtitle: 'Complete your details below',
    accent_color: '#2E5A1A',
    footer_text: 'Ground Control · Sub-contractor Onboarding Portal',
    intro_message: 'Welcome! Please complete your company, insurance and CIS details below. Our team will review and confirm your approval to work on our sites.',
    enabled: true,
    widgets: [
      { id: 'w_company', type: 'company_info', title: 'Company Information', enabled: true, order: 0 },
      { id: 'w_insurance', type: 'insurance', title: 'Insurance Details', enabled: true, order: 1 },
      { id: 'w_cis', type: 'cis', title: 'CIS / Tax Details', enabled: true, order: 2 },
      { id: 'w_contacts', type: 'contacts', title: 'Key Contacts', enabled: true, order: 3 },
      { id: 'w_references', type: 'references', title: 'References', enabled: true, order: 4 },
      { id: 'w_signin', type: 'site_signin', title: 'Sign In to Site', enabled: false, order: 5 },
      { id: 'w_logs', type: 'daily_logs', title: 'Daily Activity Log', enabled: false, order: 6 },
      { id: 'w_klb', type: 'keylogbook_prompt', title: 'KeyLogBook', enabled: false, order: 7 },
    ],
    site_signin_enabled: false,
    site_signin_instructions: 'Tap sign in when you arrive on site so the site team knows you\'re here.',
    subcontractor_logs_enabled: false,
    subcontractor_logs_instructions: 'Log your daily activities so we have a record of your day on site.',
    keylogbook_prompt_enabled: false,
    keylogbook_prompt_text: 'Do you use KeyLogBook for your drilling logs?',
    keylogbook_yes_message: 'Great — please log all your drilling activity on your tablet inside KeyLogBook. It will sync automatically to this system.',
    keylogbook_no_message: 'No problem — please use the daily log form below to record your activities each day.',
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
        widgets: body.widgets ?? DEFAULTS[portalType].widgets,
        site_signin_enabled: body.site_signin_enabled ?? false,
        site_signin_instructions: body.site_signin_instructions ?? '',
        subcontractor_logs_enabled: body.subcontractor_logs_enabled ?? false,
        subcontractor_logs_instructions: body.subcontractor_logs_instructions ?? '',
        keylogbook_prompt_enabled: body.keylogbook_prompt_enabled ?? false,
        keylogbook_prompt_text: body.keylogbook_prompt_text ?? '',
        keylogbook_yes_message: body.keylogbook_yes_message ?? '',
        keylogbook_no_message: body.keylogbook_no_message ?? '',
      };
      let saved;
      if (records[0]?.id) {
        saved = await base44.asServiceRole.entities.PortalBranding.update(records[0].id, patch);
      } else {
        saved = await base44.asServiceRole.entities.PortalBranding.create(patch);
      }
      return Response.json({ ok: true, branding: saved });
    }

    // ---- SIGN_IN: visitor signs in to site (public, no auth) ----
    if (body.action === 'sign_in') {
      const record = await base44.asServiceRole.entities.PortalSignIn.create({
        portal_type: portalType,
        visitor_name: body.visitor_name || 'Unknown',
        visitor_company: body.visitor_company || '',
        visitor_email: body.visitor_email || '',
        visitor_phone: body.visitor_phone || '',
        job_id: body.job_id || '',
        job_name: body.job_name || '',
        site_reference: body.site_reference || '',
        signed_in_at: new Date().toISOString(),
        status: 'on_site',
        notes: body.notes || '',
      });
      return Response.json({ ok: true, sign_in_id: record.id });
    }

    // ---- SIGN_OUT: visitor signs out ----
    if (body.action === 'sign_out') {
      const signInId = body.sign_in_id;
      if (!signInId) return Response.json({ error: 'sign_in_id required' }, { status: 400 });
      await base44.asServiceRole.entities.PortalSignIn.update(signInId, {
        signed_out_at: new Date().toISOString(),
        status: 'signed_out',
      });
      return Response.json({ ok: true });
    }

    // ---- SUBMIT_LOG: subcontractor submits a daily log (public, no auth) ----
    if (body.action === 'submit_log') {
      const record = await base44.asServiceRole.entities.SubcontractorDailyLog.create({
        portal_type: 'subcontractor_onboarding',
        subcontractor_name: body.subcontractor_name || 'Unknown',
        subcontractor_company: body.subcontractor_company || '',
        subcontractor_email: body.subcontractor_email || '',
        job_id: body.job_id || '',
        job_name: body.job_name || '',
        site_reference: body.site_reference || '',
        log_date: body.log_date || new Date().toISOString().slice(0, 10),
        tasks: body.tasks || '',
        hours_worked: body.hours_worked || 0,
        start_time: body.start_time || '',
        end_time: body.end_time || '',
        meterage: body.meterage || 0,
        borehole_ref: body.borehole_ref || '',
        equipment_used: body.equipment_used || '',
        crew_names: body.crew_names || '',
        photo_urls: body.photo_urls || '',
        notes: body.notes || '',
        uses_keylogbook: body.uses_keylogbook || false,
        submitted_at: new Date().toISOString(),
        manager_review_status: 'pending',
      });
      return Response.json({ ok: true, log_id: record.id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});