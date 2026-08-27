import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr } from '../../shared/cvrHelpers.ts';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * parseEWRAFPUpload — fetches an EWR (East West Rail) AFP Excel file and parses
 * its specific sheet structure directly. The EWR AFP format is fundamentally
 * different from the standard Lump Sum AFP: it has per-borehole column groups
 * under AFP period headers in the drilling sheets, time-based dayworks entries,
 * enabling crew, accommodation, misc, hires, and mileage sheets.
 *
 * The uploaded file IS the AFP — no template or field-data population is used.
 *
 * Input:  { file_url: string }
 * Output: { preview: { is_ewr, contract_details, ewr_sheets, afp_periods } }
 */

function findSheet(workbook, pattern: RegExp): string | undefined {
  return workbook.SheetNames.find(n => pattern.test(n));
}

function findCols(headerRow: any[], mappings: Record<string, string[]>): Record<string, number> {
  const cols: Record<string, number> = {};
  for (const [field, headers] of Object.entries(mappings)) {
    // Exact match first
    for (let c = 0; c < headerRow.length; c++) {
      const l = String(headerRow[c] || '').toLowerCase().trim();
      if (headers.some(h => l === h)) { cols[field] = c; break; }
    }
    // Fallback to includes match
    if (cols[field] === undefined) {
      for (let c = 0; c < headerRow.length; c++) {
        const l = String(headerRow[c] || '').toLowerCase().trim();
        if (headers.some(h => l.includes(h))) { cols[field] = c; break; }
      }
    }
  }
  return cols;
}

// Parse Summary sheet (key-value: label in col 0, value in col 1+)
function parseSummary(rows: any[][]): any {
  const details: any = {};
  for (const row of rows) {
    if (!row || !row[0]) continue;
    const label = String(row[0]).toLowerCase().trim();
    let value: any = null;
    for (let c = 1; c < Math.min(row.length, 5); c++) {
      if (row[c] != null && row[c] !== '') { value = row[c]; break; }
    }
    if (label.includes('payment due')) details.payment_due_date = toDateStr(value);
    else if (label.includes('purchase order') || label.includes('client po')) details.client_purchase_order = String(value || '').trim();
    else if (label.includes('gc job') || label.includes('job number')) details.gc_job_number = String(value || '').trim();
    else if (label === 'client') details.client = String(value || '').trim();
    else if (label.includes('contract') && (label.includes('value') || label.includes('award'))) details.contract_award_value = toNum(value);
    else if (label.includes('date')) details.date = toDateStr(value);
  }
  return details;
}

// Parse Rotary/CP Drilling sheet (AFP period headers in row above column headers,
// borehole names in header row, per-borehole quantities in data rows)
function parseDrillingSheet(rows: any[][]): any[] {
  // Find header row (contains "Item" and "Item Description")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] || [];
    let hasItem = false, hasDesc = false;
    for (const cell of row) {
      const l = String(cell || '').toLowerCase().trim();
      if (l === 'item') hasItem = true;
      if (l.includes('item description')) hasDesc = true;
    }
    if (hasItem && hasDesc) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];

  // AFP period headers are in the row above the header row
  const afpHeaderRow = headerIdx > 0 ? rows[headerIdx - 1] : [];
  const afpHeaders: { col: number; afp_number: number }[] = [];
  for (let c = 0; c < (afpHeaderRow || []).length; c++) {
    const val = String(afpHeaderRow[c] || '').trim();
    const m = val.match(/AFP\s*(\d+)/i);
    if (m) afpHeaders.push({ col: c, afp_number: parseInt(m[1]) });
  }

  const headerRow = rows[headerIdx];
  const cols = findCols(headerRow, {
    itemLetter: ['item'],
    desc: ['item description'],
    unit: ['unit'],
    rate: ['rate'],
    totalQty: ['total qty'],
    netTotal: ['net total'],
    assessedQty: ['assessed qty'],
    assessedTotal: ['assessed total'],
  });

  // Borehole columns = non-empty, non-fixed columns in the header row
  const fixedCols = new Set(Object.values(cols).filter(c => c >= 0));
  const boreholeCols: { col: number; ref: string; afp_number: number }[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (fixedCols.has(c)) continue;
    const ref = String(headerRow[c] || '').trim();
    if (!ref) continue;
    let afpNumber = 1;
    for (let i = afpHeaders.length - 1; i >= 0; i--) {
      if (afpHeaders[i].col <= c) { afpNumber = afpHeaders[i].afp_number; break; }
    }
    boreholeCols.push({ col: c, ref, afp_number: afpNumber });
  }

  const lineItems: any[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const description = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : '';
    const itemLetter = cols.itemLetter >= 0 ? String(row[cols.itemLetter] || '').trim() : '';
    if (!description && !itemLetter) continue;

    const rate = cols.rate >= 0 ? toNum(row[cols.rate]) : 0;
    const totalQty = cols.totalQty >= 0 ? toNum(row[cols.totalQty]) : 0;
    const netTotal = cols.netTotal >= 0 ? toNum(row[cols.netTotal]) : 0;

    // Skip section headers (no data in any borehole column)
    const hasBoreholeData = boreholeCols.some(bc => toNum(row[bc.col]) > 0);
    if (rate === 0 && totalQty === 0 && netTotal === 0 && !hasBoreholeData) continue;

    // Collect per-borehole quantities grouped by AFP period
    const perPeriod: Record<number, { boreholes: { ref: string; qty: number }[]; period_qty: number; period_amount: number }> = {};
    for (const bc of boreholeCols) {
      const qty = toNum(row[bc.col]);
      if (qty === 0) continue;
      if (!perPeriod[bc.afp_number]) perPeriod[bc.afp_number] = { boreholes: [], period_qty: 0, period_amount: 0 };
      perPeriod[bc.afp_number].boreholes.push({ ref: bc.ref, qty });
      perPeriod[bc.afp_number].period_qty += qty;
    }
    for (const afpNum of Object.keys(perPeriod)) {
      perPeriod[afpNum].period_amount = perPeriod[afpNum].period_qty * rate;
    }

    lineItems.push({
      item_letter: itemLetter,
      description,
      unit: cols.unit >= 0 ? String(row[cols.unit] || '').trim() : '',
      rate,
      total_qty: totalQty,
      net_total: netTotal,
      assessed_qty: cols.assessedQty >= 0 ? toNum(row[cols.assessedQty]) : 0,
      assessed_total: cols.assessedTotal >= 0 ? toNum(row[cols.assessedTotal]) : 0,
      per_period: perPeriod,
    });
  }
  return lineItems;
}

