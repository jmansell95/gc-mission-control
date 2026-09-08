import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id } = await req.json();
    if (!booking_id) return Response.json({ error: 'booking_id required' }, { status: 400 });

    const booking = await base44.asServiceRole.entities.TrainingBooking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });

    const course = booking.course_id ? await base44.asServiceRole.entities.TrainingCourse.get(booking.course_id) : null;
    const staff = booking.staff_id ? await base44.asServiceRole.entities.Staff.get(booking.staff_id) : null;

    if (!staff || !staff.email) return Response.json({ skipped: true, reason: 'No staff email' });
    if (staff.email_notifications_enabled === false) return Response.json({ skipped: true, reason: 'Notifications disabled' });

    const startDate = course?.start_date
      ? new Date(course.start_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'To be confirmed';
    const endDate = course?.end_date && course.end_date !== course.start_date
      ? new Date(course.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'training_booking' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const tok = {
      staff_name: staff.name?.split(' ')[0] || '',
      course_title: course?.title || 'N/A',
      start_date: startDate, end_date: endDate || '',
      start_time: course?.start_time || '', end_time: course?.end_time || '',
      venue: course?.venue || '', address: course?.address || '',
      provider: course?.provider || '', provider_phone: course?.provider_phone || '',
      description: course?.description || ''
    };

    const subject = cfg.subject
      ? cfg.subject.replace(/\{course_title\}/g, tok.course_title).replace(/\{staff_name\}/g, tok.staff_name)
      : `Training Booking — ${course?.title || 'Training Course'}`;

    const baseUrl = await getAppBaseUrl(base44);

    // Rich HTML body
    const detailsTable = infoTable([
      ['Course', tok.course_title],
      ['Date', tok.start_date + (tok.end_date ? ' to ' + tok.end_date : '')],
      ['Time', tok.start_time ? (tok.start_time + (tok.end_time ? ' - ' + tok.end_time : '')) : '—'],
      ['Venue', tok.venue || '—'],
      ['Address', tok.address || '—'],
      ['Provider', tok.provider || '—'],
      ['Provider Phone', tok.provider_phone || '—'],
    ].filter(r => r[1] && r[1] !== '—'));

    const bodyHtml =
      heading('Training course booking') +
      p('Hi ' + tok.staff_name + ',') +
      p('You have been booked onto a training course. Please arrive on time and bring any required PPE or identification.') +
      sectionCard('Course Details', detailsTable, { titleBg: '#7c3aed' }) +
      (tok.description ? callout(tok.description, 'info') : '') +
      helpTip('What to do next', 'Check your schedule for the training date. Make sure you know the venue address and arrive 10 minutes early. Bring your ID and any PPE required for the course. If you can\'t attend, contact your manager immediately to rearrange.') +
      linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{staff_name\}/g, tok.staff_name).replace(/\{course_title\}/g, tok.course_title)
            .replace(/\{start_date\}/g, tok.start_date).replace(/\{end_date\}/g, tok.end_date)
            .replace(/\{start_time\}/g, tok.start_time).replace(/\{end_time\}/g, tok.end_time)
            .replace(/\{venue\}/g, tok.venue).replace(/\{address\}/g, tok.address)
            .replace(/\{provider\}/g, tok.provider).replace(/\{provider_phone\}/g, tok.provider_phone)
            .replace(/\{description\}/g, tok.description)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule')
      : bodyHtml;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'violet', banner_subtitle: 'Training Booking' })
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});