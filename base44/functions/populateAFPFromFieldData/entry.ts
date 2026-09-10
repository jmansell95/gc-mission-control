import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { bulkPopulateAFP } from '../../shared/afpPopulation.ts';

/**
 * populateAFPFromFieldData — user-invoked "Refresh from Field Data" action.
 *
 * Delegates to the shared bulkPopulateAFP module (also used by the
 * autoPopulateNewAFP entity automation) so the bulk logic is defined once.
 *
 * Input:  { afp_id: string }
 * Output: { success, populated, sources, total }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { afp_id } = body;
    if (!afp_id) return Response.json({ error: 'afp_id is required' }, { status: 400 });

    // EWR jobs: the uploaded AFP Excel file IS the AFP data — skip field-data
    // populate (which creates legacy sheet_name='drilling' items that don't
    // appear in the EWR-specific sheet tabs).
    const afps = await base44.entities.AFP.filter({ id: afp_id });
    const afp = afps[0];
    if (afp?.job_id) {
      const jobs = await base44.entities.Job.filter({ id: afp.job_id });
      const job = jobs[0];
      if (job && /\b(ewr|east\s*west\s*rail)\b/i.test(job.name || '')) {
        return Response.json({ skipped: 'ewr_job', message: 'EWR jobs use the uploaded AFP file directly — field data populate is skipped.' });
      }
    }

    const userName = user.full_name || user.email || 'System';
    const result = await bulkPopulateAFP(base44, afp_id, userName);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}