// Parse Dayworks sheet (Application Number, Crew, BH Location, Date, times, description, rate, qty, net total)
function parseDayworks(rows: any[][]): any[] {
  if (!rows.length) return [];
  const cols = findCols(rows[0] || [], {
    appNum: ['application number'],
    crew: ['crew'],
    bh: ['bh location'],
    date: ['date'],
    start: ['start time'],
    end: ['end time'],
    desc: ['description'],
    rate: ['rate'],
    qty: ['qty'],
    netTotal: ['net total'],
    assessedQty: ['assessed qty'],
    assessedTotal: ['assessed total'],
    comments: ['comments'],
  });
  const entries: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const appNum = toNum(cols.appNum >= 0 ? row[cols.appNum] : 0);
    if (!appNum) continue;
    const description = cols.desc >= 0 ? String(row[cols.desc] || '').trim() : '';
    const netTotal = cols.netTotal >= 0 ? toNum(row[cols.netTotal]) : 0;
    if (!description && netTotal === 0) continue;
    entries.push({
      afp_number: appNum,
      crew: cols.crew >= 0 ? String(row[cols.crew] || '').trim() : '',
      bh_location: cols.bh >= 0 ? String(row[cols.bh] || '').trim() : '',
      date: cols.date >= 0 ? toDateStr(row[cols.date]) : null,
      start_time: cols.start >= 0 ? String(row[cols.start] || '').trim() : '',
      end_time: cols.end >= 0 ? String(row[cols.end] || '').trim() : '',
      description,
      rate: cols.rate >= 0 ? toNum(row[cols.rate]) : 0,
      qty: cols.qty >= 0 ? toNum(row[cols.qty]) : 0,
      net_total: netTotal,
      assessed_qty: cols.assessedQty >= 0 ? toNum(row[cols.assessedQty]) : 0,
      assessed_total: cols.assessedTotal >= 0 ? toNum(row[cols.assessedTotal]) : 0,
    });
  }
  return entries;
}

// Parse Enabling Crew / Accommodation sheet
function parseEnablingOrAccommodation(rows: any[][], isAccommodation: boolean): any[] {
  if (!rows.length) return [];
  const cols = findCols(rows[0] || [], {
    appNum: ['application number'],
    resource: ['resource name'],
    start: ['start date'],
    end: ['end date'],
    booking: ['booking reference'],
    rate: ['rate'],
    qty: ['qty', 'number of nights'],
    netTotal: ['net total'],
    assessedQty: ['assessed qty'],
    assessedTotal: ['assessed total'],
    comments: ['comments'],
  });
  const entries: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const appNum = toNum(cols.appNum >= 0 ? row[cols.appNum] : 0);
    if (!appNum) continue;
    const resource = cols.resource >= 0 ? String(row[cols.resource] || '').trim() : '';
    const netTotal = cols.netTotal >= 0 ? toNum(row[cols.netTotal]) : 0;
    if (!resource && netTotal === 0) continue;
    entries.push({
      afp_number: appNum,
      resource_name: resource,
      start_date: cols.start >= 0 ? toDateStr(row[cols.start]) : null,
      end_date: cols.end >= 0 ? toDateStr(row[cols.end]) : null,
      booking_ref: isAccommodation && cols.booking >= 0 ? String(row[cols.booking] || '').trim() : '',
      rate: cols.rate >= 0 ? toNum(row[cols.rate]) : 0,
      qty: cols.qty >= 0 ? toNum(row[cols.qty]) : 0,
      nights: isAccommodation ? (cols.qty >= 0 ? toNum(row[cols.qty]) : 0) : 0,
      net_total: netTotal,
      assessed_qty: cols.assessedQty >= 0 ? toNum(row[cols.assessedQty]) : 0,
      assessed_total: cols.assessedTotal >= 0 ? toNum(row[cols.assessedTotal]) : 0,
    });
  }
  return entries;
}

