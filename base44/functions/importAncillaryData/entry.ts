import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr } from '../../shared/cvrHelpers.ts';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * importAncillaryData — parses equipment delivery lists and weekly cost sheets
 * from Excel files and creates the appropriate records (JobCostItem for equipment,
 * DailyCost for weekly costs) with duplicate detection.
 *
 * Input: { items: [{ file_url, job_id, type, source_file_name }] }
 *   type: 'equipment_deliveries' or 'weekly_costs'
 * Output: { results: [{ type, file_name, records_created, duplicates_skipped, errors }] }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items array is required' }, { status: 400 });
    }

    const results: any[] = [];

    for (const item of items) {
      const { file_url, job_id, type, source_file_name } = item;
      if (!file_url || !job_id || !type) {
        results.push({ type, error: 'Missing required fields (file_url, job_id, type)' });
        continue;
      }

      try {
        // Fetch and parse the Excel file
        const fileRes = await fetch(file_url);
        if (!fileRes.ok) {
          results.push({ type, file_name: source_file_name, error: 'Could not download file' });
          continue;
        }
        const fileBuf = await fileRes.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });

        // Get the job for division_id
        const jobs = await base44.entities.Job.filter({ id: job_id });
        const job = jobs[0];
        if (!job) {
          results.push({ type, file_name: source_file_name, error: 'Job not found' });
          continue;
        }

        if (type === 'equipment_deliveries') {
          // ── Parse equipment delivery list ──
          // Columns: col_1=Project, col_2=Date Delivered, col_3=Delivered by,
          // col_4=Diameter, col_5=Lengths, col_6=Number Sent, col_7=Total Length (m),
          // col_8=Individual weight, col_9=Total weight (KG), col_10=Total weight (Ton)

          // Check for existing equipment deliveries to avoid duplicates
          const existing = await base44.asServiceRole.entities.JobCostItem.filter(
            { job_id, category: 'internal_equipment' }, null, 500
          );
          const existingKeys = new Set(existing.map((e: any) =>
            `${e.start_date || ''}|${String(e.description || '').toLowerCase().trim()}`
          ));

          const deliveries: any[] = [];
          let duplicatesSkipped = 0;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const dateDelivered = row[2] instanceof Date ? row[2].toISOString().slice(0, 10) : '';
            const deliveredBy = String(row[3] || '').trim();
            const diameter = String(row[4] || '').trim();
            const lengths = String(row[5] || '').trim();
            const numberSent = String(row[6] || '').trim();
            const totalLength = String(row[7] || '').trim();
            const individualWeight = toNum(row[8]);
            const totalWeightKg = toNum(row[9]);
            const totalWeightTon = toNum(row[10]);

            // Skip rows without actual equipment data
            if (!diameter && !lengths && !numberSent) continue;

            // Build description from diameter + lengths + number sent
            const descParts = [diameter, lengths, numberSent].filter(Boolean);
            if (descParts.length === 0) continue;
            const description = `Drilling equipment: ${descParts.join(' - ')}`;
            const dupKey = `${dateDelivered}|${description.toLowerCase().trim()}`;

            if (existingKeys.has(dupKey)) {
              duplicatesSkipped++;
              continue;
            }
            existingKeys.add(dupKey);

            deliveries.push({
              job_id,
              category: 'internal_equipment',
              description,
              reference_number: deliveredBy ? `Delivered by ${deliveredBy}` : '',
              start_date: dateDelivered,
              unit_cost: 0,
              quantity: 1,
              unit_label: totalLength || numberSent || 'nr',
              notes: [
                diameter ? `Diameter: ${diameter}` : '',
                lengths ? `Lengths: ${lengths}` : '',
                numberSent ? `Number sent: ${numberSent}` : '',
                totalLength ? `Total length: ${totalLength}` : '',
                individualWeight ? `Individual weight: ${individualWeight}kg` : '',
                totalWeightKg ? `Total weight: ${totalWeightKg}kg (${totalWeightTon}t)` : '',
                deliveredBy ? `Delivered by: ${deliveredBy}` : '',
              ].filter(Boolean).join('\n'),
            });
          }

          if (deliveries.length > 0) {
            await base44.asServiceRole.entities.JobCostItem.bulkCreate(deliveries);
          }

          results.push({
            type: 'equipment_deliveries',
            file_name: source_file_name,
            records_created: deliveries.length,
            duplicates_skipped: duplicatesSkipped,
          });

        } else if (type === 'weekly_costs') {
          // ── Parse weekly cost sheet (EWR format) ──
          // Columns: col_1=Project, col_2=Date, col_3=Labour, col_4=Job Description,
          // col_5=Cost, col_6=Overnight Accommodation Y/N, col_7=Accom Cost, col_8=Total Cost

          // Check for existing daily costs from this source to avoid duplicates
          const existing = await base44.asServiceRole.entities.DailyCost.filter(
            { job_id, category: 'misc' }, null, 2000
          );
          const existingKeys = new Set(existing.map((e: any) =>
            `${e.date || ''}|${String(e.staff_name || '').toLowerCase().trim()}|${String(e.description || '').toLowerCase().trim()}`
          ));

          const costs: any[] = [];
          let duplicatesSkipped = 0;

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Parse date — handle Date objects, strings, and Excel serials
            let date = '';
            const rawDate = row[2];
            if (rawDate instanceof Date) {
              date = rawDate.toISOString().slice(0, 10);
            } else if (typeof rawDate === 'number' && rawDate > 20000 && rawDate < 80000) {
              const d = new Date(Date.UTC(1899, 11, 30) + rawDate * 86400000);
              date = d.toISOString().slice(0, 10);
            } else if (typeof rawDate === 'string' && rawDate.trim()) {
              const s = rawDate.trim();
              const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (isoMatch) date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
              else { const d = new Date(s); if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10); }
            }
            const labour = String(row[3] || '').trim();
            const jobDesc = String(row[4] || '').trim();
            const cost = toNum(row[5]);
            const overnightAccom = String(row[6] || '').trim();
            const accomCost = toNum(row[7]);
            const totalCost = toNum(row[8]);

            if (!labour) continue;

            // Create labour cost record
            const labourDesc = jobDesc || 'Mobilisation Crew';
            const labourKey = `${date}|${labour.toLowerCase().trim()}|${labourDesc.toLowerCase().trim()}`;
            if (!existingKeys.has(labourKey)) {
              existingKeys.add(labourKey);
              costs.push({
                job_id,
                staff_id: 'unknown',
                staff_name: labour,
                date,
                category: 'misc',
                description: labourDesc,
                amount_net: cost,
                amount_gross: cost,
                vat_rate: 0,
                status: 'approved',
                notes: `Imported from ${source_file_name || 'weekly cost sheet'}`,
              });
            } else {
              duplicatesSkipped++;
            }

            // Create accommodation cost record (if accommodation cost > 0)
            if (accomCost > 0) {
              const accomDesc = `Overnight Accommodation — ${overnightAccom || 'Yes'}`;
              const accomKey = `${date}|${labour.toLowerCase().trim()}|${accomDesc.toLowerCase().trim()}`;
              if (!existingKeys.has(accomKey)) {
                existingKeys.add(accomKey);
                costs.push({
                  job_id,
                  staff_id: 'unknown',
                  staff_name: labour,
                  date,
                  category: 'subsistence',
                  description: accomDesc,
                  amount_net: accomCost,
                  amount_gross: accomCost,
                  vat_rate: 0,
                  status: 'approved',
                  notes: `Imported from ${source_file_name || 'weekly cost sheet'}`,
                });
              } else {
                duplicatesSkipped++;
              }
            }
          }

          if (costs.length > 0) {
            // Create in batches of 100 to avoid bulkCreate limits
            for (let i = 0; i < costs.length; i += 100) {
              const batch = costs.slice(i, i + 100);
              await base44.asServiceRole.entities.DailyCost.bulkCreate(batch);
            }
          }

          results.push({
            type: 'weekly_costs',
            file_name: source_file_name,
            records_created: costs.length,
            duplicates_skipped: duplicatesSkipped,
          });
        }
      } catch (err: any) {
        results.push({ type, file_name: source_file_name, error: err.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}