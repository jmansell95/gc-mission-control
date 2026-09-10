import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getPortalJobs — returns all jobs a logged-in portal user
// (client or subcontractor) has access to. Access is determined
// by matching the user's id against the portal_user_id field
// on Client and Contractor records.
//
// Called from the PortalDashboard page when a client or
// subcontractor logs in.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find all clients where portal_user_id == user.id
    const clients = await base44.asServiceRole.entities.Client.filter({ portal_user_id: user.id });
    const clientIds = (clients || []).map((c: any) => c.id);

    // Find all contractors where portal_user_id == user.id
    const contractors = await base44.asServiceRole.entities.Contractor.filter({ portal_user_id: user.id });
    const contractorIds = (contractors || []).map((c: any) => c.id);

    if (clientIds.length === 0 && contractorIds.length === 0) {
      return Response.json({ jobs: [], role: null, user_name: user.full_name || user.email || '' });
    }

    // Fetch all jobs and filter to those linked to this user's clients/contractors
    const allJobs = await base44.asServiceRole.entities.Job.list(500);
    const portalJobs = (allJobs || []).filter((j: any) =>
      (j.client_id && clientIds.includes(j.client_id)) ||
      (j.contractor_id && contractorIds.includes(j.contractor_id))
    );

    // Determine role (client takes precedence if both exist)
    const role = clientIds.length > 0 ? 'client' : 'subcontractor';

    return Response.json({
      jobs: portalJobs.map((j: any) => ({
        id: j.id,
        name: j.name,
        job_reference: j.job_reference || '',
        status: j.status,
        start_date: j.start_date || '',
        end_date: j.end_date || '',
        location: j.location || '',
        portal_enabled: j.portal_enabled || false,
        portal_sections: j.portal_sections || null,
        client_id: j.client_id || '',
        contractor_id: j.contractor_id || '',
      })),
      role,
      user_name: user.full_name || user.email || '',
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}