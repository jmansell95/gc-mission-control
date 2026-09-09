import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import * as XLSX from 'npm:xlsx@0.18.5';
import {
  JOB_IDS, DIVISION_ID, detectFileType, matchJobId,
  parseExcelDate, parseNum, parseCurrency, cleanStr,
  type FileType
} from '../../shared/projectDataImporter.ts';

// ============================================================
// importProjectDataBatch — batch-imports project cost data from
// multiple Excel files. Dynamically detects columns from header
// row. Deduplicates by source filename.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { files, debug } = body as { files: { url: string; filename: string }[], debug?: boolean };
    if (!files || !Array.isArray(files)) {
      return Response.json({ error: 'files array is required' }, { status: 400 });
    }

    const results = {
      total_files: files.length, processed: 0, skipped: 0,
      errors: [] as string[],
      job_cost_items_created: 0, delivery_logs_created: 0,
      afps_created: 0, afp_line_items_created: 0, purchase_orders_created: 0,
      details: [] as string[],
    };
    const debugInfo: any[] = [];

    // Pre-fetch dedup data
    const existingCostItems = await base44.asServiceRole.entities.JobCostItem.list('-created_date', 500);
    const importedFilenames = new Set<string>();
    for (const ci of existingCostItems) {
      if (ci.reference_number?.startsWith('IMPORT:')) importedFilenames.add(ci.reference_number);
    }
    const existingAFPs = await base44.asServiceRole.entities.AFP.list('-created_date', 100);
    const importedAFPFiles = new Set<string>();
    for (const afp of existingAFPs) {
      if (afp.source_file_name) importedAFPFiles.add(afp.source_file_name);
    }
    const existingDeliveries = await base44.asServiceRole.entities.DeliveryLog.list('-created_date', 500);
    const importedDeliveryFiles = new Set<string>();
    for (const dl of existingDeliveries) {
      if (dl.po_number?.startsWith('IMPORT:')) importedDeliveryFiles.add(dl.po_number);
    }
    const staffList = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffByLowerName: Record<string, string> = {};
    for (const s of staffList) {
      if (s.name) staffByLowerName[s.name.toLowerCase().trim()] = s.id;
    }
    // Pre-fetch suppliers for PO matching
    const supplierList = await base44.asServiceRole.entities.Supplier.list('-created_date', 500);
    const supplierByLowerName: Record<string, string> = {};
    for (const s of supplierList) {
      if (s.name) supplierByLowerName[s.name.toLowerCase().trim()] = s.id;
    }

    for (const file of files) {
      try {
        const fileType = detectFileType(file.filename);
        let jobId = matchJobId(file.filename, fileType);
        const dedupRef = `IMPORT:${file.filename}`;

        if (fileType === 'afp_workbook' && importedAFPFiles.has(file.filename)) {
          results.skipped++; results.details.push(`SKIP: ${file.filename}`); continue;
        }
        if (fileType === 'delivery_list' && importedDeliveryFiles.has(dedupRef)) {
          results.skipped++; results.details.push(`SKIP: ${file.filename}`); continue;
        }
        if (fileType !== 'afp_workbook' && fileType !== 'delivery_list' && importedFilenames.has(dedupRef)) {
          results.skipped++; results.details.push(`SKIP: ${file.filename}`); continue;
        }

        const fileRes = await fetch(file.url);
        if (!fileRes.ok) { results.errors.push(`${file.filename}: download failed`); continue; }
        const fileBuf = await fileRes.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

        if (fileType === 'afp_workbook' && !jobId) jobId = matchJobFromAFP(workbook);
        if (!jobId) { results.errors.push(`${file.filename}: no job match`); continue; }

        if (debug) {
          const rows = getRows(workbook);
          debugInfo.push({ filename: file.filename, fileType, first3: rows.slice(0, 3).map((r: any[]) => r.map((c: any) => c === null ? 'null' : String(c).substring(0, 25))) });
        }

        switch (fileType) {
          case 'cost_sheet': await processCostSheet(base44, workbook, jobId, file.filename, results); break;
          case 'hire_list': await processHireList(base44, workbook, jobId, file.filename, results); break;
          case 'purchase_list': await processPurchaseList(base44, workbook, jobId, file.filename, results); break;
          case 'delivery_list': await processDeliveryList(base44, workbook, jobId, file.filename, results, staffByLowerName); break;
          case 'afp_workbook': await processAFPWorkbook(base44, workbook, jobId, file.filename, file.url, results, supplierByLowerName); break;
          case 'equipment_list': await processEquipmentList(base44, workbook, jobId, file.filename, results); break;
        }
        results.processed++;
        results.details.push(`OK: ${file.filename} (${fileType})`);
      } catch (e: any) {
        results.errors.push(`${file.filename}: ${e.message || String(e)}`);
      }
    }

    return Response.json({ ok: true, ...results, ...(debug ? { debugInfo } : {}) });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message || String(error) }, { status: 500 });
  }
}

