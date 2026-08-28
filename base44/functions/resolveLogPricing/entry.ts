import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// resolveLogPricing — hybrid keyword → rate card matcher
// ============================================================
// Consults the KeywordRateMapping dictionary first (exact,
// case-insensitive, division-scoped), then falls back to fuzzy
// description matching against RateCardItem descriptions.
//
// Returns a confidence score + suggested rate card item.
// High-confidence (≥0.8) matches auto-price; low-confidence
// land in the Pricing Review queue.
//
// Invoked from stampBillingCharge (on log create) and from the
// review queue confirm action (which teaches the dictionary).

const HIGH_CONFIDENCE_THRESHOLD = 0.8;

// Common drilling/site terms that appear in many rate card descriptions.
// These are weighted lower so rare, specific tokens (e.g. "coreliner",
// "borehole", "SPT") dominate the match score instead of generic words.
const STOP_WORDS = new Set([
  'rig', 'crew', 'site', 'to', 'and', 'the', 'a', 'of', 'for', 'on',
  'with', 'cp', 'rotary', 'mobilise', 'mobilisation', 'mobilized',
  'per', 'nr', 'no', 'unit', 'item', 'day', 'hour', 'sum', 'm',
  'work', 'works', 'equipment', 'plant', 'hire',
]);

function normalize(s: string): string {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Word-boundary check: does `desc` contain `keyword` as a whole word/phrase?
// Prevents "core" matching "coreliner" or "hardcore".
function containsWordBoundary(desc: string, keyword: string): boolean {
  if (!desc || !keyword) return false;
  // Escape regex special chars
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i');
  return re.test(desc);
}

// Weighted Jaccard-style fuzzy score (0–1).
// Rare tokens (not in STOP_WORDS) carry more weight than common ones,
// so a match on "coreliner" beats a match on "rig" + "site".
// Requires a minimum token length of 3 to avoid tiny fragments.
function fuzzyScore(keyword: string, description: string): number {
  const k = normalize(keyword);
  const d = normalize(description);
  if (!k || !d) return 0;

  // Exact phrase match with word boundaries — high confidence
  if (containsWordBoundary(d, k) && k.length >= 4) return 0.92;

  const kTokens = k.split(' ').filter(t => t.length >= 3);
  const dTokens = d.split(' ').filter(t => t.length >= 3);
  if (kTokens.length === 0 || dTokens.length === 0) return 0;

  const dSet = new Set(dTokens);
  let weightedHits = 0;
  let weightedTotal = 0;
  for (const t of kTokens) {
    const weight = STOP_WORDS.has(t) ? 0.3 : 1.0;
    weightedTotal += weight;
    if (dSet.has(t)) weightedHits += weight;
  }
  if (weightedTotal === 0) return 0;

  // Jaccard denominator: penalise vague descriptions that match everything
  const unionSize = new Set([...kTokens, ...dTokens]).size;
  const jaccard = weightedHits / Math.max(weightedTotal, unionSize * 0.5);
  return Math.min(0.85, Math.round(jaccard * 100) / 100);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { description, division_id, log_id, confirm_mapping } = body;

    if (!description) {
      return Response.json({ ok: false, error: 'description required' }, { status: 400 });
    }

    const desc = normalize(description);

    // ── Confirm mode: billing team confirms a match, teaching the dictionary ──
    if (confirm_mapping && log_id) {
      const { rate_card_item_id, keyword, category } = body;
      if (!rate_card_item_id || !keyword) {
        return Response.json({ ok: false, error: 'rate_card_item_id and keyword required to confirm' }, { status: 400 });
      }
      // Upsert the dictionary entry
      const existing = await base44.asServiceRole.entities.KeywordRateMapping.filter({ keyword: normalize(keyword) });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.KeywordRateMapping.update(existing[0].id, {
          rate_card_item_id,
          category: category || existing[0].category,
          confidence_score: 1.0,
          is_confirmed: true,
          created_by: body.confirmed_by || 'system',
        });
      } else {
        await base44.asServiceRole.entities.KeywordRateMapping.create({
          keyword: normalize(keyword),
          rate_card_item_id,
          category: category || 'drilling',
          confidence_score: 1.0,
          is_confirmed: true,
          division_id: division_id || undefined,
          created_by: body.confirmed_by || 'system',
        });
      }
      // Mark the log as reviewed
      await base44.asServiceRole.entities.InvestigationLog.update(log_id, {
        pricing_review_status: 'reviewed',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: body.confirmed_by || 'billing',
      });
      return Response.json({ ok: true, confirmed: true, keyword: normalize(keyword) });
    }

    // ── Match mode: find the best rate card item for this description ──

    // 1. Dictionary lookup (exact, case-insensitive, division-scoped)
    const dictEntries = await base44.asServiceRole.entities.KeywordRateMapping.list('confidence_score', 500);
    // Prefer division-specific + confirmed entries
    const scoped = dictEntries.filter(e =>
      (e.is_confirmed !== false) &&
      (e.division_id === division_id || !e.division_id)
    );

    let bestDictMatch = null;
    for (const entry of scoped) {
      const kw = normalize(entry.keyword);
      if (desc === kw || desc.includes(kw)) {
        if (!bestDictMatch || entry.confidence_score >= bestDictMatch.confidence_score) {
          bestDictMatch = entry;
        }
      }
    }

    if (bestDictMatch) {
      const confidence = Math.max(HIGH_CONFIDENCE_THRESHOLD, Number(bestDictMatch.confidence_score) || 0.8);
      // Increment match count
      try {
        await base44.asServiceRole.entities.KeywordRateMapping.update(bestDictMatch.id, {
          match_count: (Number(bestDictMatch.match_count) || 0) + 1,
          last_matched_at: new Date().toISOString(),
        });
      } catch (_) { /* non-fatal */ }

      // Fetch the rate card item for the price
      const rci = await base44.asServiceRole.entities.RateCardItem.get(bestDictMatch.rate_card_item_id);
      return Response.json({
        ok: true,
        matched: true,
        rate_card_item_id: bestDictMatch.rate_card_item_id,
        unit_price: rci?.price || rci?.cost_price || 0,
        unit: rci?.unit || 'sum',
        category: bestDictMatch.category,
        confidence,
        source: 'dictionary',
        auto_price: confidence >= HIGH_CONFIDENCE_THRESHOLD,
      });
    }

    // 2. Fuzzy fallback — match against RateCardItem descriptions
    // Filter by division when possible so a Geotechnical log doesn't match
    // a Land & Water rate card item. Division-blank items are always included.
    const allRateCardItems = await base44.asServiceRole.entities.RateCardItem.filter({ is_active: true });
    const rateCardItems = division_id
      ? allRateCardItems.filter(r => !r.division_id || r.division_id === division_id)
      : allRateCardItems;
    let bestFuzzy = null;
    let bestScore = 0;
    for (const rci of rateCardItems) {
      const score = fuzzyScore(description, rci.description);
      if (score > bestScore) {
        bestScore = score;
        bestFuzzy = rci;
      }
    }

    if (bestFuzzy && bestScore >= 0.5) {
      return Response.json({
        ok: true,
        matched: true,
        rate_card_item_id: bestFuzzy.id,
        unit_price: bestFuzzy.price || bestFuzzy.cost_price || 0,
        unit: bestFuzzy.unit || 'sum',
        category: bestFuzzy.category || 'drilling',
        confidence: bestScore,
        source: 'fuzzy',
        auto_price: bestScore >= HIGH_CONFIDENCE_THRESHOLD,
        suggested_rate_card_item_id: bestFuzzy.id,
      });
    }

    // 3. No match — pending review
    return Response.json({
      ok: true,
      matched: false,
      confidence: 0,
      source: 'none',
      auto_price: false,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}