// Parse Misc / Hires sheet
function parseMiscOrHires(rows: any[][]): any[] {
  if (!rows.length) return [];
  const cols = findCols(rows[0] || [], {
    appNum: ['application number'],
    resource: ['resource name'],
    unit: ['unit'],
    rate: ['rate'],
    date: ['date of works', 'date'],
    comments: ['comments'],
    qty: ['qty'],
    netTotal: ['net total'],
    assessedQty: ['assessed qty'],
    assessedTotal: ['assessed total'],
  });
  const entries: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const appNum = toNum(cols.appNum >= 0 ? row[cols.appNum] : 0);
    if (!appNum) continue;
    const resource = cols.resource >= 0 ? String(row[cols.resource] || '').trim() : '';
    const netTotal = cols.netTotal >= 0 ? toNum(row[cols.netTotal]) : 0;
    if (!resource && netTotal === 0) continue;
    entries.push({
      afp_number: appNum,
      resource_name: resource,
      unit: cols.unit >= 0 ? String(row[cols.unit] || '').trim() : '',
      rate: cols.rate >= 0 ? toNum(row[cols.rate]) : 0,
      date: cols.date >= 0 ? toDateStr(row[cols.date]) : null,
      comments: cols.comments >= 0 ? String(row[cols.comments] || '').trim() : '',
      qty: cols.qty >= 0 ? toNum(row[cols.qty]) : 0,
      net_total: netTotal,
      assessed_qty: cols.assessedQty >= 0 ? toNum(row[cols.assessedQty]) : 0,
      assessed_total: cols.assessedTotal >= 0 ? toNum(row[cols.assessedTotal]) : 0,
    });
  }
  return entries;
}

