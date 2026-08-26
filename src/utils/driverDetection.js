// Driver staff are exempt from the "one assignment per day" rule because they
// legitimately do multiple drops/deliveries per day. We identify them two ways:
//   1. They appear as driver_staff_id on any DeliveryLog record (data-driven,
//      always accurate — these are the people actually doing drops).
//   2. Their team name contains "driver" or "delivery" (manual fallback).

const DRIVER_KEYWORDS = ['driver', 'delivery'];

/**
 * Build the set of staff IDs who are drivers, from a list of DeliveryLog records.
 * Returns a Set of staff_id strings.
 */
export function buildDriverStaffIds(deliveries = []) {
  const ids = new Set();
  deliveries.forEach(d => {
    if (d.driver_staff_id) ids.add(d.driver_staff_id);
  });
  return ids;
}

/**
 * Returns true if the given staff member is a driver (exempt from one-per-day).
 * @param staffId - the staff member's ID
 * @param staff - full staff list (to look up the team)
 * @param driverStaffIds - Set of staff IDs built from DeliveryLog
 * @param teams - team list (for name-based fallback)
 */
export function isDriverStaff(staffId, staff = [], driverStaffIds = new Set(), teams = []) {
  if (!staffId) return false;
  if (driverStaffIds.has(staffId)) return true;
  const member = staff.find(s => s.id === staffId);
  if (!member || !member.team_id) return false;
  const team = teams.find(t => t.id === member.team_id);
  if (!team) return false;
  const name = (team.name || '').toLowerCase();
  return DRIVER_KEYWORDS.some(kw => name.includes(kw));
}