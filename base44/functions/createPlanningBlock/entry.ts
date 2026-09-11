import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createNotification } from '../../shared/inboxEngine.ts';

// ============================================================
// createPlanningBlock — creates a tentative PlanningBlock and
// notifies division managers for review. Called from the
// Resource Planner when a planner drops a new block.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const data = body.data || body;

    if (!data.start_date || !data.end_date) {
      return Response.json({ error: 'Start and end dates are required' }, { status: 400 });
    }

    // 1. Create the planning block
    const block = await base44.asServiceRole.entities.PlanningBlock.create({
      name: data.name || 'Tentative Job',
      division_id: data.division_id || '',
      start_date: data.start_date,
      end_date: data.end_date,
      rig_asset_id: data.rig_asset_id || '',
      rig_type: data.rig_type || 'not_applicable',
      tentative_crew_ids: data.tentative_crew_ids || [],
      location: data.location || '',
      notes: data.notes || '',
      status: 'draft',
      created_by_name: user.full_name || user.email || 'Admin',
      created_by_id: user.id,
    });

    // 2. Notify division managers for review
    const divisionId = data.division_id || '';
    const divisionStaff = await base44.asServiceRole.entities.Staff.filter({
      is_active: true,
    });

    // Filter to division managers (same division + admin/management/super_admin role)
    const managers = divisionStaff.filter((s: any) =>
      (!divisionId || s.division_id === divisionId) &&
      ['super_admin', 'admin', 'management'].includes(s.system_role)
    ).map((s: any) => ({
      staffId: s.id,
      userId: s.user_id || null,
      name: s.name || 'Manager',
      email: s.email || null,
    }));

    if (managers.length > 0) {
      const dateRange = data.start_date === data.end_date
        ? data.start_date
        : `${data.start_date} → ${data.end_date}`;
      const rigTypeLabel: Record<string, string> = {
        cp: 'Cable Percussion',
        rotary: 'Rotary',
        mixed: 'Mixed',
        not_applicable: '',
      };
      const rigLabel = rigTypeLabel[data.rig_type] || '';
      const crewCount = (data.tentative_crew_ids || []).length;

      await createNotification(base44, {
        recipients: managers,
        type: 'alert',
        category: 'planning_block',
        title: `Potential job being planned: ${data.name || 'Tentative Job'}`,
        body: `A potential job is being planned for ${dateRange}${rigLabel ? ' — ' + rigLabel : ''}${data.location ? ' — ' + data.location : ''}${crewCount ? ` — ${crewCount} tentative crew` : ''}. Review the tentative plan in the Resource Planner.${data.notes ? ' Notes: ' + data.notes : ''}`,
        sourceHub: 'scheduling',
        sourceEntity: 'PlanningBlock',
        sourceId: block.id,
        deepLink: '/admin?section=scheduling',
        priority: 'normal',
      });
    }

    return Response.json({ ok: true, block });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}