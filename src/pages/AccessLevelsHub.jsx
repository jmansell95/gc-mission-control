import React, { useState } from 'react';
import {
  KeyRound, Building2, Users, ShieldCheck,
} from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import HubShell from '@/components/HubShell';
import StaffAssignmentPanel from '@/components/access/StaffAssignmentPanel';
import PermissionGroupsPopup from '@/components/access/PermissionGroupsPopup';

/**
 * Access Levels Hub — division-scoped access management.
 *
 * Mobile-first single page with two concerns:
 *  1. Staff assignment — pick a staff member, assign a permission group.
 *  2. Permission Groups popup — create / edit / delete custom groups.
 *
 * The admin picks a business stream via the DivisionSwitcher in the sidebar;
 * the staff list and group dropdowns scope to that single business stream.
 * A focusStaffId prop (passed from the Staff Hub "Permissions" link) auto-
 * scrolls to and highlights a staff member on load.
 */
export default function AccessLevelsHub({ focusStaffId }) {
  const { activeDivision, activeDivisionId } = useDivision();
  const [showGroupsPopup, setShowGroupsPopup] = useState(false);

  // No active business stream — prompt the admin to pick one
  if (!activeDivision) {
    return (
      <HubShell
        icon={KeyRound}
        title="Access Levels"
        subtitle="Manage permission groups and staff access per business stream"
      >
        <div className="insight-card rounded-2xl p-10 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Pick a business stream first</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Access levels are managed inside each business stream. Use the business stream switcher in the sidebar to select one.
          </p>
        </div>
      </HubShell>
    );
  }

  return (
    <HubShell
      icon={KeyRound}
      title="Access Levels"
      subtitle={`Staff access · ${activeDivision.name}`}
      actions={
        <button
          onClick={() => setShowGroupsPopup(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm active:scale-95"
        >
          <ShieldCheck className="w-4 h-4" /> Permission Groups
        </button>
      }
    >
      {/* Intro card */}
      <div className="insight-card rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900">Assign staff access</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Search for a crew member below and pick their permission group. Use <strong>Permission Groups</strong> to create or edit groups.
            </p>
          </div>
        </div>
      </div>

      {/* Staff assignment list */}
      <StaffAssignmentPanel scopedDivisionId={activeDivisionId} focusStaffId={focusStaffId} />

      {/* Permission Groups popup */}
      <PermissionGroupsPopup
        open={showGroupsPopup}
        onClose={() => setShowGroupsPopup(false)}
        scopedDivisionId={activeDivisionId}
      />
    </HubShell>
  );
}