// ============================================================
// projectDataImporter — shared helpers for batch-importing
// project cost sheets, hire/purchase lists, delivery lists,
// AFP workbooks, and equipment lists from Excel files.
// ============================================================

// Job ID mapping — matches project names from the spreadsheets
// to existing Job entity records.
export const JOB_IDS: Record<string, string> = {
  'east west': '6a82c311793be201539d5e33',      // East West Rail
  'qe2': '6a82c311793be201539d5e0e',            // QE2 Conference Centre
  'dlr': '6a8c2f131f22635fab5e8da9',            // DLR Extension to Thamesmead
  'kingsnorth': '6a82c311793be201539d5dff',     // Kingsnorth Power Station
  'beckton': '6aa02cde4391cf32b6401d9e',        // Beckton Depot Southern Expansion
};

// Division ID for all these projects (Geotechnical Site Investigation)
export const DIVISION_ID = '6a7f0a7daf04b813d077852c';

// --- File type detection ---
export type FileType =
  | 'cost_sheet'    // EWR weekly cost sheets, QE2 Westminster labour sheets
  | 'hire_list'     // DLR/QE2 hire lists
  | 'purchase_list' // DLR purchase lists
  | 'delivery_list' // Kingsnorth delivery lists
  | 'afp_workbook'  // AFP Excel workbooks (QE2, Beckton, DLR)
  | 'equipment_list'; // DLR drilling equipment lists

export function detectFileType(filename: string): FileType {
  const fn = filename.toLowerCase();
  if (fn.includes('applicationforpayment') || fn.includes('-afp') || fn.includes('afp')) return 'afp_workbook';
  if (fn.includes('deliverylist')) return 'delivery_list';
  if (fn.includes('hirelist')) return 'hire_list';
  if (fn.includes('purchaselist')) return 'purchase_list';
  if (fn.includes('equipmentlist') || fn.includes('drillingequipment')) return 'equipment_list';
  if (fn.includes('eastwestrailway') || fn.includes('qe2westminster')) return 'cost_sheet';
  return 'cost_sheet'; // default
}

export function matchJobId(filename: string, fileType: FileType): string | null {
  const fn = filename.toLowerCase();
  if (fn.includes('eastwestrailway') || fn.includes('east west')) return JOB_IDS['east west'];
  if (fn.includes('qe2')) return JOB_IDS['qe2'];
  if (fn.includes('dlr') || fn.includes('i260219')) return JOB_IDS['dlr'];
  if (fn.includes('kingsnorth')) return JOB_IDS['kingsnorth'];
  if (fn.includes('beckton') || fn.includes('bdse')) return JOB_IDS['beckton'];
  // Delivery lists are all for Kingsnorth (the project name is in the data, not the filename)
  if (fn.includes('deliverylist')) return JOB_IDS['kingsnorth'];
  // AFP workbooks — match by job number in filename or fall back to data-based matching
  if (fileType === 'afp_workbook') return null; // will be matched from Valuation Summary data
  return null;
}

// --- Excel helpers ---
export function parseExcelDate(val: any): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(val * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s) return null;
  // Handle numeric strings (Excel serial dates stored as strings)
  if (/^\d+$/.test(s)) {
    const num = parseFloat(s);
    if (num > 25569) { // Valid Excel date range (after 1970-01-01)
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(num * 86400000));
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  // Handle ISO date strings (e.g. "2026-06-01 00:00:00")
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseNum(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parseCurrency(val: any): number {
  if (val == null || val === '' || val === '?') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function cleanStr(val: any): string {
  if (val == null) return '';
  return String(val).trim();
}

// Get a cell value from a row object by trying multiple possible column keys
export function getCell(row: Record<string, any>, keys: string[]): any {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  // Try case-insensitive match
  for (const rkey of Object.keys(row)) {
    for (const key of keys) {
      if (rkey.toLowerCase().includes(key.toLowerCase()) && row[rkey] != null && row[rkey] !== '') {
        return row[rkey];
      }
    }
  }
  return null;
}

// Build a dedup key for JobCostItem records
export function dedupKey(filename: string, rowIdx: number): string {
  return `IMPORT:${filename}:${rowIdx}`;
}