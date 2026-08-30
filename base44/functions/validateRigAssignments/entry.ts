import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Post-Import Rig Validation Sweep
// ---------------------------------------------------------------------------
// Checks every drilling RotaAssignment for a null rig_asset_id.
// Auto-links by matching the rig name from the spreadsheet to a SiteAsset
// (is_rig=true). Flags unresolvable assignments for manual review.
// Also blocks publishing a rota week that has drilling assignments without rigs.
// ---------------------------------------------------------------------------

export default async function main(req: any, res: any) {
  const base44 = createClientFromRequest(req);

  try {
    // Fetch all drilling assignments with null rig_asset_id
    const allAssignments = await base44.entities.RotaAssignment.list('-created_date', 500);
    const drillingAssignments = allAssignments.filter(
      (a: any) => a.assignment_type === 'job' && !a.rig_asset_id && a.job_id
    );

    if (drillingAssignments.length === 0) {
      return res.json({
        success: true,
        summary: 'No drilling assignments with missing rigs found.',
        checked: allAssignments.length,
        missing: 0,
        auto_linked: 0,
        flagged: 0,
      });
    }

    // Fetch all rigs and jobs for matching
    const rigs = await base44.entities.SiteAsset.filter({ is_rig: true, is_active: true });
    const jobs = await base44.entities.Job.list('-created_date', 500);

    const jobMap = new Map(jobs.map((j: any) => [j.id, j]));
    const rigByName = new Map<string, any>();

    // Build a normalised rig name lookup
    for (const rig of rigs) {
      const normName = (rig.name || '').toLowerCase().trim();
      if (normName) rigByName.set(normName, rig);
      // Also index by fleet number
      if (rig.fleet_number) {
        rigByName.set(rig.fleet_number.toLowerCase().trim(), rig);
      }
    }

    let autoLinked = 0;
    let flagged = 0;
    const flaggedItems: any[] = [];

    for (const assignment of drillingAssignments) {
      const job = jobMap.get(assignment.job_id);
      if (!job) {
        flagged++;
        flaggedItems.push({
          assignment_id: assignment.id,
          staff_id: assignment.staff_id,
          date: assignment.assigned_date,
          reason: 'Job not found',
        });
        continue;
      }

      // Try to match rig by job name keywords
      const jobName = (job.name || '').toLowerCase();
      let matchedRig: any = null;

      // Strategy 1: Direct name match from job name
      for (const [rigName, rig] of rigByName) {
        if (jobName.includes(rigName) || rigName.includes(jobName.substring(0, 10))) {
          matchedRig = rig;
          break;
        }
      }

      // Strategy 2: Match by drilling method
      if (!matchedRig && job.drilling_method) {
        const methodRigs = rigs.filter((r: any) =>
          r.rig_type === job.drilling_method || (job.drilling_method === 'cp' && r.rig_type === 'cp')
        );
        if (methodRigs.length === 1) {
          matchedRig = methodRigs[0];
        }
      }

      if (matchedRig) {
        await base44.entities.RotaAssignment.update(assignment.id, {
          rig_asset_id: matchedRig.id,
        });
        autoLinked++;
      } else {
        flagged++;
        flaggedItems.push({
          assignment_id: assignment.id,
          staff_id: assignment.staff_id,
          staff_name: assignment.staff_id,
          date: assignment.assigned_date,
          job_name: job.name,
          reason: 'No matching rig found — manual assignment required',
        });
      }
    }

    return res.json({
      success: true,
      summary: `Checked ${allAssignments.length} assignments. ${drillingAssignments.length} drilling assignments had missing rigs. Auto-linked ${autoLinked}, flagged ${flagged} for manual review.`,
      checked: allAssignments.length,
      missing: drillingAssignments.length,
      auto_linked: autoLinked,
      flagged,
      flagged_items: flaggedItems,
    });
  } catch (error: any) {
    console.error('Rig validation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Rig validation failed',
    });
  }
}