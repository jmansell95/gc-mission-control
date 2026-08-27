import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, ShieldCheck, Layers,
  Building2, Crown, Briefcase, UserCheck, AlertCircle, RefreshCw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import AccessSelect from './AccessSelect';
import { SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';

const CATEGORY_LABELS = {
  field_ops: 'Field Operations',
  depot: 'Depot',
  management: 'Management',
};

/**
 * CrewAccessManager — enterprise-wide crew-based permissioning.
 * Lists all teams (crews) across every division in the left pane.
 * Selecting a crew shows its members and a permission-group selector.
 * Changing the crew's group syncs the same group to every staff member
 * in that crew, so permissions are applied at the crew level.
 */
export default function CrewAccessManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { divisions = [] } = useDivision();
  const [search, setSearch] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(null);

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

  // Staff grouped by team
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

  // Division coverage per team (derived from where the crew's staff sit)
  const divisionsByTeam = useMemo(() => {
    const map = {};
    Object.entries(staffByTeam).forEach(([teamId, members]) => {
      const divIds = new Set(members.map(m => m.division_id).filter(Boolean));
      map[teamId] = divisions.filter(d => divIds.has(d.id));
    });
    return map;
  }, [staffByTeam, divisions]);

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return teams;
    return teams.filter(t => (t.name || '').toLowerCase().includes(q));
  }, [teams, search]);

  useEffect(() => {
    if (!selectedTeamId && filteredTeams.length > 0) setSelectedTeamId(filteredTeams[0].id);
  }, [filteredTeams, selectedTeamId]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const selectedTeamStaff = selectedTeamId ? (staffByTeam[selectedTeamId] || []) : [];
  const selectedTeamDivisions = selectedTeamId ? (divisionsByTeam[selectedTeamId] || []) : [];

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

  const handleGroupChange = (newGroupId) => {
    if (!selectedTeam) return;
    const staffIds = selectedTeamStaff.map(s => s.id);
    assignMutation.mutate({ teamId: selectedTeam.id, newGroupId, staffIds });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ─── LEFT: Crew Explorer ─── */}
      <div className="lg:col-span-4 insight-card rounded-2xl p-4 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Crews & Teams</h3>
          <span className="text-xs font-bold text-slate-400 ml-auto">{teams.length} total</span>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crews..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
        {teamsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTeams.map(t => {
              const active = selectedTeamId === t.id;
              const members = staffByTeam[t.id] || [];
              const teamDivs = divisionsByTeam[t.id] || [];
              const group = groups.find(g => g.id === t.permission_group_id);
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ' +
                    (active ? 'bg-[#2E5A1A]/10 ring-1 ring-[#2E5A1A]/30' : 'hover:bg-slate-50')}
                >
                  <Users className={'w-3.5 h-3.5 flex-shrink-0 ' + (active ? 'text-[#2E5A1A]' : 'text-slate-400')} />
                  <div className="min-w-0 flex-1">
                    <p className={'text-xs font-semibold truncate ' + (active ? 'text-[#2E5A1A]' : 'text-slate-700')}>{t.name}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      {members.length > 0 && <span>{members.length} staff</span>}
                      {teamDivs.map(d => (
                        <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ background: d.color || '#2E5A1A' }} title={d.name} />
                      ))}
                    </div>
                  </div>
                  {group ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 flex-shrink-0 max-w-[80px] truncate">
                      {group.name}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 flex-shrink-0">Unset</span>
                  )}
                </button>
              );
            })}
            {filteredTeams.length === 0 && (
              <div className="text-center py-6">
                <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No crews found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── RIGHT: Crew Detail ─── */}
      <div className="lg:col-span-8">
        {selectedTeam ? (
          <CrewDetail
            team={selectedTeam}
            groups={groups}
            staff={selectedTeamStaff}
            divisions={selectedTeamDivisions}
            allDivisions={divisions}
            currentGroup={groups.find(g => g.id === selectedTeam.permission_group_id) || null}
            onGroupChange={handleGroupChange}
            saving={assignMutation.isPending}
          />
        ) : (
          <div className="insight-card rounded-2xl p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Select a crew to manage its access</p>
            <p className="text-xs text-slate-400 mt-1">Choose a team from the list on the left</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CrewDetail({ team, groups, staff, divisions, allDivisions, currentGroup, onGroupChange, saving }) {
  const categoryLabel = CATEGORY_LABELS[team.category] || team.category || 'General';

  return (
    <div className="space-y-4 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
      {/* ─── Crew Header ─── */}
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900 truncate">{team.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{categoryLabel}</span>
                {team.job_type && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 uppercase tracking-wide">{team.job_type.replace(/_/g, ' ')}</span>
                )}
              </div>
              {team.description && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{team.description}</p>}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <UserCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-slate-700 tabular-nums">{staff.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Crew Members</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <Building2 className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-extrabold text-slate-700 tabular-nums">{divisions.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Business Streams</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5 text-center">
            <ShieldCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-sm font-extrabold text-slate-700 truncate px-1">{currentGroup ? currentGroup.name : 'Not set'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Access Level</p>
          </div>
        </div>

        {/* Division coverage */}
        {divisions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1 self-center">Active in:</span>
            {divisions.map(d => (
              <span key={d.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: d.color || '#2E5A1A' }}>
                {d.code || d.name?.substring(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Permission Group Selector ─── */}
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Crew Access Level</h3>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 mb-3">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 font-medium leading-relaxed">
            Assigning a permission group here applies it to <strong>all {staff.length} crew members</strong> instantly.
            Every staff member in this crew inherits the same access level across every division they work in.
          </p>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 block">Permission Group</label>
          <AccessSelect
            value={currentGroup?.id || ''}
            onChange={onGroupChange}
            placeholder="Select a permission group…"
            disabled={saving}
            triggerClassName="h-10 w-full rounded-xl text-sm"
          >
            <SelectItem value="__none">
              <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-slate-200 flex-shrink-0" /> No group (clear access)</span>
            </SelectItem>
            <SelectLabel>System Groups</SelectLabel>
            {groups.filter(g => g.is_system).map(g => (
              <SelectItem key={g.id} value={g.id}>
                <span className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> {g.name}</span>
              </SelectItem>
            ))}
            {groups.filter(g => !g.is_system).length > 0 && (
              <>
                <SelectSeparator />
                <SelectLabel>Custom Groups</SelectLabel>
                {groups.filter(g => !g.is_system).map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </>
            )}
          </AccessSelect>
        </div>

        {currentGroup?.description && (
          <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{currentGroup.description}</p>
        )}
      </div>

      {/* ─── Crew Members ─── */}
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Crew Members</h3>
          <span className="text-xs font-bold text-slate-400">({staff.length})</span>
        </div>
        {staff.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-500">No staff assigned to this crew yet</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Assign staff to this team via the Staff Hub</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {staff.map(s => {
              const div = allDivisions.find(d => d.id === s.division_id);
              const sGroup = groups.find(g => g.id === s.permission_group_id);
              return (
                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: div ? `linear-gradient(135deg, ${div.color || '#2E5A1A'}, ${div.color || '#2E5A1A'}cc)` : '#e2e8f0', color: div ? 'white' : '#64748b' }}>
                    {(s.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.job_title || s.email || 'No title'}</p>
                  </div>
                  {div && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: div.color || '#2E5A1A' }} title={div.name} />
                  )}
                  {sGroup && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 flex-shrink-0 max-w-[70px] truncate">
                      {sGroup.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}