// --- Helpers ---
function getRows(workbook: any, sheetName?: string): any[][] {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
}

function cell(row: any[], idx: number): any {
  return row && idx >= 0 && idx < row.length ? row[idx] : null;
}

// Find the header row index and build a column map
function findHeaderRow(rows: any[][], headerKeywords: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map(c => cleanStr(c).toLowerCase()).join('|');
    if (headerKeywords.every(kw => rowText.includes(kw.toLowerCase()))) return i;
  }
  return -1;
}

function buildColMap(rows: any[][], headerIdx: number): Record<string, number> {
  const map: Record<string, number> = {};
  const header = rows[headerIdx];
  for (let c = 0; c < header.length; c++) {
    const h = cleanStr(header[c]).toLowerCase();
    if (h) map[h] = c;
  }
  return map;
}

function getCol(row: any[], colMap: Record<string, number>, ...keys: string[]): any {
  for (const k of keys) {
    if (k in colMap) return cell(row, colMap[k]);
  }
  return null;
}

function matchJobFromAFP(workbook: any): string | null {
  if (!workbook.SheetNames.includes('Valuation Summary')) return null;
  const rows = getRows(workbook, 'Valuation Summary');
  for (const row of rows) {
    const text = row.map(c => cleanStr(c)).join(' ');
    if (text.includes('PRJ-001034') || text.includes('QE2')) return JOB_IDS['qe2'];
    if (text.includes('PRJ-001058') || text.includes('Beckton') || text.includes('BDSE')) return JOB_IDS['beckton'];
    if (text.includes('I260219') || text.includes('Thamesmead') || text.includes('DLR')) return JOB_IDS['dlr'];
  }
  return null;
}

