import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getPortalJobDetail — returns the full portal data for a single
// job, authenticated by the current logged-in user's portal
// access (portal_user_id on Client/Contractor). This is the
// auth-based equivalent of getJobByPortalToken.
//
// Called from the PortalDashboard page when a client or
// subcontractor selects a job to view.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const jobId = body?.job_id;
    if (!jobId) return Response.json({ error: 'Job ID required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Verify the user has portal access to this job
    let hasAccess = false;
    let role: string | null = null;
    if (job.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: job.client_id });
      if (clients[0]?.portal_user_id === user.id) { hasAccess = true; role = 'client'; }
    }
    if (!hasAccess && job.contractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: job.contractor_id });
      if (contractors[0]?.portal_user_id === user.id) { hasAccess = true; role = 'subcontractor'; }
    }
    if (!hasAccess) return Response.json({ error: 'No portal access to this job' }, { status: 403 });

    // Fetch all portal data in parallel
    const [rawAssignments, allStaff, photos, documents, comments, milestones, timesheets, costItems, allInvoices, allDelays] = await Promise.all([
      base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id }),
      base44.asServiceRole.entities.Staff.list(),
      base44.asServiceRole.entities.SitePhoto.filter({ job_id: job.id }),
      base44.asServiceRole.entities.JobDocument.filter({ job_id: job.id }),
      base44.asServiceRole.entities.JobComment.filter({ job_id: job.id }),
      base44.asServiceRole.entities.JobMilestone.filter({ job_id: job.id }),
      base44.asServiceRole.entities.Timesheet.filter({ job_id: job.id }),
      base44.asServiceRole.entities.JobCostItem.filter({ job_id: job.id }),
      base44.asServiceRole.entities.Invoice.filter({ job_id: job.id }),
      base44.asServiceRole.entities.JobDelayLog.filter({ job_id: job.id }),
    ]);

    // Deduplicate assignments: one per staff per date (keep most advanced status)
    const dedup: Record<string, any> = {};
    (rawAssignments || []).forEach((a: any) => {
      const k = `${a.staff_id}|${a.assigned_date}`;
      const order: Record<string, number> = { completed: 3, started: 2, assigned: 1 };
      if (!dedup[k] || (order[a.status] || 0) > (order[dedup[k].status] || 0)) dedup[k] = a;
    });
    const assignments = Object.values(dedup);

    let client = null;
    if (job.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: job.client_id });
      client = clients[0] || null;
    }
    let contractor = null;
    if (job.contractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: job.contractor_id });
      contractor = contractors[0] || null;
    }

    const schedule: Record<string, any[]> = {};
    const teamMap: Record<string, any> = {};
    assignments.forEach((a: any) => {
      if (!schedule[a.assigned_date]) schedule[a.assigned_date] = [];
      const staffMember = (allStaff || []).find((s: any) => s.id === a.staff_id);
      const name = staffMember?.name || 'Unknown';
      const role = staffMember?.job_title || '';
      schedule[a.assigned_date].push({
        staff_name: name, role, status: a.status || 'assigned', meterage: a.meterage || 0,
      });
      if (!teamMap[a.staff_id]) teamMap[a.staff_id] = { name, role, shifts: 0, meterage: 0 };
      teamMap[a.staff_id].shifts += 1;
      teamMap[a.staff_id].meterage += a.meterage || 0;
    });
    const team = Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name));

    const validTimesheets = (timesheets || []).filter((t: any) => t.status === 'submitted' || t.status === 'approved');
    let totalMinutes = 0;
    let totalMeterage = 0;
    validTimesheets.forEach((t: any) => {
      totalMinutes += Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
      totalMeterage += Number(t.meterage) || 0;
    });
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const total = assignments.length;
    const completed = assignments.filter((a: any) => a.status === 'completed').length;
    const started = assignments.filter((a: any) => a.status === 'started').length;

    // Billing (client-facing, internal costs never exposed)
    const vatRate = job.vat_rate != null ? Number(job.vat_rate) : 20;
    const markup = job.markup_percentage != null ? Number(job.markup_percentage) : 0;
    let itemNet = 0;
    const lineItems: any[] = [];
    (costItems || []).forEach((c: any) => {
      const qty = Number(c.quantity) || 1;
      const unit = Number(c.unit_cost) || 0;
      itemNet += qty * unit;
      lineItems.push({ description: c.description, category: c.category });
    });
    let internalNet = itemNet;
    if (job.actual_cost != null && job.actual_cost !== '') internalNet = Number(job.actual_cost);
    const markupAmount = internalNet * (markup / 100);
    const clientNet = internalNet + markupAmount;
    const clientVat = clientNet * (vatRate / 100);
    const clientTotal = clientNet + clientVat;
    const hasBilling = (costItems || []).length > 0 || job.client_charge != null;
    const billing: any = {
      quote_label: job.client_charge_description || 'Project Investment',
      line_items: lineItems,
      subtotal: Math.round(clientNet * 100) / 100,
      vat_rate: vatRate,
      vat_amount: Math.round(clientVat * 100) / 100,
      total: Math.round(clientTotal * 100) / 100,
      has_items: (costItems || []).length > 0,
    };
    if (!billing.has_items && job.client_charge != null) {
      billing.subtotal = Number(job.client_charge);
      billing.vat_amount = 0;
      billing.total = Number(job.client_charge);
      billing.legacy = true;
    }

    const delays = (allDelays || [])
      .filter((d: any) => d.manager_review_status === 'approved')
      .sort((a, b) => new Date(b.reported_at || b.created_date).getTime() - new Date(a.reported_at || a.created_date).getTime())
      .map((d: any) => ({
        delay_type: d.delay_type || 'other',
        description: d.description || '',
        impacted_days: Number(d.impacted_days) || 0,
        impacted_hours: Number(d.impacted_hours) || 0,
        reported_at: d.reported_at || d.created_date || '',
        staff_name: d.staff_name || '',
      }));

    return Response.json({
      job: {
        id: job.id,
        name: job.name,
        location: job.location,
        job_type: job.job_type,
        status: job.status,
        start_date: job.start_date,
        end_date: job.end_date,
        notes: job.notes,
        job_reference: job.job_reference || '',
        project_manager: job.project_manager || '',
        site_contact_name: job.site_contact_name || '',
        site_contact_phone: job.site_contact_phone || '',
        client_charge_description: job.client_charge_description || '',
        portal_sections: job.portal_sections || null,
      },
      role,
      client: client ? { name: client.name, contact_name: client.contact_name } : null,
      contractor: contractor ? { name: contractor.name, contact_name: contractor.contact_name || '' } : null,
      schedule,
      progress: { total, completed, started },
      team,
      totals: { staff: team.length, shifts: total, hours: totalHours, meterage: totalMeterage },
      billing: hasBilling ? billing : null,
      documents: (documents || []).filter((d: any) => d.client_visible === true).map((d: any) => ({
        id: d.id,
        document_url: d.document_url,
        document_name: d.document_name,
        category: d.category || 'other',
        client_approved: d.client_approved === true,
        client_approved_at: d.client_approved_at || '',
        client_approved_by_name: d.client_approved_by_name || '',
      })),
      milestones: (milestones || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((m: any) => ({
        name: m.name,
        completed: m.completed || false,
        target_date: m.target_date || '',
        completed_date: m.completed_date || '',
      })),
      comments: (comments || []).map((c: any) => ({
        author_name: c.author_name,
        message: c.message,
        is_client: c.is_client || false,
        created_date: c.created_date || '',
      })),
      photos: (photos || []).map((p: any) => ({
        photo_url: p.photo_url,
        caption: p.caption || '',
        uploaded_by: p.uploaded_by_name || '',
      })),
      delays,
      invoices: (allInvoices || [])
        .filter((inv: any) => inv.status === 'sent' || inv.status === 'overdue')
        .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
        .map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          issue_date: inv.issue_date || '',
          due_date: inv.due_date || '',
          net_total: inv.net_total,
          vat_total: inv.vat_total,
          gross_total: inv.gross_total,
          status: inv.status,
        })),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}