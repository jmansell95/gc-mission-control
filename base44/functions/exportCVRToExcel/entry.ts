import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * exportCVRToExcel — generates a downloadable .xlsx file containing the
 * job's CVR data (Summary, Line Items, Variations, Cash Flow).
 *
 * Input:  { cvr_id: string }
 * Output: { file_url: string, file_name: string }
 */

function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { cvr_id } = body;
    if (!cvr_id) return Response.json({ error: 'cvr_id is required' }, { status: 400 });

    const cvr = await base44.entities.CVR.get(cvr_id);
    if (!cvr) return Response.json({ error: 'CVR not found' }, { status: 404 });

    const [lineItems, variations, cashFlow] = await Promise.all([
      base44.entities.CVRLineItem.filter({ cvr_id }, 'sort_order', 500),
      base44.entities.VariationOrder.filter({ cvr_id }, 'vo_number', 200),
      base44.entities.CashFlowEntry.filter({ cvr_id }, 'sort_order', 200),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Summary sheet ──
    const sumData = [
      ['Cost / Value Report'],
      [],
      ['Job Name', cvr.job_name || ''],
      ['Job Reference', cvr.job_reference || ''],
      ['Client', cvr.client_name || ''],
      ['Contract Value', toNum(cvr.contract_value)],
      ['Variations Total', toNum(cvr.variations_total)],
      ['Forecast Final Value', toNum(cvr.forecast_final_value)],
      ['Budget', toNum(cvr.budget)],
      ['Total Cost', toNum(cvr.total_cost)],
      ['Costs to Date', toNum(cvr.costs_to_date)],
      ['Value to Date', toNum(cvr.value_to_date)],
      ['Profit / Loss', toNum(cvr.profit_loss)],
      ['Profit %', toNum(cvr.profit_pct)],
      ['Project Start', cvr.project_start || ''],
      ['Project End', cvr.project_end || ''],
      ['Weeks in Progress', toNum(cvr.weeks_in_progress)],
    ];
    const sumWs = XLSX.utils.aoa_to_sheet(sumData);
    sumWs['!cols'] = [{ wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

    // ── Line Items sheet ──
    const liData = [
      ['Item Ref', 'Description', 'Tender Value', 'VO Values', 'Forecast Final', 'Invoiced Costs', 'Committed Costs', 'Orders Not Placed', 'Defects', 'Total Cost', 'Costs to Date', 'Value to Date', 'Profit / Loss'],
      ...lineItems.map(li => [
        li.item_ref || '',
        li.description || li.item || '',
        toNum(li.tender_value),
        toNum(li.vo_values_total || 0),
        toNum(li.forecast_final_value),
        toNum(li.invoiced_costs),
        toNum(li.committed_costs),
        toNum(li.orders_not_placed),
        toNum(li.defects_contingency),
        toNum(li.total_cost),
        toNum(li.costs_to_date),
        toNum(li.value_to_date),
        toNum(li.profit_loss),
      ]),
    ];
    const liWs = XLSX.utils.aoa_to_sheet(liData);
    liWs['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, liWs, 'Line Items');

    // ── Variations sheet ──
    const varData = [
      ['VO No.', 'Description', 'Agreed Value', 'Firm', 'Budget', 'Prelim Cost', 'Labour Cost', 'Plant Cost', 'Material Cost', 'Total Cost', 'Profit Margin', 'Profit %'],
      ...variations.map(v => [
        toNum(v.vo_number),
        v.description || '',
        toNum(v.agreed_value),
        toNum(v.firm),
        toNum(v.budget),
        toNum(v.prelim_cost),
        toNum(v.labour_cost),
        toNum(v.plant_cost),
        toNum(v.material_cost),
        toNum(v.total_cost),
        toNum(v.profit_margin),
        toNum(v.profit_margin_pct),
      ]),
    ];
    const varWs = XLSX.utils.aoa_to_sheet(varData);
    varWs['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, varWs, 'Variations');

    // ── Cash Flow sheet ──
    if (cashFlow.length > 0) {
      const cfData = [
        ['Month', 'Description', 'App Value', 'Qty', 'Unit', 'Rate', 'Amount'],
        ...cashFlow.map(cf => [
          cf.month_date || '',
          cf.description || '',
          toNum(cf.app_value),
          toNum(cf.qty),
          cf.unit || '',
          toNum(cf.rate),
          toNum(cf.amount),
        ]),
      ];
      const cfWs = XLSX.utils.aoa_to_sheet(cfData);
      cfWs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, cfWs, 'Cash Flow');
    }

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const fileName = `CVR_${(cvr.job_name || 'job').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
    const fileUrl = uploadRes.file_url;

    return Response.json({ file_url: fileUrl, file_name: fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}