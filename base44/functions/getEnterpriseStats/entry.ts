import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * getEnterpriseStats — server-side aggregation of enterprise-wide metrics.
 *
 * Returns per-division and global stats (staff counts, active jobs, vehicles,
 * outstanding invoices, pending timesheets, expired compliance items) in a
 * single round-trip. Replaces the dashboard's client-side filtering of
 * list()-limited arrays, which undercounted when record counts exceeded the
 * 500–5000 cap and went stale when mutations didn't invalidate the cache.
 *
 * Runs as service role to see all divisions; the frontend filters the result
 * by the user's permitted divisions.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;

    // Fetch all records (service role bypasses RLS). Paginate to avoid limits.
    const fetchAll = async (entity, limit = 10000) => {
      const out = [];
      let skip = 0;
      while (true) {
        const batch = await sr.entities[entity].list('-created_date', limit, skip);
        out.push(...batch);
        if (batch.length < limit) break;
        skip += limit;
        if (skip > 50000) break; // safety cap
      }
      return out;
    };

    const [divisions, staff, jobs, vehicles, invoices, timesheets, compliance, assets, snapshots] = await Promise.all([
      sr.entities.Division.list('-sort_order', 500),
      fetchAll('Staff'),
      fetchAll('Job'),
      fetchAll('Vehicle'),
      fetchAll('Invoice'),
      fetchAll('Timesheet'),
      fetchAll('ComplianceItem'),
      fetchAll('SiteAsset'),
      sr.entities.DivisionSnapshot.list('-created_date', 500),
    ]);

    // Per-division stats
    const divisionStats = divisions.map(d => {
      const dStaff = staff.filter(s => s.division_id === d.id);
      const dJobs = jobs.filter(j => j.division_id === d.id);
      const dVehicles = vehicles.filter(v => v.division_id === d.id);
      const dInvoices = invoices.filter(i => i.division_id === d.id);
      return {
        division: {
          id: d.id,
          name: d.name,
          code: d.code,
          color: d.color,
          status: d.status,
          division_type: d.division_type,
          landing_page: d.landing_page,
        },
        staffCount: dStaff.length,
        activeStaff: dStaff.filter(s => s.is_active !== false).length,
        jobsCount: dJobs.length,
        activeJobs: dJobs.filter(j => (j.status || 'planning') === 'in_progress').length,
        vehiclesCount: dVehicles.length,
        assetsCount: assets.filter(a => a.division_id === d.id || (!a.division_id && dJobs.some(j => j.division_id === d.id))).length,
        planningJobs: dJobs.filter(j => (j.status || 'planning') === 'planning').length,
        outstanding: dInvoices
          .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
          .reduce((sum, i) => sum + (i.gross_total || 0), 0),
      };
    });

    // Global stats (all divisions — frontend filters by permitted)
    const now = new Date();
    const parentIds = new Set(divisions.filter(d => d.parent_division_id).map(d => d.parent_division_id));
    const businessUnits = divisions.filter(d => !d.parent_division_id && parentIds.has(d.id)).length;

    const globalStats = {
      businessUnits,
      snapshots: snapshots.length,
      divisions: divisions.length,
      activeDivisions: divisions.filter(d => d.status === 'active').length,
      staff: staff.length,
      activeJobs: jobs.filter(j => (j.status || 'planning') === 'in_progress').length,
      vehicles: vehicles.length,
      pendingTs: timesheets.filter(t => t.status === 'submitted').length,
      openCompliance: compliance.filter(c => c.expiry_date && new Date(c.expiry_date) < now).length,
      planningJobs: jobs.filter(j => (j.status || 'planning') === 'planning').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      assets: assets.filter(a => a.is_active !== false).length,
      assetsExpiring: assets.filter(a => a.compliance_status === 'expiring' || a.compliance_status === 'expired').length,
      activeStaff: staff.filter(s => s.is_active !== false).length,
      totalOutstanding: invoices
        .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
        .reduce((sum, i) => sum + (i.gross_total || 0), 0),
    };

    return Response.json({ divisionStats, globalStats, generatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}