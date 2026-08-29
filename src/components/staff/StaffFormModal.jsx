import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useAuth } from '@/lib/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import FormModal from '@/components/ui/FormModal';
import { Mail, Bell, Truck, ShieldCheck, MapPin, KeyRound, LogIn, Compass, Monitor, HardHat } from 'lucide-react';
import { resolveRoleLandingPage } from '@/utils/access';

/**
 * StaffFormModal — standardised popup for creating/editing a crew member.
 * Replaces the legacy inline Sheet form with the shared FormModal pattern.
 */
export default function StaffFormModal({ open, onClose, editing, staff, teams, vehicles, staffList }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOptions } = useConfigLists();
  const workerTypeOptions = getOptions('worker_types');
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { activeDivisionId } = useDivision();
  const { data: permissionGroups = [] } = useQuery({
    queryKey: ['permission-groups-all'],
    queryFn: () => base44.entities.PermissionGroup.list('name', 100),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-all-staff-form'],
    queryFn: () => base44.entities.Division.list('name', 50),
  });

  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [inviteOnCreate, setInviteOnCreate] = useState(true);

  const emptyForm = {
    name: '', email: '', phone: '', date_of_birth: '', ni_number: '',
    worker_type: 'direct_employee', team_id: '', default_vehicle_id: '',
    manager_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false,
    system_role: 'field', phone_gps_consent: false,
    permission_group_id: '', default_landing_page: '',
    division_id: '',
  };

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({ ...emptyForm, ...staff, phone_gps_consent: staff?.phone_gps_consent ?? false });
      } else {
        setForm(emptyForm);
        setInviteOnCreate(true);
      }
    }
  }, [open, editing, staff]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const filteredTeams = form.division_id
    ? teams.filter(t => t.division_id === form.division_id)
    : teams;

  const cleanPayload = (data) => {
    const cleaned = { ...data };
    ['default_vehicle_id', 'manager_id', 'system_role', 'permission_group_id', 'default_landing_page', 'division_id'].forEach(k => {
      if (cleaned[k] === '') delete cleaned[k];
    });
    return cleaned;
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = cleanPayload(form);
      // Auto-derive system_role and landing page from the permission group
      const grp = permissionGroups.find(g => g.id === form.permission_group_id);
      if (grp) {
        if (grp.staff_type === 'field') {
          payload.system_role = 'field';
        } else {
          const perms = grp.permissions || {};
          payload.system_role = perms.settings === 'write' ? 'admin' : 'user';
        }
        if (grp.landing_page && grp.landing_page !== 'auto') {
          payload.default_landing_page = grp.landing_page;
        } else if (grp.staff_type === 'office') {
          payload.default_landing_page = '/admin';
        } else {
          payload.default_landing_page = '/staff-schedule';
        }
      }
      // Set division_id from the selected business stream (fallback to team's division)
      if (!payload.division_id && payload.team_id) {
        const selectedTeam = teams.find(t => t.id === payload.team_id);
        if (selectedTeam?.division_id) payload.division_id = selectedTeam.division_id;
      }
      if (!payload.name?.trim() || !payload.email?.trim() || !payload.worker_type || !payload.team_id || !payload.division_id || !payload.permission_group_id) {
        toast({ title: 'Missing required fields', description: 'Name, email, worker type, crew, business stream and permission group are all required.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      if (editing) {
        const original = staffList.find(s => s.id === editing);
        if (original && original.email && original.email.toLowerCase() !== (form.email || '').toLowerCase()) {
          payload.invite_sent = false;
        }
        await base44.entities.Staff.update(editing, payload);

        // Sync linked User platform role + division from the assigned permission
        // group (admin-level groups promote to platform 'admin', which RLS checks
        // for the cross-division bypass). Runs server-side so it works regardless
        // of the current admin's own role.
        try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [editing] }); } catch (_) {}
        toast({ title: 'Crew member updated' });
      } else {
        const created = await base44.entities.Staff.create(payload);
        if (inviteOnCreate && form.email) {
          try {
            // Register the user (creates account + sends OTP), then send the
            // branded Ground Control invite email — works without a custom
            // domain because the user is now a registered user.
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

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={ShieldCheck}
      title={editing ? 'Edit Crew Member' : 'New Crew Member'}
      description={editing ? 'Update this crew member\'s details and access.' : 'Add a new crew member to the team.'}
      size="xl"
      saveLabel={editing ? 'Update' : 'Add Crew Member'}
      onSave={handleSave}
      saving={saving}
    >
      <div className="space-y-5">
        {/* Identity */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Identity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
            <div className="sm:col-span-2">
              <label className={labelCls}>Crew *</label>
              <select value={form.team_id || ''} onChange={e => set('team_id', e.target.value)} required className={inputCls}>
                <option value="">Select Crew</option>
                {filteredTeams.map(t => {
                  const parent = teams.find(p => p.id === t.parent_team_id);
                  return <option key={t.id} value={t.id}>{parent ? `${parent.name} — ${t.name}` : t.name}</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Assignment</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" value={form.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NI Number</label>
              <input type="text" value={form.ni_number || ''} onChange={e => set('ni_number', e.target.value.toUpperCase())} placeholder="AB123456C" className={`${inputCls} font-mono uppercase`} />
            </div>
          </div>
        </div>

        {/* Access & Business Stream — two-step permission flow */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Access & Business Stream</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-2.5">
            <div>
              <label className={labelCls}>Business Stream *</label>
              <select value={form.division_id || ''} onChange={e => set('division_id', e.target.value)} className={inputCls}>
                <option value="">Select Business Stream</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Permission Group *</label>
              <select value={form.permission_group_id || ''} onChange={e => set('permission_group_id', e.target.value)} className={inputCls}>
                <option value="">Select Permission Group</option>
                <optgroup label="System Groups">
                  {permissionGroups.filter(g => g.is_system).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </optgroup>
                {permissionGroups.filter(g => !g.is_system).length > 0 && (
                  <optgroup label="Custom Groups">
                    {permissionGroups.filter(g => !g.is_system).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
          {/* Live landing-page preview — auto-derived from the permission group */}
          {(() => {
            const grp = permissionGroups.find(g => g.id === form.permission_group_id) || null;
            const div = divisions.find(d => d.id === form.division_id) || null;
            const route = grp ? (grp.landing_page && grp.landing_page !== 'auto' ? grp.landing_page : grp.staff_type === 'office' ? '/admin' : '/staff-schedule') : '/staff-schedule';
            const isOffice = route === '/admin';
            const labels = { '/admin': 'Admin Dashboard', '/staff-schedule': 'My Schedule', '/staff-profile': 'My Profile', '/deliveries': 'Delivery Dashboard', '/scanner': 'Asset Scanner', '/subcontractor': 'Subcontractor Portal' };
            return (
              <div className="mt-2.5 flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className={'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ' + (isOffice ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600')}>
                  {isOffice ? <Monitor className="w-4 h-4 text-white" /> : <HardHat className="w-4 h-4 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#2E5A1A]" /> Lands on: {labels[route] || route}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {grp ? `Set by the "${grp.name}" group` : 'Select a permission group to determine landing page'}
                    {div && ` · ${div.name} stream`}
                  </p>
                </div>
                {div && (
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: div.color || '#2E5A1A' }} title={div.name} />
                )}
              </div>
            );
          })()}
        </div>

        {/* Notifications */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">Notifications</p>
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
            <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
              <input type="checkbox" checked={form.phone_gps_consent === true} onChange={e => set('phone_gps_consent', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
              <span className="text-sm text-slate-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> Phone GPS consent — auto-detect site arrival/departure even when not in a tracked vehicle</span>
            </label>
          </div>
        </div>
      </div>
    </FormModal>
  );
}