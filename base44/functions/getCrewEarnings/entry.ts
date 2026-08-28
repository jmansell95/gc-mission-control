import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getCrewEarnings — per-crew total earned for a date range
// ============================================================
// Aggregates AFPLineItem revenue by the crew/team assigned to
// each job. Returns per-crew total earned with a job-level
// breakdown, filterable by date range and optional team_id.
//
// Returns: { crews: [{ team_id, team_name, total_earned, jobs_count,
//                      job_breakdown: [{ job_id, job_name, earned }] }],
//            totals: { total_earned, crews_count } }

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, team_id, division_id } = body;

    // 1. Fetch AFPLineItems in date range
    const lineItems = await base44.asServiceRole.entities.AFPLineItem.list('-source_date', 2000);
    const filtered = lineItems.filter(li => {
      if (date_from && li.source_date && li.source_date < date_from) return false;
      if (date_to && li.source_date && li.source_date > date_to) return false;
      if (li.dispute_status === 'rejected') return false;
      return true;
    });

    // 2. Fetch jobs to map job_id → team
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j.id] = j;

    // 3. Fetch teams for names
    const teams = await base44.asServiceRole.entities.Team.list('-created_date', 200);
    const teamMap: Record<string, any> = {};
    for (const t of teams) teamMap[t.id] = t;

    // 4. Aggregate by team
    const crewStats: Record<string, { total: number; jobs: Record<string, number> }> = {};
    for (const li of filtered) {
      const job = jobMap[li.job_id];
      if (!job) continue;
      // Determine team: job.required_team_ids (primary discipline) or job.team_id
      const teamIds = job.required_team_ids || [];
      if (teamIds.length === 0) continue;
      const amt = li.agreed_amount || li.amount || 0;
      for (const tid of teamIds) {
        if (team_id && tid !== team_id) continue;
        if (!crewStats[tid]) crewStats[tid] = { total: 0, jobs: {} };
        crewStats[tid].total += amt;
        crewStats[tid].jobs[li.job_id] = (crewStats[tid].jobs[li.job_id] || 0) + amt;
      }
    }

    // 5. Build result
    const crews = Object.entries(crewStats).map(([tid, stats]) => {
      const team = teamMap[tid];
      const jobBreakdown = Object.entries(stats.jobs).map(([jid, earned]) => ({
        job_id: jid,
        job_name: jobMap[jid]?.name || '—',
        job_reference: jobMap[jid]?.job_reference || '',
        earned: round2(earned),
      })).sort((a, b) => b.earned - a.earned);

      return {
        team_id: tid,
        team_name: team?.name || 'Unassigned',
        job_type: team?.job_type || '',
        total_earned: round2(stats.total),
        jobs_count: jobBreakdown.length,
        job_breakdown: jobBreakdown,
      };
    }).sort((a, b) => b.total_earned - a.total_earned);

    const totals = {
      total_earned: round2(crews.reduce((s, c) => s + c.total_earned, 0)),
      crews_count: crews.length,
    };

    return Response.json({ ok: true, crews, totals });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}