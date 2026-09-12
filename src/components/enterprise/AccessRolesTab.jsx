import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Shield, Loader2, Search, Crown, Building2, UserCog, User,
  ChevronDown, Check, Save,
} from 'lucide-react';

const ROLES = [
  {
    value: 'enterprise_admin',
    label: 'Enterprise Admin',
    icon: Crown,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Sees every BU and stream. Manages global settings.',
  },
  {
    value: 'bu_admin',
    label: 'BU Admin',
    icon: Building2,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Manages all streams within their parent Business Unit.',
  },
  {
    value: 'stream_manager',
    label: 'Stream Manager',
    icon: UserCog,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Manages their own stream only.',
  },
  {
    value: 'user',
    label: 'User',
    icon: User,
    color: 'text-slate-600 bg-slate-50 border-slate-200',
    description: 'Scoped to their assigned stream.',
  },
];

export default function AccessRolesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState({}); // staffId -> { enterprise_role, division_id, managed_division_ids }
  const [saving, setSaving] = useState(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff-for-access-roles'],
    queryFn: () => base44.entities.Staff.list('-name', 500),
    staleTime: 30000,
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-for-access-roles'],
    queryFn: () => base44.entities.Division.list('-sort_order', 500),
    staleTime: 60000,
  });

  // Group divisions for the BU/stream selectors
  const buGroups = useMemo(() => {
    const bus = divisions.filter(d => !d.parent_division_id);
    const streams = divisions.filter(d => d.parent_division_id);
    return bus.map(bu => ({
      bu,
      streams: streams.filter(s => s.parent_division_id === bu.id),
    }));
  }, [divisions]);

  const filtered = useMemo(() => {
    if (!search) return staff;
    const q = search.toLowerCase();
    return staff.filter(s =>
      s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.job_title?.toLowerCase().includes(q)
    );
  }, [staff, search]);

  const getRoleMeta = (role) => ROLES.find(r => r.value === role) || ROLES[3];

  const startEdit = (s) => {
    setEditing(e => ({
      ...e,
      [s.id]: {
        enterprise_role: s.enterprise_role || 'user',
        division_id: s.division_id || '',
        managed_division_ids: s.managed_division_ids || [],
      },
    }));
  };

  const updateEdit = (staffId, key, value) => {
    setEditing(e => ({ ...e, [staffId]: { ...e[staffId], [key]: value } }));
  };

  const saveEdit = async (s) => {
    const edits = editing[s.id];
    if (!edits) return;
    setSaving(s.id);
    try {
      await base44.entities.Staff.update(s.id, {
        enterprise_role: edits.enterprise_role,
        division_id: edits.division_id || null,
        managed_division_ids: edits.managed_division_ids,
      });
      setEditing(e => { const next = { ...e }; delete next[s.id]; return next; });
      queryClient.invalidateQueries({ queryKey: ['staff-for-access-roles'] });
      toast({ title: 'Role updated', description: `${s.name} is now ${getRoleMeta(edits.enterprise_role).label}` });
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-extrabold text-slate-900">Access & Roles</h3>
          <p className="text-xs text-slate-500">Assign enterprise roles to control BU/stream visibility. Permission Groups handle granular module access underneath.</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ROLES.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.value} className={`rounded-xl p-3 border ${r.color}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-bold">{r.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">{r.description}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search staff by name, email, or role…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
        />
      </div>

      {/* Staff list */}
      <div className="space-y-2">
        {filtered.map(s => {
          const isEditing = !!editing[s.id];
          const edits = editing[s.id] || {};
          const currentRole = isEditing ? edits.enterprise_role : (s.enterprise_role || 'user');
          const RoleIcon = getRoleMeta(currentRole).icon;
          const streamName = divisions.find(d => d.id === (isEditing ? edits.division_id : s.division_id))?.name || 'Unassigned';

          return (
            <div key={s.id} className="hub-glass rounded-xl p-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-slate-500">{s.name?.charAt(0) || '?'}</span>
                  )}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400 truncate">{s.email || s.job_title || 'No email'}</p>
                </div>

                {/* Role badge / selector */}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={edits.enterprise_role}
                      onChange={e => updateEdit(s.id, 'enterprise_role', e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button
                      onClick={() => saveEdit(s)}
                      disabled={saving === s.id}
                      className="px-3 py-1.5 rounded-lg command-gradient text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {saving === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditing(e => { const n = { ...e }; delete n[s.id]; return n; })} className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${getRoleMeta(currentRole).color}`}>
                      <RoleIcon className="w-3 h-3" /> {getRoleMeta(currentRole).label}
                    </span>
                    <button onClick={() => startEdit(s)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 border border-primary/20 transition">
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Stream assignment (when editing) */}
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Home Stream</label>
                    <select
                      value={edits.division_id}
                      onChange={e => updateEdit(s.id, 'division_id', e.target.value)}
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-primary"
                    >
                      <option value="">Unassigned</option>
                      {buGroups.map(g => (
                        <optgroup key={g.bu.id} label={g.bu.name}>
                          {g.streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Access (BU Admin / Enterprise Admin)</label>
                    <p className="text-[10px] text-slate-400 mt-0.5">Managed division IDs — for cross-stream access.</p>
                  </div>
                </div>
              )}

              {/* Current stream (when not editing) */}
              {!isEditing && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: divisions.find(d => d.id === s.division_id)?.color || '#cbd5e1' }} />
                  <span className="font-medium">{streamName}</span>
                  {s.managed_division_ids?.length > 0 && (
                    <span className="text-slate-300">· +{s.managed_division_ids.length} additional</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">No staff found</div>
        )}
      </div>
    </div>
  );
}