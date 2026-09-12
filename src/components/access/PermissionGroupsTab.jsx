import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AccessModuleGrid from '@/components/settings/access/AccessModuleGrid';
import { normalizePermissions, defaultPermissions } from '@/utils/permissions';
import {
  KeyRound, Crown, Lock, Eye, ShieldCheck, X, Loader2, Save, Plus,
  Trash2, Pencil, Users, AlertTriangle, Search,
} from 'lucide-react';

/**
 * PermissionGroupsTab — full control over Permission Groups.
 * Lists every group with member counts; click to edit the matrix inline,
 * create new groups, rename, toggle read-only, and delete custom groups.
 */
export default function PermissionGroupsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // group object or '__new'

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => base44.entities.PermissionGroup.list('-created_date', 200),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const memberCount = useMemo(() => {
    const m = {};
    staff.forEach((s) => {
      if (s.permission_group_id) m[s.permission_group_id] = (m[s.permission_group_id] || 0) + 1;
    });
    return m;
  }, [staff]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return groups;
    return groups.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [groups, q]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['permission-groups'] });
    qc.invalidateQueries({ queryKey: ['staff'] });
    qc.invalidateQueries({ queryKey: ['staff-access-assign'] });
  };

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permission groups…"
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm transition"
          />
        </div>
        <button
          onClick={() => setEditing('__new')}
          className="inline-flex items-center gap-1.5 h-11 px-4 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Group</span>
        </button>
      </div>

      {/* Group cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-10 text-center">
          <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No permission groups found</p>
          <p className="text-xs text-slate-400 mt-1">Create one to control what your team can access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((g) => {
            const p = normalizePermissions(g.permissions);
            const writeCount = Object.values(p).filter((v) => v === 'write').length;
            const readCount = Object.values(p).filter((v) => v === 'read').length;
            const total = Object.keys(p).length;
            const count = memberCount[g.id] || 0;
            return (
              <button
                key={g.id}
                onClick={() => setEditing(g)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:border-primary/30 transition group"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${g.is_read_only ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                    {g.is_read_only ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition">{g.name}</p>
                      {g.is_system && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {count} member{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {g.description && (
                  <p className="text-xs text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">{g.description}</p>
                )}
                <div className="mt-3">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(writeCount / total) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(readCount / total) * 100}%` }} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-semibold">
                    <span className="text-emerald-600 flex items-center gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />{writeCount} full</span>
                    <span className="text-amber-600 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{readCount} read</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <GroupEditorPopup
          group={editing === '__new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/** Inline editor popup for a single permission group (create / edit / delete). */
function GroupEditorPopup({ group, onClose, onSaved }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !group;

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [permissions, setPermissions] = useState(group ? normalizePermissions(group.permissions) : defaultPermissions());
  const [isReadOnly, setIsReadOnly] = useState(!!group?.is_read_only);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSystem = !!group?.is_system;
  const matrixEditable = isNew || !isSystem;

  const handleModuleChange = (key, level) => {
    if (!matrixEditable) return;
    setPermissions((p) => ({ ...p, [key]: level }));
  };
  const handleSetAll = (level) => {
    if (!matrixEditable) return;
    setPermissions((p) => {
      const next = { ...p };
      Object.keys(next).forEach((k) => (next[k] = level));
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        if (!name.trim()) throw new Error('Please enter a group name');
        await base44.entities.PermissionGroup.create({
          name: name.trim(),
          description: description.trim() || undefined,
          is_system: false,
          is_read_only: isReadOnly,
          permissions,
        });
      } else if (!isSystem) {
        await base44.entities.PermissionGroup.update(group.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
          is_read_only: isReadOnly,
        });
      } else {
        // System groups: only read-only toggle + matrix allowed? System is locked.
        throw new Error('System groups cannot be edited');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      toast({ title: isNew ? 'Group created' : 'Group saved', description: name.trim() });
      onSaved?.();
      onClose();
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.PermissionGroup.delete(group.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Group deleted', description: group.name });
      onSaved?.();
      onClose();
    },
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg flex flex-col overflow-hidden animate-slide-up max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
              <KeyRound className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">
                {isNew ? 'New Permission Group' : 'Edit Permission Group'}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {isSystem ? 'System group — locked' : 'Controls access for every member assigned'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name + description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Group Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystem}
                placeholder="e.g. Senior Drillers"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSystem}
                placeholder="What can this group do?"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          {/* Read-only lockdown */}
          <button
            type="button"
            onClick={() => matrixEditable && setIsReadOnly((v) => !v)}
            disabled={!matrixEditable}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
              isReadOnly ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
            } ${!matrixEditable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isReadOnly ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              {isReadOnly ? <Lock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Read-Only Lockdown</p>
              <p className="text-[11px] text-slate-500">Force every module to view-only — no create, edit or delete anywhere.</p>
            </div>
            <div className={`w-10 h-6 rounded-full flex items-center transition flex-shrink-0 ${isReadOnly ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'}`}>
              <span className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
            </div>
          </button>

          {/* Module matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">Module Access</label>
              {isSystem ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> System — locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <ShieldCheck className="w-3 h-3" /> Editable
                </span>
              )}
            </div>
            <AccessModuleGrid
              permissions={permissions}
              isReadOnly={isReadOnly}
              onChange={handleModuleChange}
              onSetAll={handleSetAll}
            />
          </div>

          {/* Delete zone */}
          {!isNew && !isSystem && (
            <div className="pt-2 border-t border-slate-100">
              {confirmDelete ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="flex items-start gap-1.5 text-xs text-rose-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Delete "{group.name}"? Members will lose their access group assignment.
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 bg-white text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Group
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky save bar */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center gap-2 safe-area-bottom">
          <button onClick={onClose} className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isSystem || (isNew && !name.trim())}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Saving…' : isNew ? 'Create Group' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}