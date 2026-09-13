import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveFromSnapshot, loadActiveContract } from '../../shared/rateResolver.ts';
import { loadJobRateCardItems, preTokenizeRateItems, findBestMatchFast } from '../../shared/jobRateMatcher.ts';

/**
 * repriceAFPFromRateCard — re-resolves all auto-populated (non-manual)
 * AFPLineItems against the current rate card, updating rate/amount/
 * original_amount/agreed_amount in place.
 *
 * Use case: rate cards may have been edited after driller logs were stamped.
 * This lets the billing team refresh the AFP to reflect the latest rates
 * with one click, preserving manual items and dispute statuses.
 *
 * Disputed/counter-offered/agreed items are NOT re-priced (they're in
 * active negotiation — re-pricing would reset the agreed amount).
 *
 * Optimized: pre-loads rate card items ONCE and uses the fast pre-tokenized
 * matcher across all line items, instead of calling resolveRate per item
 * (which re-fetches the rate card from the API every time).
 *
 * Input:  { afp_id: string }
 * Output: { success, repriced, skipped, total }
 */

function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { afp_id } = body;
    if (!afp_id) return Response.json({ error: 'afp_id is required' }, { status: 400 });

    const afp = await base44.entities.AFP.get(afp_id);
    if (!afp) return Response.json({ error: 'AFP not found' }, { status: 404 });
    if (afp.status !== 'draft') {
      return Response.json({ error: 'Only draft AFPs can be re-priced' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(afp.job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const activeContract = await loadActiveContract(base44.asServiceRole, afp.job_id);
    const lineItems = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);

    // ── Pre-load rate card items ONCE (job-scoped + global) ──
    // This avoids 268+ individual API calls when repricing a large AFP.
    const jobDate = afp.period_start_date || job.start_date || null;
    const rateCardItems = await loadJobRateCardItems(base44, afp.job_id, jobDate);
    const preTokenized = preTokenizeRateItems(rateCardItems);

    let repriced = 0;
    let skipped = 0;
    const updates: any[] = [];

    for (const li of lineItems) {
      // Skip manual items — billing team set those deliberately
      if (li.is_manual || li.source === 'manual') {
        skipped++;
        continue;
      }
      // Skip items in active dispute negotiation — don't override agreed amounts
      if (li.dispute_status === 'disputed' || li.dispute_status === 'counter_offered' || li.dispute_status === 'agreed') {
        skipped++;
        continue;
      }
      // Skip items without a description to match against
      if (!li.item) {
        skipped++;
        continue;
      }

      const qty = toNum(li.qty) || 1;
      const desc = String(li.item);

      // Level 1 — contract snapshot (frozen rates)
      let resolved = null;
      if (activeContract?.rate_snapshot) {
        resolved = resolveFromSnapshot(desc, activeContract.rate_snapshot, qty);
      }

      // Level 2 + 3 — job / global rate cards (fast pre-tokenized matcher)
      if (!resolved) {
        const match = findBestMatchFast(desc, preTokenized);
        if (match) {
          const unitPrice = Number(match.price) || 0;
          resolved = {
            total: Math.round(unitPrice * qty * 100) / 100,
            unit_price: unitPrice,
          };
        }
      }

      if (resolved && resolved.total > 0) {
        const newRate = qty > 0 ? Math.round((resolved.total / qty) * 100) / 100 : resolved.unit_price;
        updates.push({
          id: li.id,
          rate: newRate,
          amount: resolved.total,
          original_amount: resolved.total,
          agreed_amount: resolved.total,
        });
        repriced++;
      } else {
        // No rate card match — leave as-is (don't zero it out)
        skipped++;
      }
    }

    // Apply updates in bulk
    if (updates.length > 0) {
      await base44.entities.AFPLineItem.bulkUpdate(updates);
    }

    // Recalculate AFP totals from all line items
    const refreshed = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const total = refreshed.reduce((s, li) => s + toNum(li.amount), 0);
    const agreedTotal = refreshed
      .filter(li => li.dispute_status !== 'rejected')
      .reduce((s, li) => s + toNum(li.agreed_amount || li.amount), 0);

    await base44.entities.AFP.update(afp_id, {
      total_claimed: total,
      original_total: total,
      agreed_total: agreedTotal,
      last_updated_at: new Date().toISOString(),
      last_updated_by: user.full_name || user.email || 'System',
    });

    return Response.json({
      success: true,
      repriced,
      skipped,
      total,
      agreed_total: agreedTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}