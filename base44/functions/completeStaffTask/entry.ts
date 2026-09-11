import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// completeStaffTask — marks a task complete and handles
// ============================================================
// Called from the field app when a staff member taps 'Complete'.
// Stamps completed_at + completed_by, notifies the assigner,
// and if the task is recurring, generates the next cycle instance.

function computeNextDueDate(frequency: string, dayOfWeek: number, dayOfMonth: number, monthOfYear: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (frequency === 'daily') {
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'weekly') {
    const targetDay = dayOfWeek || 1; // default Monday
    const currentDay = today.getDay() || 7; // 0=Sun → 7
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // next occurrence
    const next = new Date(today);
    next.setDate(next.getDate() + daysToAdd);
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'monthly') {
    const targetDay = dayOfMonth || 1;
    const next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(targetDay, 28));
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'yearly') {
    const targetMonth = monthOfYear || 1;
    const targetDay = dayOfMonth || 1;
    let year = today.getFullYear();
    if (targetMonth < today.getMonth() + 1 || (targetMonth === today.getMonth() + 1 && targetDay <= today.getDate())) {
      year++;
    }
    const next = new Date(year, targetMonth - 1, Math.min(targetDay, 28));
    return next.toISOString().slice(0, 10);
  }
  // Fallback: tomorrow
  const next = new Date(today);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { task_id, completion_note, completion_photo_url } = body;

    if (!task_id) return Response.json({ error: 'Missing task_id' }, { status: 400 });

    // Fetch the task (service role so we can read regardless of RLS)
    const taskList = await base44.asServiceRole.entities.StaffTask.filter({ id: task_id });
    const task = taskList?.[0];
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });
    if (task.status === 'completed') return Response.json({ error: 'Task already completed' }, { status: 400 });

    // Get completer name
    let completerName = user.full_name || user.email || '';
    try {
      const completerList = await base44.asServiceRole.entities.Staff.filter({ user_id: user.id });
      if (completerList?.[0]) completerName = completerList[0].name || completerName;
    } catch { /* continue */ }

    const now = new Date().toISOString();

    // Mark the task complete
    await base44.entities.StaffTask.update(task_id, {
      status: 'completed',
      completed_at: now,
      completed_by: completerName,
      completed_by_id: user.id,
      completion_note: completion_note || '',
      completion_photo_url: completion_photo_url || '',
    });

    // If recurring, generate the next cycle instance
    let nextTask = null;
    if (task.is_recurring && task.recurring_template_id) {
      try {
        const templateList = await base44.asServiceRole.entities.RecurringDutyTemplate.filter({ id: task.recurring_template_id });
        const template = templateList?.[0];
        if (template && template.is_active) {
          const nextDue = computeNextDueDate(
            template.frequency,
            template.day_of_week,
            template.day_of_month,
            template.month_of_year,
          );

          // Generate for each assigned staff member
          const staffIds = template.assigned_staff_ids?.length > 0
            ? template.assigned_staff_ids
            : [];

          if (staffIds.includes(task.assigned_to_staff_id)) {
            // Get staff name for denormalisation
            const staffList = await base44.asServiceRole.entities.Staff.filter({ id: task.assigned_to_staff_id });
            const staff = staffList?.[0];
            nextTask = await base44.asServiceRole.entities.StaffTask.create({
              title: template.name,
              description: template.description || '',
              assigned_to_staff_id: task.assigned_to_staff_id,
              assigned_to_name: staff?.name || task.assigned_to_name || '',
              assigned_by_staff_id: task.assigned_by_staff_id,
              assigned_by_name: task.assigned_by_name || '',
              due_date: nextDue,
              due_time: template.due_time || '',
              priority: template.priority || 'medium',
              category: 'recurring',
              status: 'pending',
              linked_job_id: template.linked_job_id || '',
              linked_vehicle_id: template.linked_vehicle_id || '',
              is_recurring: true,
              recurring_template_id: template.id,
              division_id: template.division_id || '',
            });
          }

          // Update template's next_due_date and last_generated_at
          await base44.asServiceRole.entities.RecurringDutyTemplate.update(template.id, {
            next_due_date: nextDue,
            last_generated_at: now,
          });
        }
      } catch (e) { /* non-fatal — next cycle generation failure shouldn't block completion */ }
    }

    // Notify the assigner (non-blocking)
    try {
      if (task.assigned_by_staff_id && task.assigned_by_staff_id !== user.id) {
        const assignerStaff = await base44.asServiceRole.entities.Staff.filter({ id: task.assigned_by_staff_id });
        const assigner = assignerStaff?.[0];
        if (assigner?.user_id) {
          await base44.integrations.Core.SendPushNotification({
            user_id: assigner.user_id,
            title: `Task Completed: ${task.title}`,
            content: `${completerName} completed "${task.title}"${completion_note ? ' — ' + completion_note.slice(0, 80) : ''}`,
            action_label: 'View',
            action_url: '/staff',
          });
        }
      }
    } catch { /* non-fatal */ }

    return Response.json({ success: true, completed_at: now, next_task: nextTask });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}