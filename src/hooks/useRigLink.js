import { base44 } from '@/api/base44Client';

// Shared rig-link helpers used by the rig pill, the rota grid, the job
// schedule tab, and the field crew schedule. Keeps rig + crew-partner
// resolution in one place so every view shows the same link.

const PAIRING_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

// Deterministic colour per crew_pairing_id so the two crew members on the
// same rig share the same accent — the visual "link" between them.
export function hashPairingColor(pairingId) {
  if (!pairingId) return PAIRING_COLORS[0];
  let h = 0;
  for (let i = 0; i < pairingId.length; i++) h = (h * 31 + pairingId.charCodeAt(i)) >>> 0;
  return PAIRING_COLORS[h % PAIRING_COLORS.length];
}

// Resolve the rig + crew partner for a single shift.
// `allAssignments` should include other crew members' shifts for the same
// date so the partner can be found via crew_pairing_id.
export function resolveRigLink(assignment, rigs, allAssignments, staff) {
  if (!assignment?.rig_asset_id) return null;
  const rig = (rigs || []).find(r => r.id === assignment.rig_asset_id);
  if (!rig) return null;
  let partner = null;
  if (assignment.crew_pairing_id) {
    const p = (allAssignments || []).find(a =>
      a.crew_pairing_id === assignment.crew_pairing_id &&
      a.staff_id !== assignment.staff_id &&
      a.assigned_date === assignment.assigned_date
    );
    if (p) {
      const ps = (staff || []).find(s => s.id === p.staff_id);
      partner = { name: ps?.name || 'Unknown', role: p.crew_role };
    }
  }
  return { rig, partner, pairingId: assignment.crew_pairing_id, role: assignment.crew_role };
}

// Remove a rig link from a shift AND its partner's shift (same date +
// pairing) so the pairing dissolves cleanly. Never deletes the shifts —
// only clears rig_asset_id, crew_pairing_id and crew_role.
export async function removeRigLink(assignment, allAssignments) {
  // Clear the rig + pairing from this shift and its partner. crew_role is
  // left untouched (enum field — clearing it can fail validation); since the
  // pill only renders when rig_asset_id is set, the role is invisible once
  // the rig is unlinked and gets overwritten on re-link.
  const updates = [{ id: assignment.id, rig_asset_id: '', crew_pairing_id: '' }];
  if (assignment.crew_pairing_id) {
    const partner = (allAssignments || []).find(a =>
      a.crew_pairing_id === assignment.crew_pairing_id &&
      a.staff_id !== assignment.staff_id &&
      a.assigned_date === assignment.assigned_date
    );
    if (partner) updates.push({ id: partner.id, rig_asset_id: '', crew_pairing_id: '' });
  }
  await base44.entities.RotaAssignment.bulkUpdate(updates);
  return updates.length;
}