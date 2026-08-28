import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generateKeyLogBookTimesheet } from '../../shared/keylogbookTimesheet.ts';

// ============================================================
// Approve KeyLogBook Site Logs → Re-generate Timesheet
// ============================================================
// Called by an admin from the Site Logs tab to re-approve and
// re-generate the timesheet after editing site log activities.
// The webhook (receiveKeyLogBookData) now auto-approves and
// auto-generates the timesheet inline, so this function is only
// needed when a manager edits logs and wants to re-generate.

interface ApprovePayload {
  job_id: string;
  date: string;
  staff_id?: string;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins/managers may re-generate and approve timesheets from site logs.
    const isAdmin = user.role === 'admin';
    let isManager = isAdmin;
    if (!isManager) {
      try {
        const staffRec = await base44.entities.Staff.filter({ user_id: user.id });
        const s = staffRec[0];
        isManager = !!s && (s.system_role === 'admin' || s.system_role === 'management' || s.system_role === 'super_admin');
      } catch (_) { /* fall through to deny */ }
    }
    if (!isManager) {
      return Response.json({ error: 'Only managers can approve site logs' }, { status: 403 });
    }

    const body: ApprovePayload = await req.json().catch(() => ({}));

    if (!body.job_id || !body.date) {
      return Response.json({ error: 'job_id and date are required' }, { status: 400 });
    }

    const result = await generateKeyLogBookTimesheet(base44, body.job_id, body.date, body.staff_id);

    return Response.json({
      status: result.status,
      job_id: body.job_id,
      date: body.date,
      approved: result.approved,
      timesheets_created: result.timesheets_created,
      staff_name: result.staff_name,
      message: result.message,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});