import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CrewProfileEditorDrawer from '@/components/staff/CrewProfileEditorDrawer';
import StaffFormModal from '@/components/staff/StaffFormModal';
import StaffPermissionPopup from '@/components/access/StaffPermissionPopup';
import {
  Search, Users, Mail, Phone, HardHat, Wrench, UserCog, ShieldCheck,
  ShieldOff, ChevronRight, KeyRound, UserPlus, Loader2, AlertCircle, Trash2,
  CopyX,
} from 'lucide-react';
import { formatWorkerType } from '@/utils/format';

/**
 * StaffListTab — a flat, searchable list of every individual staff member.
 * Full control: edit profile (drawer) + manage permissions (popup) + add staff.
 */
export default function StaffListTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [permissionStaff, setPermissionStaff] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deduping, setDeduping] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-staff-list'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach((t) => (m[t.id] = t));
    return m;
  }, [teams]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return staff;
    return staff.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.job_title || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (teamMap[s.team_id]?.name || '').toLowerCase().includes(q)
    );
  }, [staff, teamMap, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['staff'] });
    qc.invalidateQueries({ queryKey: ['staff-page-hub'] });
  };

  const handleAdd = () => {
    setFormModalOpen(true);
  };

  const handleDeduplicate = async () => {
    if (!window.confirm('Remove duplicate staff records?\n\nThis merges records that share the same name AND linked user account. The record with the most data is kept; all rota assignments, compliance items and timesheets from duplicates are re-pointed to the kept record, then the empty duplicates are deleted.')) return;
    setDeduping(true);
    try {
      const res = await base44.functions.invoke('deduplicateStaff', {});
      const d = res.data || {};
      refresh();
      qc.invalidateQueries({ queryKey: ['rotas'] });
      qc.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast({ title: 'Deduplication complete', description: d.message || `Deleted ${d.recordsDeleted} duplicate record(s).` });
    } catch (e) {
      toast({ title: 'Deduplication failed', description: e?.message, variant: 'destructive' });
    }
    setDeduping(false);
  };

  const handleDelete = async (staffId) => {
    if (!window.confirm('Delete this staff member? This cannot be undone.')) return;
    try {
      await base44.entities.Staff.delete(staffId);
      toast({ title: 'Staff member deleted' });
      refresh();
    } catch (e) {
      toast({ title: 'Could not delete', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search + Add */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, email or team…"
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E5A1A] focus:ring-4 focus:ring-[#2E5A1A]/10 shadow-sm transition"
          />
        </div>
        <button
          onClick={handleDeduplicate}
          disabled={deduping}
          title="Merge duplicate staff records (same name + user account)"
          className="inline-flex items-center gap-1.5 h-11 px-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition disabled:opacity-50 shadow-sm flex-shrink-0"
        >
          {deduping ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyX className="w-4 h-4" />}
          <span className="hidden sm:inline">Dedup</span>
        </button>
        <button
          onClick={handleAdd}
          disabled={creating}
          className="inline-flex items-center gap-1.5 h-11 px-4 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] transition disabled:opacity-50 shadow-sm flex-shrink-0"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          <span className="hidden sm:inline">Add Staff</span>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-10 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No staff found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different search or add a new staff member.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              team={teamMap[s.team_id]}
              onOpen={() => setEditing(s)}
              onPermissions={() => setPermissionStaff(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      <CrewProfileEditorDrawer
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        staff={editing}
        teams={teams}
        onSaved={refresh}
      />

      <StaffFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editing={null}
        staff={null}
        teams={teams}
        vehicles={vehicles}
        staffList={staff}
      />

      {permissionStaff && (
        <StaffPermissionPopup staff={permissionStaff} onClose={() => setPermissionStaff(null)} />
      )}
    </div>
  );
}

function StaffCard({ staff, team, onOpen, onPermissions, onDelete }) {
  const linked = !!staff.user_id;
  const initials = (staff.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const wtMeta = {
    direct_employee: { label: 'Direct', icon: HardHat, cls: 'bg-emerald-50 text-emerald-700' },
    subcontractor: { label: 'Subcon', icon: Wrench, cls: 'bg-blue-50 text-blue-700' },
    agency: { label: 'Agency', icon: UserCog, cls: 'bg-violet-50 text-violet-700' },
  };
  const wt = wtMeta[staff.worker_type] || wtMeta.direct_employee;
  const WtIcon = wt.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition group">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-sm overflow-hidden shadow-sm">
          {staff.avatar_url ? (
            <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#2E5A1A] transition">{staff.name}</p>
            {staff.is_active === false && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">INACTIVE</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{staff.job_title || formatWorkerType(staff.worker_type) || 'Staff'}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${wt.cls}`}>
              <WtIcon className="w-2.5 h-2.5" />
              {wt.label}
            </span>
            {team && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium truncate max-w-[120px]">
                <Users className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{team.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50 min-w-0">
        {staff.email && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate min-w-0">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{staff.email}</span>
          </span>
        )}
        {staff.phone && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{staff.phone}</span>
          </span>
        )}
      </div>

      {/* Status badge row */}
      <div className="flex items-center gap-2 mt-3">
        {linked ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
            <ShieldCheck className="w-3 h-3" /> Linked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
            <ShieldOff className="w-3 h-3" /> No login
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={onPermissions}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#2E5A1A] hover:text-white text-slate-600 text-[11px] font-semibold transition"
          title="Manage permissions"
        >
          <KeyRound className="w-3.5 h-3.5" /> Access
        </button>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-[11px] font-semibold hover:bg-[#1c4a12] transition"
        >
          Edit <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition flex-shrink-0"
          title="Delete staff member"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}