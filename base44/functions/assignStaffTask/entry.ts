import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// assignStaffTask — creates a StaffTask record and notifies
// ============================================================
// Called from the Staff Hub task assignment panel. Creates a
// StaffTask, sends a push notification + email to the assignee,
// and creates an InboxItem for the assigner to track completion.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      title,
      description,
      assigned_to_staff_id,
      due_date,
      due_time,
      priority = 'medium',
      category = 'ad_hoc',
      photo_url,
      attachment_url,
      linked_job_id,
      linked_vehicle_id,
      division_id,
      recurring_template_id,
      is_recurring = false,
      assigned_to_name,
      linked_job_name,
      linked_vehicle_name,
    } = body;

    if (!title || !assigned_to_staff_id || !due_date) {
      return Response.json({ error: 'Missing required fields: title, assigned_to_staff_id, due_date' }, { status: 400 });
    }

    // Get assigner staff record for denormalised name
    let assignerName = user.full_name || user.email || '';
    try {
      const assignerList = await base44.entities.Staff.filter({ user_id: user.id });
      if (assignerList?.[0]) assignerName = assignerList[0].name || assignerName;
    } catch { /* continue with user name */ }

    // Create the StaffTask
    const task = await base44.entities.StaffTask.create({
      title,
      description: description || '',
      assigned_to_staff_id,
      assigned_to_name: assigned_to_name || '',
      assigned_by_staff_id: user.id,
      assigned_by_name: assignerName,
      due_date,
      due_time: due_time || '',
      priority,
      category,
      status: 'pending',
      photo_url: photo_url || '',
      attachment_url: attachment_url || '',
      linked_job_id: linked_job_id || '',
      linked_job_name: linked_job_name || '',
      linked_vehicle_id: linked_vehicle_id || '',
      linked_vehicle_name: linked_vehicle_name || '',
      is_recurring,
      recurring_template_id: recurring_template_id || '',
      division_id: division_id || '',
    });

    // Send push notification to the assignee (non-blocking)
    try {
      // Look up the assignee's platform user ID for push
      const assigneeStaff = await base44.asServiceRole.entities.Staff.filter({ id: assigned_to_staff_id });
      const assignee = assigneeStaff?.[0];
      if (assignee?.user_id) {
        await base44.integrations.Core.SendPushNotification({
          user_id: assignee.user_id,
          title: `New Task: ${priority === 'urgent' ? 'URGENT — ' : ''}${title}`,
          content: description ? (description.slice(0, 100) + (description.length > 100 ? '…' : '')) : `Due ${due_date}`,
          action_label: 'View Task',
          action_url: '/my-duties',
        });
      }
    } catch { /* non-fatal — push may not be configured */ }

    // Send email notification (non-blocking)
    try {
      const assigneeStaff = await base44.asServiceRole.entities.Staff.filter({ id: assigned_to_staff_id });
      const assignee = assigneeStaff?.[0];
      if (assignee?.email) {
        const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
        await base44.integrations.Core.SendEmail({
          to: assignee.email,
          subject: `New Task Assigned: ${title}`,
          body: `Hi ${assignee.name || ''},\n\nYou have been assigned a new task:\n\nTitle: ${title}\nPriority: ${priorityLabel}\nDue: ${due_date}${due_time ? ' at ' + due_time : ''}\n\n${description || ''}\n\nAssigned by: ${assignerName}\n\nPlease complete this task by the due date. Open the app → My Tasks to view details and mark it complete.\n\n— GC Mission Control`,
        });
      }
    } catch { /* non-fatal — email may not be configured for non-registered users */ }

    return Response.json({ success: true, task });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}