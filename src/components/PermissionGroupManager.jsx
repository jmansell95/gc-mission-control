import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Plus, Trash2, Save, Lock, Pencil, X, KeyRound, Crown,
  Users, Building2, HardHat, Eye, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  PERMISSION_MODULES, ACCESS_LEVELS, SYSTEM_GROUPS,
  defaultPermissions, normalizePermissions,
} from '@/utils/permissions';
import SettingsLockdownManager from '@/components/settings/SettingsLockdownManager';
import PermissionMatrixGrid from '@/components/settings/access/PermissionMatrixGrid';
import { getAllPermissionKeysForHub } from '@/utils/subTabRegistry';
import TabBar from '@/components/TabBar';

export default function PermissionGroupManager({ profile }) {
  const [tab, setTab] = useState('groups');

  const tabs = [
    { id: 'groups', label: 'Permission Groups', icon: KeyRound },
    { id: 'lockdowns', label: 'Page Lockdowns', icon: Lock },
  ];

  return (
    <div className="space-y-4">
      {/* Super Admin Only banner */}
      <div className="insight-card rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Super Admin Restricted Area</p>
          <p className="text-xs text-slate-500">
            Only Super Admins can create, edit, and delete permission groups. These groups control what every staff member and team can see and do across the entire platform.
          </p>
        </div>
      </div>

      <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />

      {tab === 'groups' ? <GroupsTab /> : <SettingsLockdownManager profile={profile} />}
    </div>
  );
}

function GroupsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all'],
    queryFn: async () => (await base44.entities.Staff.list()),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams-all'],
    queryFn: async () => (await base44.entities.Team.list()),
  });

  // Count staff and teams assigned to each group
  const staffCountByGroup = {};
  staff.forEach(s => {
    if (s.permission_group_id) {
      staffCountByGroup[s.permission_group_id] = (staffCountByGroup[s.permission_group_id] || 0) + 1;
    }
  });
  const teamCountByGroup = {};
  teams.forEach(t => {
    if (t.permission_group_id) {
      teamCountByGroup[t.permission_group_id] = (teamCountByGroup[t.permission_group_id] || 0) + 1;
    }
  });

  const ensureSystemGroups = useMutation({
    mutationFn: async () => {
      for (const g of SYSTEM_GROUPS) {
        const existing = await base44.entities.PermissionGroup.filter({ name: g.name });
        if (existing.length === 0) {
          await base44.entities.PermissionGroup.create({
            ...g,
            permissions: normalizePermissions(g.permissions),
          });
        } else {
          // Fill in any missing modules for existing system groups (preserves customizations)
          const existingGroup = existing[0];
          const stored = existingGroup.permissions || {};
          const expected = normalizePermissions(g.permissions);
          let needsUpdate = false;
          const updatedPerms = { ...stored };
          PERMISSION_MODULES.forEach(m => {
            if (!(m.key in stored)) {
              updatedPerms[m.key] = expected[m.key];
              needsUpdate = true;
            }
          });
          if (needsUpdate) {
            await base44.entities.PermissionGroup.update(existingGroup.id, {
              permissions: normalizePermissions(updatedPerms),
            });
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries(['permission-groups']),
  });

  useEffect(() => {
    if (groups.length === 0 && !isLoading) ensureSystemGroups.mutate();
  }, [groups.length, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (group) => {
      const payload = { ...group, permissions: normalizePermissions(group.permissions) };
      if (group.id) {
        await base44.entities.PermissionGroup.update(group.id, payload);
      } else {
        await base44.entities.PermissionGroup.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      toast({ title: 'Permission group saved' });
      setEditing(null);
    },
    onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await base44.entities.PermissionGroup.delete(id); },
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      qc.invalidateQueries(['staff-all']);
      qc.invalidateQueries(['teams-all']);
      toast({ title: 'Group deleted' });
    },
    onError: (e) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const handleDelete = (group) => {
    const count = (staffCountByGroup[group.id] || 0) + (teamCountByGroup[group.id] || 0);
    if (count > 0) {
      toast({
        title: 'Cannot delete group',
        description: `${count} staff/team member(s) are still assigned. Reassign them first.`,
        variant: 'destructive',
      });
      return;
    }
    if (confirm(`Delete "${group.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(group.id);
    }
  };

  const startNew = () => setEditing({
    name: '', description: '', is_read_only: false,
    permissions: defaultPermissions(),
  });

  if (editing) {
    return (
      <GroupEditor
        group={editing}
        onCancel={() => setEditing(null)}
        onSave={(g) => saveMutation.mutate(g)}
        saving={saveMutation.isPending}
      />
    );
  }

  const systemGroups = groups.filter(g => g.is_system);
  const customGroups = groups.filter(g => !g.is_system);
  const totalAssigned = Object.values(staffCountByGroup).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Business Stream isolation banner */}
      <div className="insight-card rounded-2xl p-4 flex items-start gap-3 bg-emerald-50/50 border-emerald-200">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-md">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Business Stream Isolation</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Staff can only see records within their assigned Business Stream. When editing a staff member, select their Business Stream first, then choose a Permission Group from the filtered list. Field staff are locked to their schedule and profile only.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={KeyRound} label="Total Groups" value={groups.length} tone="emerald" />
        <StatTile icon={Users} label="Staff Assigned" value={totalAssigned} tone="blue" />
        <StatTile icon={Building2} label="Custom Groups" value={customGroups.length} tone="amber" />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Create access levels, then assign each crew member from Staff Command. Each group controls what its members can see and do.
        </p>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
        </div>
      )}

      {/* System Groups — built-in, can edit but not delete */}
      {systemGroups.length > 0 && (
        <div>
          <SectionHeader icon={Shield} title="System Groups" subtitle="Built-in access levels — can edit but not delete" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systemGroups.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                staffCount={staffCountByGroup[g.id] || 0}
                teamCount={teamCountByGroup[g.id] || 0}
                onEdit={() => setEditing(g)}
                onDelete={() => handleDelete(g)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Groups — user-created, can edit and delete */}
      {customGroups.length > 0 && (
        <div>
          <SectionHeader icon={Building2} title="Custom Groups" subtitle="Your own access levels — edit or delete anytime" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customGroups.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                staffCount={staffCountByGroup[g.id] || 0}
                teamCount={teamCountByGroup[g.id] || 0}
                onEdit={() => setEditing(g)}
                onDelete={() => handleDelete(g)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && customGroups.length === 0 && systemGroups.length > 0 && (
        <div className="insight-card rounded-2xl p-6 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No custom groups yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "New Group" to create your own access level — e.g. "Office Staff", "Junior Manager", "Read-Only Accounts".</p>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-slate-500" />
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function GroupCard({ group, staffCount, teamCount, onEdit, onDelete }) {
  const p = normalizePermissions(group.permissions);
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const noneCount = Object.values(p).filter(v => v === 'none').length;

  // Determine tier badge
  const tier = group.is_read_only ? 'read-only' :
    writeCount === Object.keys(p).length ? 'full' :
    writeCount > 0 ? 'office' :
    'field';

  const tierBadge = {
    'full': { label: 'Full Access', cls: 'bg-emerald-100 text-emerald-700' },
    'office': { label: 'Office Staff', cls: 'bg-blue-100 text-blue-700' },
    'field': { label: 'Field Team', cls: 'bg-amber-100 text-amber-700' },
    'read-only': { label: 'Read Only', cls: 'bg-slate-100 text-slate-600' },
  }[tier];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {group.is_read_only && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            <h3 className="font-bold text-slate-900 truncate">{group.name}</h3>
            {group.is_system && (
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">SYSTEM</span>
            )}
          </div>
          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierBadge.cls}`}>{tierBadge.label}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 line-clamp-2 mb-3 flex-1">{group.description || 'No description'}</p>

      {/* Visual hub access dots — coloured by access level (green/amber/red) */}
      <div className="flex flex-wrap gap-1 mb-3">
        {PERMISSION_MODULES.map(m => {
          const level = p[m.key] || 'none';
          return (
            <span
              key={m.key}
              className={`w-2.5 h-2.5 rounded-full transition ${
                level === 'write' ? 'bg-emerald-500' :
                level === 'read' ? 'bg-amber-500' :
                'bg-rose-300'
              }`}
              title={`${m.label}: ${level === 'write' ? 'Full Access' : level === 'read' ? 'Read Only' : 'No Access'}`}
            />
          );
        })}
      </div>

      {/* Permission summary */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{writeCount} full</span>
        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{readCount} read</span>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{noneCount} hidden</span>
      </div>

      {/* Assignment counts */}
      <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{staffCount}</span> staff
        </span>
        <span className="inline-flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{teamCount}</span> teams
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        {!group.is_system && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

function GroupEditor({ group, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    ...group,
    name: group.name || '',
    description: group.description || '',
    is_read_only: group.is_read_only || false,
    staff_type: group.staff_type || 'flexible',
    landing_page: group.landing_page || 'auto',
    permissions: normalizePermissions(group.permissions),
    sub_tab_permissions: group.sub_tab_permissions || {},
  }));

  const setLevel = (key, level) => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: level } }));

  const setAll = (level) => {
    const newPerms = {};
    PERMISSION_MODULES.forEach(m => { newPerms[m.key] = level; });
    setForm(f => ({ ...f, permissions: newPerms }));
  };

  // Sub-tab permission handlers
  const setSubTabLevel = (permKey, level) =>
    setForm(f => ({ ...f, sub_tab_permissions: { ...f.sub_tab_permissions, [permKey]: level } }));
  const setHubSubTabs = (hubKey, level) => {
    const keys = getAllPermissionKeysForHub(hubKey);
    const newSubs = { ...form.sub_tab_permissions };
    for (const k of keys) newSubs[k] = level;
    setForm(f => ({ ...f, sub_tab_permissions: newSubs }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#2E5A1A]" />
          <h2 className="text-lg font-bold text-slate-900">{group.id ? 'Edit Group' : 'New Permission Group'}</h2>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Group Name</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]"
            placeholder="e.g. Office Staff, Junior Manager, Read-Only Accounts"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]"
            placeholder="What can members of this group do?"
          />
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_read_only}
            onChange={e => setForm({ ...form, is_read_only: e.target.checked })}
            className="w-4 h-4 rounded accent-[#2E5A1A] mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Read-Only Lockdown</span>
            <p className="text-xs text-slate-500">Force every module to read-only — members can view but never create, edit, or delete anything.</p>
          </div>
        </label>

        {/* Staff type & landing page */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Staff Type</label>
            <select
              value={form.staff_type}
              onChange={e => setForm({ ...form, staff_type: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white"
            >
              <option value="flexible">Flexible (any)</option>
              <option value="office">Office Staff</option>
              <option value="field">Field Team</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Classifies this group — drives the default landing page after onboarding.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Landing Page</label>
            <select
              value={form.landing_page}
              onChange={e => setForm({ ...form, landing_page: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white"
            >
              <option value="auto">Auto (from staff type)</option>
              <option value="/admin">Admin Dashboard</option>
              <option value="/staff-schedule">My Schedule</option>
              <option value="/staff-profile">My Profile</option>
              <option value="/deliveries">Deliveries</option>
              <option value="/scanner">Scanner</option>
              <option value="/subcontractor">Subcontractor</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Where members land after login. Individual staff overrides still take priority.</p>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 mb-2">Quick Presets</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAll('write')} className="text-xs font-medium px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition">
            <ShieldCheck className="w-3 h-3 inline mr-1" /> Full Access (all write)
          </button>
          <button onClick={() => setAll('read')} className="text-xs font-medium px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition">
            <Eye className="w-3 h-3 inline mr-1" /> Read Everything
          </button>
          <button onClick={() => setAll('none')} className="text-xs font-medium px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
            <Lock className="w-3 h-3 inline mr-1" /> Lock All (no access)
          </button>
        </div>
      </div>

      {/* Module Permissions — Visual Matrix Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="font-bold text-slate-900 text-sm">Module Permissions</h3>
          <p className="text-xs text-slate-500 ml-1">Click a cell to toggle — red = none, amber = read, green = write</p>
        </div>
        <PermissionMatrixGrid
          permissions={form.permissions}
          isReadOnly={form.is_read_only}
          onChange={setLevel}
          onSetAll={setAll}
          subTabPermissions={form.sub_tab_permissions}
          onSubTabChange={setSubTabLevel}
          onSetHubSubTabs={setHubSubTabs}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sticky bottom-0 bg-white/80 backdrop-blur-md pt-3 pb-1 -mx-1 px-1 border-t border-slate-100">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Group'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-xl text-sm font-medium hover:bg-slate-200 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}