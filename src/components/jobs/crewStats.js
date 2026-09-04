// Shared helpers for computing per-crew-member stats on a job.
// Used by the redesigned Daily Schedule tab and the CrewDetailModal.

export function computeCrewStats(member, rotas, rigs) {
  const memberRotas = (rotas || []).filter(r => r.staff_id === member.id);
  const shifts = memberRotas.length;
  const completed = memberRotas.filter(r => r.status === 'completed').length;
  const started = memberRotas.filter(r => r.status === 'started').length;
  const daysWorked = new Set(memberRotas.map(r => r.assigned_date)).size;
  const totalMeterage = memberRotas.reduce((s, r) => s + (Number(r.meterage) || 0), 0);

  // Travel time — sum inter_site_travel_minutes + any geofence-derived travel
  const travelMinutes = memberRotas.reduce((s, r) => s + (Number(r.inter_site_travel_minutes) || 0), 0);

  // Hours on shift — estimate from start/end times where available
  let hoursMinutes = 0;
  memberRotas.forEach(r => {
    if (r.start_time && r.end_time) {
      const [sh, sm] = r.start_time.split(':').map(Number);
      const [eh, em] = r.end_time.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60; // overnight
      hoursMinutes += mins;
    } else if (r.started_at && r.completed_at) {
      hoursMinutes += Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 60000);
    }
  });

  // Current rig (most recent assignment with a rig_asset_id)
  const rigRota = [...memberRotas]
    .sort((a, b) => (b.assigned_date || '').localeCompare(a.assigned_date || ''))
    .find(r => r.rig_asset_id);
  const rig = rigRota ? (rigs || []).find(g => g.id === rigRota.rig_asset_id) : null;
  const crewRole = rigRota?.crew_role || null;

  return {
    shifts, completed, started, daysWorked, totalMeterage,
    travelMinutes, hoursMinutes, rig, rigRota, crewRole,
    memberRotas,
  };
}

export function findCrewPartner(member, rotas, allStaff) {
  // Find the crew partner — someone sharing the same crew_pairing_id on the
  // same date, or someone on the same rig on the same date with a different role.
  const memberRotas = (rotas || []).filter(r => r.staff_id === member.id && r.crew_pairing_id);
  if (memberRotas.length === 0) return null;
  const latest = memberRotas.sort((a, b) => (b.assigned_date || '').localeCompare(a.assigned_date || ''))[0];
  const partner = (rotas || []).find(r =>
    r.crew_pairing_id === latest.crew_pairing_id &&
    r.staff_id !== member.id &&
    r.assigned_date === latest.assigned_date
  );
  if (!partner) return null;
  const partnerStaff = (allStaff || []).find(s => s.id === partner.staff_id);
  return partnerStaff ? { staff: partnerStaff, role: partner.crew_role, rota: partner } : null;
}

export const fmtHours = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};