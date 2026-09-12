import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck, Clock, Users, ShieldCheck, Save, Plus, X, Loader2, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

// ApprovalRoutingSettings — admin page to configure who receives each
// approval type. Lists all ApprovalRoutingConfig records grouped by hub,
// with inline editing of approver mode, approvers, fallbacks, SLA and active state.

const HUB_LABELS = {
  billing: 'Financial Hub', jobs: 'Projects Hub', scheduling: 'Scheduling Hub',
  staff: 'People Hub', logistics: 'Logistics Hub', compliance: 'Compliance Hub',
  settings: 'Settings', overview: 'Dashboard',
};

const MODE_META = {
  manager_chain: { label: 'Manager Chain', icon: UserCheck, desc: 'Routes to the requester\'s assigned manager, escalating to fallbacks then super admins.' },
  permission_group: { label: 'Permission Group', icon: Users, desc: 'Routes to all active staff in a chosen permission group.' },
  specific_staff: { label: 'Specific Staff', icon: ShieldCheck, desc: 'Routes to the explicit staff members you pick below.' },
};

export default function ApprovalRoutingSettings() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState({}); // { [configId]: { ...draft fields } }
  const [saving, setSaving] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['approval-routing-configs'],
    queryFn: () => base44.entities.ApprovalRoutingConfig.list('hub', 100),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['all-active-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['all-permission-groups'],
    queryFn: () => base44.entities.PermissionGroup.list('name', 50),
  });

  const grouped = configs.reduce((acc, c) => {
    const hub = c.hub || 'overview';
    if (!acc[hub]) acc[hub] = [];
    acc[hub].push(c);
    return acc;
  }, {});

  const startEdit = (c) => {
    setEditing(e => ({ ...e, [c.id]: {
      approver_mode: c.approver_mode,
      approver_staff_ids: c.approver_staff_ids || [],
      fallback_staff_ids: c.fallback_staff_ids || [],
      permission_group_id: c.permission_group_id || '',
      sla_hours: c.sla_hours ?? 48,
      requires_multiple_signoffs: c.requires_multiple_signoffs,
      is_active: c.is_active,
    } }));
  };

  const save = async (c) => {
    setSaving(c.id);
    try {
      const draft = editing[c.id];
      await base44.entities.ApprovalRoutingConfig.update(c.id, {
        ...draft,
        last_edited_by: user?.full_name || user?.email || 'Admin',
      });
      toast({ title: 'Routing updated', description: c.label });
      setEditing(e => { const n = { ...e }; delete n[c.id]; return n; });
      queryClient.invalidateQueries({ queryKey: ['approval-routing-configs'] });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(null); }
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('seedApprovalRouting', {});
      toast({ title: 'Defaults seeded', description: `${res.data?.created || 0} new routing config(s) created` });
      queryClient.invalidateQueries({ queryKey: ['approval-routing-configs'] });
    } catch (e) {
      toast({ title: 'Seed failed', description: e.message, variant: 'destructive' });
    } finally { setSeeding(false); }
  };

  if (!isPlatformAdmin) {
    return <div className="hub-glass rounded-2xl p-8 text-center text-slate-500">Admin access required.</div>;
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="hub-glass rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Approval Routing</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Decide who receives each approval type across the platform. When someone submits an AFP, requests leave, or triggers any approval, the engine routes it to the approvers configured here — and sends them an inbox notification plus an email.
          </p>
        </div>
        <button
          onClick={seedDefaults} disabled={seeding}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
        >
          <Zap className="w-4 h-4" /> {seeding ? 'Seeding…' : 'Seed Defaults'}
        </button>
      </div>

      {/* Config cards grouped by hub */}
      {Object.entries(grouped).map(([hub, hubConfigs]) => (
        <div key={hub}>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">
            {HUB_LABELS[hub] || hub}
          </h3>
          <div className="space-y-3">
            {hubConfigs.map(c => {
              const draft = editing[c.id];
              const isEditing = !!draft;
              const ModeIcon = MODE_META[draft?.approver_mode || c.approver_mode]?.icon || UserCheck;
              return (
                <div key={c.id} className="hub-glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{c.label}</p>
                        <code className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{c.approval_type}</code>
                        {!c.is_active && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">INACTIVE</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{MODE_META[draft?.approver_mode || c.approver_mode]?.desc}</p>
                    </div>
                    {!isEditing && (
                      <button onClick={() => startEdit(c)} className="text-xs font-semibold text-primary hover:underline">
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-4 space-y-3.5 animate-slide-up border-t border-slate-100 pt-4">
                      {/* Mode selector */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Approver Mode</label>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                          {Object.entries(MODE_META).map(([mode, m]) => (
                            <button
                              key={mode}
                              onClick={() => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], approver_mode: mode } }))}
                              className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-bold transition ${
                                draft.approver_mode === mode
                                  ? 'command-gradient text-white shadow-sm'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <m.icon className="w-4 h-4" />
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Specific staff picker */}
                      {draft.approver_mode === 'specific_staff' && (
                        <StaffPicker
                          label="Approvers"
                          selected={draft.approver_staff_ids}
                          staff={staff}
                          onChange={(ids) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], approver_staff_ids: ids } }))}
                        />
                      )}

                      {/* Permission group picker */}
                      {draft.approver_mode === 'permission_group' && (
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Permission Group</label>
                          <select
                            value={draft.permission_group_id}
                            onChange={(e) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], permission_group_id: e.target.value } }))}
                            className="w-full mt-1.5 text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="">Select a group…</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Fallback staff picker */}
                      <StaffPicker
                        label="Fallback Approvers (used if primary can't be resolved + SLA escalation)"
                        selected={draft.fallback_staff_ids}
                        staff={staff}
                        onChange={(ids) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], fallback_staff_ids: ids } }))}
                      />

                      {/* SLA + multi-signoff + active */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SLA (hours)</label>
                          <input
                            type="number" min={0} value={draft.sla_hours}
                            onChange={(e) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], sla_hours: Number(e.target.value) } }))}
                            className="w-full mt-1.5 text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">0 = no SLA</p>
                        </div>
                        <label className="flex items-center gap-2 mt-5 cursor-pointer">
                          <input type="checkbox" checked={draft.requires_multiple_signoffs}
                            onChange={(e) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], requires_multiple_signoffs: e.target.checked } }))}
                            className="w-4 h-4 rounded accent-[#2E5A1A]" />
                          <span className="text-xs font-semibold text-slate-600">Multi-signoff</span>
                        </label>
                        <label className="flex items-center gap-2 mt-5 cursor-pointer">
                          <input type="checkbox" checked={draft.is_active}
                            onChange={(e) => setEditing(e => ({ ...e, [c.id]: { ...e[c.id], is_active: e.target.checked } }))}
                            className="w-4 h-4 rounded accent-[#2E5A1A]" />
                          <span className="text-xs font-semibold text-slate-600">Active</span>
                        </label>
                      </div>

                      {/* Save / cancel */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => save(c)} disabled={saving === c.id}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
                        >
                          {saving === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                        </button>
                        <button
                          onClick={() => setEditing(e => { const n = { ...e }; delete n[c.id]; return n; })}
                          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Read-only summary */}
                  {!isEditing && (
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><ModeIcon className="w-3.5 h-3.5" /> {MODE_META[c.approver_mode]?.label}</span>
                      {c.approver_mode === 'specific_staff' && c.approver_staff_ids?.length > 0 && (
                        <span>· {c.approver_staff_ids.length} approver(s)</span>
                      )}
                      {c.approver_mode === 'permission_group' && (
                        <span>· {groups.find(g => g.id === c.permission_group_id)?.name || 'No group set'}</span>
                      )}
                      <span>· <Clock className="w-3 h-3 inline" /> SLA {c.sla_hours || 0}h</span>
                      {c.requires_multiple_signoffs && <span>· Multi-signoff</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// StaffPicker — compact multi-select with chips. Shows selected staff as
// removable chips + a dropdown to add more.
function StaffPicker({ label, selected, staff, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedStaff = staff.filter(s => selected.includes(s.id));
  const filtered = staff.filter(s =>
    !selected.includes(s.id) &&
    (s.name || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const add = (id) => { onChange([...selected, id]); setQuery(''); setOpen(false); };
  const remove = (id) => onChange(selected.filter(s => s !== id));

  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="mt-1.5">
        {selectedStaff.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedStaff.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-lg">
                {s.name}
                <button onClick={() => remove(s.id)} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search staff to add…"
            className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => add(s.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  {s.name}
                  {s.job_title && <span className="text-xs text-slate-400">· {s.job_title}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}