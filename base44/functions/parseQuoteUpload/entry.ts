import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ---------------------------------------------------------------------------
// parseQuoteUpload — smart quote extraction for the Add Billable Items wizard
// ---------------------------------------------------------------------------
// Two modes:
//
//   mode: 'extract' (default)
//     Input:  { file_url, mode: 'extract' }
//     Extracts a raw table (headers + rows) from the uploaded PDF/image quote
//     using ExtractDataFromUploadedFile. Returns raw rows + detected columns
//     so the frontend can render a column-mapping builder.
//     Returns: { success, file_url, raw_text, raw_rows, detected_columns }
//
//   mode: 'match'
//     Input:  { mode: 'match', mapped_rows: [{description, quantity, unit_price,
//             line_total}], supplier_id }
//     Fuzzy-matches each description against RateCardItem records so the wizard
//     can flag price discrepancies.
//     Returns: { success, rows: [{description, quantity, unit_price, line_total,
//              matched_rate_card_item_id, rate_card_price, price_differs}] }
// ---------------------------------------------------------------------------

const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export default async function main(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const mode = body.mode || 'extract';

    // ── MATCH MODE ──────────────────────────────────────────────────────
    if (mode === 'match') {
      const mappedRows = body.mapped_rows || [];
      if (mappedRows.length === 0) {
        return Response.json({ success: false, error: 'No mapped rows provided', rows: [] });
      }

      const supplierId = body.supplier_id || '';
      const allRateItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 1000);
      const pool = (allRateItems as any[]).filter((r) => {
        if (supplierId) return r.rate_card_source === 'supplier' && r.supplier_id === supplierId && r.is_active !== false;
        return r.rate_card_source !== 'supplier' && r.is_active !== false;
      });

      const rows = mappedRows.map((r: any, i: number) => {
        const row: any = {
          temp_id: `row_${i}`,
          description: String(r.description || '').trim(),
          quantity: Number(r.quantity) || 1,
          unit_price: Number(r.unit_price) || 0,
          line_total: Number(r.line_total) || (Number(r.quantity) || 1) * (Number(r.unit_price) || 0),
          matched_rate_card_item_id: '',
          rate_card_price: null as number | null,
          price_differs: false,
        };

        const desc = norm(row.description);
        if (desc) {
          let match: any = null;
          // 1. Exact match
          match = pool.find((r) => norm(r.description) === desc);
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

        return row;
      }).filter((r: any) => r.description);

      return Response.json({
        success: true,
        rows,
        extracted_count: rows.length,
        matched_count: rows.filter((r: any) => r.matched_rate_card_item_id).length,
        discrepancy_count: rows.filter((r: any) => r.price_differs).length,
      });
    }

    // ── EXTRACT MODE (default) ──────────────────────────────────────────
    const { file_url } = body;
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Extract a raw table from the document. We ask for headers + rows (as
    // arrays of arrays) rather than a fixed line_items schema — this is more
    // flexible for arbitrary quote layouts and lets the user map columns.
    const extractRes = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          headers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Column headers from the quote table (e.g. Description, Qty, Unit Price, Total)',
          },
          rows: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'string' },
              description: 'A single data row — one cell per column, in the same order as headers',
            },
            description: 'All data rows from the quote table',
          },
          raw_text: {
            type: 'string',
            description: 'The full plain-text content of the document (fallback if table extraction is incomplete)',
          },
        },
      },
    });

    const output = extractRes?.output || {};
    const headers: string[] = (output.headers || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    const rawRows: string[][] = output.rows || [];
    const rawText: string = output.raw_text || '';

    // Convert the headers + rows into an array of objects keyed by column name.
    // When headers are missing, generate placeholder column names (Col 1, Col 2…).
    const detectedColumns = headers.length > 0
      ? headers
      : (rawRows[0] || []).map((_: any, i: number) => `Column ${i + 1}`);

    const rawRowObjects = rawRows
      .filter((row: string[]) => Array.isArray(row) && row.some((cell: string) => String(cell || '').trim()))
      .map((row: string[]) => {
        const obj: Record<string, string> = {};
        detectedColumns.forEach((col: string, i: number) => {
          obj[col] = String(row[i] || '').trim();
        });
        return obj;
      });

    if (rawRowObjects.length === 0 && !rawText) {
      return Response.json({
        success: false,
        error: 'No content could be extracted from this document. Please enter items manually.',
        file_url,
        raw_text: '',
        raw_rows: [],
        detected_columns: [],
      });
    }

    return Response.json({
      success: true,
      file_url,
      raw_text: rawText,
      raw_rows: rawRowObjects,
      detected_columns: detectedColumns,
      row_count: rawRowObjects.length,
    });
  } catch (error: any) {
    console.error('parseQuoteUpload error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Quote extraction failed',
      raw_text: '',
      raw_rows: [],
      detected_columns: [],
    }, { status: 500 });
  }
}