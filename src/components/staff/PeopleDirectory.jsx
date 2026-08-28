import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CrewProfileEditorDrawer from '@/components/staff/CrewProfileEditorDrawer';
import {
  Users, Search, ChevronDown, ChevronRight, Plus, ShieldCheck, ShieldOff,
  GitBranch, HardHat, UserCircle, Loader2, UserPlus, Link2, AlertTriangle,
  Wrench, Truck, Layers,
} from 'lucide-react';
import { TEAM_CATEGORIES } from '@/utils/teamAccess';
import { formatWorkerType } from '@/utils/format';

/**
 * PeopleDirectory — the unified People tab.
 *
 * Master-detail by crew type (Team). Three drill-down levels:
 *   1. Crew Types (Teams) as expandable section cards
 *   2. Crew Profiles (DrillingCrew pairings / subcontractor parent Staff) as cards within
 *   3. Crew Members (Staff) listed under each crew profile
 *
 * Selecting a crew profile or member opens the CrewProfileEditorDrawer for
 * full details and inline member management. Unlinked platform users are
 * surfaced at the top with one-click link/create actions.
 */
export default function PeopleDirectory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedType, setExpandedType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['drilling-crews'],
    queryFn: () => base44.entities.DrillingCrew.list(),
  });

  const { data: unlinkedData } = useQuery({
    queryKey: ['crew-profiles'],
    queryFn: () => base44.functions.invoke('getUnlinkedUsers'),
  });

  const unlinked = unlinkedData?.data?.unlinked || [];
  const unlinkedCount = unlinkedData?.data?.total || 0;

  // Group staff by team
  const staffByTeam = useMemo(() => {
    const m = {};
    staff.forEach((s) => {
      const tid = s.team_id || '__unassigned';
      if (!m[tid]) m[tid] = [];
      m[tid].push(s);
    });
    return m;
  }, [staff]);

  // Crew profiles (DrillingCrew) grouped by team
  const crewsByTeam = useMemo(() => {
    const m = {};
    crews.forEach((c) => {
      const tid = c.team_id || '__unassigned';
      if (!m[tid]) m[tid] = [];
      m[tid].push(c);
    });
    return m;
  }, [crews]);

  // For each team, identify "crew profile" groups:
  //  - Subcontractor/agency parent Staff (crew_parent_id null) → profile card, children underneath
  //  - DrillingCrew records → profile card with lead/second man
  //  - Direct employees → grouped into a single "Direct Crew" profile
  const buildProfiles = (teamId) => {
    const teamStaff = staffByTeam[teamId] || [];
    const teamCrews = crewsByTeam[teamId] || [];
    const profiles = [];

    // DrillingCrew pairings
    teamCrews.forEach((crew) => {
      const lead = staff.find((s) => s.id === crew.lead_driller_staff_id);
      const second = staff.find((s) => s.id === crew.second_man_staff_id);
      profiles.push({
        type: 'drilling_crew',
        id: crew.id,
        name: crew.name || [crew.lead_driller_name, crew.second_man_name].filter(Boolean).join(' + ') || 'Unnamed Crew',
        subtitle: `${crew.crew_type?.toUpperCase() || ''} Crew`.trim(),
        members: [lead, second].filter(Boolean),
        crewRecord: crew,
      });
    });

    // Subcontractor / agency parent Staff (crew_parent_id null)
    const subParents = teamStaff.filter((s) =>
      (s.worker_type === 'subcontractor' || s.worker_type === 'agency') && !s.crew_parent_id
    );
    subParents.forEach((parent) => {
      const children = teamStaff.filter((s) => s.crew_parent_id === parent.id);
      profiles.push({
        type: 'subcontractor',
        id: parent.id,
        name: parent.name,
        subtitle: formatWorkerType(parent.worker_type),
        members: children.length > 0 ? children : [parent],
        parentStaff: parent,
      });
    });

    // Direct employees — single "Direct Crew" profile group
    const direct = teamStaff.filter((s) =>
      s.worker_type === 'direct_employee' || (!s.crew_parent_id && s.worker_type !== 'subcontractor' && s.worker_type !== 'agency')
    );
    if (direct.length > 0) {
      profiles.push({
        type: 'direct',
        id: `direct-${teamId}`,
        name: 'Direct Crew',
        subtitle: `${direct.length} member${direct.length !== 1 ? 's' : ''}`,
        members: direct,
      });
    }

    return profiles;
  };

  const teamIds = new Set(teams.map((t) => t.id));
  const parentTeams = teams.filter((t) => !t.parent_team_id || !teamIds.has(t.parent_team_id));
  const subTeamsOf = (pid) => teams.filter((t) => t.parent_team_id === pid && teamIds.has(pid));

  // Search filter
  const q = search.trim().toLowerCase();
  const filteredTeams = useMemo(() => {
    if (!q) return parentTeams;
    const matchTeam = (t) => {
      if (t.name.toLowerCase().includes(q)) return true;
      const members = staffByTeam[t.id] || [];
      return members.some((m) => (m.name || '').toLowerCase().includes(q) || (m.job_title || '').toLowerCase().includes(q));
    };
    return parentTeams.filter(matchTeam);
  }, [parentTeams, staffByTeam, q]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crew-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff-page-hub'] });
    queryClient.invalidateQueries({ queryKey: ['drilling-crews'] });
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  };

  const handleCreateFromUser = async (u) => {
    setActioningId(u.id);
    try {
      const fieldTeam = teams.find((t) => t.category === 'field_ops') || teams[0];
      await base44.entities.Staff.create({
        name: u.full_name || u.email,
        email: u.email,
        user_id: u.id,
        worker_type: 'direct_employee',
        team_id: fieldTeam?.id || '',
        is_active: true,
        system_role: u.role === 'admin' ? 'admin' : 'field',
      });
      toast({ title: 'Crew profile created', description: `${u.full_name || u.email} is now linked.` });
      refresh();
    } catch (e) {
      toast({ title: 'Could not create profile', description: e?.message, variant: 'destructive' });
    } finally {
      setActioningId(null);
    }
  };

  const handleLinkUser = async (u, staffRecord) => {
    setActioningId(u.id);
    try {
      await base44.entities.Staff.update(staffRecord.id, { user_id: u.id });
      toast({ title: 'Profile linked', description: `${staffRecord.name} is now connected to ${u.email}.` });
      refresh();
    } catch (e) {
      toast({ title: 'Link failed', description: e?.message, variant: 'destructive' });
    } finally {
      setActioningId(null);
    }
  };

  const linkCandidate = (u) => {
    const lc = (u.email || '').toLowerCase();
    return staff.find((s) => !s.user_id && s.email && s.email.toLowerCase() === lc);
  };

  const categoryIcon = (cat) => {
    if (cat === 'depot') return Wrench;
    if (cat === 'management') return ShieldCheck;
    return HardHat;
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crew types, people, roles…"
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 shadow-sm transition"
        />
      </div>

      {/* Unlinked users banner */}
      {unlinkedCount > 0 && (
        <div className="insight-card rounded-2xl p-4 border-l-4 border-amber-400 bg-amber-50/40">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-amber-900">
                {unlinkedCount} platform {unlinkedCount === 1 ? 'user has' : 'users have'} no crew profile
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Link them to an existing profile or create one below.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {unlinked.map((u) => {
              const candidate = linkCandidate(u);
              return (
                <div key={u.id} className="bg-white/70 rounded-xl p-3 flex items-center gap-3 border border-amber-100">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name || u.email}</p>
                    {candidate && (
                      <p className="text-[11px] text-emerald-600 font-medium">Matches: {candidate.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {candidate && (
                      <button
                        onClick={() => handleLinkUser(u, candidate)}
                        disabled={actioningId === u.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                      >
                        {actioningId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        Link
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateFromUser(u)}
                      disabled={actioningId === u.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
                    >
                      {actioningId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Create
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Crew Types — master list */}
      {teamsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="insight-card rounded-2xl p-10 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No crew types found</p>
          <p className="text-xs text-slate-400 mt-1">Create crew types in Settings to get started.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTeams.map((team) => {
            const isExpanded = expandedType === team.id;
            const members = staffByTeam[team.id] || [];
            const subTeams = subTeamsOf(team.id);
            const profiles = isExpanded ? buildProfiles(team.id) : [];
            const CatIcon = categoryIcon(team.category);
            const memberCount = members.length;

            return (
              <div key={team.id} className="insight-card rounded-2xl overflow-hidden">
                {/* Crew Type header — Level 1 */}
                <button
                  onClick={() => setExpandedType(isExpanded ? null : team.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CatIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{team.name}</p>
                      {team.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold">
                          {TEAM_CATEGORIES.find((c) => c.value === team.category)?.label || team.category}
                        </span>
                      )}
                      {team.job_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium capitalize">
                          {team.job_type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                      {subTeams.length > 0 && ` · ${subTeams.length} sub-crew${subTeams.length !== 1 ? 's' : ''}`}
                      {team.is_supervisor_team && ' · Supervisor team'}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {/* Crew Profiles — Level 2 + Members — Level 3 */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-3 space-y-2.5">
                    {profiles.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No members in this crew type yet.</p>
                    ) : (
                      profiles.map((profile) => (
                        <CrewProfileCard
                          key={profile.id}
                          profile={profile}
                          onOpenMember={(s) => setEditing(s)}
                        />
                      ))
                    )}
                    {subTeams.length > 0 && (
                      <div className="pt-1.5 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <GitBranch className="w-3 h-3" /> Sub-Crews
                        </p>
                        {subTeams.map((st) => {
                          const subMembers = staffByTeam[st.id] || [];
                          return (
                            <button
                              key={st.id}
                              onClick={() => setExpandedType(st.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-100 hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/[0.02] transition text-left"
                            >
                              <GitBranch className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                              <p className="text-sm font-medium text-slate-700 truncate flex-1">{st.name}</p>
                              <span className="text-xs text-slate-400">{subMembers.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned people */}
      {!q && (staffByTeam['__unassigned'] || []).length > 0 && (
        <div className="insight-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setExpandedType(expandedType === '__unassigned' ? null : '__unassigned')}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-700 truncate">Unassigned People</p>
              <p className="text-xs text-slate-400">{staffByTeam['__unassigned'].length} not in a crew type</p>
            </div>
            {expandedType === '__unassigned' ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {expandedType === '__unassigned' && (
            <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-3 space-y-1.5">
              {staffByTeam['__unassigned'].map((s) => (
                <MemberRow key={s.id} member={s} onClick={() => setEditing(s)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full-profile editor drawer */}
      <CrewProfileEditorDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        staff={editing}
        teams={teams}
        onSaved={refresh}
      />
    </div>
  );
}

/** Crew Profile card — Level 2, with members listed underneath (Level 3). */
function CrewProfileCard({ profile, onOpenMember }) {
  const [open, setOpen] = useState(true);

  const profileIcon = () => {
    if (profile.type === 'drilling_crew') return HardHat;
    if (profile.type === 'subcontractor') return Truck;
    return Users;
  };
  const Icon = profileIcon();

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden">
      {/* Profile header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50/50 transition text-left"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          profile.type === 'drilling_crew' ? 'bg-indigo-50' :
          profile.type === 'subcontractor' ? 'bg-amber-50' : 'bg-emerald-50'
        }`}>
          <Icon className={`w-4 h-4 ${
            profile.type === 'drilling_crew' ? 'text-indigo-600' :
            profile.type === 'subcontractor' ? 'text-amber-600' : 'text-emerald-600'
          }`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {profile.subtitle} · {profile.members.length} member{profile.members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Members list — Level 3 */}
      {open && (
        <div className="border-t border-slate-100 px-2 py-1.5 space-y-0.5">
          {profile.members.map((m) => (
            <MemberRow key={m.id} member={m} onClick={() => onOpenMember(m)} />
          ))}
          {profile.members.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No members yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Single member row — Level 3. */
function MemberRow({ member, onClick }) {
  const linked = !!member.user_id;
  const initials = (member.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition group text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-[10px] overflow-hidden">
        {member.avatar_url ? <img src={member.avatar_url} alt={member.name} className="w-full h-full object-cover" /> : initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-[#2E5A1A] transition">{member.name}</p>
          {!member.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">Inactive</span>}
        </div>
        <p className="text-[11px] text-slate-400 truncate">
          {member.job_title || formatWorkerType(member.worker_type) || 'Crew Member'}
        </p>
      </div>
      {linked ? (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold flex-shrink-0">
          <ShieldCheck className="w-3 h-3" /> Linked
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold flex-shrink-0">
          <ShieldOff className="w-3 h-3" /> No login
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
    </button>
  );
}