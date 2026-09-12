import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Users, Search, Plus, ShieldCheck, PoundSterling, GraduationCap, LayoutGrid,
  Briefcase, ChevronRight, ChevronDown, Trash2, Loader2, Save, X, GitBranch, UserCircle2, Truck
} from 'lucide-react';
import ChipMultiSelect from '@/components/forms/ChipMultiSelect';
import { useConfigLists } from '@/hooks/useConfigLists';
import { formatWorkerType } from '@/utils/format';
import { TEAM_CATEGORIES, LANDING_PAGES, CAPABILITY_KEYS, DEFAULT_CAPABILITIES, DEFAULT_LANDING_PAGE } from '@/utils/teamAccess';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm transition";

const TABS = [
  { id: 'details', label: 'Details', icon: Briefcase },
  { id: 'revenue', label: 'Revenue & Assets', icon: PoundSterling },
  { id: 'qualifications', label: 'Qualifications', icon: GraduationCap },
  { id: 'access', label: 'Access & Landing', icon: LayoutGrid },
  { id: 'supervisor', label: 'Supervisor', icon: ShieldCheck },
  { id: 'roster', label: 'Roster', icon: Users },
];

const blank = () => ({ name: '', description: '', parent_team_id: '', job_type: '', category: '', default_landing_page: '', allowed_tool_access: [], revenue_stream_type: '', billing_default_markup: 0, compatible_asset_types: [], required_qualifications: [], is_supervisor_team: false, supervisor_staff_id: '', managed_team_ids: [] });

