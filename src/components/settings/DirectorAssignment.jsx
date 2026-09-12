import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Crown, Search, Check, X, Loader2, Building2, ChevronDown, UserCog,
} from 'lucide-react';

/**
 * DirectorAssignment — lets super admins assign the 'director' role to users
 * and select which divisions each director can manage (managed_division_ids).
 *
 * Only visible to super admins (role='admin'). Accessed via the Division
 * Manager → Directors tab.
 */
export default function DirectorAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users-directors'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const directors = filteredUsers.filter(u => u.role === 'director');
  const otherUsers = filteredUsers.filter(u => u.role !== 'director' && u.role !== 'admin');

  const updateRole = async (userId, newRole) => {
    setUpdating(userId);
    try {
      await base44.entities.User.update(userId, { role: newRole });
      if (newRole === 'director') {
        toast({ title: 'Promoted to Director', description: 'Now assign their managed divisions.' });
      } else {
        toast({ title: 'Role updated', description: 'Managed divisions cleared.' });
      }
      queryClient.invalidateQueries({ queryKey: ['all-users-directors'] });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const toggleDivision = async (director, divisionId) => {
    setUpdating(director.id);
    try {
      const current = director.managed_division_ids || [];
      const next = current.includes(divisionId)
        ? current.filter(id => id !== divisionId)
        : [...current, divisionId];
      await base44.entities.User.update(director.id, { managed_division_ids: next });
      toast({ title: next.includes(divisionId) ? 'Business Stream assigned' : 'Business Stream removed' });
      queryClient.invalidateQueries({ queryKey: ['all-users-directors'] });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="hub-glass rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Director Management</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Promote users to <strong>Director</strong> to let them manage multiple divisions. Directors can switch between only their assigned divisions — they cannot see or access other divisions.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
        />
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-2xl" />
      ) : (
        <>
          {/* Current Directors */}
          {directors.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Active Directors</p>
              <div className="space-y-2">
                {directors.map(d => (
                  <DirectorCard
                    key={d.id}
                    director={d}
                    divisions={divisions}
                    updating={updating === d.id}
                    onToggleDivision={(divId) => toggleDivision(d, divId)}
                    onDemote={() => updateRole(d.id, 'user')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Promote Users */}
          {otherUsers.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Promote to Director</p>
              <div className="space-y-1.5">
                {otherUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                      {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => updateRole(u.id, 'director')}
                      disabled={updating === u.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg command-gradient text-white text-xs font-bold shadow-sm hover:shadow-md disabled:opacity-60 transition">
                      {updating === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                      Make Director
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {directors.length === 0 && otherUsers.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">No users match "{search}"</div>
          )}
        </>
      )}
    </div>
  );
}

function DirectorCard({ director, divisions, updating, onToggleDivision, onDemote }) {
  const [expanded, setExpanded] = useState(true);
  const managedIds = director.managed_division_ids || [];

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-slate-900 truncate">{director.full_name || 'Unknown'}</p>
            <p className="text-xs text-slate-400 truncate">{director.email}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200 flex-shrink-0">
            {managedIds.length} {managedIds.length === 1 ? 'Business Stream' : 'Business Streams'}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <ChevronDown className={`w-4 h-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {expanded && (
          <>
            <p className="text-xs text-slate-500 mb-2">Assigned Business Streams (can switch between these only):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
              {divisions.map(d => {
                const assigned = managedIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => onToggleDivision(d.id)}
                    disabled={updating}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold transition text-left disabled:opacity-60 ${
                      assigned
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color || '#2E5A1A' }} />
                    <span className="flex-1 truncate">{d.name}</span>
                    {assigned
                      ? <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      : <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                  </button>
                );
              })}
              {divisions.length === 0 && (
                <p className="text-xs text-slate-400 col-span-2">No divisions available. Create divisions first.</p>
              )}
            </div>
            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={onDemote}
                disabled={updating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition disabled:opacity-60">
                <UserCog className="w-3.5 h-3.5" />
                Remove Director Role
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}