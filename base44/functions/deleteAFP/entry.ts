import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * deleteAFP — deletes an AFP and all its line items using the service role
 * to bypass any RLS edge cases. Also clears next_afp_id chain links from any
 * AFPs that pointed to the deleted one.
 *
 * Input:  { afp_id: string }
 * Output: { success, deleted_line_items, chain_links_cleared }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only check
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required to delete AFPs' }, { status: 403 });
    }

    const body = await req.json();
    const { afp_id } = body;
    if (!afp_id) return Response.json({ error: 'afp_id is required' }, { status: 400 });

    // 1. Delete all line items belonging to this AFP
    const items = await base44.asServiceRole.entities.AFPLineItem.filter({ afp_id }, null, 5000);
    let deletedLineItems = 0;
    if (items.length > 0) {
      await base44.asServiceRole.entities.AFPLineItem.deleteMany({ afp_id });
      deletedLineItems = items.length;
    }

    // 2. Delete the AFP itself
    await base44.asServiceRole.entities.AFP.delete(afp_id);

    // 3. Clear chain links from any AFPs pointing to the deleted one
    const chainLinks = await base44.asServiceRole.entities.AFP.filter({ next_afp_id: afp_id }, null, 50);
    for (const link of chainLinks) {
      await base44.asServiceRole.entities.AFP.update(link.id, { next_afp_id: '' });
    }

    return Response.json({
      success: true,
      deleted_line_items: deletedLineItems,
      chain_links_cleared: chainLinks.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}