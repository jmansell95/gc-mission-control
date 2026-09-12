import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * exportAFPToExcel — generates a downloadable .xlsx file in the Lump Sum
 * template structure (Valuation Summary, Measured Works, Variation Summary,
 * Materials On site) pre-filled with the AFP's current data.
 *
 * Input:  { afp_id: string }
 * Output: { file_url: string, file_name: string }
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

    const lineItems = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);

    // Build workbook
    const wb = XLSX.utils.book_new();

    // ── Valuation Summary sheet ──
    const vsData = [
      ['Application for Payment'],
      [],
      ['Project Name', afp.job_name || ''],
      ['GC Job Number', afp.gc_job_number || ''],
      ['Client', afp.client_name || ''],
      ['Client Purchase Order', afp.client_po || ''],
      ['Contract Award Value', toNum(afp.contract_value)],
      ['AFP Number', afp.afp_number || 1],
      ['Period Start', afp.period_start_date || ''],
      ['Period End', afp.period_end_date || ''],
      ['Payment Due Date', afp.payment_due_date || ''],
      [],
      ['Total Claimed', toNum(afp.total_claimed)],
      ['Original Total', toNum(afp.original_total)],
      ['Disputed Total', toNum(afp.disputed_total)],
      ['Agreed Total', toNum(afp.agreed_total)],
    ];
    const vsWs = XLSX.utils.aoa_to_sheet(vsData);
    vsWs['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, vsWs, 'Valuation Summary');

    // ── Measured Works sheet ──
    const mwItems = lineItems.filter(li =>
      li.sheet_name === 'measured_works' ||
      li.sheet_name === 'drilling' ||
      li.sheet_name === 'plant_hire' ||
      li.sheet_name === 'rates'
    );
    const mwData = [
      ['Item Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Sum', 'Applied in Period', 'Comments'],
      ...mwItems.map(li => [
        li.item_ref || '',
        li.item || '',
        li.unit || '',
        toNum(li.qty),
        toNum(li.rate),
        toNum(li.amount),
        toNum(li.applied_in_period),
        li.dispute_note || li.comments || '',
      ]),
    ];
    const mwWs = XLSX.utils.aoa_to_sheet(mwData);
    mwWs['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, mwWs, 'Measured Works');

    // ── Variation Summary sheet ──
    const varItems = lineItems.filter(li => li.sheet_name === 'variations');
    const varData = [
      ['VO Ref', 'Date', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Total Cost', 'Comments'],
      ...varItems.map(li => [
        li.item_ref || '',
        li.source_date || '',
        li.ref || '',
        li.item || '',
        li.unit || '',
        toNum(li.qty),
        toNum(li.rate),
        toNum(li.amount),
        li.dispute_note || '',
      ]),
    ];
    const varWs = XLSX.utils.aoa_to_sheet(varData);
    varWs['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, varWs, 'Variation Summary');

    // ── Materials On site sheet ──
    const matItems = lineItems.filter(li => li.sheet_name === 'materials');
    const matData = [
      ['Item', 'Description', 'Unit', 'Quantity', 'Cost'],
      ...matItems.map(li => [
        li.item_ref || '',
        li.item || '',
        li.unit || '',
        toNum(li.qty),
        toNum(li.amount),
      ]),
    ];
    const matWs = XLSX.utils.aoa_to_sheet(matData);
    matWs['!cols'] = [{ wch: 10 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, matWs, 'Materials On site');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const fileName = `AFP_${afp.afp_number}_${(afp.job_name || 'job').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Upload
    const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
    const fileUrl = uploadRes.file_url;

    return Response.json({ file_url: fileUrl, file_name: fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}