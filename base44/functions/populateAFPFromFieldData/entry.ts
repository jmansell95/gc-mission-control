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

    const userName = user.full_name || user.email || 'System';
    const result = await bulkPopulateAFP(base44, afp_id, userName);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}