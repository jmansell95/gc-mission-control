import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getAvailabilityMatrix — returns all data needed to render the
// full-year availability heatmap in a single call. Pre-joins
// staff, rigs, rota assignments, absences, and service records
// so the frontend doesn't need 52 separate week queries.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const year = parseInt(body?.year) || new Date().getFullYear();
    const divisionId = body?.division_id || '';

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Fetch all data in parallel using service role for admin-level access
    const [staff, rigs, assignments, absences, jobs, teams, serviceRecords] = await Promise.all([
      base44.asServiceRole.entities.Staff.filter({ is_active: true }, 'name', 500),
      base44.asServiceRole.entities.SiteAsset.filter({ is_active: true }, 'name', 500),
      base44.asServiceRole.entities.RotaAssignment.filter({}, 'assigned_date', 5000),
      base44.asServiceRole.entities.Absence.filter({ status: 'approved' }, 'start_date', 500),
      base44.asServiceRole.entities.Job.list(500),
      base44.asServiceRole.entities.Team.list(200),
      base44.asServiceRole.entities.ServiceRecord.list(500).catch(() => []),
    ]);

    // Filter by division if specified
    const divFilter = (item: any) => !divisionId || !item.division_id || item.division_id === divisionId;
    const staffList = (staff || []).filter(divFilter);
    const rigList = (rigs || []).filter((a: any) => a.asset_type === 'rig' && divFilter(a));

    const staffIds = new Set(staffList.map((s: any) => s.id));
    const rigIds = new Set(rigList.map((r: any) => r.id));

    // Filter assignments to the year and relevant staff/rigs
    const assignmentList = (assignments || []).filter((a: any) => {
      if (a.assigned_date < yearStart || a.assigned_date > yearEnd) return false;
      if (divisionId) {
        const belongs = (a.staff_id && staffIds.has(a.staff_id)) || (a.rig_asset_id && rigIds.has(a.rig_asset_id));
        if (!belongs) return false;
      }
      return true;
    });

    // Filter absences to relevant staff
    const absenceList = (absences || []).filter((a: any) => {
      if (divisionId && a.staff_id && !staffIds.has(a.staff_id)) return false;
      return true;
    });

    // Build job map
    const jobMap: Record<string, any> = {};
    (jobs || []).forEach((j: any) => { jobMap[j.id] = { name: j.name, reference: j.job_reference }; });

    // Build team map
    const teamMap: Record<string, string> = {};
    (teams || []).forEach((t: any) => { teamMap[t.id] = t.name; });

    // Enrich staff
    const staffData = staffList.map((s: any) => ({
      id: s.id, name: s.name, job_title: s.job_title, worker_type: s.worker_type,
      team_id: s.team_id, team_name: teamMap[s.team_id] || '',
    }));

    // Enrich rigs
    const rigData = rigList.map((r: any) => ({
      id: r.id, name: r.name, rig_type: r.rig_type, make: r.make, model: r.model,
    }));

    // Enrich assignments with job info
    const assignmentData = assignmentList.map((a: any) => ({
      staff_id: a.staff_id, rig_asset_id: a.rig_asset_id, assigned_date: a.assigned_date,
      assignment_type: a.assignment_type, non_job_label: a.non_job_label,
      job_id: a.job_id, job_name: jobMap[a.job_id]?.name || '',
      job_reference: jobMap[a.job_id]?.reference || '',
      crew_role: a.crew_role,
    }));

    // Service records for rig maintenance status
    const maintenanceData = (serviceRecords || [])
      .filter((r: any) => r.asset_id && rigIds.has(r.asset_id))
      .map((r: any) => ({
        asset_id: r.asset_id,
        service_date: r.service_date || r.date,
        next_service_date: r.next_service_date,
      }));

    return Response.json({
      staff: staffData,
      rigs: rigData,
      assignments: assignmentData,
      absences: absenceList,
      maintenance: maintenanceData,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}