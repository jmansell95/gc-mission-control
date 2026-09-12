import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import CrewProfileEditorDrawer from '@/components/staff/CrewProfileEditorDrawer';
import {
  Users, UserPlus, Link2, AlertTriangle, Search, ShieldCheck, ShieldOff,
  Mail, Loader2, ChevronRight, UserCircle,
} from 'lucide-react';

/**
 * CrewProfilesTab — admin management view for crew profiles.
 * Shows unlinked platform users (with one-click link/create) and the full
 * Staff directory with linked-status badges and a full-profile editor.
 */
export default function CrewProfilesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crew-profiles'],
    queryFn: () => base44.functions.invoke('getUnlinkedUsers'),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const unlinked = data?.data?.unlinked || [];
  const allStaff = data?.data?.staff || [];
  const unlinkedCount = data?.data?.total || 0;

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  // Staff records that have a matching platform user (by user_id presence).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? allStaff.filter((s) =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.job_title || '').toLowerCase().includes(q))
      : allStaff;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allStaff, search]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['crew-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    queryClient.invalidateQueries({ queryKey: ['staff-page-hub'] });
  };

  // Create a new Staff record seeded from an unlinked platform user.
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

  // Link an unlinked platform user to an existing Staff record matched by email.
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

  // For each unlinked user, find a candidate Staff record (same email, no user_id).
  const linkCandidate = (u) => {
    const lc = (u.email || '').toLowerCase();
    return allStaff.find((s) => !s.user_id && s.email && s.email.toLowerCase() === lc);
  };

  return (
    <div className="space-y-5">
      {/* Unlinked users banner */}
      {unlinkedCount > 0 && (
        <div className="hub-glass rounded-2xl p-4 md:p-5 border-l-4 border-amber-400 bg-amber-50/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold text-amber-900">
                {unlinkedCount} platform {unlinkedCount === 1 ? 'user has' : 'users have'} no crew profile
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                These users can sign in but have no Staff record. Link them to an existing profile or create one below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unlinked users list */}
      {unlinkedCount > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">Unlinked Platform Users</h2>
          </div>
          <div className="space-y-2">
            {unlinked.map((u) => {
              const candidate = linkCandidate(u);
              return (
                <div key={u.id} className="hub-glass rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {u.email}
                      {u.role && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium capitalize">{u.role}</span>}
                    </p>
                    {candidate && (
                      <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                        Matches existing profile: {candidate.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {candidate && (
                      <button
                        onClick={() => handleLinkUser(u, candidate)}
                        disabled={actioningId === u.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                      >
                        {actioningId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        Link
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateFromUser(u)}
                      disabled={actioningId === u.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
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

      {/* Crew profiles directory */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg stat-gradient-brand flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900">Crew Profiles</h2>
            <span className="text-xs text-slate-400 font-medium">{filtered.length}</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crew…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No crew profiles" message="No Staff records match your search." />
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const team = teamMap[s.team_id];
              const linked = !!s.user_id;
              const initials = (s.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
              return (
                <button
                  key={s.id}
                  onClick={() => setEditing(s)}
                  className="w-full text-left hub-glass rounded-xl p-3.5 flex items-center gap-3 hover:border-primary/40 transition group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden">
                    {s.avatar_url ? <img src={s.avatar_url} alt={s.name} className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary transition">{s.name}</p>
                      {!s.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">Inactive</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {s.job_title || (team?.name) || 'Unassigned'}
                      {s.email && <span className="text-slate-400"> · {s.email}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {linked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        <ShieldCheck className="w-3 h-3" /> Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        <ShieldOff className="w-3 h-3" /> No login
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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