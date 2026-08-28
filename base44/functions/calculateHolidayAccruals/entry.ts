import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Holiday pay accrual calculator — for each active staff member, calculates
// their holiday year window, entitlement, days taken (from approved absences),
// days remaining, and days accrued to date. Creates or updates HolidayPayAccrual
// records. Run as a scheduled automation or manually from the admin dashboard.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all active staff — only direct employees accrue holiday pay.
    // Subcontractor firms, agency-supplied labour, and other non-payroll staff
    // are excluded. Existing accrual records for non-direct staff are left
    // untouched (preserving history) but the UI filters them out.
    const allStaff = await base44.asServiceRole.entities.Staff.list();
    const activeStaff = allStaff.filter(s => s.is_active !== false && s.worker_type === 'direct_employee');

    // Get all approved holiday absences. The Absence entity stores the category
    // in `reason` (enum: holiday, sick, personal, training, other) — not
    // `absence_type`/`type` — so we match on reason === 'holiday'. 'annual'
    // is accepted too for legacy/external-synced records that may use it.
    const absences = await base44.asServiceRole.entities.Absence.filter({ status: 'approved' });
    const holidayAbsences = absences.filter(a => {
      const r = (a.reason || a.absence_type || a.type || '').toLowerCase();
      return r === 'holiday' || r === 'annual' || r === 'annual_leave';
    });

    // Get existing accrual records
    const existing = await base44.asServiceRole.entities.HolidayPayAccrual.list();
    const existingByStaff = {};
    for (const e of existing) {
      if (!existingByStaff[e.staff_id]) existingByStaff[e.staff_id] = e;
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const results = [];

    for (const staff of activeStaff) {
      // Determine holiday year window — UK default: 1 April to 31 March
      const currentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const yearStart = new Date(currentYear, 3, 1); // April 1
      const yearEnd = new Date(currentYear + 1, 3, 1);
      const yearStartStr = yearStart.toISOString().slice(0, 10);
      const yearEndStr = new Date(currentYear + 1, 2, 31).toISOString().slice(0, 10);

      // Default entitlement: 28 days (UK statutory for 5-day-week workers)
      const entitlement = 28;

      // Count holiday days taken in this year window. Days are computed from
      // the start_date → end_date range (inclusive), since the Absence entity
      // has no `days` field. Falls back to 1 day for single-date records.
      const myHolidays = holidayAbsences.filter(a => {
        if (a.staff_id !== staff.id) return false;
        const aDate = (a.start_date || a.date || '').slice(0, 10);
        return aDate >= yearStartStr && aDate <= yearEndStr;
      });
      const daysTaken = myHolidays.reduce((sum, a) => {
        const s = (a.start_date || a.date || '').slice(0, 10);
        const e = (a.end_date || s).slice(0, 10);
        if (!s) return sum + 1;
        const days = Math.max(1, Math.round((new Date(e + 'T00:00:00').getTime() - new Date(s + 'T00:00:00').getTime()) / 86400000) + 1);
        return sum + days;
      }, 0);

      // Calculate accrued to date
      const daysSinceStart = Math.floor((today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
      const accrualRatePerDay = entitlement / 365;
      const daysAccruedToDate = Math.min(entitlement, Math.round(daysSinceStart * accrualRatePerDay * 10) / 10);

      const daysRemaining = entitlement - daysTaken;
      const daysCarriedOver = existingByStaff[staff.id]?.days_carried_over || 0;

      const recordData = {
        staff_id: staff.id,
        staff_name: staff.name || '',
        holiday_year_start: yearStartStr,
        holiday_year_end: yearEndStr,
        total_entitlement_days: entitlement,
        days_taken: daysTaken,
        days_remaining: daysRemaining,
        days_carried_over: daysCarriedOver,
        accrual_rate_per_day: Math.round(accrualRatePerDay * 1000) / 1000,
        days_accrued_to_date: daysAccruedToDate,
        last_calculated_at: new Date().toISOString(),
      };

      let result;
      if (existingByStaff[staff.id]) {
        result = await base44.asServiceRole.entities.HolidayPayAccrual.update(existingByStaff[staff.id].id, recordData);
      } else {
        result = await base44.entities.HolidayPayAccrual.create(recordData);
      }
      results.push({ staff_id: staff.id, staff_name: staff.name, days_taken: daysTaken, days_remaining: daysRemaining, days_accrued: daysAccruedToDate });
    }

    return Response.json({
      ok: true,
      staff_count: activeStaff.length,
      calculated_at: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}