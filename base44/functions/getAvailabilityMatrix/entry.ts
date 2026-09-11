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
    const [staff, rigs, assignments, absences, jobs, teams, serviceRecords, trainingReqs, complianceItems, planningBlocks] = await Promise.all([
      base44.asServiceRole.entities.Staff.filter({ is_active: true }, 'name', 500),
      base44.asServiceRole.entities.SiteAsset.filter({ is_active: true }, 'name', 500),
      base44.asServiceRole.entities.RotaAssignment.filter({}, 'assigned_date', 5000),
      base44.asServiceRole.entities.Absence.filter({ status: 'approved' }, 'start_date', 500),
      base44.asServiceRole.entities.Job.list(500),
      base44.asServiceRole.entities.Team.list(200),
      base44.asServiceRole.entities.ServiceRecord.list(500).catch(() => []),
      base44.asServiceRole.entities.TrainingRequirement.list(200).catch(() => []),
      base44.asServiceRole.entities.ComplianceItem.filter({ category: 'staff' }, 'reference_id', 2000).catch(() => []),
      base44.asServiceRole.entities.PlanningBlock.filter({}, 'start_date', 500).catch(() => []),
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

    // ── Training qualification detection ────────────────────────────────
    // Match TrainingRequirement labels/short_codes against CP and Rotary
    // patterns so the planner can see who's qualified for which rig type.
    const isCP = (req: any) => {
      const txt = `${req.label || ''} ${req.short_code || ''} ${req.qualification_type || ''}`.toLowerCase();
      return /\bcp\b|cable.*percussion/.test(txt);
    };
    const isRotary = (req: any) => {
      const txt = `${req.label || ''} ${req.short_code || ''} ${req.qualification_type || ''}`.toLowerCase();
      return /rotary/.test(txt);
    };
    const cpReqIds = new Set((trainingReqs || []).filter(isCP).map((r: any) => r.id));
    const rotaryReqIds = new Set((trainingReqs || []).filter(isRotary).map((r: any) => r.id));

    // ── Training gap computation ────────────────────────────────────────
    // A gap = a TrainingRequirement in the staff's training_category_ids that
    // has no valid (non-expired, non-rejected) ComplianceItem with a matching
    // qualification_type. Returns the count of missing categories.
    const now = new Date();
    const complianceByStaff: Record<string, any[]> = {};
    (complianceItems || []).forEach((item: any) => {
      const sid = item.reference_id;
      if (!sid) return;
      if (item.review_status === 'rejected') return;
      if (item.status_override === 'not_required') return;
      if (!complianceByStaff[sid]) complianceByStaff[sid] = [];
      complianceByStaff[sid].push(item);
    });

    const hasValidCompliance = (staffId: string, qualificationType: string) => {
      const items = complianceByStaff[staffId] || [];
      return items.some((item: any) => {
        if (item.qualification_type !== qualificationType) return false;
        if (!item.expiry_date) return true; // no expiry = valid
        const exp = item.expiry_date.length === 7
          ? new Date(item.expiry_date + '-01')
          : new Date(item.expiry_date);
        return exp >= now;
      });
    };

    // Enrich staff with worker_type, training qualifications, and gap count
    const staffData = staffList.map((s: any) => {
      const catIds: string[] = s.training_category_ids || [];
      const hasCP = catIds.some((id: string) => cpReqIds.has(id));
      const hasRotary = catIds.some((id: string) => rotaryReqIds.has(id));

      // Training gaps: assigned categories with no valid compliance item
      let gapCount = 0;
      for (const catId of catIds) {
        const req = (trainingReqs || []).find((r: any) => r.id === catId);
        if (!req) continue;
        if (!hasValidCompliance(s.id, req.qualification_type)) gapCount++;
      }

      return {
        id: s.id, name: s.name, job_title: s.job_title, worker_type: s.worker_type,
        team_id: s.team_id, team_name: teamMap[s.team_id] || '',
        has_cp: hasCP, has_rotary: hasRotary, training_gap_count: gapCount,
      };
    });

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

    // Filter planning blocks to the year and division
    const blockList = (planningBlocks || []).filter((pb: any) => {
      if (!pb.start_date || !pb.end_date) return false;
      if (pb.start_date > yearEnd || pb.end_date < yearStart) return false;
      if (divisionId && pb.division_id && pb.division_id !== divisionId) return false;
      return true;
    }).map((pb: any) => ({
      id: pb.id, name: pb.name, division_id: pb.division_id,
      start_date: pb.start_date, end_date: pb.end_date,
      rig_asset_id: pb.rig_asset_id, rig_type: pb.rig_type,
      tentative_crew_ids: pb.tentative_crew_ids || [],
      location: pb.location, notes: pb.notes, status: pb.status,
    }));

    return Response.json({
      staff: staffData,
      rigs: rigData,
      assignments: assignmentData,
      absences: absenceList,
      maintenance: maintenanceData,
      planning_blocks: blockList,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}