// ============================================================
// Cost Sheet (EWR weekly, QE2 Westminster)
// ============================================================
async function processCostSheet(base44: any, workbook: any, jobId: string, filename: string, results: any) {
  const rows = getRows(workbook);
  const headerIdx = findHeaderRow(rows, ['project', 'date', 'labour']);
  if (headerIdx < 0) return;
  const colMap = buildColMap(rows, headerIdx);

  const items: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const project = cleanStr(getCol(row, colMap, 'project'));
    if (!project || project.toLowerCase() === 'project' || project === '0') continue;

    const date = parseExcelDate(getCol(row, colMap, 'date', 'date ', 'date delivered'));
    const labour = cleanStr(getCol(row, colMap, 'labour'));
    const jobDesc = cleanStr(getCol(row, colMap, 'job description', 'description'));
    const cost = parseNum(getCol(row, colMap, 'cost'));
    const overnight = cleanStr(getCol(row, colMap, 'overnight accomodation y/n', 'overnight accommodation y/n', 'overnight'));
    const overnightCost = parseNum(getCol(row, colMap, 'cost ', 'overnight cost'));
    let totalCost = parseNum(getCol(row, colMap, 'total cost'));

    // Fix: recalculate total if missing
    if (totalCost === 0 && (cost + overnightCost) > 0) totalCost = cost + overnightCost;
    if (!date || (!labour && !jobDesc)) continue;

    items.push({
      job_id: jobId, division_id: DIVISION_ID, category: 'labour',
      description: `${jobDesc || 'Labour'}${labour ? ' — ' + labour : ''}`,
      unit_cost: cost, quantity: 1, unit_label: 'day', start_date: date,
      reference_number: `IMPORT:${filename}`,
      notes: overnight ? `Overnight: ${overnight}` : '',
    });

    if (overnightCost > 0) {
      items.push({
        job_id: jobId, division_id: DIVISION_ID, category: 'labour',
        description: `Overnight Accommodation${labour ? ' — ' + labour : ''}`,
        unit_cost: overnightCost, quantity: 1, unit_label: 'night', start_date: date,
        reference_number: `IMPORT:${filename}`, notes: overnight || '',
      });
    }
  }

  await bulkCreateItems(base44, items, results);
}

// ============================================================
// Hire List (DLR, QE2)
// ============================================================
async function processHireList(base44: any, workbook: any, jobId: string, filename: string, results: any) {
  const rows = getRows(workbook);
  const headerIdx = findHeaderRow(rows, ['project', 'hire', 'item']);
  if (headerIdx < 0) return;
  const colMap = buildColMap(rows, headerIdx);

  const items: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const project = cleanStr(getCol(row, colMap, 'project'));
    if (!project || project.toLowerCase() === 'project' || project === '0') continue;

    const date = parseExcelDate(getCol(row, colMap, 'date delivered', 'date'));
    const deliveredBy = cleanStr(getCol(row, colMap, 'delivered by'));
    const itemDesc = cleanStr(getCol(row, colMap, 'item description', 'description'));
    if (!itemDesc) continue;

    const itemCostRaw = cleanStr(getCol(row, colMap, 'item cost', 'cost'));
    const hirePeriod = cleanStr(getCol(row, colMap, 'hire period'));
    let totalCost = parseNum(getCol(row, colMap, 'total cost'));
    const unitCost = parseCurrency(itemCostRaw);

    // Fix: calculate total if missing
    if (totalCost === 0 && unitCost > 0) {
      const days = parseNum(hirePeriod);
      if (days > 0) {
        if (itemCostRaw.toLowerCase().includes('p/w') || itemCostRaw.toLowerCase().includes('per week')) {
          totalCost = (unitCost / 5) * days;
        } else {
          totalCost = unitCost * days;
        }
      }
    }
    if (!date) continue;

    items.push({
      job_id: jobId, division_id: DIVISION_ID, category: 'hired_equipment',
      description: itemDesc, unit_cost: totalCost > 0 ? totalCost : unitCost,
      quantity: 1, unit_label: 'hire', start_date: date,
      reference_number: `IMPORT:${filename}`,
      notes: `Hire: ${itemCostRaw || 'n/a'}${hirePeriod ? ', Period: ' + hirePeriod : ''}${deliveredBy ? ', By: ' + deliveredBy : ''}`,
    });
  }

  await bulkCreateItems(base44, items, results);
}

