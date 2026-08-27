import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Plus, Users, Building2, Crown, Search, Lock,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import {
  SYSTEM_GROUPS, defaultPermissions, normalizePermissions,
} from '@/utils/permissions';
import AccessGroupEditor from '@/components/settings/access/AccessGroupEditor';
import AccessGroupDetail from '@/components/settings/access/AccessGroupDetail';
import CrewAccessManager from '@/components/settings/access/CrewAccessManager';

/**
 * Access Levels Hub — division-scoped access management.
 *
 * Replaces the old enterprise-wide Access Levels tab. The admin picks a
 * business stream (via the DivisionSwitcher in the sidebar) and this hub
 * scopes permission groups, lockdown overrides, and crew assignments to
 * that single business stream.
 */
export default function AccessLevelsHub() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeDivision, activeDivisionId, divisions = [] } = useDivision();
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('groups');

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 200)),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-access-hub', activeDivisionId],
    queryFn: async () => {
      if (!activeDivisionId) return [];
      return await base44.entities.Staff.filter({ division_id: activeDivisionId }, '-created_date', 5000);
    },
    enabled: !!activeDivisionId,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-access-hub', activeDivisionId],
    queryFn: async () => {
      if (!activeDivisionId) return [];
      return await base44.entities.Team.filter({ division_id: activeDivisionId });
    },
    enabled: !!activeDivisionId,
  });
  const { data: manifests = [] } = useQuery({
    queryKey: ['access-manifests-hub', activeDivisionId],
    queryFn: async () => {
      if (!activeDivisionId) return [];
      return await base44.entities.DivisionAccessManifest.filter({ division_id: activeDivisionId });
    },
    enabled: !!activeDivisionId,
  });

  // Backfill landing_page + staff_type on existing system groups (one-time
  // migration for groups created before these fields existed).
  const backfillMutation = useMutation({
    mutationFn: async () => {
      for (const g of groups) {
        if (!g.is_system) continue;
        const sysDef = SYSTEM_GROUPS.find(s => s.name === g.name);
        if (!sysDef) continue;
        const patch = {};
        if (!g.landing_page && sysDef.landing_page) patch.landing_page = sysDef.landing_page;
        if (!g.staff_type && sysDef.staff_type) patch.staff_type = sysDef.staff_type;
        if (Object.keys(patch).length > 0) {
          await base44.entities.PermissionGroup.update(g.id, patch);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries(['permission-groups']),
  });

  useEffect(() => {
    if (groups.length > 0) backfillMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  // Auto-select first group
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  // Staff counts per group (within this division)
  const staffByGroup = useMemo(() => {
    const m = {};
    staff.forEach(s => {
      if (s.permission_group_id) m[s.permission_group_id] = (m[s.permission_group_id] || 0) + 1;
    });
    return m;
  }, [staff]);

  const manifestCountByGroup = useMemo(() => {
    const m = {};
    manifests.forEach(man => {
      if (man.permission_group_id) m[man.permission_group_id] = (m[man.permission_group_id] || 0) + 1;
    });
    return m;
  }, [manifests]);

  const saveMutation = useMutation({
    mutationFn: async (group) => {
      const payload = { ...group, permissions: normalizePermissions(group.permissions) };
      if (group.id) await base44.entities.PermissionGroup.update(group.id, payload);
      else await base44.entities.PermissionGroup.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      toast({ title: 'Permission group saved' });
      setEditing(null);
    },
    onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await base44.entities.PermissionGroup.delete(id); },
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      toast({ title: 'Group deleted' });
      setSelectedGroupId(null);
    },
    onError: (e) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const handleDelete = (group) => {
    const count = staffByGroup[group.id] || 0;
    if (count > 0) {
      toast({ title: 'Cannot delete group', description: `${count} staff in this business stream are still assigned. Reassign them first.`, variant: 'destructive' });
      return;
    }
    if (confirm(`Delete "${group.name}"? This cannot be undone.`)) deleteMutation.mutate(group.id);
  };

  const systemGroups = groups.filter(g => g.is_system);
  const customGroups = groups.filter(g => !g.is_system);
  const q = search.toLowerCase().trim();
  const filteredSystem = systemGroups.filter(g => !q || g.name?.toLowerCase().includes(q));
  const filteredCustom = customGroups.filter(g => !q || g.name?.toLowerCase().includes(q));

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // No active business stream — prompt the admin to pick one
  if (!activeDivision) {
    return (
      <HubShell
        icon={KeyRound}
        title="Access Levels"
        subtitle="Manage permission groups and lockdowns per business stream"
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

  const pills = [
    { id: 'groups', label: 'Access Groups', icon: KeyRound },
    { id: 'crews', label: 'Crews', icon: Users },
  ];

  return (
    <HubShell
      icon={KeyRound}
      title="Access Levels"
      subtitle={`Permission groups & lockdowns · ${activeDivision.name}`}
      actions={
        <button
          onClick={() => setEditing({ name: '', description: '', is_read_only: false, staff_type: 'flexible', landing_page: 'auto', permissions: defaultPermissions() })}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" /> New Group
        </button>
      }
    >
      <SubPills pills={pills} active={view} onChange={setView} />

      {view === 'crews' ? (
        <CrewAccessManager scopedDivisionId={activeDivisionId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Group Explorer */}
          <div className="lg:col-span-4 insight-card rounded-2xl p-4 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
              </div>
            )}

            {filteredSystem.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> System Groups
                </p>
                <div className="space-y-1">
                  {filteredSystem.map(g => (
                    <GroupListItem
                      key={g.id}
                      group={g}
                      active={selectedGroupId === g.id}
                      staffCount={staffByGroup[g.id] || 0}
                      overrideCount={manifestCountByGroup[g.id] || 0}
                      onClick={() => setSelectedGroupId(g.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredCustom.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> Custom Groups
                </p>
                <div className="space-y-1">
                  {filteredCustom.map(g => (
                    <GroupListItem
                      key={g.id}
                      group={g}
                      active={selectedGroupId === g.id}
                      staffCount={staffByGroup[g.id] || 0}
                      overrideCount={manifestCountByGroup[g.id] || 0}
                      onClick={() => setSelectedGroupId(g.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && customGroups.length === 0 && systemGroups.length > 0 && !q && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 text-center">
                <p className="text-xs font-semibold text-slate-500">No custom groups yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Click "New Group" to create one</p>
              </div>
            )}
          </div>

          {/* RIGHT: Group Detail (division-locked) */}
          <div className="lg:col-span-8 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
            {selectedGroup ? (
              <AccessGroupDetail
                group={selectedGroup}
                groups={groups}
                staffCount={staffByGroup[selectedGroup.id] || 0}
                divisions={[activeDivision]}
                overrideCount={manifestCountByGroup[selectedGroup.id] || 0}
                onEdit={() => setEditing(selectedGroup)}
                onDelete={() => handleDelete(selectedGroup)}
                lockedDivisionId={activeDivisionId}
              />
            ) : (
              <div className="insight-card rounded-2xl p-12 text-center">
                <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Select a group to manage its access</p>
                <p className="text-xs text-slate-400 mt-1">Choose a permission group from the list on the left</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <AccessGroupEditor
          group={editing}
          onCancel={() => setEditing(null)}
          onSave={(g) => saveMutation.mutate(g)}
          saving={saveMutation.isPending}
        />
      )}
    </HubShell>
  );
}

function GroupListItem({ group, active, staffCount, overrideCount, onClick }) {
  const typeBadge = group.staff_type === 'office'
    ? { label: 'Office', cls: 'bg-blue-100 text-blue-700' }
    : group.staff_type === 'field'
      ? { label: 'Field', cls: 'bg-amber-100 text-amber-700' }
      : null;
  return (
    <button
      onClick={onClick}
      className={'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ' +
        (active ? 'bg-[#2E5A1A]/10 ring-1 ring-[#2E5A1A]/30' : 'hover:bg-slate-50')}
    >
      {group.is_system ? <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className={'text-xs font-semibold truncate ' + (active ? 'text-[#2E5A1A]' : 'text-slate-700')}>{group.name}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {typeBadge && <span className={`px-1.5 py-0.5 rounded-full font-bold ${typeBadge.cls}`}>{typeBadge.label}</span>}
          {staffCount > 0 && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{staffCount}</span>}
          {overrideCount > 0 && <span className="flex items-center gap-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" />{overrideCount}</span>}
        </div>
      </div>
    </button>
  );
}