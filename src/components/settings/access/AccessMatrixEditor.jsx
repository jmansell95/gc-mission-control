import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Users, Crown, Lock, Eye, ShieldCheck, Save, X,
  Search, ChevronRight, Layers, AlertCircle, Sparkles, RotateCcw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import {
  PERMISSION_MODULES, ACCESS_LEVELS, normalizePermissions,
} from '@/utils/permissions';

const MODULE_CATEGORIES = [
  { label: 'Operations', keys: ['overview', 'jobs', 'rota', 'calendar', 'scheduling', 'logistics'] },
  { label: 'People & Compliance', keys: ['staff', 'teams', 'compliance', 'safety', 'timesheets'] },
  { label: 'Financial', keys: ['billing'] },
  { label: 'Assets & Fleet', keys: ['assets'] },
  { label: 'Technical & Audit', keys: ['ags_import', 'log-qc', 'audit-trail'] },
  { label: 'System', keys: ['settings'] },
];

const LEVEL_STYLES = {
  write: { active: 'bg-[#2E5A1A] text-white', icon: ShieldCheck, ring: 'ring-[#2E5A1A]' },
  read: { active: 'bg-amber-500 text-white', icon: Eye, ring: 'ring-amber-500' },
  none: { active: 'bg-slate-200 text-slate-600', icon: Lock, ring: 'ring-slate-300' },
};

