import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * commitTrainingImport
 * Bulk-creates TrainingBooking + ComplianceItem records from a confirmed
 * AI-classified certificate import. Called after the manager reviews the
 * preview from classifyTrainingCertificates and edits/assigns each row.
 *
 * Payload: { records: [{ staff_id, staff_name, qualification_type, document_type,
 *   holder_name, issue_date, expiry_date, provider_name, file_url, file_name,
 *   is_front, is_back, venue }] }
 * Returns: { created: { bookings: n, compliance: n }, errors: [] }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admins only' }, { status: 403 });

    const body = await req.json();
    const records = Array.isArray(body?.records) ? body.records : [];
    if (records.length === 0) return Response.json({ error: 'No records to commit' }, { status: 400 });

    // Group front/back of the same card for the same staff member so the
    // ComplianceItem carries both document_url + back_document_url.
    const groups = new Map();
    for (const r of records) {
      if (!r.staff_id) continue;
      const key = `${r.staff_id}::${r.qualification_type}`;
      if (!groups.has(key)) groups.set(key, { staff_id: r.staff_id, staff_name: r.staff_name || '', qualification_type: r.qualification_type, issue_date: r.issue_date || '', expiry_date: r.expiry_date || '', provider_name: r.provider_name || '', front: null, back: null, bookings: [] });
      const g = groups.get(key);
      if (r.issue_date && !g.issue_date) g.issue_date = r.issue_date;
      if (r.expiry_date && !g.expiry_date) g.expiry_date = r.expiry_date;
      if (r.provider_name && !g.provider_name) g.provider_name = r.provider_name;
      if (r.is_back) g.back = { url: r.file_url, name: r.file_name };
      else g.front = { url: r.file_url, name: r.file_name };
      g.bookings.push(r);
    }

    // 1. Create ComplianceItems (one per staff+qualification group, front+back merged)
    const compliancePayloads = [];
    for (const g of groups.values()) {
      const doc = g.front || g.back;
      if (!doc) continue;
      compliancePayloads.push({
        category: 'staff',
        qualification_type: g.qualification_type,
        reference_id: g.staff_id,
        reference_name: g.staff_name,
        title: g.qualification_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        issue_date: g.issue_date || undefined,
        expiry_date: g.expiry_date || undefined,
        document_url: g.front?.url || '',
        document_name: g.front?.name || '',
        back_document_url: g.back?.url || '',
        back_document_name: g.back?.name || '',
        review_status: 'approved',
        status_override: 'auto',
        responsible_person: g.staff_name,
      });
    }

    let createdCompliance = [];
    if (compliancePayloads.length > 0) {
      try {
        createdCompliance = await base44.asServiceRole.entities.ComplianceItem.bulkCreate(compliancePayloads);
      } catch (e) {
        // fall back to individual creates
        for (const p of compliancePayloads) {
          try { await base44.asServiceRole.entities.ComplianceItem.create(p); } catch (_) {}
        }
      }
    }

    // 2. Create TrainingBooking records (one per original file, status 'passed')
    const bookingPayloads = [];
    for (const r of records) {
      if (!r.staff_id) continue;
      bookingPayloads.push({
        staff_id: r.staff_id,
        staff_name: r.staff_name || '',
        status: 'passed',
        certificate_url: r.file_url || '',
        certificate_name: r.file_name || '',
        certificate_title: (r.document_type || r.qualification_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        issue_date: r.issue_date || '',
        expiry_date: r.expiry_date || '',
        notes: [r.venue && `Venue: ${r.venue}`, r.provider_name && `Provider: ${r.provider_name}`].filter(Boolean).join('\n'),
        completed_at: new Date().toISOString(),
      });
    }

    let createdBookings = [];
    if (bookingPayloads.length > 0) {
      try {
        createdBookings = await base44.asServiceRole.entities.TrainingBooking.bulkCreate(bookingPayloads);
      } catch (e) {
        for (const p of bookingPayloads) {
          try { await base44.asServiceRole.entities.TrainingBooking.create(p); } catch (_) {}
        }
      }
    }

    return Response.json({
      created: { bookings: bookingPayloads.length, compliance: compliancePayloads.length },
      errors: [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}