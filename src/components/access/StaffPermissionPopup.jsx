import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Crown, ShieldCheck, X, Loader2, Save, Plus, Lock, Eye,
  AlertTriangle, Info,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AccessSelect from '@/components/settings/access/AccessSelect';
import AccessModuleGrid from '@/components/settings/access/AccessModuleGrid';
import { SelectItem, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { normalizePermissions, defaultPermissions } from '@/utils/permissions';

/**
 * StaffPermissionPopup — the single unified permission process.
 *
 * One popup does everything:
 *  1. Pick an existing permission group (or create a new one inline).
 *  2. Edit that group's per-module access matrix + read-only lockdown.
 *  3. Save — the group is updated and the staff member is assigned to it.
 *
 * Launched from the Access button on each person in the People directory
 * and from the Manage Permissions button in the crew profile editor.
 * Bottom-sheet on mobile, centred modal on desktop.
 */
export default function StaffPermissionPopup({ staff, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedGroupId, setSelectedGroupId] = useState(staff?.permission_group_id || '');
  const [permissions, setPermissions] = useState({});
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 200)),
  });

  // Whenever the selected group changes, load its matrix into local state.
  useEffect(() => {
    if (selectedGroupId === '__new') {
      setPermissions(defaultPermissions());
      setIsReadOnly(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } else {
      const g = groups.find((x) => x.id === selectedGroupId);
      if (g) {
        setPermissions(normalizePermissions(g.permissions));
        setIsReadOnly(!!g.is_read_only);
      } else {
        setPermissions(defaultPermissions());
        setIsReadOnly(false);
      }
    }
  }, [selectedGroupId, groups]);

  // Initialise selection from the staff member's current group.
  useEffect(() => {
    setSelectedGroupId(staff?.permission_group_id || '');
  }, [staff]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );
  const isSystem = !!selectedGroup?.is_system;
  const isNew = selectedGroupId === '__new';
  const matrixEditable = isNew || (!!selectedGroup && !isSystem);

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
      let groupId = selectedGroupId;

      // 1. Create a new group if requested.
      if (isNew) {
        if (!newGroupName.trim()) throw new Error('Please enter a name for the new group');
        const created = await base44.entities.PermissionGroup.create({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
          is_system: false,
          is_read_only: isReadOnly,
          permissions,
        });
        groupId = created.id;
      } else if (selectedGroup && !isSystem) {
        // 2. Update the existing custom group's matrix + read-only flag.
        await base44.entities.PermissionGroup.update(selectedGroup.id, {
          permissions,
          is_read_only: isReadOnly,
        });
      }
      // System groups are not mutated — only the staff assignment changes.

      // 3. Assign the staff member to the (possibly new) group.
      await base44.entities.Staff.update(staff.id, { permission_group_id: groupId || null });
      try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [staff.id] }); } catch (_) {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permission-groups'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-access-assign'] });
      const label = isNew ? newGroupName.trim() : (selectedGroup?.name || 'no group');
      toast({ title: 'Permissions saved', description: `${staff.name} → ${label}` });
      onClose();
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  if (!staff) return null;

  const initials = (staff.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const dirty =
    isNew ||
    selectedGroupId !== (staff.permission_group_id || '') ||
    (selectedGroup && !isSystem && (
      JSON.stringify(normalizePermissions(selectedGroup.permissions)) !== JSON.stringify(permissions) ||
      !!selectedGroup.is_read_only !== isReadOnly
    ));

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
              <h2 className="text-base font-extrabold text-slate-900 truncate">Manage Permissions</h2>
              <p className="text-[11px] text-slate-500 truncate">{staff.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Staff identity */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-sm overflow-hidden">
              {staff.avatar_url ? <img src={staff.avatar_url} alt={staff.name} className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{staff.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{staff.job_title || 'Crew Member'}</p>
            </div>
          </div>

          {/* Group selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Permission Group</label>
            <AccessSelect
              value={selectedGroupId}
              onChange={setSelectedGroupId}
              placeholder="Select group…"
              triggerClassName="h-11 w-full rounded-xl text-sm font-medium"
            >
              <SelectItem value="__none">
                <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-slate-200 flex-shrink-0" /> No group</span>
              </SelectItem>
              <SelectGroup>
                <SelectLabel>System Groups</SelectLabel>
                {groups.filter((g) => g.is_system).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> {g.name}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
              {groups.filter((g) => !g.is_system).length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Custom Groups</SelectLabel>
                    {groups.filter((g) => !g.is_system).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
              <SelectSeparator />
              <SelectItem value="__new">
                <span className="flex items-center gap-2"><Plus className="w-3.5 h-3.5 text-[#2E5A1A] flex-shrink-0" /> Create new group…</span>
              </SelectItem>
            </AccessSelect>
          </div>

          {/* New group fields */}
          {isNew && (
            <div className="space-y-3 p-3 rounded-xl bg-[#2E5A1A]/[0.04] border border-[#2E5A1A]/15">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Group Name</label>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Senior Drillers"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Description (optional)</label>
                <input
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What can this group do?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20"
                />
              </div>
            </div>
          )}

          {/* Read-only lockdown toggle */}
          {selectedGroupId && selectedGroupId !== '__none' && (
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
          )}

          {/* Module matrix */}
          {selectedGroupId && selectedGroupId !== '__none' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">Module Access</label>
                {isSystem ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Info className="w-3 h-3" /> System group — read only
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                    <ShieldCheck className="w-3 h-3" /> {isNew ? 'New group' : 'Editable'}
                  </span>
                )}
              </div>
              <AccessModuleGrid
                permissions={permissions}
                isReadOnly={isReadOnly}
                onChange={handleModuleChange}
                onSetAll={handleSetAll}
              />
              {!isNew && !isSystem && selectedGroup && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50/60 border border-amber-100 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Changes to this group apply to everyone assigned to it.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky save bar */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center gap-2 safe-area-bottom">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty || (isNew && !newGroupName.trim())}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}