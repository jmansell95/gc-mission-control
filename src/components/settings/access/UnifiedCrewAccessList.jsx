import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, ShieldCheck, Crown, ChevronDown, Pencil, Trash2, Lock, Eye,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { normalizePermissions } from '@/utils/permissions';
import AccessSelect from './AccessSelect';
import { SelectItem, SelectLabel, SelectSeparator, SelectGroup } from '@/components/ui/select';

const CATEGORY_LABELS = {
  field_ops: 'Field Operations',
  depot: 'Depot',
  management: 'Management',
};

const TIER_BADGES = {
  full: { label: 'Full Access', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  office: { label: 'Office Staff', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  field: { label: 'Field Team', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'read-only': { label: 'Read Only', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

function getTier(group, p) {
  if (group.is_read_only) return 'read-only';
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  if (writeCount === Object.keys(p).length) return 'full';
  if (writeCount > 0) return 'office';
  return 'field';
}

/**
 * UnifiedCrewAccessList — single unified list replacing the old two-tab
 * (Access Groups + Crews) layout. Every crew (team) in the active business
 * stream renders as a row with an inline permission-group selector; expanding
 * a row reveals a compact summary of the selected group (tier, permission
 * breakdown, staff count) with edit/delete actions.
 */
export default function UnifiedCrewAccessList({ scopedDivisionId, onEditGroup, onDeleteGroup }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-all'],
    queryFn: async () => (await base44.entities.Team.list('-created_date', 500)),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all-access'],
    queryFn: async () => (await base44.entities.Staff.list('-created_date', 5000)),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });

  const staffByTeam = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      if (s.team_id) {
        if (!map[s.team_id]) map[s.team_id] = [];
        map[s.team_id].push(s);
      }
    });
    return map;
  }, [staff]);

  // Staff count per group within the active division
  const staffByGroup = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      if (s.permission_group_id && (!scopedDivisionId || s.division_id === scopedDivisionId)) {
        map[s.permission_group_id] = (map[s.permission_group_id] || 0) + 1;
      }
    });
    return map;
  }, [staff, scopedDivisionId]);

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = teams;
    if (scopedDivisionId) list = list.filter(t => t.division_id === scopedDivisionId);
    if (q) list = list.filter(t => (t.name || '').toLowerCase().includes(q));
    return list;
  }, [teams, search, scopedDivisionId]);

  useEffect(() => {
    if (!expandedTeamId && filteredTeams.length > 0) setExpandedTeamId(filteredTeams[0].id);
  }, [filteredTeams, expandedTeamId]);

  const assignMutation = useMutation({
    mutationFn: async ({ teamId, newGroupId, staffIds }) => {
      await base44.entities.Team.update(teamId, { permission_group_id: newGroupId || null });
      if (staffIds.length > 0) {
        const updates = staffIds.map(id => ({ id, permission_group_id: newGroupId || null }));
        await base44.entities.Staff.bulkUpdate(updates);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['teams-all'] });
      qc.invalidateQueries({ queryKey: ['staff-all-access'] });
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      const groupName = groups.find(g => g.id === vars.newGroupId)?.name || 'No group';
      toast({ title: 'Crew permissions updated', description: `${vars.staffIds.length} staff synced to ${groupName}` });
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const handleGroupChange = (team, newGroupId) => {
    const staffIds = (staffByTeam[team.id] || []).map(s => s.id);
    assignMutation.mutate({ teamId: team.id, newGroupId, staffIds });
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crews..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A] bg-white"
        />
      </div>

      {teamsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="insight-card rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No crews in this business stream</p>
          <p className="text-xs text-slate-400 mt-1">Create teams in the Staff Hub to manage crew access here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTeams.map(team => (
            <CrewRow
              key={team.id}
              team={team}
              groups={groups}
              members={staffByTeam[team.id] || []}
              groupStaffCount={staffByGroup}
              expanded={expandedTeamId === team.id}
              onToggleExpand={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
              onGroupChange={(gid) => handleGroupChange(team, gid)}
              saving={assignMutation.isPending}
              onEditGroup={onEditGroup}
              onDeleteGroup={onDeleteGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CrewRow({ team, groups, members, groupStaffCount, expanded, onToggleExpand, onGroupChange, saving, onEditGroup, onDeleteGroup }) {
  const currentGroup = groups.find(g => g.id === team.permission_group_id) || null;
  const categoryLabel = CATEGORY_LABELS[team.category] || team.category || 'General';

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{team.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{categoryLabel}</span>
              {team.job_type && (
                <span className="font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 uppercase tracking-wide">{team.job_type.replace(/_/g, ' ')}</span>
              )}
              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{members.length}</span>
            </div>
          </div>
        </button>

        {/* Inline group selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <AccessSelect
            value={currentGroup?.id || ''}
            onChange={onGroupChange}
            placeholder="Select group…"
            disabled={saving}
            triggerClassName="h-9 min-w-[150px] rounded-xl"
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
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <ChevronDown className={'w-4 h-4 transition-transform ' + (expanded ? 'rotate-180' : '')} />
          </button>
        </div>
      </div>

      {/* Expanded group detail */}
      {expanded && (
        <div className="animate-slide-up border-t border-slate-100 bg-slate-50/50 px-4 py-4">
          {currentGroup ? (
            <GroupSummaryPanel
              group={currentGroup}
              staffCount={groupStaffCount[currentGroup.id] || 0}
              onEdit={onEditGroup}
              onDelete={onDeleteGroup}
            />
          ) : (
            <div className="text-center py-4">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">No permission group assigned</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Select a group above to apply access to all {members.length} crew members</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSummaryPanel({ group, staffCount, onEdit, onDelete }) {
  const p = normalizePermissions(group.permissions);
  const tier = getTier(group, p);
  const badge = TIER_BADGES[tier];
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const noneCount = Object.values(p).filter(v => v === 'none').length;
  const total = Object.keys(p).length || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {group.is_read_only && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            <h3 className="text-sm font-extrabold text-slate-900 truncate">{group.name}</h3>
            {group.is_system && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Crown className="w-2.5 h-2.5" /> SYSTEM
              </span>
            )}
          </div>
          <span className={'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ' + badge.cls}>
            <span className={'w-1.5 h-1.5 rounded-full ' + badge.dot} />
            {badge.label}
          </span>
          {group.description && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{group.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onEdit && (
            <button onClick={() => onEdit(group)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {onDelete && !group.is_system && (
            <button onClick={() => onDelete(group)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-white p-2 text-center border border-slate-100">
          <Users className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
          <p className="text-sm font-extrabold text-slate-700 tabular-nums">{staffCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Staff</p>
        </div>
        <div className="rounded-lg bg-white p-2 text-center border border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
          <p className="text-sm font-extrabold text-emerald-600 tabular-nums">{writeCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Full</p>
        </div>
        <div className="rounded-lg bg-white p-2 text-center border border-slate-100">
          <Eye className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
          <p className="text-sm font-extrabold text-amber-600 tabular-nums">{readCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Read</p>
        </div>
        <div className="rounded-lg bg-white p-2 text-center border border-slate-100">
          <Lock className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
          <p className="text-sm font-extrabold text-slate-500 tabular-nums">{noneCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Hidden</p>
        </div>
      </div>

      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${(writeCount / total) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${(readCount / total) * 100}%` }} />
      </div>
    </div>
  );
}