import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Plus, Pencil, Trash2, Crown, Users, X, Loader2,
  ShieldCheck, Lock, AlertTriangle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { normalizePermissions, defaultPermissions } from '@/utils/permissions';
import AccessGroupEditor from '@/components/settings/access/AccessGroupEditor';

/**
 * PermissionGroupsPopup — the "Permission Groups" button popup on the
 * Access Levels page. Lists all system + custom groups as cards with
 * create / edit / delete controls. Creating or editing opens the shared
 * AccessGroupEditor (full-screen sheet on mobile).
 *
 * Bottom-sheet on mobile, centred modal on desktop.
 */
export default function PermissionGroupsPopup({ open, onClose, scopedDivisionId }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 200)),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-access-popup', scopedDivisionId],
    queryFn: async () => {
      if (!scopedDivisionId) return [];
      return await base44.entities.Staff.filter({ division_id: scopedDivisionId }, '-created_date', 5000);
    },
    enabled: !!scopedDivisionId,
  });

  const staffByGroup = useMemo(() => {
    const m = {};
    staff.forEach(s => { if (s.permission_group_id) m[s.permission_group_id] = (m[s.permission_group_id] || 0) + 1; });
    return m;
  }, [staff]);

  const saveMutation = useMutation({
    mutationFn: async (group) => {
      const payload = { ...group, permissions: normalizePermissions(group.permissions) };
      if (group.id) await base44.entities.PermissionGroup.update(group.id, payload);
      else await base44.entities.PermissionGroup.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      toast({ title: 'Permission group saved' });
      setEditing(null);
    },
    onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await base44.entities.PermissionGroup.delete(id); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      toast({ title: 'Group deleted' });
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

  if (!open) return null;

  const systemGroups = groups.filter(g => g.is_system);
  const customGroups = groups.filter(g => !g.is_system);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div
          className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
                <KeyRound className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 truncate">Permission Groups</h2>
                <p className="text-[11px] text-slate-500">Create, edit and delete access groups</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Group button */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setEditing({ name: '', description: '', is_read_only: false, staff_type: 'flexible', landing_page: 'auto', permissions: defaultPermissions() })}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> New Permission Group
            </button>
          </div>

          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
              </div>
            ) : (
              <>
                {/* System groups */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 px-1">
                    <Crown className="w-3 h-3 text-amber-500" /> System Groups
                  </p>
                  {systemGroups.map(g => (
                    <GroupCard key={g.id} group={g} staffCount={staffByGroup[g.id] || 0} onEdit={() => setEditing(g)} />
                  ))}
                </div>

                {/* Custom groups */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 px-1">
                    <Users className="w-3 h-3 text-slate-400" /> Custom Groups
                  </p>
                  {customGroups.length === 0 ? (
                    <div className="insight-card rounded-2xl p-6 text-center">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500">No custom groups yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tap "New Permission Group" to create one.</p>
                    </div>
                  ) : (
                    customGroups.map(g => (
                      <GroupCard key={g.id} group={g} staffCount={staffByGroup[g.id] || 0} onEdit={() => setEditing(g)} onDelete={() => handleDelete(g)} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <AccessGroupEditor
          group={editing}
          onCancel={() => setEditing(null)}
          onSave={(g) => saveMutation.mutate(g)}
          saving={saveMutation.isPending}
        />
      )}
    </>,
    document.body
  );
}

function GroupCard({ group, staffCount, onEdit, onDelete }) {
  const p = normalizePermissions(group.permissions);
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const total = Object.keys(p).length || 1;

  return (
    <div className="insight-card rounded-2xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {group.is_read_only && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            <h3 className="text-sm font-extrabold text-slate-900 truncate">{group.name}</h3>
            {group.is_system && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                <Crown className="w-2.5 h-2.5" /> SYSTEM
              </span>
            )}
          </div>
          {group.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{group.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          {onDelete && (
            <button onClick={onDelete} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-2.5 text-[11px]">
        <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
          <Users className="w-3 h-3" /> {staffCount} staff
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
          <ShieldCheck className="w-3 h-3" /> {writeCount}/{total} write
        </span>
        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
          {readCount}/{total} read
        </span>
      </div>
    </div>
  );
}