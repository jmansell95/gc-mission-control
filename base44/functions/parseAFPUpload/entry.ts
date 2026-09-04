import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr } from '../../shared/cvrHelpers.ts';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * parseAFPUpload — fetches the Lump Sum AFP Excel file, parses ALL sheets
 * (Valuation Summary, Measured Works, Variation Summary, Field Sheet,
 * CI01-03 compensation items, Materials On site) deterministically using
 * SheetJS, and returns a structured preview including the proposed multi-AFP
 * split (period boundaries + per-AFP line counts).
 *
 * The Field Sheet's daily date columns are parsed to extract per-day quantities
 * per activity. These are grouped into monthly AFP periods so historical data
 * can be split into chained AFPs.
 *
 * Input:  { file_url: string }
 * Output: { preview: { contract_details, measured_works, variations, materials, compensation_items, field_sheet_activities, afp_split } }
 */

function findHeaderRow(rows, keywords, startIdx = 0) {
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      const l = String(cell || '').toLowerCase().trim();
      if (keywords.some(kw => l === kw || l.includes(kw))) return i;
    }
  }
  return -1;
}

function colIdx(headerRow, exact, includes) {
  for (let c = 0; c < headerRow.length; c++) {
    const l = String(headerRow[c] || '').toLowerCase().trim();
    if (exact && exact.some(e => l === e)) return c;
  }
  for (let c = 0; c < headerRow.length; c++) {
    const l = String(headerRow[c] || '').toLowerCase().trim();
    if (includes && includes.some(inc => l.includes(inc))) return c;
  }
  return -1;
}

