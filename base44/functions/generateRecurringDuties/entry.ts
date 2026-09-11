import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// generateRecurringDuties — daily workflow that creates
// ============================================================
// Scheduled workflow calls this daily. For each active
// RecurringDutyTemplate whose next_due_date is today (or past),
// generates StaffTask instances for all assigned staff members.
// Then advances the template's next_due_date to the next cycle.

function computeNextDueDate(frequency: string, dayOfWeek: number, dayOfMonth: number, monthOfYear: number, fromDate: Date): string {
  const base = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

  if (frequency === 'daily') {
    const next = new Date(base);
    next.setDate(next.getDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'weekly') {
    const targetDay = dayOfWeek || 1;
    const currentDay = base.getDay() || 7;
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const next = new Date(base);
    next.setDate(next.getDate() + daysToAdd);
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'monthly') {
    const targetDay = dayOfMonth || 1;
    const next = new Date(base.getFullYear(), base.getMonth() + 1, Math.min(targetDay, 28));
    return next.toISOString().slice(0, 10);
  }
  if (frequency === 'yearly') {
    const targetMonth = monthOfYear || 1;
    const targetDay = dayOfMonth || 1;
    let year = base.getFullYear();
    if (targetMonth < base.getMonth() + 1 || (targetMonth === base.getMonth() + 1 && targetDay <= base.getDate())) {
      year++;
    }
    const next = new Date(year, targetMonth - 1, Math.min(targetDay, 28));
    return next.toISOString().slice(0, 10);
  }
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today + 'T00:00:00');

    // Fetch all active templates
    const templates = await base44.asServiceRole.entities.RecurringDutyTemplate.filter({ is_active: true });
    let generated = 0;
    let skipped = 0;
    const results = [];

    for (const template of templates) {
      // Check if this template is due today (or overdue)
      const nextDue = template.next_due_date;
      if (!nextDue) {
        // No next_due_date set — initialize it
        const initialDue = computeNextDueDate(
          template.frequency,
          template.day_of_week,
          template.day_of_month,
          template.month_of_year,
          todayDate,
        );
        await base44.asServiceRole.entities.RecurringDutyTemplate.update(template.id, {
          next_due_date: initialDue,
        });
        skipped++;
        results.push({ template_id: template.id, name: template.name, action: 'initialized', next_due: initialDue });
        continue;
      }

      const dueDate = new Date(nextDue + 'T00:00:00');
      if (dueDate > todayDate) {
        // Not due yet
        skipped++;
        continue;
      }

      // Determine which staff to generate for
      let staffIds = template.assigned_staff_ids || [];
      if (staffIds.length === 0 && template.assigned_role_keys?.length > 0) {
        // Match by role key against job_title
        const allStaff = await base44.asServiceRole.entities.Staff.filter({ is_active: true });
        const roleKeys = template.assigned_role_keys.map((k: string) => k.toLowerCase());
        staffIds = allStaff
          .filter((s: any) => {
            const title = (s.job_title || '').toLowerCase();
            return roleKeys.some((k: string) => title.includes(k));
          })
          .map((s: any) => s.id);
      }

      if (staffIds.length === 0) {
        skipped++;
        results.push({ template_id: template.id, name: template.name, action: 'no_assigned_staff' });
        continue;
      }

      // Check for existing tasks on this due_date to avoid duplicates
      const existingTasks = await base44.asServiceRole.entities.StaffTask.filter({
        recurring_template_id: template.id,
        due_date: nextDue,
      });
      const existingStaffIds = new Set(existingTasks.map((t: any) => t.assigned_to_staff_id));

      // Fetch staff names for denormalisation
      const staffRecords = await base44.asServiceRole.entities.Staff.filter({ id: { $in: staffIds } });
      const staffMap = new Map(staffRecords.map((s: any) => [s.id, s]));

      const newTasks = [];
      for (const staffId of staffIds) {
        if (existingStaffIds.has(staffId)) continue; // already generated
        const staff = staffMap.get(staffId);
        newTasks.push({
          title: template.name,
          description: template.description || '',
          assigned_to_staff_id: staffId,
          assigned_to_name: staff?.name || '',
          assigned_by_staff_id: '',
          assigned_by_name: 'System',
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

      if (newTasks.length > 0) {
        await base44.asServiceRole.entities.StaffTask.bulkCreate(newTasks);
        generated += newTasks.length;
      }

      // Advance the template's next_due_date
      const nextNextDue = computeNextDueDate(
        template.frequency,
        template.day_of_week,
        template.day_of_month,
        template.month_of_year,
        dueDate,
      );
      await base44.asServiceRole.entities.RecurringDutyTemplate.update(template.id, {
        next_due_date: nextNextDue,
        last_generated_at: new Date().toISOString(),
      });

      results.push({
        template_id: template.id,
        name: template.name,
        action: 'generated',
        tasks_created: newTasks.length,
        next_due: nextNextDue,
      });
    }

    return Response.json({
      success: true,
      templates_processed: templates.length,
      tasks_generated: generated,
      skipped,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}