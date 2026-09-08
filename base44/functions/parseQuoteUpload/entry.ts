import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ---------------------------------------------------------------------------
// parseQuoteUpload — smart quote extraction for the Add Billable Items wizard
// ---------------------------------------------------------------------------
// Accepts an uploaded file URL (PDF or image of a supplier quote), uses the
// Core.ExtractDataFromUploadedFile integration to pull a line-item table
// (description, quantity, unit_price, line_total), then fuzzy-matches each
// description against RateCardItem records so the wizard can flag price
// discrepancies for rectification / query.
//
// Returns: { rows: [{ description, quantity, unit_price, line_total,
//   matched_rate_card_item_id, rate_card_price, price_differs }] }
// ---------------------------------------------------------------------------

export default async function main(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, match_rate_cards = false, supplier_id = '' } = body;

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // 1. Extract structured line items from the uploaded quote document.
    const extractRes = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          line_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                line_total: { type: 'number' },
              },
            },
          },
        },
      },
    });

    const rawItems = (extractRes && extractRes.output && extractRes.output.line_items) || [];
    if (rawItems.length === 0) {
      return Response.json({
        success: false,
        error: 'No line items could be extracted from this document. Please enter items manually.',
        rows: [],
      });
    }

    // Normalise extracted rows
    const rows = rawItems.map((r: any, i: number) => ({
      temp_id: `row_${i}`,
      description: String(r.description || '').trim(),
      quantity: Number(r.quantity) || 1,
      unit_price: Number(r.unit_price) || 0,
      line_total: Number(r.line_total) || (Number(r.quantity) || 1) * (Number(r.unit_price) || 0),
      matched_rate_card_item_id: '',
      rate_card_price: null as number | null,
      price_differs: false,
    })).filter((r: any) => r.description);

    // 2. If requested, fuzzy-match each description against rate card items.
    if (match_rate_cards) {
      // Load rate card items. When a supplier is selected, match against that
      // supplier's rate card; otherwise match against our own company rate card.
      const allRateItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 1000);
      const pool = (allRateItems as any[]).filter((r) => {
        if (supplier_id) return r.rate_card_source === 'supplier' && r.supplier_id === supplier_id && r.is_active !== false;
        return r.rate_card_source !== 'supplier' && r.is_active !== false;
      });

      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

      for (const row of rows) {
        const desc = norm(row.description);
        if (!desc) continue;

        // 1. Exact match
        let match = pool.find((r) => norm(r.description) === desc);
        // 2. Contains (either direction)
        if (!match) match = pool.find((r) => { const d = norm(r.description); return d && d.includes(desc); });
        if (!match) match = pool.find((r) => { const d = norm(r.description); return d && desc.includes(d); });
        // 3. Token recall fuzzy match
        if (!match) {
          const tokens = desc.split(' ').filter((t) => t.length >= 3);
          if (tokens.length > 0) {
            let best: any = null;
            let bestHits = 0;
            for (const r of pool) {
              const rtokens = new Set(norm(r.description).split(' ').filter((t) => t.length >= 3));
              if (rtokens.size === 0) continue;
              let hits = 0;
              for (const t of tokens) if (rtokens.has(t)) hits++;
              if (hits >= 2 && hits > bestHits) { bestHits = hits; best = r; }
            }
            if (best && bestHits / tokens.length >= 0.5) match = best;
          }
        }

        if (match) {
          row.matched_rate_card_item_id = match.id;
          row.rate_card_price = match.price != null ? Number(match.price) : null;
          if (row.rate_card_price != null && row.unit_price > 0) {
            row.price_differs = Math.abs(row.rate_card_price - row.unit_price) > 0.01;
          }
        }
      }
    }

    return Response.json({
      success: true,
      rows,
      extracted_count: rows.length,
      matched_count: rows.filter((r: any) => r.matched_rate_card_item_id).length,
      discrepancy_count: rows.filter((r: any) => r.price_differs).length,
    });
  } catch (error: any) {
    console.error('parseQuoteUpload error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Quote extraction failed',
      rows: [],
    }, { status: 500 });
  }
}