// Parse a date header cell (could be a Date object, ISO string, or Excel serial)
function parseDateHeader(val): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  // Excel serial date number (raw: true without cellDates returns these)
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // ISO date
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY
  const ukMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukMatch) {
    const dd = ukMatch[1].padStart(2, '0'), mm = ukMatch[2].padStart(2, '0'), yyyy = ukMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Group dates into monthly periods (YYYY-MM), return sorted period keys
function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Could not download AFP file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array', cellDates: true });

    const preview: any = {
      contract_details: {},
      measured_works: [],
      variations: [],
      materials: [],
      compensation_items: [],
      field_sheet_activities: [],
      afp_split: [],
    };

    // ── Valuation Summary sheet (job metadata) ──
    const vsName = workbook.SheetNames.find(n => /valuation\s*summary/i.test(n));
    if (vsName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[vsName], { header: 1, raw: true, defval: null, blankrows: false });
      const details: any = {};

      // A cell is "label-like" (not a real value) if it ends with ':' or is a
      // bracketed placeholder like "[Owner Name]". Used to filter out label
      // cells that the look-ahead would otherwise pick up as values.
      const isLabelLike = (val: any): boolean => {
        if (val == null) return true;
        const s = String(val).toLowerCase().trim();
        if (!s) return true;
        if (s.endsWith(':')) return true;
        if (s.startsWith('[') && s.endsWith(']')) return true;
        return false;
      };

      // Find a value cell for a label at (rowIdx, col).
      // First scans the same row (next 3 cols), then falls back to the NEXT row
      // at the same column + following 3 cols — the Valuation Summary sheet
      // places values in the row below their label (e.g. "Client:" in row 2,
      // "Card Geotechnical Ltd" in row 3 col 0). Label-like cells are skipped.
      const findValCell = (rowIdx: number, col: number): any => {
        // Same row: scan next 3 cols, but STOP if we hit another label
        // (the value belongs to that label, not ours).
        const row = rows[rowIdx];
        if (row) {
          for (let c2 = col + 1; c2 < Math.min(row.length, col + 4); c2++) {
            if (row[c2] == null || row[c2] === '') continue;
            if (isLabelLike(row[c2])) break;
            return row[c2];
          }
        }
        // Next row: scan ONLY the same column (label-below-value pattern).
        const nextRow = rows[rowIdx + 1];
        if (nextRow && col < nextRow.length && nextRow[col] != null && nextRow[col] !== '' && !isLabelLike(nextRow[col])) {
          return nextRow[col];
        }
        return null;
      };

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cellVal = row[c];
          if (cellVal == null || cellVal === '') continue;
          // Normalise label: strip trailing colons so "Client:" matches "client"
          const l = String(cellVal).toLowerCase().trim().replace(/:$/, '').trim();
          const valCell = findValCell(r, c);
          if (!valCell) continue;
          if (l.includes('project name')) details.project_name = String(valCell).trim();
          else if (l.includes('gcl') || l.includes('job no')) {
            const vc = String(valCell).trim();
            if (!vc.includes(':') && !vc.toLowerCase().includes('project') && !vc.toLowerCase().includes('works')) {
              details.gc_job_number = vc;
            }
          }
          else if (l === 'client') details.client = String(valCell).trim();
          else if (l.includes('order no') || l.includes('purchase order')) details.client_purchase_order = String(valCell).trim();
          else if (l.includes('contact address')) details.contact_address = String(valCell).trim();
          else if (l.includes('payment due')) details.payment_due_date = toDateStr(valCell);
          else if (l.includes('contract award') || l.includes('contract value')) details.contract_award_value = toNum(valCell);
          else if (l.includes('date') && !l.includes('payment')) {
            const d = toDateStr(valCell);
            if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) details.date = d;
          }
        }
        if (row[0] && /^PRJ-/i.test(String(row[0]).trim())) details.gc_job_number = String(row[0]).trim();
      }

      // Parse the Contract Sum table (row with "Contract Sum" header, then
      // "Measured Works" data row below it). The contract award value is the
      // Contract Sum column value for the Measured Works row.
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const contractSumCol = row.findIndex((cell: any) =>
          cell != null && String(cell).toLowerCase().trim().includes('contract sum')
        );
        if (contractSumCol < 0) continue;
        // Find the "Measured Works" data row in the next few rows
        for (let r2 = r + 1; r2 < Math.min(rows.length, r + 6); r2++) {
          const dataRow = rows[r2];
          if (!dataRow || !dataRow[0]) continue;
          const rowLabel = String(dataRow[0]).toLowerCase().trim();
          if (rowLabel.includes('measured works')) {
            const val = toNum(dataRow[contractSumCol]);
            if (val > 0) details.contract_award_value = val;
            break;
          }
        }
        break;
      }
      // Fallback: scan for a GCL/I-prefixed job number in col 0 (e.g. "I260219")
      if (!details.gc_job_number || details.gc_job_number.includes(':')) {
        for (const row of rows) {
          if (!row || !row[0]) continue;
          const v = String(row[0]).trim();
          if (/^[A-Z]\d{4,}/i.test(v) || /^I\d+/i.test(v)) { details.gc_job_number = v; break; }
        }
      }
      preview.contract_details = details;
    }

    // ── Measured Works sheet (main line items — full three-column-group structure) ──
    const mwName = workbook.SheetNames.find(n => /measured\s*works/i.test(n));
    if (mwName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[mwName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const itemRefCol = colIdx(headerRow, ['item ref', 'item ref:'], ['item ref']);
        const descCol = colIdx(headerRow, ['description'], ['description']);
        const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const rateCol = colIdx(headerRow, ['rate'], ['rate']);
        const sumCol = colIdx(headerRow, ['sum'], ['sum']);
        // Application in the Period
        const qtyCompleteCol = colIdx(headerRow, ['qty\ncomplete', 'qty complete'], ['qty complete', 'qty\ncomplete']);
        const grossAppliedCol = colIdx(headerRow, ['gross\n applied', 'gross applied'], ['gross applied', 'gross\n applied']);
        const prevAppliedCol = colIdx(headerRow, ['previous applied'], ['previous applied']);
        const appliedInPeriodCol = colIdx(headerRow, ['applied in period'], ['applied in period']);
        // Client Assessment in the Period
        const assessedMeasureCol = colIdx(headerRow, ['assessed measure'], ['assessed measure']);
        const grossAssessedCol = colIdx(headerRow, ['gross assessed'], ['gross assessed']);
        const prevAssessedCol = colIdx(headerRow, ['previous assessed'], ['previous assessed']);
        const assessedInPeriodCol = colIdx(headerRow, ['assessed in period'], ['assessed in period']);
        // Balance Remaining
        const balanceQtyCol = colIdx(headerRow, null, ['balance']);
        const commentsCol = colIdx(headerRow, ['comments'], ['comments']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const itemRef = itemRefCol >= 0 ? String(row[itemRefCol] || '').trim() : '';
          if (!desc && !itemRef) continue;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const rate = rateCol >= 0 ? toNum(row[rateCol]) : 0;
          const amount = sumCol >= 0 ? toNum(row[sumCol]) : qty * rate;
          if (qty === 0 && rate === 0 && amount === 0) {
            // Still capture if it has applied/assessed data
            const applied = appliedInPeriodCol >= 0 ? toNum(row[appliedInPeriodCol]) : 0;
            if (applied === 0) continue;
          }
          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';

          preview.measured_works.push({
            item_ref: itemRef,
            item: desc,
            unit,
            qty,
            rate,
            amount,
            qty_complete: qtyCompleteCol >= 0 ? toNum(row[qtyCompleteCol]) : 0,
            gross_applied: grossAppliedCol >= 0 ? toNum(row[grossAppliedCol]) : 0,
            previous_applied: prevAppliedCol >= 0 ? toNum(row[prevAppliedCol]) : 0,
            applied_in_period: appliedInPeriodCol >= 0 ? toNum(row[appliedInPeriodCol]) : 0,
            assessed_qty: assessedMeasureCol >= 0 ? toNum(row[assessedMeasureCol]) : 0,
            gross_assessed: grossAssessedCol >= 0 ? toNum(row[grossAssessedCol]) : 0,
            previous_assessed: prevAssessedCol >= 0 ? toNum(row[prevAssessedCol]) : 0,
            assessed_in_period: assessedInPeriodCol >= 0 ? toNum(row[assessedInPeriodCol]) : 0,
            balance_qty: balanceQtyCol >= 0 ? toNum(row[balanceQtyCol]) : 0,
            comments: commentsCol >= 0 ? String(row[commentsCol] || '').trim() : '',
          });
        }
      }
    }

    // ── Variation Summary sheet (full structure + cost-agreement lifecycle) ──
    const varName = workbook.SheetNames.find(n => /variation\s*summary/i.test(n));
    if (varName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[varName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const voRefCol = colIdx(headerRow, ['vo ref', 'vo ref:'], ['vo ref']);
        const dateCol = colIdx(headerRow, ['date', 'date:'], ['date']);
        const refCol = colIdx(headerRow, ['ref'], ['ref']);
        const descCol = colIdx(headerRow, ['description'], ['description']);
        const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const rateCol = colIdx(headerRow, ['rate'], ['rate']);
        const totalCostCol = colIdx(headerRow, ['total cost'], ['total cost']);
        const timeImpactCol = colIdx(headerRow, ['time impact'], ['time impact']);
        const daysCol = colIdx(headerRow, ['days'], ['days']);
        const appliedInPeriodCol = colIdx(headerRow, ['applied in period'], ['applied in period']);
        const assessedInPeriodCol = colIdx(headerRow, ['assess in period', 'assessed in period'], ['assess in period', 'assessed in period']);
        const commentsCol = colIdx(headerRow, ['comments'], ['comments']);
        // Cost-agreement lifecycle dates
        const budgetCostDateCol = colIdx(headerRow, ['budget cost issue date'], ['budget cost issue']);
        const firmCostDateCol = colIdx(headerRow, ['firm cost\nissue date', 'firm cost issue date'], ['firm cost issue', 'firm cost\nissue']);
        const clientAssessmentDateCol = colIdx(headerRow, ['client assessment issue date'], ['client assessment issue']);
        const costAgreedDateCol = colIdx(headerRow, ['cost agreed date'], ['cost agreed']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const voRef = voRefCol >= 0 ? String(row[voRefCol] || '').trim() : '';
          if (!desc && !voRef) continue;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const rate = rateCol >= 0 ? toNum(row[rateCol]) : 0;
          if (!desc && !voRef && qty === 0 && rate === 0) continue;

          const timeImpactRaw = timeImpactCol >= 0 ? String(row[timeImpactCol] || '').toLowerCase().trim() : '';
          preview.variations.push({
            vo_ref: voRef,
            vo_date: dateCol >= 0 ? toDateStr(row[dateCol]) : null,
            ref: refCol >= 0 ? String(row[refCol] || '').trim() : '',
            description: desc,
            unit: unitCol >= 0 ? String(row[unitCol] || '').trim() : '',
            qty,
            rate,
            total_cost: totalCostCol >= 0 ? toNum(row[totalCostCol]) : qty * rate,
            time_impact: timeImpactRaw === 'yes' || timeImpactRaw === 'y',
            time_impact_days: daysCol >= 0 ? toNum(row[daysCol]) : 0,
            applied_in_period: appliedInPeriodCol >= 0 ? toNum(row[appliedInPeriodCol]) : 0,
            assessed_in_period: assessedInPeriodCol >= 0 ? toNum(row[assessedInPeriodCol]) : 0,
            budget_cost_issue_date: budgetCostDateCol >= 0 ? toDateStr(row[budgetCostDateCol]) : null,
            firm_cost_issue_date: firmCostDateCol >= 0 ? toDateStr(row[firmCostDateCol]) : null,
            client_assessment_issue_date: clientAssessmentDateCol >= 0 ? toDateStr(row[clientAssessmentDateCol]) : null,
            cost_agreed_date: costAgreedDateCol >= 0 ? toDateStr(row[costAgreedDateCol]) : null,
            comments: commentsCol >= 0 ? String(row[commentsCol] || '').trim() : '',
          });
        }
      }
    }

    // ── Field Sheet (daily activity data — date columns as headers) ──
    // Parses per-day quantities per activity. These drive the multi-AFP split.
    const fsName = workbook.SheetNames.find(n => /field\s*sheet/i.test(n));
    if (fsName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[fsName], { header: 1, raw: true, defval: null, blankrows: false });
      // Header row contains "Activity" or "Description"
      const headerIdx = findHeaderRow(rows, ['activity', 'description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const itemCol = colIdx(headerRow, ['item', 'item:'], ['item']);
        const activityCol = colIdx(headerRow, ['activity'], ['activity']);
        const descCol = colIdx(headerRow, ['description'], ['description']);
        const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const rateCol = colIdx(headerRow, ['rate'], ['rate']);
        const amountsCol = colIdx(headerRow, ['amounts'], ['amounts']);

        // Identify date columns — scan the header row AND all rows above it
        // (Lump Sum Field Sheets have a two-row header: dates in row 0, column
        // names in the header row).
        const dateCols: { col: number; date: string }[] = [];
        const seen = new Set<number>();
        for (let c = 0; c < headerRow.length; c++) {
          const d = parseDateHeader(headerRow[c]);
          if (d && !seen.has(c)) { dateCols.push({ col: c, date: d }); seen.add(c); }
        }
        for (let r = 0; r < headerIdx && dateCols.length === 0; r++) {
          const row0 = rows[r];
          if (!row0) continue;
          for (let c = 0; c < row0.length; c++) {
            if (seen.has(c)) continue;
            const d = parseDateHeader(row0[c]);
            if (d) { dateCols.push({ col: c, date: d }); seen.add(c); }
          }
        }

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const activity = activityCol >= 0 ? String(row[activityCol] || '').trim() : '';
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
          if (!activity && !desc && !item) continue;
          // Skip section headers (no date data)
          const hasDateData = dateCols.some(({ col }) => toNum(row[col]) > 0);
          const totalQty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          if (!hasDateData && totalQty === 0) continue;

          const daily: Record<string, number> = {};
          for (const { col, date } of dateCols) {
            const v = toNum(row[col]);
            if (v > 0) daily[date] = v;
          }
          preview.field_sheet_activities.push({
            item,
            activity,
            description: desc || activity,
            unit: unitCol >= 0 ? String(row[unitCol] || '').trim() : '',
            rate: rateCol >= 0 ? toNum(row[rateCol]) : 0,
            total_qty: totalQty || Object.values(daily).reduce((s, v) => s + v, 0),
            total_amount: amountsCol >= 0 ? toNum(row[amountsCol]) : 0,
            daily,
          });
        }
      }
    }

    // ── Compensation Item sheets (CI01, CI02, CI03) ──
    // Same date-column structure as the Field Sheet.
    const ciSheetNames = workbook.SheetNames.filter(n => /^CI\d{2}$/i.test(n.trim()));
    for (const ciName of ciSheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[ciName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['activity', 'description', 'delivery date'], 0);
      if (headerIdx < 0) continue;
      const headerRow = rows[headerIdx];
      const itemCol = colIdx(headerRow, ['item', 'item:'], ['item']);
      const activityCol = colIdx(headerRow, ['activity', 'delivery date'], ['activity', 'delivery date']);
      const descCol = colIdx(headerRow, ['description'], ['description']);
      const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
      const unitCol = colIdx(headerRow, ['unit'], ['unit']);
      const rateCol = colIdx(headerRow, ['rate'], ['rate']);
      const amountsCol = colIdx(headerRow, ['amounts'], ['amounts']);

      const dateCols: { col: number; date: string }[] = [];
      const seen = new Set<number>();
      for (let c = 0; c < headerRow.length; c++) {
        const d = parseDateHeader(headerRow[c]);
        if (d && !seen.has(c)) { dateCols.push({ col: c, date: d }); seen.add(c); }
      }
      for (let r = 0; r < headerIdx && dateCols.length === 0; r++) {
        const row0 = rows[r];
        if (!row0) continue;
        for (let c = 0; c < row0.length; c++) {
          if (seen.has(c)) continue;
          const d = parseDateHeader(row0[c]);
          if (d) { dateCols.push({ col: c, date: d }); seen.add(c); }
        }
      }

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const activity = activityCol >= 0 ? String(row[activityCol] || '').trim() : '';
        const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
        const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
        if (!activity && !desc && !item) continue;
        const totalQty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
        const daily: Record<string, number> = {};
        for (const { col, date } of dateCols) {
          const v = toNum(row[col]);
          if (v > 0) daily[date] = v;
        }
        const hasData = totalQty > 0 || Object.values(daily).reduce((s, v) => s + v, 0) > 0;
        if (!hasData) continue;
        preview.compensation_items.push({
          sheet: ciName.trim().toUpperCase(),
          item,
          activity,
          description: desc || activity,
          unit: unitCol >= 0 ? String(row[unitCol] || '').trim() : '',
          rate: rateCol >= 0 ? toNum(row[rateCol]) : 0,
          total_qty: totalQty,
          total_amount: amountsCol >= 0 ? toNum(row[amountsCol]) : 0,
          daily,
        });
      }
    }

    // ── Materials On site sheet ──
    const matName = workbook.SheetNames.find(n => /materials?\s*on\s*site|medicals/i.test(n));
    if (matName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[matName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const itemCol = colIdx(headerRow, ['item', 'item:'], ['item']);
        const descCol = colIdx(headerRow, ['description', 'description:'], ['description']);
        const qtyCol = colIdx(headerRow, ['quantity'], ['quantity']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const costCol = colIdx(headerRow, ['cost'], ['cost']);
        const assessedCol = colIdx(headerRow, ['client assessed'], ['client assessed']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
          if (!desc && !item) continue;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const cost = costCol >= 0 ? toNum(row[costCol]) : 0;
          if (!desc && !item && qty === 0 && cost === 0) continue;
          preview.materials.push({
            item,
            description: desc,
            unit: unitCol >= 0 ? String(row[unitCol] || '').trim() : '',
            qty,
            cost,
            assessed: assessedCol >= 0 ? toNum(row[assessedCol]) : 0,
          });
        }
      }
    }

    // ── Build the multi-AFP split from all dates found ──
    // Collect every date referenced across Field Sheet, Compensation Items, and Variations.
    const allDates = new Set<string>();
    for (const act of preview.field_sheet_activities) {
      for (const d of Object.keys(act.daily || {})) allDates.add(d);
    }
    for (const ci of preview.compensation_items) {
      for (const d of Object.keys(ci.daily || {})) allDates.add(d);
    }
    for (const v of preview.variations) {
      if (v.vo_date) allDates.add(v.vo_date);
    }

    if (allDates.size > 0) {
      // Group into monthly periods
      const monthGroups: Record<string, string[]> = {};
      for (const d of allDates) {
        const mk = monthKeyOf(d);
        if (!monthGroups[mk]) monthGroups[mk] = [];
        monthGroups[mk].push(d);
      }
      const sortedMonths = Object.keys(monthGroups).sort();
      preview.afp_split = sortedMonths.map((mk, i) => {
        const dates = monthGroups[mk].sort();
        const periodStart = dates[0];
        const periodEnd = dates[dates.length - 1];
        // Count lines that fall in this period
        let mwCount = 0, varCount = 0, ciCount = 0;
        for (const act of preview.field_sheet_activities) {
          const inPeriod = Object.keys(act.daily || {}).some(d => monthKeyOf(d) === mk);
          if (inPeriod) mwCount++;
        }
        for (const v of preview.variations) {
          if (v.vo_date && monthKeyOf(v.vo_date) === mk) varCount++;
        }
        for (const ci of preview.compensation_items) {
          const inPeriod = Object.keys(ci.daily || {}).some(d => monthKeyOf(d) === mk);
          if (inPeriod) ciCount++;
        }
        return {
          afp_number: i + 1,
          period_start: periodStart,
          period_end: periodEnd,
          month: mk,
          measured_works_lines: mwCount,
          variation_lines: varCount,
          compensation_item_lines: ciCount,
        };
      });
    }

    return Response.json({ preview });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}