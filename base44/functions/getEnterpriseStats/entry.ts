import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * getEnterpriseStats — server-side aggregation of enterprise-wide metrics.
 *
 * Returns:
 *  - divisionStats: per-division operating counters (staff, jobs, vehicles, outstanding)
 *  - buStats: per-business-unit aggregates (stream count, rolled-up staff/jobs/outstanding)
 *  - globalStats: enterprise totals + operations/financial/compliance breakdowns
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

    const fetchAll = async (entity, limit = 10000) => {
      const out = [];
      let skip = 0;
      while (true) {
        const batch = await sr.entities[entity].list('-created_date', limit, skip);
        out.push(...batch);
        if (batch.length < limit) break;
        skip += limit;
        if (skip > 50000) break;
      }
      return out;
    };

    const [divisions, staff, jobs, vehicles, invoices, timesheets, compliance, assets, snapshots, deliveries, safetyReports, cashFlow] = await Promise.all([
      sr.entities.Division.list('-sort_order', 500),
      fetchAll('Staff'),
      fetchAll('Job'),
      fetchAll('Vehicle'),
      fetchAll('Invoice'),
      fetchAll('Timesheet'),
      fetchAll('ComplianceItem'),
      fetchAll('SiteAsset'),
      sr.entities.DivisionSnapshot.list('-created_date', 500),
      fetchAll('DeliveryLog'),
      fetchAll('SafetyReport'),
      fetchAll('CashFlowEntry'),
    ]);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Per-division stats
    const divisionStats = divisions.map(d => {
      const dStaff = staff.filter(s => s.division_id === d.id);
      const dJobs = jobs.filter(j => j.division_id === d.id);
      const dVehicles = vehicles.filter(v => v.division_id === d.id);
      const dInvoices = invoices.filter(i => i.division_id === d.id);
      const dCompliance = compliance.filter(c => c.division_id === d.id);
      const dAssets = assets.filter(a => a.division_id === d.id);
      const dDeliveries = deliveries.filter(dl => dl.division_id === d.id);
      const dSafety = safetyReports.filter(sr => sr.job_id && dJobs.some(j => j.id === sr.job_id));
      return {
        division: {
          id: d.id,
          name: d.name,
          code: d.code,
          color: d.color,
          status: d.status,
          division_type: d.division_type,
          landing_page: d.landing_page,
          parent_division_id: d.parent_division_id,
          logo_url: d.logo_url,
          tagline: d.tagline,
        },
        staffCount: dStaff.length,
        activeStaff: dStaff.filter(s => s.is_active !== false).length,
        jobsCount: dJobs.length,
        activeJobs: dJobs.filter(j => (j.status || 'planning') === 'in_progress').length,
        vehiclesCount: dVehicles.length,
        assetsCount: dAssets.length,
        planningJobs: dJobs.filter(j => (j.status || 'planning') === 'planning').length,
        completedJobs: dJobs.filter(j => j.status === 'completed').length,
        outstanding: dInvoices
          .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
          .reduce((sum, i) => sum + (i.gross_total || 0), 0),
        revenue: dInvoices
          .filter(i => i.status === 'paid')
          .reduce((sum, i) => sum + (i.gross_total || 0), 0),
        pendingDeliveries: dDeliveries.filter(dl => dl.status === 'pending' || dl.status === 'in_progress').length,
        openIncidents: dSafety.filter(sr => sr.status === 'open').length,
        expiredCompliance: dCompliance.filter(c => c.expiry_date && new Date(c.expiry_date) < now).length,
        expiringCompliance: dCompliance.filter(c => {
          if (!c.expiry_date) return false;
          const exp = new Date(c.expiry_date);
          return exp >= now && exp <= thirtyDaysFromNow;
        }).length,
        assetsExpiring: dAssets.filter(a => a.compliance_status === 'expiring' || a.compliance_status === 'expired').length,
        rigsDeployed: dAssets.filter(a => a.is_rig && a.is_active !== false).length,
      };
    });

    // BU-level aggregates — roll up child division stats per BU
    const parentIds = new Set(divisions.filter(d => d.parent_division_id).map(d => d.parent_division_id));
    const businessUnitDivisions = divisions.filter(d => !d.parent_division_id && parentIds.has(d.id));

    const buStats = businessUnitDivisions.map(bu => {
      const childIds = divisions.filter(d => d.parent_division_id === bu.id).map(d => d.id);
      const childStatEntries = divisionStats.filter(ds => childIds.includes(ds.division.id));
      return {
        businessUnit: {
          id: bu.id,
          name: bu.name,
          code: bu.code,
          color: bu.color,
          status: bu.status,
          logo_url: bu.logo_url,
          tagline: bu.tagline,
        },
        streamCount: childIds.length,
        totalStaff: childStatEntries.reduce((s, c) => s + (c.staffCount || 0), 0),
        totalActiveStaff: childStatEntries.reduce((s, c) => s + (c.activeStaff || 0), 0),
        totalActiveJobs: childStatEntries.reduce((s, c) => s + (c.activeJobs || 0), 0),
        totalVehicles: childStatEntries.reduce((s, c) => s + (c.vehiclesCount || 0), 0),
        totalOutstanding: childStatEntries.reduce((s, c) => s + (c.outstanding || 0), 0),
        totalRevenue: childStatEntries.reduce((s, c) => s + (c.revenue || 0), 0),
        totalOpenIncidents: childStatEntries.reduce((s, c) => s + (c.openIncidents || 0), 0),
        totalExpiredCompliance: childStatEntries.reduce((s, c) => s + (c.expiredCompliance || 0), 0),
        streams: childStatEntries,
      };
    });

    // Global stats
    const globalStats = {
      businessUnits: businessUnitDivisions.length,
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
      totalRevenue: invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.gross_total || 0), 0),

      // Operations & Logistics
      activeDeliveries: deliveries.filter(dl => dl.status === 'pending' || dl.status === 'in_progress').length,
      completedDeliveries: deliveries.filter(dl => dl.status === 'completed').length,
      rigsDeployed: assets.filter(a => a.is_rig && a.is_active !== false).length,
      fleetUtilisation: vehicles.length > 0
        ? Math.round((vehicles.filter(v => v.current_operator_id).length / vehicles.length) * 100)
        : 0,

      // Financial Performance
      totalInvoiced: invoices.reduce((sum, i) => sum + (i.gross_total || 0), 0),
      overdueInvoices: invoices.filter(i => i.status && i.status !== 'paid' && i.status !== 'void' && i.due_date && new Date(i.due_date) < now).length,
      cashFlowProjected: cashFlow.reduce((sum, cf) => sum + (cf.amount || 0), 0),

      // Compliance & Safety
      openIncidents: safetyReports.filter(sr => sr.status === 'open').length,
      criticalIncidents: safetyReports.filter(sr => sr.severity === 'critical' && sr.status === 'open').length,
      expiringCompliance: compliance.filter(c => {
        if (!c.expiry_date) return false;
        const exp = new Date(c.expiry_date);
        return exp >= now && exp <= thirtyDaysFromNow;
      }).length,
      compliancePassRate: compliance.length > 0
        ? Math.round((compliance.filter(c =>
            c.review_status !== 'pending_review' && c.review_status !== 'rejected' &&
            (!c.expiry_date || new Date(c.expiry_date) >= now)
          ).length / compliance.length) * 100)
        : 100,
    };

    return Response.json({ divisionStats, buStats, globalStats, generatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}