// Parse Mileage sheet (no Application Number — assigned to AFP 1)
function parseMileage(rows: any[][]): any[] {
  if (!rows.length) return [];
  const cols = findCols(rows[0] || [], {
    vehicle: ['vehicle', 'driver'],
    date: ['date'],
    startMile: ['start m'],
    endMile: ['end m'],
    total: ['total'],
    chargeable: ['chargeable'],
    rate: ['rate'],
    netTotal: ['net total'],
    assessedQty: ['assessed qty'],
    assessedTotal: ['assessed total'],
  });
  const entries: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const vehicle = cols.vehicle >= 0 ? String(row[cols.vehicle] || '').trim() : '';
    const netTotal = cols.netTotal >= 0 ? toNum(row[cols.netTotal]) : 0;
    if (!vehicle && netTotal === 0) continue;
    entries.push({
      vehicle_driver: vehicle,
      date: cols.date >= 0 ? toDateStr(row[cols.date]) : null,
      start_mileage: cols.startMile >= 0 ? toNum(row[cols.startMile]) : 0,
      end_mileage: cols.endMile >= 0 ? toNum(row[cols.endMile]) : 0,
      total: cols.total >= 0 ? toNum(row[cols.total]) : 0,
      chargeable: cols.chargeable >= 0 ? toNum(row[cols.chargeable]) : 0,
      rate: cols.rate >= 0 ? toNum(row[cols.rate]) : 0,
      net_total: netTotal,
      assessed_qty: cols.assessedQty >= 0 ? toNum(row[cols.assessedQty]) : 0,
      assessed_total: cols.assessedTotal >= 0 ? toNum(row[cols.assessedTotal]) : 0,
    });
  }
  return entries;
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

    const ewrSheets: any = {
      rotary_drilling: [],
      cp_drilling: [],
      rotary_dayworks: [],
      cp_dayworks: [],
      enabling_crew: [],
      accommodation: [],
      misc: [],
      hires: [],
      mileage: [],
    };

    // ── Summary sheet ──
    let contractDetails: any = {};
    const sumName = findSheet(workbook, /summary/i);
    if (sumName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sumName], { header: 1, raw: true, defval: null, blankrows: false });
      contractDetails = parseSummary(rows);
    }

    // ── Rotary Drilling ──
    const rotDrillName = findSheet(workbook, /rotary.*drilling/i);
    if (rotDrillName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[rotDrillName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.rotary_drilling = parseDrillingSheet(rows);
    }

    // ── CP Drilling ──
    const cpDrillName = findSheet(workbook, /cp.*drilling/i);
    if (cpDrillName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[cpDrillName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.cp_drilling = parseDrillingSheet(rows);
    }

    // ── Rotary Dayworks ──
    const rotDwName = findSheet(workbook, /rotary.*dayworks/i);
    if (rotDwName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[rotDwName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.rotary_dayworks = parseDayworks(rows);
    }

    // ── CP Dayworks ──
    const cpDwName = findSheet(workbook, /cp.*dayworks/i);
    if (cpDwName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[cpDwName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.cp_dayworks = parseDayworks(rows);
    }

    // ── Enabling Crew ──
    const enabName = findSheet(workbook, /enabling.*crew/i);
    if (enabName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[enabName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.enabling_crew = parseEnablingOrAccommodation(rows, false);
    }

    // ── Accommodation ──
    const accName = findSheet(workbook, /accommodation/i);
    if (accName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[accName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.accommodation = parseEnablingOrAccommodation(rows, true);
    }

    // ── Misc ──
    const miscName = workbook.SheetNames.find(n => /^misc$/i.test(n.trim()));
    if (miscName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[miscName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.misc = parseMiscOrHires(rows);
    }

    // ── Hires ──
    const hiresName = workbook.SheetNames.find(n => /^hires$/i.test(n.trim()));
    if (hiresName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[hiresName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.hires = parseMiscOrHires(rows);
    }

    // ── Mileage ──
    const mileName = findSheet(workbook, /mileage/i);
    if (mileName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[mileName], { header: 1, raw: true, defval: null, blankrows: false });
      ewrSheets.mileage = parseMileage(rows);
    }

    // ── Build afp_periods from all AFP numbers found ──
    const afpNumbers = new Set<number>();
    // From drilling sheet per_period keys
    for (const sheetKey of ['rotary_drilling', 'cp_drilling']) {
      for (const item of ewrSheets[sheetKey]) {
        for (const afpNum of Object.keys(item.per_period || {})) afpNumbers.add(parseInt(afpNum));
      }
    }
    // From Application Number in other sheets
    for (const sheetKey of ['rotary_dayworks', 'cp_dayworks', 'enabling_crew', 'accommodation', 'misc', 'hires']) {
      for (const entry of ewrSheets[sheetKey]) {
        if (entry.afp_number) afpNumbers.add(entry.afp_number);
      }
    }
    // Mileage goes to AFP 1
    if (ewrSheets.mileage.length > 0) afpNumbers.add(1);

    // If no AFP numbers found, default to 1
    if (afpNumbers.size === 0) afpNumbers.add(1);

    // Derive period dates from entries
    const afpPeriods: any[] = [];
    for (const afpNum of Array.from(afpNumbers).sort((a, b) => a - b)) {
      const dates: string[] = [];
      for (const sheetKey of ['rotary_dayworks', 'cp_dayworks', 'enabling_crew', 'accommodation', 'misc', 'hires']) {
        for (const entry of ewrSheets[sheetKey]) {
          if (entry.afp_number !== afpNum) continue;
          if (entry.date) dates.push(entry.date);
          if (entry.start_date) dates.push(entry.start_date);
          if (entry.end_date) dates.push(entry.end_date);
        }
      }
      dates.sort();
      const periodStart = dates.length > 0 ? dates[0] : (contractDetails.date || '');
      const periodEnd = dates.length > 0 ? dates[dates.length - 1] : (contractDetails.payment_due_date || periodStart);

      // Calculate total claimed for this AFP period
      let totalClaimed = 0;
      for (const sheetKey of ['rotary_drilling', 'cp_drilling']) {
        for (const item of ewrSheets[sheetKey]) {
          const pd = item.per_period?.[afpNum];
          if (pd) totalClaimed += pd.period_amount;
        }
      }
      for (const sheetKey of ['rotary_dayworks', 'cp_dayworks', 'enabling_crew', 'accommodation', 'misc', 'hires']) {
        for (const entry of ewrSheets[sheetKey]) {
          if (entry.afp_number === afpNum) totalClaimed += entry.net_total;
        }
      }
      if (afpNum === 1) {
        for (const entry of ewrSheets.mileage) totalClaimed += entry.net_total;
      }

      afpPeriods.push({
        afp_number: afpNum,
        period_start: periodStart,
        period_end: periodEnd,
        total_claimed: Math.round(totalClaimed * 100) / 100,
      });
    }

    const preview = {
      is_ewr: true,
      contract_details: contractDetails,
      ewr_sheets: ewrSheets,
      afp_periods: afpPeriods,
    };

    return Response.json({ preview });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}