const PREVIEW_NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: '📊' },
  { id: 'jobs', label: 'Jobs', icon: '💼' },
  { id: 'rota', label: 'Rota', icon: '📅' },
  { id: 'scheduling', label: 'Scheduling', icon: '⏰' },
  { id: 'staff', label: 'Staff', icon: '👥' },
  { id: 'compliance', label: 'Compliance', icon: '🛡️' },
  { id: 'billing', label: 'Billing', icon: '💰' },
  { id: 'assets', label: 'Assets', icon: '📦' },
  { id: 'logistics', label: 'Logistics', icon: '🚚' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function AccessMatrixEditor({ fixedGroup, inline = false, lockedDivisionId = null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { divisions, permittedDivisions: allPermitted } = useDivision();
  const permittedDivisions = lockedDivisionId ? allPermitted.filter(d => d.id === lockedDivisionId) : allPermitted;
  const [selectedDivisionId, setSelectedDivisionId] = useState(lockedDivisionId || null);
  const [selectedGroupId, setSelectedGroupId] = useState(fixedGroup?.id || null);
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });

  const { data: manifests = [], isLoading: manifestsLoading } = useQuery({
    queryKey: ['division-access-manifests', selectedDivisionId],
    queryFn: async () => {
      if (!selectedDivisionId) return [];
      return await base44.entities.DivisionAccessManifest.filter({ division_id: selectedDivisionId });
    },
    enabled: !!selectedDivisionId,
  });

  const { data: divisionStaff = [] } = useQuery({
    queryKey: ['division-staff', selectedDivisionId],
    queryFn: async () => {
      if (!selectedDivisionId) return [];
      return await base44.entities.Staff.filter({ division_id: selectedDivisionId });
    },
    enabled: !!selectedDivisionId,
  });

  const { data: allGroupStaff = [] } = useQuery({
    queryKey: ['group-staff-all-divisions', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      return await base44.entities.Staff.filter({ permission_group_id: selectedGroupId });
    },
    enabled: !!selectedGroupId,
  });

  useEffect(() => {
    if (lockedDivisionId) { setSelectedDivisionId(lockedDivisionId); return; }
    if (!selectedDivisionId && permittedDivisions.length > 0) {
      setSelectedDivisionId(permittedDivisions[0].id);
    }
  }, [permittedDivisions, lockedDivisionId]);

  useEffect(() => {
    if (!fixedGroup && !selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, fixedGroup]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || (fixedGroup?.id === selectedGroupId ? fixedGroup : null);
  const selectedDivision = divisions.find(d => d.id === selectedDivisionId);
  const existingManifest = manifests.find(m => m.permission_group_id === selectedGroupId);

  const [workingPerms, setWorkingPerms] = useState({});

  useEffect(() => {
    if (selectedGroup) {
      const base = normalizePermissions(selectedGroup.permissions);
      const overrides = existingManifest?.feature_access || {};
      setWorkingPerms({ ...base, ...overrides });
      setDirty(false);
    }
  }, [selectedGroup, existingManifest]);

  const setLevel = (key, level) => {
    setWorkingPerms(p => ({ ...p, [key]: level }));
    setDirty(true);
  };

  const setAll = (level) => {
    const newPerms = {};
    Object.keys(workingPerms).forEach(k => { newPerms[k] = level; });
    setWorkingPerms(newPerms);
    setDirty(true);
  };

  const computeDiff = () => {
    if (!selectedGroup) return {};
    const base = normalizePermissions(selectedGroup.permissions);
    const diff = {};
    Object.keys(workingPerms).forEach(k => {
      if (workingPerms[k] !== base[k]) {
        diff[k] = workingPerms[k];
      }
    });
    return diff;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const diff = computeDiff();
      const payload = {
        division_id: selectedDivisionId,
        permission_group_id: selectedGroupId,
        feature_access: diff,
        version: (existingManifest?.version || 0) + 1,
      };
      if (existingManifest?.id) {
        await base44.entities.DivisionAccessManifest.update(existingManifest.id, payload);
      } else {
        await base44.entities.DivisionAccessManifest.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['division-access-manifests', selectedDivisionId]);
      qc.invalidateQueries(['all-access-manifests']);
      toast({ title: 'Business Stream lockdown saved', description: `${selectedDivision?.name} · ${selectedGroup?.name}` });
      setDirty(false);
    },
    onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (existingManifest?.id) {
        await base44.entities.DivisionAccessManifest.delete(existingManifest.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['division-access-manifests', selectedDivisionId]);
      qc.invalidateQueries(['all-access-manifests']);
      toast({ title: 'Lockdown cleared', description: 'Reverted to group defaults' });
      setDirty(false);
    },
  });

  const stats = useMemo(() => {
    const vals = Object.values(workingPerms);
    return {
      write: vals.filter(v => v === 'write').length,
      read: vals.filter(v => v === 'read').length,
      none: vals.filter(v => v === 'none').length,
      total: vals.length,
    };
  }, [workingPerms]);

  const staffInGroup = divisionStaff.filter(s => s.permission_group_id === selectedGroupId);
  const filteredGroups = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  if (permittedDivisions.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">No divisions available</p>
        <p className="text-xs text-slate-400 mt-1">Create a business stream first in the Business Streams tab to configure lockdown rules.</p>
      </div>
    );
  }

  // ─── INLINE MODE: division tabs + matrix + preview (no hierarchy pane) ───
  if (inline && fixedGroup) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Matrix Editor */}
        <div className="lg:col-span-7 insight-card rounded-2xl p-4">
          {selectedGroup && selectedDivision ? (
            <>
              {/* Division context */}
              {lockedDivisionId && selectedDivision ? (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedDivision.color || '#2E5A1A' }} />
                  <span className="text-xs font-bold text-slate-700">{selectedDivision.name}</span>
                  <span className="text-[10px] text-slate-400">· lockdown overrides for this business stream</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
                  {permittedDivisions.map(d => {
                    const active = selectedDivisionId === d.id;
                    const hasOverride = manifests.filter(m => m.division_id === d.id && m.permission_group_id === selectedGroupId).length > 0;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDivisionId(d.id)}
                        className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ' +
                          (active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: active ? 'rgba(255,255,255,0.5)' : (d.color || '#2E5A1A') }} />
                        {d.name}
                        {hasOverride && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has lockdown overrides" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Override / dirty banners */}
              {existingManifest && !dirty && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">Custom lockdown active — overrides the group's base permissions for {selectedDivision.name} only.</p>
                </div>
              )}
              {dirty && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 mb-3">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">Unsaved changes — click Save to apply this lockdown to {selectedDivision.name}.</p>
                </div>
              )}

              {/* Quick presets */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Presets:</span>
                <button onClick={() => setAll('write')} className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Full Access
                </button>
                <button onClick={() => setAll('read')} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Read Everything
                </button>
                <button onClick={() => setAll('none')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Lock All
                </button>
              </div>

              {/* Stat bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-4">
                <div className="bg-[#2E5A1A]" style={{ width: `${stats.total ? (stats.write / stats.total) * 100 : 0}%` }} />
                <div className="bg-amber-400" style={{ width: `${stats.total ? (stats.read / stats.total) * 100 : 0}%` }} />
                <div className="bg-slate-300" style={{ width: `${stats.total ? (stats.none / stats.total) * 100 : 0}%` }} />
              </div>

              {/* Module categories */}
              <div className="space-y-3">
                {MODULE_CATEGORIES.map(cat => {
                  const catModules = PERMISSION_MODULES.filter(m => cat.keys.includes(m.key));
                  if (catModules.length === 0) return null;
                  return (
                    <div key={cat.label} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cat.label}</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {catModules.map(m => {
                          const current = workingPerms[m.key] || 'none';
                          const baseLevel = selectedGroup ? normalizePermissions(selectedGroup.permissions)[m.key] : 'none';
                          const isOverridden = current !== baseLevel;
                          return (
                            <div key={m.key} className={'flex items-center justify-between px-3.5 py-2.5 ' + (isOverridden ? 'bg-amber-50/40' : 'bg-white')}>
                              <div className="flex items-center gap-2 min-w-0">
                                {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" title="Sensitive module" />}
                                <span className="text-sm font-medium text-slate-700 truncate">{m.label}</span>
                                {isOverridden && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">OVERRIDE</span>}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {ACCESS_LEVELS.map(lvl => {
                                  const active = current === lvl.value;
                                  const style = LEVEL_STYLES[lvl.value];
                                  const Icon = style.icon;
                                  return (
                                    <button
                                      key={lvl.value}
                                      onClick={() => setLevel(m.key, lvl.value)}
                                      className={'px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ' +
                                        (active ? style.active : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {lvl.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sticky save bar */}
              <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm"
                >
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving…' : `Save Lockdown for ${selectedDivision.name}`}
                </button>
                {existingManifest && (
                  <button
                    onClick={() => { if (confirm('Clear this division lockdown and revert to group defaults?')) resetMutation.mutate(); }}
                    disabled={resetMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-rose-600 bg-rose-50 rounded-xl text-sm font-semibold hover:bg-rose-100 disabled:opacity-50 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="w-6 h-6 border-3 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-5 insight-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">Live Preview</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400">
              {selectedDivision?.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">What a <strong>{selectedGroup?.name}</strong> user sees:</p>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            <div className="px-3 py-2 bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: selectedDivision?.color || '#2E5A1A' }} />
              {selectedDivision?.code || 'DIV'}
            </div>
            <div className="p-2 space-y-0.5">
              {PREVIEW_NAV_ITEMS.map(item => {
                const level = workingPerms[item.id] || 'none';
                const visible = level !== 'none';
                const readOnly = level === 'read';
                return (
                  <div
                    key={item.id}
                    className={'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition ' +
                      (visible ? 'bg-white' : 'bg-slate-100 opacity-40') +
                      (readOnly ? ' ring-1 ring-amber-200' : '')}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className={'flex-1 truncate ' + (visible ? 'text-slate-700 font-medium' : 'text-slate-400 line-through')}>{item.label}</span>
                    {level === 'write' && <ShieldCheck className="w-3 h-3 text-[#2E5A1A]" />}
                    {readOnly && <Eye className="w-3 h-3 text-amber-500" />}
                    {!visible && <Lock className="w-3 h-3 text-slate-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Affected staff */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Affected Staff</p>
              <span className="text-[10px] font-bold text-slate-500">
                {staffInGroup.length} here · {allGroupStaff.length} total
              </span>
            </div>
            {staffInGroup.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No staff in this group within {selectedDivision?.name}.{allGroupStaff.length > 0 && ` (${allGroupStaff.length} in other divisions)`}</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {staffInGroup.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {s.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── DRAWER MODE (3-pane): hierarchy + matrix + preview ───
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* PANE 1: Hierarchy Selector */}
        <div className={'insight-card rounded-2xl p-4 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto ' + (fixedGroup ? 'lg:col-span-4' : 'lg:col-span-3')}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="text-sm font-bold text-slate-900">{fixedGroup ? 'Business Streams' : 'Hierarchy'}</h3>
            {fixedGroup && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Crown className="w-3 h-3" /> {fixedGroup.name}
              </span>
            )}
          </div>

          <div className="space-y-1 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Business Streams</p>
            {permittedDivisions.map(d => {
              const active = selectedDivisionId === d.id;
              const manifestCount = manifests.filter(m => m.division_id === d.id && m.permission_group_id === selectedGroupId).length;
              const staffCount = divisionStaff.filter(s => s.permission_group_id === selectedGroupId && s.division_id === d.id).length;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDivisionId(d.id)}
                  className={'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ' +
                    (active ? 'bg-[#2E5A1A]/10 ring-1 ring-[#2E5A1A]/30' : 'hover:bg-slate-50')}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color || '#2E5A1A' }} />
                  <div className="min-w-0 flex-1">
                    <p className={'text-xs font-semibold truncate ' + (active ? 'text-[#2E5A1A]' : 'text-slate-700')}>{d.name}</p>
                    <p className="text-[10px] text-slate-400">{d.code || d.division_type}{staffCount > 0 ? ` · ${staffCount} staff` : ''}</p>
                  </div>
                  {manifestCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Has lockdown overrides">🔒</span>
                  )}
                </button>
              );
            })}
          </div>

          {!fixedGroup && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Permission Groups</p>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              {filteredGroups.map(g => {
                const active = selectedGroupId === g.id;
                const hasManifest = manifests.some(m => m.permission_group_id === g.id);
                const staffCount = divisionStaff.filter(s => s.permission_group_id === g.id).length;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    className={'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ' +
                      (active ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-slate-50')}
                  >
                    {g.is_system ? <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={'text-xs font-semibold truncate ' + (active ? 'text-amber-700' : 'text-slate-700')}>{g.name}</p>
                      {staffCount > 0 && <p className="text-[10px] text-slate-400">{staffCount} staff here</p>}
                    </div>
                    {hasManifest && <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Has overrides" />}
                    <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PANE 2: Matrix Editor */}
        <div className={'insight-card rounded-2xl p-4 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto ' + (fixedGroup ? 'lg:col-span-5' : 'lg:col-span-6')}>
          {selectedGroup && selectedDivision ? (
            <>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: selectedDivision.color || '#2E5A1A' }}>
                    <Building2 className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedDivision.name}</h3>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedGroup.is_system && <Crown className="w-3 h-3 text-amber-500 inline mr-1" />}
                      {selectedGroup.name}
                    </p>
                  </div>
                </div>
                {existingManifest && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 flex-shrink-0">
                    <Sparkles className="w-3 h-3" /> v{existingManifest.version}
                  </span>
                )}
              </div>

              {existingManifest && !dirty && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">Custom lockdown active — changes here override the group's base permissions for this division only.</p>
                </div>
              )}
              {dirty && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 mb-3">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">Unsaved changes — click Save to apply this lockdown to {selectedDivision.name}.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Presets:</span>
                <button onClick={() => setAll('write')} className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Full Access
                </button>
                <button onClick={() => setAll('read')} className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Read Everything
                </button>
                <button onClick={() => setAll('none')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Lock All
                </button>
              </div>

              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-4">
                <div className="bg-[#2E5A1A]" style={{ width: `${stats.total ? (stats.write / stats.total) * 100 : 0}%` }} />
                <div className="bg-amber-400" style={{ width: `${stats.total ? (stats.read / stats.total) * 100 : 0}%` }} />
                <div className="bg-slate-300" style={{ width: `${stats.total ? (stats.none / stats.total) * 100 : 0}%` }} />
              </div>

              <div className="space-y-3">
                {MODULE_CATEGORIES.map(cat => {
                  const catModules = PERMISSION_MODULES.filter(m => cat.keys.includes(m.key));
                  if (catModules.length === 0) return null;
                  return (
                    <div key={cat.label} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cat.label}</p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {catModules.map(m => {
                          const current = workingPerms[m.key] || 'none';
                          const baseLevel = selectedGroup ? normalizePermissions(selectedGroup.permissions)[m.key] : 'none';
                          const isOverridden = current !== baseLevel;
                          return (
                            <div key={m.key} className={'flex items-center justify-between px-3.5 py-2.5 ' + (isOverridden ? 'bg-amber-50/40' : 'bg-white')}>
                              <div className="flex items-center gap-2 min-w-0">
                                {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" title="Sensitive module" />}
                                <span className="text-sm font-medium text-slate-700 truncate">{m.label}</span>
                                {isOverridden && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">OVERRIDE</span>}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {ACCESS_LEVELS.map(lvl => {
                                  const active = current === lvl.value;
                                  const style = LEVEL_STYLES[lvl.value];
                                  const Icon = style.icon;
                                  return (
                                    <button
                                      key={lvl.value}
                                      onClick={() => setLevel(m.key, lvl.value)}
                                      className={'px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ' +
                                        (active ? style.active : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {lvl.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm"
                >
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving…' : 'Save Lockdown'}
                </button>
                {existingManifest && (
                  <button
                    onClick={() => { if (confirm('Clear this division lockdown and revert to group defaults?')) resetMutation.mutate(); }}
                    disabled={resetMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-rose-600 bg-rose-50 rounded-xl text-sm font-semibold hover:bg-rose-100 disabled:opacity-50 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <div className="w-6 h-6 border-3 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* PANE 3: Live Preview */}
        <div className="lg:col-span-3 insight-card rounded-2xl p-4 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">Live Preview</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">What a <strong>{selectedGroup?.name}</strong> user sees in <strong>{selectedDivision?.name}</strong>:</p>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            <div className="px-3 py-2 bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: selectedDivision?.color || '#2E5A1A' }} />
              {selectedDivision?.code || 'DIV'}
            </div>
            <div className="p-2 space-y-0.5">
              {PREVIEW_NAV_ITEMS.map(item => {
                const level = workingPerms[item.id] || 'none';
                const visible = level !== 'none';
                const readOnly = level === 'read';
                return (
                  <div
                    key={item.id}
                    className={'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition ' +
                      (visible ? 'bg-white' : 'bg-slate-100 opacity-40') +
                      (readOnly ? ' ring-1 ring-amber-200' : '')}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className={'flex-1 truncate ' + (visible ? 'text-slate-700 font-medium' : 'text-slate-400 line-through')}>{item.label}</span>
                    {level === 'write' && <ShieldCheck className="w-3 h-3 text-[#2E5A1A]" />}
                    {readOnly && <Eye className="w-3 h-3 text-amber-500" />}
                    {!visible && <Lock className="w-3 h-3 text-slate-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Affected Staff</p>
              <span className="text-[10px] font-bold text-slate-500">
                {staffInGroup.length} here · {allGroupStaff.length} total
              </span>
            </div>
            {staffInGroup.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No staff in this group within {selectedDivision?.name}.{allGroupStaff.length > 0 && ` (${allGroupStaff.length} in other divisions)`}</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {staffInGroup.slice(0, 8).map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {s.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                  </div>
                ))}
                {staffInGroup.length > 8 && (
                  <p className="text-[10px] text-slate-400 text-center pt-1">+{staffInGroup.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}