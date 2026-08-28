import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates an iCal (.ics) feed of a staff member's upcoming rota assignments
// so schedules can be imported into phone/desktop calendars.
// Called from the Staff Manager via base44.functions.invoke('getStaffICalFeed', { staff_id }).

function fmtICalDate(dateStr) {
  // dateStr is YYYY-MM-DD -> YYYYMMDD
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

function escapeICal(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const staffId = body.staff_id;
    if (!staffId) return Response.json({ error: 'staff_id is required' }, { status: 400 });

    const staff = await base44.asServiceRole.entities.Staff.get(staffId);
    if (!staff) return Response.json({ error: 'Staff member not found' }, { status: 404 });

    // Fetch rota assignments from today forward (next 90 days)
    const today = new Date().toISOString().slice(0, 10);
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter(
      { staff_id: staffId, assigned_date: { $gte: today } },
      'assigned_date',
      500
    );

    const jobIds = [...new Set(assignments.map(a => a.job_id).filter(Boolean))];
    const jobs = [];
    for (const jid of jobIds) {
      try {
        const j = await base44.asServiceRole.entities.Job.get(jid);
        if (j) jobs.push(j);
      } catch (_) {}
    }
    const jobMap = {};
    jobs.forEach(j => { jobMap[j.id] = j; });

    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GC Mission Control//Staff Schedule//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:' + escapeICal(staff.name + ' — GC Schedule'),
    ];

    assignments.forEach(a => {
      const job = a.job_id ? jobMap[a.job_id] : null;
      let summary, location, description;
      if (a.assignment_type === 'annual_leave') {
        summary = 'Annual Leave' + (a.non_job_label ? ' — ' + a.non_job_label : '');
        description = 'Annual leave / day off';
      } else if (a.assignment_type === 'sick') {
        summary = 'Sick Leave';
        description = 'Sick leave';
      } else if (a.assignment_type === 'training') {
        summary = 'Training' + (a.non_job_label ? ' — ' + a.non_job_label : '');
        description = a.non_job_label || 'Training course';
      } else if (job) {
        summary = job.name || 'Job';
        location = job.location || '';
        const parts = [];
        if (job.location) parts.push('Location: ' + job.location);
        if (job.site_contact_name) parts.push('Site contact: ' + job.site_contact_name);
        if (job.site_contact_phone) parts.push('Phone: ' + job.site_contact_phone);
        if (job.project_manager) parts.push('PM: ' + job.project_manager);
        if (a.start_time && a.end_time) parts.push('Shift: ' + a.start_time + '–' + a.end_time);
        if (a.notes) parts.push('Notes: ' + a.notes);
        description = parts.join('\\n');
      } else {
        summary = a.non_job_label || 'Assignment';
        description = a.non_job_label || '';
      }

      const dStart = fmtICalDate(a.assigned_date);
      // All-day event: use DATE value (no time). End date is +1 day per iCal spec.
      const dEnd = a.assigned_date ? fmtICalDate(new Date(new Date(a.assigned_date + 'T00:00:00').getTime() + 86400000).toISOString().slice(0, 10)) : dStart;

      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + a.id + '@gc-mission-control');
      lines.push('DTSTAMP:' + nowStamp + 'Z');
      lines.push('DTSTART;VALUE=DATE:' + dStart);
      lines.push('DTEND;VALUE=DATE:' + dEnd);
      lines.push('SUMMARY:' + escapeICal(summary));
      if (location) lines.push('LOCATION:' + escapeICal(location));
      if (description) lines.push('DESCRIPTION:' + escapeICal(description));
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    const ical = lines.join('\r\n');
    return Response.json({ ical, count: assignments.length, staff_name: staff.name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}