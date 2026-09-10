import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ============================================================
// checkDarkCrew — scheduled check for crew members who have
// "gone dark" (no GPS fix for >15 min during an active shift).
//
// For each dark crew member, creates an InboxItem alert and
// sends an email to their manager so they can follow up.
//
// Runs as a service role (no user session) via a scheduled
// workflow every 15 minutes during working hours.
// ============================================================

const DARK_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Use service role to bypass RLS — this is a scheduled system check
    const base44Admin = base44.asServiceRole;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Get all active assignments for today (job assignments only)
    const assignments = await base44Admin.entities.RotaAssignment.filter({
      assigned_date: today,
      assignment_type: "job",
    });

    // Get all staff (to check tracking_enabled)
    const allStaff = await base44Admin.entities.Staff.list("-created_date", 500);
    const staffById = new Map(allStaff.map(s => [s.id, s]));

    // Get recent location logs (last 30 min) to check who has a fresh fix
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const recentLogs = await base44Admin.entities.StaffLocationLog.filter(
      {},
      "-recorded_at",
      500,
    );
    // Filter to last 30 min
    const recentByStaff = new Map();
    for (const log of recentLogs) {
      if (!log.staff_id) continue;
      if (log.recorded_at && new Date(log.recorded_at).getTime() > now.getTime() - 30 * 60 * 1000) {
        if (!recentByStaff.has(log.staff_id) || new Date(log.recorded_at) > new Date(recentByStaff.get(log.staff_id).recorded_at)) {
          recentByStaff.set(log.staff_id, log);
        }
      }
    }

    // Find dark crew: assigned today, tracking enabled, but no fix in >15 min
    const darkCrew = [];
    for (const assignment of assignments) {
      const staff = staffById.get(assignment.staff_id);
      if (!staff) continue;
      if (!staff.tracking_enabled || !staff.tracking_consent_signed_at) continue;

      const latestLog = recentByStaff.get(assignment.staff_id);
      if (!latestLog) {
        // No log at all in the last 30 min — definitely dark
        darkCrew.push({ staff, assignment, lastFixAt: null });
      } else {
        const age = now.getTime() - new Date(latestLog.recorded_at).getTime();
        if (age > DARK_THRESHOLD_MS) {
          darkCrew.push({ staff, assignment, lastFixAt: latestLog.recorded_at });
        }
      }
    }

    if (darkCrew.length === 0) {
      return Response.json({ status: "ok", dark_count: 0, message: "No dark crew detected" });
    }

    // Check for existing dark alerts (avoid spamming — only alert once per
    // staff per day unless the alert was already actioned)
    const existingAlerts = await base44Admin.entities.InboxItem.filter({
      category: "crew_dark",
      status: "pending",
    });
    const existingByStaff = new Set(existingAlerts.map(a => a.source_id));

    let alertsCreated = 0;
    let emailsSent = 0;

    for (const { staff, assignment, lastFixAt } of darkCrew) {
      // Skip if there's already a pending dark alert for this staff member
      if (existingByStaff.has(staff.id)) continue;

      // Resolve the manager (from Staff.manager_id or fallback to admins)
      let managerStaffId = staff.manager_id || null;
      let managerName = "";
      let managerEmail = "";
      let managerUserId = "";

      if (managerStaffId) {
        const manager = staffById.get(managerStaffId);
        if (manager) {
          managerName = manager.name;
          managerEmail = manager.email;
          managerUserId = manager.user_id || "";
        }
      }

      // If no manager, fall back to super admins
      if (!managerUserId) {
        const admins = allStaff.filter(s => s.system_role === "super_admin" || s.system_role === "admin");
        if (admins.length > 0) {
          managerStaffId = admins[0].id;
          managerName = admins[0].name;
          managerEmail = admins[0].email;
          managerUserId = admins[0].user_id || "";
        }
      }

      const minutes = lastFixAt ? Math.round((now.getTime() - new Date(lastFixAt).getTime()) / 60000) : null;

      // Create the inbox alert
      try {
        await base44Admin.entities.InboxItem.create({
          type: "alert",
          category: "crew_dark",
          title: `${staff.name} has gone dark`,
          body: `No GPS fix for ${minutes ? minutes + " min" : "30+ min"}. Last seen: ${lastFixAt ? new Date(lastFixAt).toLocaleString("en-GB") : "never"}. They have an active shift today${assignment.job_name ? ` on ${assignment.job_name}` : ""}.`,
          source_hub: "fleet",
          source_entity: "Staff",
          source_id: staff.id,
          deep_link: `/fleet?crew=${staff.id}`,
          priority: "urgent",
          status: "pending",
          assigned_to_staff_id: managerStaffId || null,
          assigned_to_user_id: managerUserId || null,
          assigned_to_name: managerName || "Manager",
          requester_staff_id: staff.id,
          requester_name: staff.name,
        });
        alertsCreated++;
      } catch (e) {
        // Non-fatal — continue with other crew
      }

      // Send email to the manager
      if (managerEmail) {
        try {
          await base44Admin.integrations.Core.SendEmail({
            to: managerEmail,
            subject: `⚠️ ${staff.name} has gone dark — no GPS for ${minutes ? minutes + " min" : "30+ min"}`,
            body: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#dc2626">Crew Member Gone Dark</h2>
              <p><strong>${staff.name}</strong> has not reported a GPS fix for ${minutes ? minutes + " minutes" : "over 30 minutes"}.</p>
              <p><strong>Last seen:</strong> ${lastFixAt ? new Date(lastFixAt).toLocaleString("en-GB") : "Never"}</p>
              ${assignment.job_name ? `<p><strong>Active job:</strong> ${assignment.job_name}</p>` : ""}
              <p style="margin-top:20px;padding:15px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">
                Please follow up with ${staff.name} to confirm they're safe and their phone tracking is working.
              </p>
              <p style="margin-top:20px"><a href="https://gc-mission-control.base44.app/fleet" style="color:#2E5A1A;font-weight:600">Open the Live Crew Map →</a></p>
            </div>`,
          });
          emailsSent++;
        } catch (e) {
          // Non-fatal
        }
      }
    }

    return Response.json({
      status: "ok",
      dark_count: darkCrew.length,
      alerts_created: alertsCreated,
      emails_sent: emailsSent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}