import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, Crown, ShieldCheck, Loader2, KeyRound,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AccessSelect from '@/components/settings/access/AccessSelect';
import { SelectItem, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';

/**
 * StaffAssignmentPanel — the core of the redesigned Access Levels page.
 *
 * A searchable list of staff scoped to the active business stream. Each row
 * has an inline permission-group selector. Changing the selector updates the
 * staff member's permission_group_id and syncs their platform role/division
 * via syncStaffUserRoles.
 *
 * Mobile-first: rows stack the selector below the name on phones, inline on
 * desktop. A focusStaffId prop auto-scrolls to and highlights a staff member
 * (used when navigating from the Staff Hub "Permissions" link).
 */
export default function StaffAssignmentPanel({ scopedDivisionId, focusStaffId }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);
  const listRef = useRef(null);
  const rowRefs = useRef({});

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff-access-assign', scopedDivisionId],
    queryFn: async () => {
      if (!scopedDivisionId) return [];
      return await base44.entities.Staff.filter({ division_id: scopedDivisionId }, 'name', 5000);
    },
    enabled: !!scopedDivisionId,
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 200)),
  });

  const groupMap = useMemo(() => {
    const m = {};
    groups.forEach(g => { m[g.id] = g; });
    return m;
  }, [groups]);

  const assignMutation = useMutation({
    mutationFn: async ({ staffId, newGroupId }) => {
      await base44.entities.Staff.update(staffId, { permission_group_id: newGroupId || null });
      try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [staffId] }); } catch (_) {}
    },
    onMutate: ({ staffId }) => setSavingId(staffId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staff-access-assign', scopedDivisionId] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      const g = groupMap[vars.newGroupId];
      toast({ title: 'Permission updated', description: g ? `Now in "${g.name}"` : 'Group removed' });
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
    onSettled: () => setSavingId(null),
  });

  const q = search.toLowerCase().trim();
  const filteredStaff = useMemo(() => {
    if (!q) return staff;
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.job_title || '').toLowerCase().includes(q));
  }, [staff, q]);

  // Auto-scroll to the focused staff member
  useEffect(() => {
    if (focusStaffId && rowRefs.current[focusStaffId]) {
      rowRefs.current[focusStaffId].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusStaffId, filteredStaff.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  if (filteredStaff.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-10 text-center">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">{q ? 'No staff match your search' : 'No staff in this business stream'}</p>
        <p className="text-xs text-slate-400 mt-1">{q ? 'Try a different name or role.' : 'Add staff via the Staff Hub to assign their access here.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={listRef}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff by name or role…"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 bg-white shadow-sm transition"
        />
      </div>

      {/* Staff list */}
      <div className="space-y-2">
        {filteredStaff.map(s => (
          <StaffAssignRow
            key={s.id}
            staff={s}
            groups={groups}
            groupMap={groupMap}
            saving={savingId === s.id}
            focused={focusStaffId === s.id}
            rowRef={(el) => { rowRefs.current[s.id] = el; }}
            onChange={(gid) => assignMutation.mutate({ staffId: s.id, newGroupId: gid })}
          />
        ))}
      </div>
    </div>
  );
}

function StaffAssignRow({ staff, groups, groupMap, saving, focused, rowRef, onChange }) {
  const currentGroup = groupMap[staff.permission_group_id] || null;
  const initials = (staff.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div
      ref={rowRef}
      className={`insight-card rounded-2xl p-3 sm:p-4 transition ${focused ? 'ring-2 ring-[#2E5A1A]/40 bg-[#2E5A1A]/[0.03]' : ''}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Identity */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-xs overflow-hidden">
            {staff.avatar_url ? <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">{staff.name}</p>
              {!staff.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-semibold flex-shrink-0">Inactive</span>}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{staff.job_title || 'Crew Member'}</p>
            {currentGroup && (
              <div className="flex items-center gap-1 mt-1">
                {currentGroup.is_system ? <Crown className="w-3 h-3 text-amber-500" /> : <ShieldCheck className="w-3 h-3 text-[#2E5A1A]" />}
                <span className="text-[10px] font-semibold text-slate-500 truncate">{currentGroup.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Group selector */}
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          {saving && <Loader2 className="w-4 h-4 text-[#2E5A1A] animate-spin flex-shrink-0" />}
          <AccessSelect
            value={staff.permission_group_id || ''}
            onChange={onChange}
            placeholder="Assign group…"
            disabled={saving}
            triggerClassName="h-10 sm:h-9 min-w-[160px] w-full sm:w-auto rounded-xl text-sm"
          >
            <SelectItem value="__none">
              <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-slate-200 flex-shrink-0" /> No group</span>
            </SelectItem>
            <SelectGroup>
              <SelectLabel>System Groups</SelectLabel>
              {groups.filter(g => g.is_system).map(g => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> {g.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
            {groups.filter(g => !g.is_system).length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Custom Groups</SelectLabel>
                  {groups.filter(g => !g.is_system).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </AccessSelect>
        </div>
      </div>
    </div>
  );
}