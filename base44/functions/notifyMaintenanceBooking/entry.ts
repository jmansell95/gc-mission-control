import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillInfo, pillWarning,
  sectionCard, helpTip, heading, p, callout, html
} from '../../shared/emailStyling.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id } = await req.json();
    if (!booking_id) return Response.json({ error: 'booking_id required' }, { status: 400 });

    const booking = await base44.asServiceRole.entities.VehicleMaintenanceBooking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (!booking.assigned_staff_id) return Response.json({ skipped: true, reason: 'No staff assigned' });

    const staff = await base44.asServiceRole.entities.Staff.get(booking.assigned_staff_id);
    if (!staff || !staff.email) return Response.json({ skipped: true, reason: 'No staff email' });
    if (staff.email_notifications_enabled === false) return Response.json({ skipped: true, reason: 'Notifications disabled' });

    const vehicle = booking.vehicle_id ? await base44.asServiceRole.entities.Vehicle.get(booking.vehicle_id) : null;

    const typeLabels = { mot: 'MOT', service: 'Service', windscreen: 'Windscreen Repair', repair: 'Repair', inspection: 'Inspection', other: 'Maintenance' };
    const typeLabel = typeLabels[booking.booking_type] || 'Maintenance';

    const dateStr = booking.booking_date
      ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'To be confirmed';
    const timeStr = booking.booking_time || 'Time to be confirmed';

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'maintenance_booking' });
    const cfg = cfgList[0] || {};
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const vehicleName = `${vehicle?.name || booking.vehicle_name || 'N/A'} (${vehicle?.registration_number || 'N/A'})`;
    const tok = {
      staff_name: staff.name?.split(' ')[0] || '',
      vehicle_name: vehicleName, booking_type: typeLabel,
      booking_date: dateStr, booking_time: timeStr,
      supplier_name: booking.supplier_name || '', supplier_phone: booking.supplier_phone || '',
      location: booking.location || '', notes: booking.notes || ''
    };

    const subject = cfg.subject
      ? cfg.subject.replace(/\{booking_type\}/g, typeLabel).replace(/\{vehicle_name\}/g, vehicle?.registration_number || booking.vehicle_name || 'Vehicle')
      : `${typeLabel} Booking — ${vehicle?.registration_number || booking.vehicle_name || 'Vehicle'}`;

    const baseUrl = await getAppBaseUrl(base44);

    // Rich HTML body
    const detailsTable = infoTable([
      ['Vehicle', vehicleName],
      ['Booking Type', typeLabel],
      ['Date', dateStr],
      ['Time', timeStr],
      ['Supplier', tok.supplier_name || '—'],
      ['Supplier Phone', tok.supplier_phone || '—'],
      ['Location', tok.location || '—'],
    ].filter(r => r[1] && r[1] !== '—'));

    const bodyHtml =
      heading('Vehicle ' + typeLabel.toLowerCase() + ' booking') +
      p('Hi ' + tok.staff_name + ',') +
      p('A vehicle ' + typeLabel.toLowerCase() + ' booking has been scheduled for you. Please ensure the vehicle is taken to the appointment on time.') +
      sectionCard('Booking Details', detailsTable, { titleBg: '#1d4ed8' }) +
      (tok.notes ? callout(tok.notes, 'info') : '') +
      helpTip('What to do next', 'Check your schedule for the booking date. Make sure the vehicle is clean and fuelled before the appointment. If you can\'t make the booking time, contact your manager as soon as possible to rearrange.') +
      linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

    // If custom template is set, use it instead
    const finalHtml = (cfg.template)
      ? escapeHtml(
          cfg.template
            .replace(/\{staff_name\}/g, tok.staff_name)
            .replace(/\{vehicle_name\}/g, tok.vehicle_name)
            .replace(/\{booking_type\}/g, tok.booking_type)
            .replace(/\{booking_date\}/g, tok.booking_date)
            .replace(/\{booking_time\}/g, tok.booking_time)
            .replace(/\{supplier_name\}/g, tok.supplier_name)
            .replace(/\{supplier_phone\}/g, tok.supplier_phone)
            .replace(/\{location\}/g, tok.location)
            .replace(/\{notes\}/g, tok.notes)
        ).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule')
      : bodyHtml;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: brandedWrapper(finalHtml, { ...cfg, headerVariant: 'blue', banner_subtitle: typeLabel + ' Booking' })
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});