export default function CrewTypeCommand() {
  const { toast } = useToast();
  const { getOptions } = useConfigLists();
  const JOB_TYPE_OPTIONS = getOptions('team_job_types');
  const REVENUE_STREAMS = getOptions('revenue_streams');
  const ASSET_TYPE_OPTIONS = getOptions('asset_types');
  const QUALIFICATION_OPTIONS = getOptions('qualifications');
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('details');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: teams = [], isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const teamIds = new Set(teams.map(t => t.id));
  const parentTeams = teams.filter(t => !t.parent_team_id || !teamIds.has(t.parent_team_id));
  const subTeamsOf = (pid) => teams.filter(t => t.parent_team_id === pid && teamIds.has(pid));
  const membersOf = (tid) => staff.filter(s => s.team_id === tid);
  const unassigned = staff.filter(s => !s.team_id || !teamIds.has(s.team_id));

  const flatForSearch = useMemo(() => {
    const out = [];
    parentTeams.forEach(t => {
      out.push({ ...t, _depth: 0 });
      subTeamsOf(t.id).forEach(s => out.push({ ...s, _depth: 1 }));
    });
    return out.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [teams, search]);

  React.useEffect(() => {
    if (!selectedId && flatForSearch.length > 0) setSelectedId(flatForSearch[0].id);
  }, [flatForSearch, selectedId]);

  const selected = teams.find(t => t.id === selectedId);
  const selectedMembers = selected ? membersOf(selected.id) : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addName.trim() || adding) return;
    setAdding(true);
    try {
      const created = await base44.entities.Team.create({ name: addName.trim() });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowAdd(false);
      setAddName('');
      setSelectedId(created.id);
      toast({ title: 'Crew type added' });
    } catch (err) {
      toast({ title: 'Could not add', description: err?.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (team) => {
    const subs = subTeamsOf(team.id);
    const members = membersOf(team.id);
    const bits = [];
    if (subs.length) bits.push(`${subs.length} sub-crew${subs.length === 1 ? '' : 's'}`);
    if (members.length) bits.push(`${members.length} member${members.length === 1 ? '' : 's'}`);
    if (!confirm(`Delete ${team.name}?${bits.length ? ` It has ${bits.join(' and ')} — they'll become unassigned.` : ''}`)) return;
    try {
      await base44.entities.Team.delete(team.id);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setSelectedId(null);
      toast({ title: `${team.name} deleted` });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Crew Type Command</h2>
            <p className="text-sm text-slate-400">{teams.length} crews · {staff.length - unassigned.length} assigned · {unassigned.length} unassigned</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Add Crew Type
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* Crew list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crews…" className={`${inputCls} pl-9`} />
            </div>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {isLoading ? <div className="p-4 text-sm text-slate-400">Loading…</div> : flatForSearch.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No crews found.</p>
            ) : flatForSearch.map(t => {
              const isSel = t.id === selectedId;
              const count = membersOf(t.id).length;
              return (
                <button key={t.id} onClick={() => setSelectedId(t.id)} style={{ paddingLeft: 12 + t._depth * 16 }} className={`w-full text-left flex items-center gap-2 px-3 py-2.5 border-b border-slate-50 transition ${isSel ? 'bg-primary/5 border-l-[3px] border-l-[#2E5A1A]' : 'hover:bg-slate-50'}`}>
                  {t._depth > 0 && <GitBranch className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                    {count > 0 && <p className="text-xs text-slate-400">{count} member{count !== 1 ? 's' : ''}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        {!selected ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center min-h-[400px]">
            <div className="text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-medium">Select a crew type to manage</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-lg truncate">{selected.name}</h3>
                <p className="text-sm text-slate-400 truncate">{selected.description || selectedMembers.length + ' members'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {selected.category && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">{TEAM_CATEGORIES.find(c => c.value === selected.category)?.label || selected.category}</span>}
                {selected.job_type && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{JOB_TYPE_OPTIONS.find(o => o.value === selected.job_type)?.label || selected.job_type}</span>}
                {selected.is_supervisor_team && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Supervisor</span>}
              </div>
              <button onClick={() => handleDelete(selected)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0" title="Delete crew"><Trash2 className="w-4 h-4" /></button>
            </div>

            <div className="flex gap-1 px-5 border-b border-slate-100 overflow-x-auto">
              {TABS.map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${active ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <Icon className="w-4 h-4" /> {t.label}
                    {t.id === 'roster' && selectedMembers.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">{selectedMembers.length}</span>}
                  </button>
                );
              })}
            </div>

            <div className="p-5 max-h-[calc(100vh-340px)] overflow-y-auto">
              {tab === 'details' && <DetailsTab team={selected} teams={teams} JOB_TYPE_OPTIONS={JOB_TYPE_OPTIONS} />}
              {tab === 'revenue' && <RevenueTab team={selected} REVENUE_STREAMS={REVENUE_STREAMS} ASSET_TYPE_OPTIONS={ASSET_TYPE_OPTIONS} />}
              {tab === 'qualifications' && <QualificationsTab team={selected} QUALIFICATION_OPTIONS={QUALIFICATION_OPTIONS} />}
              {tab === 'access' && <AccessTab team={selected} />}
              {tab === 'supervisor' && <SupervisorTab team={selected} teams={teams} staff={staff} />}
              {tab === 'roster' && <RosterTab members={selectedMembers} subTeams={subTeamsOf(selected.id)} />}
            </div>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add Crew Type</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input required autoFocus type="text" placeholder="Crew name *" value={addName} onChange={e => setAddName(e.target.value)} className={inputCls} />
              <button type="submit" disabled={adding} className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Crew
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function useTeamUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return async (id, patch) => {
    try {
      await base44.entities.Team.update(id, patch);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
  };
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function DetailsTab({ team, teams, JOB_TYPE_OPTIONS }) {
  const update = useTeamUpdate();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [parent, setParent] = useState(team.parent_team_id || '');
  const [jobType, setJobType] = useState(team.job_type || '');
  const [category, setCategory] = useState(team.category || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { setName(team.name); setDescription(team.description || ''); setParent(team.parent_team_id || ''); setJobType(team.job_type || ''); setCategory(team.category || ''); }, [team.id]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    await update(team.id, {
      name, description, parent_team_id: parent || '', job_type: jobType || '', category,
      default_landing_page: DEFAULT_LANDING_PAGE[category] || team.default_landing_page || '',
      allowed_tool_access: team.allowed_tool_access?.length ? team.allowed_tool_access : (DEFAULT_CAPABILITIES[category] || []),
    });
    setSaving(false);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Crew Name"><input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} /></Field>
      <Field label="Description" hint="Internal notes about this crew"><textarea value={description} onChange={e => setDescription(e.target.value)} rows="2" className={inputCls} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Parent Crew" hint="Leave blank for a top-level crew group">
          <select value={parent} onChange={e => setParent(e.target.value)} className={inputCls}>
            <option value="">— Top-level —</option>
            {teams.filter(t => t.id !== team.id && !t.parent_team_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Job Type" hint="Members can only be assigned to matching jobs">
          <select value={jobType} onChange={e => setJobType(e.target.value)} className={inputCls}>
            <option value="">Flexible (any)</option>
            {JOB_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Top-Level Group" hint="Determines default landing page and tool access">
        <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
          <option value="">— Select group —</option>
          {TEAM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
      </button>
    </form>
  );
}

function RevenueTab({ team, REVENUE_STREAMS, ASSET_TYPE_OPTIONS }) {
  const update = useTeamUpdate();
  const [stream, setStream] = useState(team.revenue_stream_type || '');
  const [markup, setMarkup] = useState(team.billing_default_markup ?? 0);
  const [assets, setAssets] = useState(team.compatible_asset_types || []);

  React.useEffect(() => { setStream(team.revenue_stream_type || ''); setMarkup(team.billing_default_markup ?? 0); setAssets(team.compatible_asset_types || []); }, [team.id]);

  const save = async (e) => {
    e.preventDefault();
    await update(team.id, { revenue_stream_type: stream || '', billing_default_markup: Number(markup) || 0, compatible_asset_types: assets });
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Revenue Stream" hint={REVENUE_STREAMS.find(r => r.value === stream)?.description}>
        <select value={stream} onChange={e => setStream(e.target.value)} className={inputCls}>
          {REVENUE_STREAMS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Default Billing Markup %"><input type="number" min="0" step="0.1" value={markup} onChange={e => setMarkup(e.target.value)} className={inputCls} /></Field>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Compatible Asset Types</label>
        <ChipMultiSelect options={ASSET_TYPE_OPTIONS} value={assets} onChange={setAssets} columns={2} hint="Only compatible assets are offered when assigning equipment to this crew." />
      </div>
      <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
        <Save className="w-4 h-4" /> Save
      </button>
    </form>
  );
}

function QualificationsTab({ team, QUALIFICATION_OPTIONS }) {
  const update = useTeamUpdate();
  const [quals, setQuals] = useState(team.required_qualifications || []);
  React.useEffect(() => { setQuals(team.required_qualifications || []); }, [team.id]);
  const save = async (e) => { e.preventDefault(); await update(team.id, { required_qualifications: quals }); };
  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Required Qualifications & Training</label>
        <ChipMultiSelect options={QUALIFICATION_OPTIONS} value={quals} onChange={setQuals} columns={2} color="violet" hint="Staff missing these are flagged in the Training Gaps dashboard. Red dot = critical (e.g. CSCS card)." />
      </div>
      <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
        <Save className="w-4 h-4" /> Save
      </button>
    </form>
  );
}

function AccessTab({ team }) {
  const update = useTeamUpdate();
  const [landing, setLanding] = useState(team.default_landing_page || '');
  const [access, setAccess] = useState(team.allowed_tool_access || []);
  const [groupId, setGroupId] = useState(team.permission_group_id || '');
  const { data: groups = [] } = useQuery({ queryKey: ['permission-groups'], queryFn: () => base44.entities.PermissionGroup.list('-created_date', 100) });
  React.useEffect(() => { setLanding(team.default_landing_page || ''); setAccess(team.allowed_tool_access || []); setGroupId(team.permission_group_id || ''); }, [team.id]);
  const save = async (e) => { e.preventDefault(); await update(team.id, { default_landing_page: landing, allowed_tool_access: access, permission_group_id: groupId || '' }); };
  const selectedGroup = groups.find(g => g.id === groupId);
  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Permission Group (Access Level)" hint="Assign a granular access level — takes precedence over the legacy tool access list below. Define levels in Settings → Access Levels.">
        <select value={groupId} onChange={e => setGroupId(e.target.value)} className={inputCls}>
          <option value="">— No permission group (use legacy list) —</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.is_read_only ? ' (Read-Only Lockdown)' : ''}{g.is_system ? ' · SYSTEM' : ''}</option>)}
        </select>
      </Field>
      {selectedGroup && (
        <div className={`rounded-lg border p-3 text-xs ${selectedGroup.is_read_only ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className="font-semibold text-slate-700">{selectedGroup.name}{selectedGroup.is_read_only ? ' — Read-Only Lockdown' : ''}</p>
          {selectedGroup.description && <p className="text-slate-500 mt-0.5">{selectedGroup.description}</p>}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Default Landing Page (first page after login)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LANDING_PAGES.map(p => (
            <button type="button" key={p.value} onClick={() => setLanding(p.value)} className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition text-left ${landing === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Admin Tool Access (legacy)</label>
        <ChipMultiSelect options={CAPABILITY_KEYS.map(c => ({ value: c.key, label: c.label }))} value={access} onChange={setAccess} columns={2} hint={groupId ? "Overridden by the permission group above — kept for reference." : "Pick which admin sections this crew can access. Field crews typically only need Schedule View."} />
      </div>
      <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
        <Save className="w-4 h-4" /> Save
      </button>
    </form>
  );
}

function SupervisorTab({ team, teams, staff }) {
  const update = useTeamUpdate();
  const [isSupervisor, setIsSupervisor] = useState(team.is_supervisor_team || false);
  const [supervisorId, setSupervisorId] = useState(team.supervisor_staff_id || '');
  const [managed, setManaged] = useState(team.managed_team_ids || []);
  React.useEffect(() => { setIsSupervisor(team.is_supervisor_team || false); setSupervisorId(team.supervisor_staff_id || ''); setManaged(team.managed_team_ids || []); }, [team.id]);
  const save = async (e) => { e.preventDefault(); await update(team.id, { is_supervisor_team: isSupervisor, supervisor_staff_id: supervisorId || '', managed_team_ids: managed }); };
  return (
    <form onSubmit={save} className="space-y-4">
      <button type="button" onClick={() => setIsSupervisor(!isSupervisor)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition text-left w-full ${isSupervisor ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isSupervisor ? 'bg-primary border-primary' : 'border-slate-300'}`}>{isSupervisor && <span className="w-2 h-2 bg-white rounded-full" />}</span>
        This is a supervisor team (oversees other crews)
      </button>
      {isSupervisor && (
        <>
          <Field label="Supervisor">
            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className={inputCls}>
              <option value="">— Select supervisor —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Managed Crews</label>
            <ChipMultiSelect options={teams.filter(t => t.id !== team.id).map(t => ({ value: t.id, label: t.name }))} value={managed} onChange={setManaged} columns={2} hint="Crews this supervisor oversees — they'll see a production overview on their dashboard." />
          </div>
        </>
      )}
      <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
        <Save className="w-4 h-4" /> Save
      </button>
    </form>
  );
}

function RosterTab({ members, subTeams }) {
  if (members.length === 0 && subTeams.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No members in this crew yet. Assign crew members from the Staff Command page.</p>;
  }
  return (
    <div className="space-y-4">
      {members.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">{m.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs text-slate-400 truncate">{formatWorkerType(m.worker_type)}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${m.invite_sent ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              </div>
            ))}
          </div>
        </div>
      )}
      {subTeams.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {subTeams.length} sub-crew{subTeams.length !== 1 ? 's' : ''}</p>
          <div className="space-y-1.5">
            {subTeams.map(s => <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-700"><GitBranch className="w-3.5 h-3.5 text-slate-400" /> {s.name}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}