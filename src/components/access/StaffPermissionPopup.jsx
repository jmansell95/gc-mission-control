import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Crown, ShieldCheck, X, Loader2, ExternalLink, Save,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AccessSelect from '@/components/settings/access/AccessSelect';
import { SelectItem, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';

/**
 * StaffPermissionPopup — quick permission editor launched from a staff
 * member's card in the Staff Hub. Shows the current group, a dropdown to
 * change it, a Save button, and an "Open full Access Levels page" link
 * that navigates to Access Levels with this staff member pre-selected.
 *
 * Bottom-sheet on mobile, centred modal on desktop.
 */
export default function StaffPermissionPopup({ staff, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState(staff?.permission_group_id || '');

  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 200)),
  });

  useEffect(() => {
    setSelectedGroupId(staff?.permission_group_id || '');
  }, [staff]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Staff.update(staff.id, { permission_group_id: selectedGroupId || null });
      try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [staff.id] }); } catch (_) {}
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-access-assign'] });
      const g = groups.find(x => x.id === selectedGroupId);
      toast({ title: 'Permission updated', description: g ? `${staff.name} is now in "${g.name}"` : `${staff.name}'s group removed` });
      onClose();
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  if (!staff) return null;

  const currentGroup = groups.find(g => g.id === staff.permission_group_id) || null;
  const initials = (staff.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const openFullPage = () => {
    onClose();
    navigate('/admin', { state: { section: 'settings', settingsTab: 'access-levels', focusStaffId: staff.id } });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md flex-shrink-0">
              <KeyRound className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">Permissions</h2>
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

          {/* Current group display */}
          {currentGroup && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#2E5A1A]/[0.04] border border-[#2E5A1A]/15">
              {currentGroup.is_system ? <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <ShieldCheck className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Current Group</p>
                <p className="text-sm font-bold text-slate-900 truncate">{currentGroup.name}</p>
              </div>
            </div>
          )}

          {/* Group selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Assign Permission Group</label>
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
          </div>

          {/* Link to full page */}
          <button
            onClick={openFullPage}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[#2E5A1A] bg-[#2E5A1A]/[0.06] rounded-xl text-sm font-semibold hover:bg-[#2E5A1A]/[0.1] transition"
          >
            <ExternalLink className="w-4 h-4" /> Open full Access Levels page
          </button>
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
            disabled={saveMutation.isPending || selectedGroupId === (staff.permission_group_id || '')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}