// ============================================================
// Purchase List (DLR)
// ============================================================
async function processPurchaseList(base44: any, workbook: any, jobId: string, filename: string, results: any) {
  const rows = getRows(workbook);
  const headerIdx = findHeaderRow(rows, ['project', 'purchase']);
  if (headerIdx < 0) return;
  const colMap = buildColMap(rows, headerIdx);

  const items: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const project = cleanStr(getCol(row, colMap, 'project'));
    if (!project || project.toLowerCase() === 'project' || project === '0') continue;

    const date = parseExcelDate(getCol(row, colMap, 'date delivered', 'date'));
    const purchase = cleanStr(getCol(row, colMap, 'purchase'));
    if (!purchase) continue;

    const quantity = cleanStr(getCol(row, colMap, 'quantity', 'amount'));
    const itemCost = parseNum(getCol(row, colMap, 'item cost', 'cost'));
    const uplift = cleanStr(getCol(row, colMap, '20 % uplift', '20% uplift', 'uplift'));
    let totalCost = parseNum(getCol(row, colMap, 'total cost'));

    if (totalCost === 0 && itemCost > 0) {
      const upliftRate = parseNum(uplift) / 100;
      totalCost = itemCost * (1 + upliftRate);
    }
    const qtyNum = parseNum(quantity) || 1;

    items.push({
      job_id: jobId, division_id: DIVISION_ID, category: 'purchased_equipment',
      description: purchase,
      unit_cost: totalCost > 0 ? totalCost / qtyNum : itemCost,
      quantity: qtyNum, unit_label: 'each',
      start_date: date || new Date().toISOString().slice(0, 10),
      reference_number: `IMPORT:${filename}`,
      notes: `Purchase${quantity ? ', Qty: ' + quantity : ''}${uplift ? ', Uplift: ' + uplift : ''}`,
    });
  }

  await bulkCreateItems(base44, items, results);
}

// ============================================================
// Delivery List (Kingsnorth)
// ============================================================
async function processDeliveryList(base44: any, workbook: any, jobId: string, filename: string, results: any, staffByLowerName: Record<string, string>) {
  const rows = getRows(workbook);
  const headerIdx = findHeaderRow(rows, ['project', 'driver', 'delivered']);
  if (headerIdx < 0) return;
  const colMap = buildColMap(rows, headerIdx);

  const logs: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const project = cleanStr(getCol(row, colMap, 'project'));
    if (!project || project.toLowerCase() === 'project' || project === '0') continue;

    const date = parseExcelDate(getCol(row, colMap, 'date delivered', 'date'));
    const driver = cleanStr(getCol(row, colMap, 'driver'));
    if (!date || !driver) continue;

    const trailer = cleanStr(getCol(row, colMap, 'trailer'));
    const collectFrom = cleanStr(getCol(row, colMap, 'collect from'));
    const deliveredTo = cleanStr(getCol(row, colMap, 'delivered to'));
    const reason = cleanStr(getCol(row, colMap, 'reason'));
    const costPerHour = parseNum(getCol(row, colMap, 'cost per hour'));
    const totalCost = parseNum(getCol(row, colMap, 'total cost'));
    const totalMiles = parseNum(getCol(row, colMap, 'total miles'));
    const costPerMile = parseNum(getCol(row, colMap, 'cost per mile'));
    const totalMileageCost = parseNum(getCol(row, colMap, 'total mileage cost'));
    let totalCost2 = parseNum(getCol(row, colMap, 'total cost2', 'total cost 2'));

    if (totalCost2 === 0) totalCost2 = totalCost + totalMileageCost;

    const driverId = staffByLowerName[driver.toLowerCase()] || 'imported';
    const reasonLower = reason.toLowerCase();
    let deliveryType = 'site_delivery';
    if (reasonLower.includes('sample')) deliveryType = 'sample_collection';
    else if (reasonLower.includes('collect')) deliveryType = 'supplier_collection';

    logs.push({
      job_id: jobId, division_id: DIVISION_ID,
      driver_staff_id: driverId, driver_staff_name: driver,
      delivery_type: deliveryType, status: 'completed',
      scheduled_date: date, completed_at: new Date(date).toISOString(),
      pickup_address: collectFrom, delivery_address: deliveredTo,
      items: reason, miles: totalMiles, chargeable: true,
      charge_amount: totalCost2,
      charge_breakdown: JSON.stringify({ cost_per_hour: costPerHour, hourly_cost: totalCost, total_miles: totalMiles, cost_per_mile: costPerMile, mileage_cost: totalMileageCost, total: totalCost2 }),
      billing_status: 'auto', po_number: `IMPORT:${filename}`,
      notes: `Trailer: ${trailer || 'No'}`,
    });
  }

  if (logs.length > 0) {
    for (let i = 0; i < logs.length; i += 50) {
      const batch = logs.slice(i, i + 50);
      await base44.asServiceRole.entities.DeliveryLog.bulkCreate(batch);
      results.delivery_logs_created += batch.length;
    }
  }
}

