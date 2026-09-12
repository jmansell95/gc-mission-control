import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Plus, Users, Building2, Crown, Globe, Search, Lock, Layers, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import {
  PERMISSION_MODULES, SYSTEM_GROUPS, defaultPermissions, normalizePermissions,
} from '@/utils/permissions';
import AccessGroupEditor from './access/AccessGroupEditor';
import AccessGroupDetail from './access/AccessGroupDetail';
import CrewAccessManager from './access/CrewAccessManager';

export default function EnterpriseAccessManager({ profile }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { divisions = [] } = useDivision();
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('groups');

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all-access'],
    queryFn: async () => (await base44.entities.Staff.list('-created_date', 5000)),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-all'],
    queryFn: async () => (await base44.entities.Team.list()),
  });
  const { data: manifests = [] } = useQuery({
    queryKey: ['all-access-manifests'],
    queryFn: async () => (await base44.entities.DivisionAccessManifest.list('-created_date', 5000)),
  });

  // Build assignment + division coverage maps
  const staffByGroup = {};
  const divisionsByGroup = {};
  staff.forEach(s => {
    if (s.permission_group_id) {
      staffByGroup[s.permission_group_id] = (staffByGroup[s.permission_group_id] || 0) + 1;
      if (s.division_id) {
        if (!divisionsByGroup[s.permission_group_id]) divisionsByGroup[s.permission_group_id] = new Set();
        divisionsByGroup[s.permission_group_id].add(s.division_id);
      }
    }
  });
  const teamCountByGroup = {};
  teams.forEach(t => {
    if (t.permission_group_id) {
      teamCountByGroup[t.permission_group_id] = (teamCountByGroup[t.permission_group_id] || 0) + 1;
    }
  });
  const manifestCountByGroup = {};
  manifests.forEach(m => {
    if (m.permission_group_id) {
      manifestCountByGroup[m.permission_group_id] = (manifestCountByGroup[m.permission_group_id] || 0) + 1;
    }
  });

  const ensureSystemGroups = useMutation({
    mutationFn: async () => {
      for (const g of SYSTEM_GROUPS) {
        const existing = await base44.entities.PermissionGroup.filter({ name: g.name });
        if (existing.length === 0) {
          await base44.entities.PermissionGroup.create({ ...g, permissions: normalizePermissions(g.permissions) });
        } else {
          const existingGroup = existing[0];
          const stored = existingGroup.permissions || {};
          const expected = normalizePermissions(g.permissions);
          let needsUpdate = false;
          const updatedPerms = { ...stored };
          PERMISSION_MODULES.forEach(m => {
            if (!(m.key in stored)) { updatedPerms[m.key] = expected[m.key]; needsUpdate = true; }
          });
          if (needsUpdate) {
            await base44.entities.PermissionGroup.update(existingGroup.id, { permissions: normalizePermissions(updatedPerms) });
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries(['permission-groups']),
  });

  useEffect(() => {
    if (groups.length === 0 && !isLoading) ensureSystemGroups.mutate();
  }, [groups.length, isLoading]);

  // Auto-select first group
  useEffect(() => {
    if (!selectedGroupId && groups.length > 0) setSelectedGroupId(groups[0].id);
  }, [groups]);

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
      qc.invalidateQueries(['staff-all-access']);
      qc.invalidateQueries(['teams-all']);
      toast({ title: 'Group deleted' });
      setSelectedGroupId(null);
    },
    onError: (e) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const handleDelete = (group) => {
    const count = (staffByGroup[group.id] || 0) + (teamCountByGroup[group.id] || 0);
    if (count > 0) {
      toast({ title: 'Cannot delete group', description: `${count} staff/team member(s) are still assigned. Reassign them first.`, variant: 'destructive' });
      return;
    }
    if (confirm(`Delete "${group.name}"? This cannot be undone.`)) deleteMutation.mutate(group.id);
  };

  const getDivisionsForGroup = (groupId) => {
    const divIds = divisionsByGroup[groupId];
    if (!divIds) return [];
    return divisions.filter(d => divIds.has(d.id));
  };

  const systemGroups = groups.filter(g => g.is_system);
  const customGroups = groups.filter(g => !g.is_system);
  const totalAssigned = Object.values(staffByGroup).reduce((a, b) => a + b, 0);
  const totalDivisionsCovered = new Set(Object.values(divisionsByGroup).flatMap(s => [...s])).size;
  const totalManifests = manifests.length;

  const filteredSystem = systemGroups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredCustom = customGroups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="hub-glass rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Enterprise-Wide Access Control <Globe className="w-3.5 h-3.5 text-emerald-600" />
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Use <strong>Access Groups</strong> to edit base permissions and division-specific lockdowns, or switch to <strong>Crews</strong> to apply a permission group to an entire team at once — every crew member inherits the same access instantly.
          </p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        <button onClick={() => setViewMode('groups')} className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ' + (viewMode === 'groups' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <KeyRound className="w-3.5 h-3.5" /> Access Groups
        </button>
        <button onClick={() => setViewMode('crews')} className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ' + (viewMode === 'crews' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Users className="w-3.5 h-3.5" /> Crews
        </button>
      </div>

      {viewMode === 'groups' && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile icon={KeyRound} label="Total Groups" value={groups.length} tone="emerald" />
        <StatTile icon={Users} label="Staff Assigned" value={totalAssigned} tone="blue" />
        <StatTile icon={Building2} label="Business Streams Covered" value={totalDivisionsCovered} tone="amber" />
        <StatTile icon={Layers} label="Business Stream Overrides" value={totalManifests} tone="violet" />
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ─── LEFT: Group Explorer ─── */}
        <div className="lg:col-span-4 hub-glass rounded-2xl p-4 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto">
          {/* Search + New */}
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
            <button onClick={() => setEditing({ name: '', description: '', is_read_only: false, permissions: defaultPermissions() })} className="inline-flex items-center gap-1 px-2.5 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
            </div>
          )}

          {/* System Groups */}
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

          {/* Custom Groups */}
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

          {!isLoading && customGroups.length === 0 && systemGroups.length > 0 && !search && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 text-center">
              <p className="text-xs font-semibold text-slate-500">No custom groups yet</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Click "New" to create one</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Group Detail ─── */}
        <div className="lg:col-span-8 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto">
          {selectedGroup ? (
            <AccessGroupDetail
              group={selectedGroup}
              groups={groups}
              staffCount={staffByGroup[selectedGroup.id] || 0}
              divisions={getDivisionsForGroup(selectedGroup.id)}
              overrideCount={manifestCountByGroup[selectedGroup.id] || 0}
              onEdit={() => setEditing(selectedGroup)}
              onDelete={() => handleDelete(selectedGroup)}
            />
          ) : (
            <div className="hub-glass rounded-2xl p-12 text-center">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Select a group to manage its access</p>
              <p className="text-xs text-slate-400 mt-1">Choose a permission group from the list on the left</p>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {viewMode === 'crews' && (
        <CrewAccessManager />
      )}

      {/* Inline editor */}
      {editing && (
        <AccessGroupEditor group={editing} onCancel={() => setEditing(null)} onSave={(g) => saveMutation.mutate(g)} saving={saveMutation.isPending} />
      )}
    </div>
  );
}

function GroupListItem({ group, active, staffCount, overrideCount, onClick }) {
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
          {staffCount > 0 && <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{staffCount}</span>}
          {overrideCount > 0 && <span className="flex items-center gap-0.5 text-amber-600"><Lock className="w-2.5 h-2.5" />{overrideCount}</span>}
        </div>
      </div>
    </button>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    amber: 'from-amber-500 to-orange-600',
    violet: 'from-violet-500 to-purple-600',
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-3 text-white relative overflow-hidden shadow-md`}>
      <Icon className="absolute right-2 top-2 w-6 h-6 opacity-20" />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums mt-1">{value}</p>
      </div>
    </div>
  );
}