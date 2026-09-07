import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ============================================================
// getMyDuties — aggregates all crew duty items across cycles
// ============================================================
// Returns a structured object with daily/weekly/monthly/yearly
// duty items, each with due_status, mitti verification, and
// action URLs. Also calculates vehicle check frequency from
// weekly mileage (300+ mi/week → daily).

const MILEAGE_THRESHOLD = 300; // miles per week

function daysBetween(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay() || 7; // 0=Sun → 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function dueStatus(daysUntilDue: number): string {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'due_today';
  if (daysUntilDue <= 7) return 'due_this_week';
  return 'on_track';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get staff record
    const staffList = await base44.entities.Staff.filter({ user_id: user.id });
    const staff = staffList?.[0];
    if (!staff) return Response.json({ error: 'No staff profile' }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart();

    // ── Today's assignments ──
    const todaysAssignments = await base44.entities.RotaAssignment.filter({
      staff_id: staff.id,
      assigned_date: today,
      assignment_type: 'job',
    });

    // ── Vehicle for check frequency ──
    let vehicle: any = null;
    let vehicleId: string | null = null;
    if (todaysAssignments.length > 0 && todaysAssignments[0].vehicle_id) {
      vehicleId = todaysAssignments[0].vehicle_id;
    } else if (staff.default_vehicle_id) {
      vehicleId = staff.default_vehicle_id;
    }
    if (vehicleId) {
      try {
        const vList = await base44.asServiceRole.entities.Vehicle.filter({ id: vehicleId });
        vehicle = vList?.[0] || null;
      } catch (e) { /* continue */ }
    }

    // ── Calculate weekly mileage ──
    let weeklyMileage = 0;
    if (vehicleId) {
      try {
        const logs = await base44.asServiceRole.entities.VehicleLocationLog.filter({
          vehicle_id: vehicleId,
        });
        // Get odometer readings from this week
        const weekLogs = (logs || [])
          .filter((l: any) => l.recorded_at && l.recorded_at >= weekStart && l.odometer_km != null)
          .sort((a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
        if (weekLogs.length >= 2) {
          const minOdo = weekLogs[0].odometer_km;
          const maxOdo = weekLogs[weekLogs.length - 1].odometer_km;
          weeklyMileage = Math.round((maxOdo - minOdo) * 0.621371); // km → miles
        } else if (vehicle?.current_mileage) {
          // Fallback: use current_mileage as a rough indicator
          weeklyMileage = 0; // can't calculate without historical data
        }
      } catch (e) { /* continue */ }
    }

    // ── Determine effective check frequency ──
    let effectiveFrequency = 'weekly';
    if (vehicle) {
      if (vehicle.check_frequency === 'daily') {
        effectiveFrequency = 'daily';
      } else if (vehicle.check_frequency === 'weekly') {
        effectiveFrequency = 'weekly';
      } else {
        // auto — detect from mileage
        effectiveFrequency = weeklyMileage >= MILEAGE_THRESHOLD ? 'daily' : 'weekly';
      }
    }

    // ── Last Mitti audits by category ──
    let lastVehicleCheck: any = null;
    let lastPowra: any = null;
    let lastEquipmentCheck: any = null;
    try {
      const audits = await base44.asServiceRole.entities.SafetyReport.filter({
        auditor_staff_id: staff.id,
      });
      const vehicleAudits = audits.filter((a: any) => a.audit_category === 'vehicle_check')
        .sort((a: any, b: any) => new Date(b.conducted_at || b.completed_at || 0).getTime() - new Date(a.conducted_at || a.completed_at || 0).getTime());
      lastVehicleCheck = vehicleAudits[0] || null;
      const powraAudits = audits.filter((a: any) => a.audit_category === 'powra')
        .sort((a: any, b: any) => new Date(b.conducted_at || b.completed_at || 0).getTime() - new Date(a.conducted_at || a.completed_at || 0).getTime());
      lastPowra = powraAudits[0] || null;
      const equipAudits = audits.filter((a: any) => a.audit_category === 'equipment')
        .sort((a: any, b: any) => new Date(b.conducted_at || b.completed_at || 0).getTime() - new Date(a.conducted_at || a.completed_at || 0).getTime());
      lastEquipmentCheck = equipAudits[0] || null;
    } catch (e) { /* continue */ }

    // ── Today's check timestamps from assignment ──
    const todayAssignment = todaysAssignments[0];
    const todayVehicleCheckAt = todayAssignment?.mitti_vehicle_check_at || null;
    const todayPowraAt = todayAssignment?.mitti_powra_at || null;
    const todayEquipmentCheckAt = todayAssignment?.mitti_equipment_check_at || null;

    // ── Compliance items (yearly cycle) ──
    let complianceItems: any[] = [];
    try {
      const allItems = await base44.entities.ComplianceItem.filter({
        reference_id: staff.id,
      });
      complianceItems = (allItems || []).filter((i: any) => i.expiry_date);
    } catch (e) { /* continue */ }

    // ── Toolbox talks (weekly) ──
    let lastToolboxTalk: any = null;
    try {
      const talks = await base44.asServiceRole.entities.ToolboxTalk.list('-created_date', 10);
      // Find the most recent one this staff member attended
      lastToolboxTalk = (talks || []).find((t: any) =>
        t.attendees && Array.isArray(t.attendees) && t.attendees.includes(staff.id)
      ) || (talks || [])[0] || null;
    } catch (e) { /* continue */ }

    // ── Equipment calibrations (monthly) ──
    let lastCalibration: any = null;
    try {
      const calibrations = await base44.asServiceRole.entities.EquipmentCalibration.list('-calibration_date', 5);
      lastCalibration = calibrations?.[0] || null;
    } catch (e) { /* continue */ }

    // ── Environmental reports (monthly) ──
    let lastEnvReport: any = null;
    try {
      const envReports = await base44.asServiceRole.entities.EnvironmentalReport.list('-created_date', 5);
      lastEnvReport = envReports?.[0] || null;
    } catch (e) { /* continue */ }

    // ── Build duty items ──
    const daily: any[] = [];
    const weekly: any[] = [];
    const monthly: any[] = [];
    const yearly: any[] = [];

    // Daily: Vehicle check (if daily frequency)
    if (effectiveFrequency === 'daily') {
      const done = !!todayVehicleCheckAt;
      daily.push({
        label: 'Vehicle Check',
        category: 'vehicle_check',
        frequency: 'Daily (300+ mi/week)',
        due_status: done ? 'done' : 'overdue',
        mitti_verified: done,
        last_completed_at: todayVehicleCheckAt || lastVehicleCheck?.conducted_at || null,
        action_type: 'mitti_form',
        action_url: 'vehicle_check',
      });
    } else {
      // Weekly vehicle check
      const lastCheckDate = lastVehicleCheck?.conducted_at || lastVehicleCheck?.completed_at || null;
      const daysSince = daysBetween(lastCheckDate);
      const done = daysSince <= 7;
      weekly.push({
        label: 'Vehicle Check',
        category: 'vehicle_check',
        frequency: 'Weekly',
        due_status: done ? 'done' : daysSince > 7 ? 'overdue' : 'due_this_week',
        mitti_verified: !!lastCheckDate,
        last_completed_at: lastCheckDate,
        action_type: 'mitti_form',
        action_url: 'vehicle_check',
      });
    }

    // Daily: POWRA (once per shift start)
    const powraDone = !!todayPowraAt;
    daily.push({
      label: 'POWRA',
      category: 'powra',
      frequency: 'Each shift',
      due_status: powraDone ? 'done' : (todayAssignment ? 'due_today' : 'on_track'),
      mitti_verified: powraDone,
      last_completed_at: todayPowraAt || lastPowra?.conducted_at || null,
      action_type: 'mitti_form',
      action_url: 'powra',
    });

    // Daily: Plant/Equipment check (drillers only)
    if (/driller/i.test(staff.job_title || '')) {
      const equipDone = !!todayEquipmentCheckAt;
      daily.push({
        label: 'Plant / Equipment Check',
        category: 'equipment',
        frequency: 'Daily',
        due_status: equipDone ? 'done' : (todayAssignment ? 'due_today' : 'on_track'),
        mitti_verified: equipDone,
        last_completed_at: todayEquipmentCheckAt || lastEquipmentCheck?.conducted_at || null,
        action_type: 'mitti_form',
        action_url: 'equipment',
      });
    }

    // Daily: PPE inspection
    daily.push({
      label: 'PPE Inspection',
      category: 'ppe',
      frequency: 'Daily',
      due_status: todayAssignment ? (todayAssignment.daily_checks_completed ? 'done' : 'due_today') : 'on_track',
      mitti_verified: false,
      last_completed_at: todayAssignment?.daily_checks_completed_at || null,
      action_type: 'shift_wizard',
      action_url: 'checks',
    });

    // Daily: Timesheet submission
    let timesheetSubmitted = false;
    try {
      const ts = await base44.entities.Timesheet.filter({ staff_id: staff.id, date: today });
      timesheetSubmitted = ts?.some((t: any) => t.status === 'submitted' || t.status === 'approved') || false;
    } catch (e) { /* continue */ }
    daily.push({
      label: 'Submit Timesheet',
      category: 'timesheet',
      frequency: 'Daily',
      due_status: timesheetSubmitted ? 'done' : (todayAssignment && todayAssignment.status === 'completed' ? 'overdue' : 'on_track'),
      mitti_verified: false,
      last_completed_at: null,
      action_type: 'navigate',
      action_url: '/staff-schedule',
    });

    // Daily: KeyLogBook entries (drillers)
    if (/driller/i.test(staff.job_title || '')) {
      daily.push({
        label: 'KeyLogBook Entry',
        category: 'keylogbook',
        frequency: 'Daily',
        due_status: todayAssignment ? 'due_today' : 'on_track',
        mitti_verified: false,
        last_completed_at: null,
        action_type: 'navigate',
        action_url: '/staff-schedule',
      });
    }

    // Daily: Asset sign-out/return
    daily.push({
      label: 'Asset Sign-Out / Return',
      category: 'assets',
      frequency: 'Per shift',
      due_status: todayAssignment ? 'due_today' : 'on_track',
      mitti_verified: false,
      last_completed_at: null,
      action_type: 'navigate',
      action_url: '/scanner',
    });

    // Weekly: Toolbox talk
    const lastTalkDate = lastToolboxTalk?.created_date || lastToolboxTalk?.delivered_at || null;
    const daysSinceTalk = daysBetween(lastTalkDate);
    weekly.push({
      label: 'Toolbox Talk',
      category: 'toolbox_talk',
      frequency: 'Weekly',
      due_status: daysSinceTalk <= 7 ? 'done' : daysSinceTalk > 14 ? 'overdue' : 'due_this_week',
      mitti_verified: false,
      last_completed_at: lastTalkDate,
      action_type: 'navigate',
      action_url: '/compliance',
    });

    // Weekly: COSHH review
    weekly.push({
      label: 'COSHH Review',
      category: 'coshh',
      frequency: 'Weekly',
      due_status: 'on_track',
      mitti_verified: false,
      last_completed_at: null,
      action_type: 'navigate',
      action_url: '/compliance',
    });

    // Monthly: Equipment calibration check
    const lastCalDate = lastCalibration?.calibration_date || lastCalibration?.created_date || null;
    const daysSinceCal = daysBetween(lastCalDate);
    monthly.push({
      label: 'Equipment Calibration Check',
      category: 'calibration',
      frequency: 'Monthly',
      due_status: daysSinceCal <= 30 ? 'done' : daysSinceCal > 60 ? 'overdue' : 'due_this_week',
      mitti_verified: false,
      last_completed_at: lastCalDate,
      action_type: 'navigate',
      action_url: '/assets',
    });

    // Monthly: Environmental inspection
    const lastEnvDate = lastEnvReport?.created_date || lastEnvReport?.date || null;
    const daysSinceEnv = daysBetween(lastEnvDate);
    monthly.push({
      label: 'Environmental Inspection',
      category: 'environmental',
      frequency: 'Monthly',
      due_status: daysSinceEnv <= 30 ? 'done' : daysSinceEnv > 60 ? 'overdue' : 'due_this_week',
      mitti_verified: false,
      last_completed_at: lastEnvDate,
      action_type: 'navigate',
      action_url: '/compliance',
    });

    // Monthly: Safety audit review
    monthly.push({
      label: 'Safety Audit Review',
      category: 'safety_audit',
      frequency: 'Monthly',
      due_status: 'on_track',
      mitti_verified: false,
      last_completed_at: null,
      action_type: 'navigate',
      action_url: '/compliance',
    });

    // Yearly: Training renewals & compliance items
    for (const item of complianceItems) {
      const expiryDate = item.expiry_date;
      // Handle YYYY-MM format for staff compliance
      let daysUntilExpiry: number;
      if (expiryDate && expiryDate.length === 7) {
        // YYYY-MM format — parse as end of month
        const d = new Date(expiryDate + '-01');
        d.setMonth(d.getMonth() + 1, 0); // last day of that month
        daysUntilExpiry = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      } else {
        daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }
      yearly.push({
        label: item.title || 'Training Renewal',
        category: item.qualification_type || 'other',
        frequency: 'Yearly',
        due_status: daysUntilExpiry < 0 ? 'overdue' : daysUntilExpiry <= 30 ? 'due_this_week' : daysUntilExpiry <= 90 ? 'on_track' : 'on_track',
        mitti_verified: false,
        last_completed_at: item.issue_date || null,
        action_type: 'navigate',
        action_url: '/staff-profile',
        expiry_date: expiryDate,
        days_until_expiry: daysUntilExpiry,
      });
    }

    // Yearly: LOLER/PUWER thorough examination
    yearly.push({
      label: 'LOLER / PUWER Thorough Examination',
      category: 'loler_puwer',
      frequency: 'Yearly (6-monthly for lifting gear)',
      due_status: 'on_track',
      mitti_verified: false,
      last_completed_at: null,
      action_type: 'navigate',
      action_url: '/assets',
    });

    // ── Summary ──
    const allItems = [...daily, ...weekly, ...monthly, ...yearly];
    const overdue = allItems.filter((i: any) => i.due_status === 'overdue').length;
    const dueToday = allItems.filter((i: any) => i.due_status === 'due_today').length;
    const dueThisWeek = allItems.filter((i: any) => i.due_status === 'due_this_week').length;
    const allDone = overdue === 0 && dueToday === 0;

    // ── Update vehicle weekly mileage cache ──
    if (vehicle && vehicleId) {
      try {
        await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
          weekly_mileage_miles: weeklyMileage,
          weekly_mileage_calculated_at: new Date().toISOString(),
        });
      } catch (e) { /* non-fatal */ }
    }

    return Response.json({
      daily,
      weekly,
      monthly,
      yearly,
      summary: {
        overdue,
        due_today: dueToday,
        due_this_week: dueThisWeek,
        all_done: allDone,
      },
      vehicle: vehicle ? {
        id: vehicle.id,
        name: vehicle.name,
        registration_number: vehicle.registration_number,
        check_frequency: vehicle.check_frequency || 'auto',
        check_frequency_override: vehicle.check_frequency_override || false,
        effective_frequency: effectiveFrequency,
        weekly_mileage_miles: weeklyMileage,
      } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}