// ── Fuzzy supplier matching with auto-create ──
// Normalises supplier names (strips Ltd/Limited/UK/etc., lowercases, trims)
// and tries exact then Levenshtein-distance matching. If no match is found,
// auto-creates a new Supplier record so POs get a real supplier_id.
async function resolveOrCreateSupplier(
  base44: any, name: string, cache: Record<string, string>, results: any
): Promise<string> {
  const clean = name.toLowerCase().trim();
  if (!clean) return 'unmatched';

  // 1. Exact match (cache)
  if (cache[clean]) return cache[clean];

  // 2. Normalised match (strip suffixes)
  const normalise = (s: string) =>
    s.toLowerCase().trim().replace(/\b(ltd|limited|uk|ltd\.|plc|llp|inc|corp)\b\.?/g, '').replace(/[^\w\s]/g, '').trim();
  const normalisedName = normalise(name);
  for (const [cachedName, id] of Object.entries(cache)) {
    if (normalise(cachedName) === normalisedName) {
      cache[clean] = id; // cache for next time
      return id;
    }
  }

  // 3. Fuzzy match (Levenshtein distance ≤ 2)
  for (const [cachedName, id] of Object.entries(cache)) {
    const dist = levenshtein(normalisedName, normalise(cachedName));
    if (dist <= 2 && normalisedName.length > 3) {
      cache[clean] = id;
      return id;
    }
  }

  // 4. Auto-create a new Supplier
  try {
    const newSupplier = await base44.asServiceRole.entities.Supplier.create({
      name: name.trim(),
      division_id: DIVISION_ID,
      notes: 'Auto-created from project data import',
    });
    cache[clean] = newSupplier.id;
    results.details.push(`Created supplier: ${name}`);
    return newSupplier.id;
  } catch (e) {
    return 'unmatched';
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// ============================================================
// AFP Workbook (QE2, Beckton, DLR)
// ============================================================
async function processAFPWorkbook(base44: any, workbook: any, jobId: string, filename: string, fileUrl: string, results: any, supplierByLowerName: Record<string, string>) {
  let afpNumber = 1, clientName = '', clientPO = '', gcJobNumber = '', contractValue = 0;

  if (workbook.SheetNames.includes('Valuation Summary')) {
    const vsRows = getRows(workbook, 'Valuation Summary');
    for (const row of vsRows) {
      const c0 = cleanStr(cell(row, 0)).toLowerCase();
      const c1 = cleanStr(cell(row, 1));
      const c2 = cleanStr(cell(row, 2));
      const c3 = cleanStr(cell(row, 3));
      // Extract the first non-label value from cells after the label cell.
      // Skips cells that look like labels (end with ':' or match known label text).
      const findValue = (row: any[], startIdx: number): string => {
        for (let j = startIdx; j < row.length; j++) {
          const v = cleanStr(cell(row, j));
          if (!v) continue;
          // Skip label-like cells
          if (v.endsWith(':')) continue;
          if (/^(project name|job no|gcl|client|order no|contract|application no)\b/i.test(v)) continue;
          return v;
        }
        return '';
      };
      if (c0.includes('job no') || c0.includes('gcl')) { const v = findValue(row, 1); if (v) gcJobNumber = v; }
      if (c0.includes('project name')) { const v = findValue(row, 1); if (v) clientName = v; }
      if (c0.includes('client') && !clientName) { const v = findValue(row, 1); if (v) clientName = v; }
      if (c0.includes('order no')) { const v = findValue(row, 1); if (v) clientPO = v; }
      if (c0.includes('contract') && c2) contractValue = parseNum(c2);
      if (c0.includes('application no')) { const v = findValue(row, 1); if (v) afpNumber = parseNum(v); }
    }
  }

  const afpRecord = await base44.asServiceRole.entities.AFP.create({
    job_id: jobId, afp_number: afpNumber,
    period_date: new Date().toISOString().slice(0, 10),
    client_po: clientPO, gc_job_number: gcJobNumber,
    client_name: clientName, contract_value: contractValue,
    status: 'draft', source_file_url: fileUrl, source_file_name: filename,
    last_updated_at: new Date().toISOString(), last_updated_by: 'Batch Import',
  });
  results.afps_created++;

  // Measured Works
  if (workbook.SheetNames.includes('Measured Works')) {
    const mwRows = getRows(workbook, 'Measured Works');
    const headerIdx = mwRows.findIndex((r: any[]) => cleanStr(cell(r, 0)).toLowerCase().includes('item ref'));
    if (headerIdx >= 0) {
      const colMap = buildColMap(mwRows, headerIdx);
      const lineItems: any[] = [];
      for (let i = headerIdx + 1; i < mwRows.length; i++) {
        const row = mwRows[i];
        const description = cleanStr(getCol(row, colMap, 'description'));
        if (!description || description.toLowerCase() === 'description') continue;

        const qty = parseNum(getCol(row, colMap, 'qty'));
        const unit = cleanStr(getCol(row, colMap, 'unit'));
        const rate = parseNum(getCol(row, colMap, 'rate'));
        const sum = parseNum(getCol(row, colMap, 'sum'));
        const qtyComplete = parseNum(getCol(row, colMap, 'qty\ncomplete', 'qty complete'));
        const grossApplied = parseNum(getCol(row, colMap, 'gross\n applied', 'gross applied'));
        const previousApplied = parseNum(getCol(row, colMap, 'previous applied'));
        const appliedInPeriod = parseNum(getCol(row, colMap, 'applied in period'));
        const finalApplied = appliedInPeriod > 0 ? appliedInPeriod : (grossApplied - previousApplied);

        lineItems.push({
          afp_id: afpRecord.id, job_id: jobId, sheet_name: 'measured_works',
          category: 'other', item_ref: cleanStr(getCol(row, colMap, 'item ref:', 'item ref')),
          item: description, unit, qty, rate, amount: sum,
          qty_complete: qtyComplete, gross_applied: grossApplied,
          previous_applied: previousApplied, applied_in_period: finalApplied,
          source: 'afp_upload', source_date: new Date().toISOString().slice(0, 10),
          sort_order: lineItems.length,
        });
      }
      await bulkCreateLineItems(base44, lineItems, results);
    }
  }

  // Variation Summary
  if (workbook.SheetNames.includes('Variation Summary')) {
    const varRows = getRows(workbook, 'Variation Summary');
    const headerIdx = varRows.findIndex((r: any[]) => cleanStr(cell(r, 0)).toLowerCase().includes('vo ref'));
    if (headerIdx >= 0) {
      const colMap = buildColMap(varRows, headerIdx);
      const varItems: any[] = [];
      for (let i = headerIdx + 1; i < varRows.length; i++) {
        const row = varRows[i];
        const description = cleanStr(getCol(row, colMap, 'description'));
        if (!description) continue;
        const voRef = cleanStr(getCol(row, colMap, 'vo ref:', 'vo ref'));
        const voDate = parseExcelDate(getCol(row, colMap, 'date:', 'date'));
        const qty = parseNum(getCol(row, colMap, 'qty'));
        const unit = cleanStr(getCol(row, colMap, 'unit'));
        const rate = parseNum(getCol(row, colMap, 'rate'));
        const totalCost = parseNum(getCol(row, colMap, 'total cost'));
        const timeImpact = cleanStr(getCol(row, colMap, 'time impact\n(yes/no)', 'time impact (yes/no)')).toLowerCase().includes('yes');
        const timeDays = parseNum(getCol(row, colMap, 'days'));

        varItems.push({
          afp_id: afpRecord.id, job_id: jobId, sheet_name: 'variations',
          category: 'other', item_ref: voRef, item: description, unit, qty, rate,
          amount: totalCost, vo_ref: voRef, vo_date: voDate,
          time_impact: timeImpact, time_impact_days: timeDays,
          source: 'afp_upload', source_date: voDate || new Date().toISOString().slice(0, 10),
          sort_order: 1000 + varItems.length,
        });
      }
      await bulkCreateLineItems(base44, varItems, results);
    }
  }

  // Materials On Site
  const matSheetName = workbook.SheetNames.find((n: string) => n.toLowerCase().includes('materials on site'));
  if (matSheetName) {
    const matRows = getRows(workbook, matSheetName);
    const headerIdx = matRows.findIndex((r: any[]) => {
      const text = r.map(c => cleanStr(c).toLowerCase()).join('|');
      return text.includes('description') && text.includes('quantity');
    });
    if (headerIdx >= 0) {
      const colMap = buildColMap(matRows, headerIdx);
      const matItems: any[] = [];
      for (let i = headerIdx + 1; i < matRows.length; i++) {
        const row = matRows[i];
        const description = cleanStr(getCol(row, colMap, 'description:', 'description'));
        if (!description) continue;
        const quantity = parseNum(getCol(row, colMap, 'quantity'));
        const unit = cleanStr(getCol(row, colMap, 'unit'));
        const cost = parseNum(getCol(row, colMap, 'cost'));
        if (cost > 0 || quantity > 0) {
          matItems.push({
            afp_id: afpRecord.id, job_id: jobId, sheet_name: 'materials',
            category: 'materials', item: description, unit, qty: quantity,
            rate: cost, amount: quantity * cost, source: 'afp_upload',
            source_date: new Date().toISOString().slice(0, 10),
            sort_order: 2000 + matItems.length,
          });
        }
      }
      await bulkCreateLineItems(base44, matItems, results);
    }
  }

  // Material Requests Log → PurchaseOrder records
  if (workbook.SheetNames.includes('Material Requests Log')) {
    const mrlRows = getRows(workbook, 'Material Requests Log');
    const headerIdx = mrlRows.findIndex((r: any[]) => {
      const text = r.map(c => cleanStr(c).toLowerCase()).join('|');
      return text.includes('po number') && text.includes('supplier');
    });
    if (headerIdx >= 0) {
      const colMap = buildColMap(mrlRows, headerIdx);
      const poItems: any[] = [];
      for (let i = headerIdx + 1; i < mrlRows.length; i++) {
        const row = mrlRows[i];
        const poNumber = cleanStr(getCol(row, colMap, 'po number'));
        const supplier = cleanStr(getCol(row, colMap, 'supplier'));
        const supplyOrdered = cleanStr(getCol(row, colMap, 'supply ordered'));
        if (!poNumber || !supplyOrdered) continue;
        const dateOrdered = parseExcelDate(getCol(row, colMap, 'date order placed'));
        const netAmount = parseNum(getCol(row, colMap, 'net amount (£)', 'net amount'));
        const orderer = cleanStr(getCol(row, colMap, 'orderer'));
        const invoiceNo = cleanStr(getCol(row, colMap, 'invoice no.', 'invoice no'));
        const notes = cleanStr(getCol(row, colMap, 'notes'));

        const supplierId = await resolveOrCreateSupplier(base44, supplier, supplierByLowerName, results);
        poItems.push({
          po_number: poNumber, job_id: jobId, job_name: 'DLR Extension to Thamesmead',
          supplier_id: supplierId, supplier_name: supplier,
          status: invoiceNo ? 'received' : 'sent',
          order_date: dateOrdered || new Date().toISOString().slice(0, 10),
          items: [{ description: supplyOrdered, quantity: 1, unit_cost: netAmount, unit_label: 'sum', vat_exempt: false }],
          subtotal: netAmount, total: netAmount,
          invoice_number: invoiceNo || undefined,
          notes: `${notes}${orderer ? ' — Ordered by: ' + orderer : ''}${invoiceNo ? ' — Invoice: ' + invoiceNo : ''}`.trim(),
        });
      }
      if (poItems.length > 0) {
        for (let i = 0; i < poItems.length; i += 50) {
          const batch = poItems.slice(i, i + 50);
          await base44.asServiceRole.entities.PurchaseOrder.bulkCreate(batch);
          results.purchase_orders_created += batch.length;
        }
      }
    }
  }

  // Update AFP total_claimed
  const allLineItems = await base44.asServiceRole.entities.AFPLineItem.filter({ afp_id: afpRecord.id });
  const totalClaimed = allLineItems.reduce((s: number, li: any) => s + (li.applied_in_period || li.amount || 0), 0);
  await base44.asServiceRole.entities.AFP.update(afpRecord.id, { total_claimed: Math.round(totalClaimed * 100) / 100 });
}

// ============================================================
// Equipment List (DLR)
// ============================================================
async function processEquipmentList(base44: any, workbook: any, jobId: string, filename: string, results: any) {
  const rows = getRows(workbook);
  const headerIdx = findHeaderRow(rows, ['project', 'delivered']);
  if (headerIdx < 0) return;
  const colMap = buildColMap(rows, headerIdx);

  const items: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const project = cleanStr(getCol(row, colMap, 'project'));
    if (!project || project.toLowerCase() === 'project' || project === '0') continue;

    const date = parseExcelDate(getCol(row, colMap, 'date delivered', 'date'));
    const deliveredBy = cleanStr(getCol(row, colMap, 'delivered by'));
    const diameter = cleanStr(getCol(row, colMap, 'diamater', 'diameter'));
    const lengths = cleanStr(getCol(row, colMap, 'lengths'));
    const numberSent = cleanStr(getCol(row, colMap, 'number sent'));
    const totalLength = cleanStr(getCol(row, colMap, 'totel length (m)', 'total length (m)'));
    const totalWeight = parseNum(getCol(row, colMap, 'total weight (ton)'));
    const itemDesc = cleanStr(getCol(row, colMap, 'items', 'item description'));

    const description = diameter ? `${diameter} — ${lengths || numberSent || ''}`.trim() : itemDesc;
    if (!description) continue;

    items.push({
      job_id: jobId, division_id: DIVISION_ID, category: 'internal_equipment',
      description, unit_cost: 0, quantity: parseNum(numberSent) || 1,
      unit_label: 'each', start_date: date || new Date().toISOString().slice(0, 10),
      reference_number: `IMPORT:${filename}`,
      notes: `${totalLength ? 'Total length: ' + totalLength + 'm, ' : ''}${totalWeight ? 'Weight: ' + totalWeight + 't, ' : ''}${deliveredBy ? 'By: ' + deliveredBy : ''}`.trim().replace(/,\s*$/, ''),
    });
  }

  await bulkCreateItems(base44, items, results);
}

// --- Bulk create helpers ---
async function bulkCreateItems(base44: any, items: any[], results: any) {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    await base44.asServiceRole.entities.JobCostItem.bulkCreate(batch);
    results.job_cost_items_created += batch.length;
  }
}

async function bulkCreateLineItems(base44: any, items: any[], results: any) {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    await base44.asServiceRole.entities.AFPLineItem.bulkCreate(batch);
    results.afp_line_items_created += batch.length;
  }
}