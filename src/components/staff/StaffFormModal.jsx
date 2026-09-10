import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useAuth } from '@/lib/AuthContext';
import FormModal from '@/components/ui/FormModal';
import {
  Mail, Bell, Truck, ShieldCheck, UserCircle2, Building2,
  KeyRound, Users, Briefcase, UserCheck, PoundSterling,
} from 'lucide-react';

/**
 * StaffFormModal — standardised popup for creating/editing a crew member.
 * Larger 3xl modal with all staff information in one place: identity, crew &
 * stream, personal, subcontractor details, notifications, and access control.
 */
export default function StaffFormModal({ open, onClose, editing, staff, teams, vehicles, staffList }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOptions } = useConfigLists();
  const workerTypeOptions = getOptions('worker_types');
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: permissionGroups = [] } = useQuery({
    queryKey: ['permission-groups-all'],
    queryFn: () => base44.entities.PermissionGroup.list('name', 100),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-all-staff-form'],
    queryFn: () => base44.entities.Division.list('name', 50),
  });
  // Load the current user's Staff profile so we can grant day-rate editing
  // to management-level users, not just platform admins.
  const { data: myProfileArr } = useQuery({
    queryKey: ['my-staff-profile-staff-form', currentUser?.id],
    queryFn: () => base44.entities.Staff.filter({ user_id: currentUser.id }, '-created_date', 1),
    enabled: !!currentUser?.id,
  });
  const mySystemRole = myProfileArr?.[0]?.system_role;
  const canEditFinancials = isAdmin || mySystemRole === 'admin' || mySystemRole === 'super_admin' || mySystemRole === 'management';

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviteOnCreate, setInviteOnCreate] = useState(true);

  const emptyForm = {
    name: '', email: '', phone: '', date_of_birth: '', ni_number: '',
    job_title: '',
    worker_type: 'direct_employee', team_id: '', default_vehicle_id: '',
    manager_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false,
    permission_group_id: '', default_landing_page: '',
    division_id: '',
    managed_division_ids: [],
    is_approver: false,
    is_active: true,
    company: '', lead_driller_name: '', lead_driller_phone: '',
    second_man_name: '', second_man_phone: '',
    market_dojo_onboarded: false,
    day_rate: null,
  };

  const toggleManagedDivision = (divId) => {
    setForm(prev => {
      const current = prev.managed_division_ids || [];
      return {
        ...prev,
        managed_division_ids: current.includes(divId)
          ? current.filter(id => id !== divId)
          : [...current, divId],
      };
    });
  };

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({ ...emptyForm, ...staff });
      } else {
        setForm(emptyForm);
        setInviteOnCreate(true);
      }
    }
  }, [open, editing, staff]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const isSubcontractor = form.worker_type === 'subcontractor' || form.worker_type === 'agency';
  const filteredTeams = form.division_id
    ? teams.filter(t => t.division_id === form.division_id)
    : teams;

  const cleanPayload = (data) => {
    const cleaned = { ...data };
    ['default_vehicle_id', 'manager_id', 'permission_group_id', 'default_landing_page', 'division_id', 'team_id'].forEach(k => {
      if (cleaned[k] === '') delete cleaned[k];
    });
    return cleaned;
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = cleanPayload(form);
      if (!payload.division_id && payload.team_id) {
        const selectedTeam = teams.find(t => t.id === payload.team_id);
        if (selectedTeam?.division_id) payload.division_id = selectedTeam.division_id;
      }
      if (!payload.name?.trim() || !payload.email?.trim() || !payload.worker_type || !payload.team_id) {
        toast({ title: 'Missing required fields', description: 'Name, email, worker type and crew are required.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      if (editing) {
        const original = staffList.find(s => s.id === editing);
        if (original && original.email && original.email.toLowerCase() !== (form.email || '').toLowerCase()) {
          payload.invite_sent = false;
        }
        await base44.entities.Staff.update(editing, payload);
        try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [editing] }); } catch (_) {}
        toast({ title: 'Crew member updated' });
      } else {
        const created = await base44.entities.Staff.create(payload);
        if (inviteOnCreate && form.email) {
          try {
            const tempPassword = 'GC' + Math.random().toString(36).slice(2, 10) + '!';
            let registered = false;
            try {
              await base44.auth.register({ email: form.email, password: tempPassword });
              registered = true;
            } catch (regErr) {
              if (!String(regErr?.message || '').match(/already|exists/i)) throw regErr;
              registered = true;
            }
            let brandedSent = false;
            if (registered) {
              try {
                const res = await base44.functions.invoke('sendBrandedInvite', { email: form.email, staff_name: form.name, temp_password: tempPassword });
                brandedSent = (res.data || res)?.sent === true;
              } catch (_) { /* fall back below */ }
            }
            if (!brandedSent) {
              await base44.users.inviteUser(form.email, 'user');
            }
            await base44.entities.Staff.update(created.id, { invite_sent: true });
            toast({ title: 'Crew member added', description: brandedSent ? `Branded invite sent to ${form.email}` : `Invite sent to ${form.email}` });
          } catch (err) {
            toast({ title: 'Crew member added', description: 'App invite could not be sent — use the invite button on the card.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Crew member added' });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      onClose();
    } catch (error) {
      toast({ title: 'Could not save crew member', description: error?.message || 'Please check all fields and try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';
  const sectionTitle = 'text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5';
  const gridCls = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5';

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={ShieldCheck}
      title={editing ? 'Edit Crew Member' : 'New Crew Member'}
      description={editing ? 'Update this crew member\'s details and access.' : 'Add a new crew member to the team.'}
      size="3xl"
      saveLabel={editing ? 'Update' : 'Add Crew Member'}
      onSave={handleSave}
      saving={saving}
    >
      <div className="space-y-6">
        {/* Identity */}
        <section>
          <p className={sectionTitle}><UserCircle2 className="w-3.5 h-3.5" /> Identity</p>
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Full Name *</label>
              <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Address *</label>
              <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Worker Type</label>
              <select value={form.worker_type || 'direct_employee'} onChange={e => set('worker_type', e.target.value)} className={inputCls}>
                {workerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Job Title</label>
              <input type="text" value={form.job_title || ''} onChange={e => set('job_title', e.target.value)} placeholder="e.g. Cable Percussion Driller" className={inputCls} />
            </div>
          </div>
        </section>

        {/* Crew & Stream */}
        <section>
          <p className={sectionTitle}><Users className="w-3.5 h-3.5" /> Crew & Stream</p>
          <div className={gridCls}>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelCls}>Crew *</label>
              <select value={form.team_id || ''} onChange={e => set('team_id', e.target.value)} required className={inputCls}>
                <option value="">Select Crew</option>
                {filteredTeams.map(t => {
                  const parent = teams.find(p => p.id === t.parent_team_id);
                  return <option key={t.id} value={t.id}>{parent ? `${parent.name} — ${t.name}` : t.name}</option>;
                })}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className={labelCls}>Business Stream</label>
                <select value={form.division_id || ''} onChange={e => set('division_id', e.target.value)} className={inputCls}>
                  <option value="">Inherit from crew</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {isAdmin && (
              <div>
                <label className={labelCls}>Access Level</label>
                <select value={form.permission_group_id || ''} onChange={e => set('permission_group_id', e.target.value)} className={inputCls}>
                  <option value="">Default (Field Staff)</option>
                  {permissionGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
            {isAdmin && (
              <div>
                <label className={labelCls}>Default Landing Page</label>
                <select value={form.default_landing_page || ''} onChange={e => set('default_landing_page', e.target.value)} className={inputCls}>
                  <option value="">Auto (from access level)</option>
                  <option value="/admin">Admin Dashboard</option>
                  <option value="/staff-schedule">My Schedule</option>
                  <option value="/staff-profile">My Profile</option>
                  <option value="/deliveries">Deliveries</option>
                  <option value="/scanner">Scanner</option>
                  <option value="/subcontractor">Subcontractor Hub</option>
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Default Vehicle</label>
              <select value={form.default_vehicle_id || ''} onChange={e => set('default_vehicle_id', e.target.value)} className={inputCls}>
                <option value="">None (Optional)</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Timesheet Manager</label>
              <select value={form.manager_id || ''} onChange={e => set('manager_id', e.target.value)} className={inputCls}>
                <option value="">None (Admin approves)</option>
                {staffList.filter(s => s.id !== editing).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Personal — admin only */}
        {isAdmin && (
          <section>
            <p className={sectionTitle}><Briefcase className="w-3.5 h-3.5" /> Personal</p>
            <div className={gridCls}>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" value={form.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>NI Number</label>
                <input type="text" value={form.ni_number || ''} onChange={e => set('ni_number', e.target.value.toUpperCase())} placeholder="AB123456C" className={`${inputCls} font-mono uppercase`} />
              </div>
            </div>
          </section>
        )}

        {/* Financial — admin + management */}
        {canEditFinancials && (
          <section>
            <p className={sectionTitle}><PoundSterling className="w-3.5 h-3.5" /> Financial</p>
            <div className={gridCls}>
              <div>
                <label className={labelCls}>Day Rate (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.day_rate ?? ''}
                  onChange={e => set('day_rate', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 180.00"
                  className={inputCls}
                />
                <p className="text-[10px] text-slate-400 mt-1">Internal cost per day in GBP. Used for labour cost calculations. Leave blank to fall back to the rate card.</p>
              </div>
            </div>
          </section>
        )}

        {/* Subcontractor / Agency Details — conditional */}
        {isSubcontractor && (
          <section>
            <p className={sectionTitle}><Building2 className="w-3.5 h-3.5" /> Subcontractor / Agency Details</p>
            <div className={gridCls}>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className={labelCls}>Company</label>
                <input type="text" value={form.company || ''} onChange={e => set('company', e.target.value)} placeholder="Company / agency name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Lead Driller Name</label>
                <input type="text" value={form.lead_driller_name || ''} onChange={e => set('lead_driller_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Lead Driller Phone</label>
                <input type="tel" value={form.lead_driller_phone || ''} onChange={e => set('lead_driller_phone', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Second Man Name</label>
                <input type="text" value={form.second_man_name || ''} onChange={e => set('second_man_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Second Man Phone</label>
                <input type="tel" value={form.second_man_phone || ''} onChange={e => set('second_man_phone', e.target.value)} className={inputCls} />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 self-end">
                <input type="checkbox" checked={form.market_dojo_onboarded === true} onChange={e => set('market_dojo_onboarded', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Onboarded in Market Dojo</span>
              </label>
            </div>
          </section>
        )}

        {/* Notifications & Flags */}
        <section>
          <p className={sectionTitle}><Bell className="w-3.5 h-3.5" /> Notifications & Flags</p>
          <div className="space-y-2.5">
            {!editing && (
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <input type="checkbox" checked={inviteOnCreate} onChange={e => setInviteOnCreate(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#2E5A1A]" /> Send app invite so they can log in and see their schedule</span>
              </label>
            )}
            {editing && (
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-amber-50/60 border border-amber-100">
                <input type="checkbox" checked={form.email_notifications_enabled !== false} onChange={e => set('email_notifications_enabled', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-amber-600" /> Receive schedule and assignment emails</span>
              </label>
            )}
            <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-blue-50/60 border border-blue-100">
              <input type="checkbox" checked={form.delivery_dashboard_enabled === true} onChange={e => set('delivery_dashboard_enabled', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
              <span className="text-sm text-slate-700 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-blue-600" /> Driver — delivery dashboard access</span>
            </label>
            {editing && (
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-slate-600" /> Active — appears in rota and staff lists</span>
              </label>
            )}
          </div>
        </section>

        {/* Access Control — admin only */}
        {isAdmin && (
          <section>
            <p className={sectionTitle}><KeyRound className="w-3.5 h-3.5" /> Access Control</p>
            <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-purple-50/60 border border-purple-100">
              <input type="checkbox" checked={form.is_approver === true} onChange={e => set('is_approver', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
              <span className="text-sm text-slate-700 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-purple-600" /> Access Approver — receives notifications and can approve new users waiting for access</span>
            </label>

            {/* Enterprise admin — additional business streams */}
            {divisions.length > 1 && (
              <div className="mt-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-1">Enterprise Admin — Additional Business Streams</p>
                <p className="text-[11px] text-slate-500 mb-2.5">Grant access to other business streams beyond this person's home stream. When any are selected, they can switch between streams and see the enterprise dashboard rollup.</p>
                <div className="flex flex-wrap gap-2">
                  {divisions
                    .filter(d => d.id !== form.division_id)
                    .map(d => {
                      const selected = (form.managed_division_ids || []).includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleManagedDivision(d.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            selected
                              ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </FormModal>
  );
}