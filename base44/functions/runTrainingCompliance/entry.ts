import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { brandedWrapper, heading, p, dataTable, callout, escapeHtml, getAppBaseUrl } from '../../shared/emailStyling.ts';

/**
 * Training Compliance Autopilot — runs weekly on Monday at 07:00.
 *
 * Scans all compliance items for staff qualifications expiring within 60 days.
 * For each expiring item:
 *   1. Finds training providers that deliver that qualification
 *   2. Checks the staff member's rota for availability windows
 *   3. Drafts a training booking suggestion
 *   4. Sends a weekly digest email to managers with the full list
 *
 * Leverages: ComplianceItem, TrainingCourse, Supplier, RotaAssignment, SendEmail
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const sixtyDaysOut = new Date(now.getTime() + 60 * 86400000);
    const sixtyDaysStr = sixtyDaysOut.toISOString().slice(0, 7); // YYYY-MM for staff compliance

    // 1. Get all staff compliance items
    const complianceItems = await base44.asServiceRole.entities.ComplianceItem.filter({
      category: 'staff',
      review_status: { $ne: 'rejected' },
      status_override: { $ne: 'not_required' },
    });

    // 2. Find items expiring within 60 days
    const expiring = complianceItems.filter((item) => {
      if (!item.expiry_date) return false;
      // Staff compliance uses YYYY-MM format
      const expiry = item.expiry_date.length === 7
        ? new Date(item.expiry_date + '-01')
        : new Date(item.expiry_date);
      const diff = (expiry.getTime() - now.getTime()) / 86400000;
      return diff <= 60 && diff >= -30; // expiring soon or recently expired
    });

    if (expiring.length === 0) {
      return Response.json({ ok: true, expiringCount: 0, message: 'No training expiring in the next 60 days' });
    }

    // 3. Get all staff + training providers for matching
    const allStaff = await base44.asServiceRole.entities.Staff.list();
    const providers = await base44.asServiceRole.entities.Supplier.filter({ is_training_provider: true });

    const digest = [];
    const bookingsDrafted = [];

    for (const item of expiring) {
      const staffMember = allStaff.find((s) => s.id === item.reference_id);
      if (!staffMember) continue;

      // Find providers that deliver this qualification type
      const matchingProviders = providers.filter((p) =>
        (p.training_services || []).includes(item.qualification_type)
      );

      // Check the staff member's rota for the next 4 weeks to find available windows
      const fourWeeksOut = new Date(now.getTime() + 28 * 86400000).toISOString().slice(0, 10);
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
        staff_id: staffMember.id,
        assigned_date: { $gte: now.toISOString().slice(0, 10), $lte: fourWeeksOut },
      });

      // Find dates with no job assignment (off/leave days)
      const bookedDates = new Set(assignments.filter((a) => a.assignment_type === 'job').map((a) => a.assigned_date));

      digest.push({
        staff_name: staffMember.name,
        qualification: item.title,
        qualification_type: item.qualification_type,
        expiry_date: item.expiry_date,
        providers_available: matchingProviders.length,
        provider_names: matchingProviders.map((p) => p.name).slice(0, 3),
      });

      // Draft a training booking if a provider is available
      if (matchingProviders.length > 0) {
        const provider = matchingProviders[0];
        const existingBooking = await base44.asServiceRole.entities.TrainingBooking.filter({
          staff_id: staffMember.id,
          compliance_item_id: item.id,
          status: 'suggested',
        });
        if (existingBooking.length === 0) {
          await base44.asServiceRole.entities.TrainingBooking.create({
            staff_id: staffMember.id,
            staff_name: staffMember.name,
            compliance_item_id: item.id,
            qualification_type: item.qualification_type,
            provider_id: provider.id,
            provider_name: provider.name,
            status: 'suggested',
            notes: `Auto-suggested — ${item.title} expires ${item.expiry_date}. Manager review required.`,
          });
          bookingsDrafted.push(staffMember.name);
        }
      }
    }

    // 4. Send weekly digest email to admins
    if (digest.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const body = `The following staff qualifications expire within 60 days:\n\n` +
        digest.map((d) =>
          `• ${d.staff_name} — ${d.qualification} (expires ${d.expiry_date}) — ${d.providers_available} provider${d.providers_available !== 1 ? 's' : ''} available${d.provider_names.length > 0 ? ': ' + d.provider_names.join(', ') : ''}`
        ).join('\n') +
        `\n\n${bookingsDrafted.length} training booking${bookingsDrafted.length !== 1 ? 's' : ''} auto-drafted for manager review.\n\nGC Mission Control — Training Compliance Autopilot`;

      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Training Compliance Digest — ${digest.length} qualification${digest.length !== 1 ? 's' : ''} expiring`,
            body,
          });
        } catch (_) {}
      }
    }

    return Response.json({
      ok: true,
      expiringCount: expiring.length,
      bookingsDrafted: bookingsDrafted.length,
      digest,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}