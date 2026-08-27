import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useDivision } from '@/contexts/DivisionContext';
import {
  ShieldCheck, Mail, Users, KeyRound, Check, ChevronRight, ChevronLeft, X,
  User, Briefcase, Compass, Send, Loader2, Building2, Monitor, HardHat,
} from 'lucide-react';
import { resolveRoleLandingPage } from '@/utils/access';

/**
 * StaffOnboardingWizard — guided per-business-stream staff creation.
 *
 * Steps: Identity → Crew → Access → Review & Invite.
 * Shows a live landing-page preview derived from the selected permission
 * group (office → Admin Dashboard, field → My Schedule). On finish it
 * creates the Staff record, registers the user, sends the branded Ground
 * Control invite email, and marks invite_sent.
 */
const STEPS = [
  { id: 'identity', label: 'Identity', icon: User },
  { id: 'crew', label: 'Crew', icon: Users },
  { id: 'access', label: 'Access', icon: KeyRound },
  { id: 'review', label: 'Review & Invite', icon: Send },
];

export default function StaffOnboardingWizard({ open, onClose, teams, vehicles, staffList }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getOptions } = useConfigLists();
  const workerTypeOptions = getOptions('worker_types');
  const { activeDivisionId, activeDivision } = useDivision();

  const { data: permissionGroups = [] } = useQuery({
    queryKey: ['permission-groups-all'],
    queryFn: () => base44.entities.PermissionGroup.list('name', 200),
  });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    name: '', email: '', phone: '', worker_type: 'direct_employee', team_id: '',
    default_vehicle_id: '', manager_id: '', permission_group_id: '',
    email_notifications_enabled: true, delivery_dashboard_enabled: false,
    phone_gps_consent: false,
  };

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const filteredTeams = activeDivisionId
    ? teams.filter(t => t.division_id === activeDivisionId)
    : teams;

  const selectedGroup = permissionGroups.find(g => g.id === form.permission_group_id) || null;
  const selectedTeam = teams.find(t => t.id === form.team_id) || null;

  // Live landing-page preview derived from the selected permission group
  const landingPreview = useMemo(() => {
    const fakeProfile = {
      default_landing_page: '',
      permission_group: selectedGroup,
      worker_type: form.worker_type,
      system_role: 'field',
      team: selectedTeam ? { default_landing_page: selectedTeam.default_landing_page } : null,
    };
    const route = resolveRoleLandingPage(fakeProfile, false);
    const labels = {
      '/admin': { label: 'Admin Dashboard', icon: Monitor, tone: 'office' },
      '/staff-schedule': { label: 'My Schedule', icon: HardHat, tone: 'field' },
      '/staff-profile': { label: 'My Profile', icon: User, tone: 'field' },
      '/deliveries': { label: 'Delivery Dashboard', icon: Briefcase, tone: 'field' },
      '/scanner': { label: 'Asset Scanner', icon: Compass, tone: 'field' },
      '/subcontractor': { label: 'Subcontractor Portal', icon: Briefcase, tone: 'field' },
    };
    return { route, ...(labels[route] || { label: route, icon: Compass, tone: 'field' }) };
  }, [selectedGroup, form.worker_type, selectedTeam]);

  const groupTypeBadge = (g) => {
    if (g?.staff_type === 'office') return { label: 'Office', cls: 'bg-blue-100 text-blue-700' };
    if (g?.staff_type === 'field') return { label: 'Field', cls: 'bg-amber-100 text-amber-700' };
    return null;
  };

  const canProceed = () => {
    if (step === 0) return form.name?.trim() && form.email?.trim() && form.worker_type;
    if (step === 1) return !!form.team_id;
    return true;
  };

  const handleFinish = async () => {
    if (saving) return;
    if (!form.name?.trim() || !form.email?.trim() || !form.worker_type || !form.team_id) {
      toast({ title: 'Missing required fields', description: 'Name, email, worker type and crew are all required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      ['default_vehicle_id', 'manager_id', 'permission_group_id'].forEach(k => { if (payload[k] === '') delete payload[k]; });
      const team = teams.find(t => t.id === payload.team_id);
      if (team?.division_id) payload.division_id = team.division_id;

      const created = await base44.entities.Staff.create(payload);

      // Register + send branded invite
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

      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-page-hub'] });
      queryClient.invalidateQueries({ queryKey: ['crew-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      onClose();
    } catch (error) {
      toast({ title: 'Could not save crew member', description: error?.message || 'Please check all fields and try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';
  const StepIcon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl h-[100dvh] sm:h-[calc(100dvh-2rem)] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Add Crew Member</h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                {activeDivision && <><span className="w-1.5 h-1.5 rounded-full" style={{ background: activeDivision.color || '#2E5A1A' }} /> {activeDivision.name} · </>}
                Step {step + 1} of {STEPS.length} — {STEPS[step].label}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex-shrink-0 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const SIcon = s.icon;
              const done = i < step;
              const current = i === step;
              return (
                <React.Fragment key={s.id}>
                  <div className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ' +
                    (current ? 'bg-[#2E5A1A] text-white shadow-sm' : done ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400')}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <SIcon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={'flex-1 h-0.5 rounded-full ' + (done ? 'bg-emerald-300' : 'bg-slate-200')} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: Identity */}
          {step === 0 && (
            <div className="space-y-3.5 animate-slide-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="John Smith" />
                </div>
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="john@groundcontrol.co.uk" />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="07XXX XXX XXX" />
                </div>
                <div>
                  <label className={labelCls}>Worker Type *</label>
                  <select value={form.worker_type || 'direct_employee'} onChange={e => set('worker_type', e.target.value)} className={inputCls}>
                    {workerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 font-medium">We'll send a branded Ground Control invite email to {form.email || 'them'} once you finish. They'll verify their account and set up their profile.</p>
              </div>
            </div>
          )}

          {/* STEP 2: Crew */}
          {step === 1 && (
            <div className="space-y-3.5 animate-slide-up">
              {!activeDivisionId && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-medium">Pick a business stream in the sidebar first — crews are scoped to each stream.</p>
                </div>
              )}
              <div>
                <label className={labelCls}>Crew / Team *</label>
                <select value={form.team_id || ''} onChange={e => set('team_id', e.target.value)} className={inputCls}>
                  <option value="">Select Crew</option>
                  {filteredTeams.map(t => {
                    const parent = teams.find(p => p.id === t.parent_team_id);
                    return <option key={t.id} value={t.id}>{parent ? `${parent.name} — ${t.name}` : t.name}</option>;
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">The crew determines which business stream this person belongs to. {activeDivision ? `Showing crews in ${activeDivision.name}.` : ''}</p>
              </div>
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
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <input type="checkbox" checked={form.phone_gps_consent === true} onChange={e => set('phone_gps_consent', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Phone GPS consent — auto-detect site arrival/departure</span>
              </label>
            </div>
          )}

          {/* STEP 3: Access */}
          {step === 2 && (
            <div className="space-y-4 animate-slide-up">
              <div>
                <label className={labelCls}>Permission Group</label>
                <select value={form.permission_group_id || ''} onChange={e => set('permission_group_id', e.target.value)} className={inputCls}>
                  <option value="">None (legacy role-based)</option>
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

              {/* Live landing-page preview */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#2E5A1A]" />
                  <p className="text-xs font-bold text-slate-700">Where they'll land after setup</p>
                  {selectedGroup && groupTypeBadge(selectedGroup) && (
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${groupTypeBadge(selectedGroup).cls}`}>
                      {groupTypeBadge(selectedGroup).label} Staff
                    </span>
                  )}
                </div>
                <div className="p-4 flex items-center gap-3">
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ' +
                    (landingPreview.tone === 'office' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600')}>
                    <landingPreview.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">{landingPreview.label}</p>
                    <p className="text-xs text-slate-500 font-mono">{landingPreview.route}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedGroup?.landing_page && selectedGroup.landing_page !== 'auto'
                        ? `Set by the "${selectedGroup.name}" group`
                        : selectedGroup?.staff_type === 'office'
                          ? 'Office groups land on the admin dashboard'
                          : selectedGroup?.staff_type === 'field'
                            ? 'Field groups land on their schedule'
                            : 'Derived from their role until a group is chosen'}
                    </p>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <input type="checkbox" checked={form.delivery_dashboard_enabled === true} onChange={e => set('delivery_dashboard_enabled', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-blue-600" /> Driver — delivery dashboard access</span>
              </label>
            </div>
          )}

          {/* STEP 4: Review & Invite */}
          {step === 3 && (
            <div className="space-y-3.5 animate-slide-up">
              <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                <ReviewRow icon={User} label="Name" value={form.name} />
                <ReviewRow icon={Mail} label="Email" value={form.email} />
                <ReviewRow icon={HardHat} label="Worker Type" value={workerTypeOptions.find(o => o.value === form.worker_type)?.label || form.worker_type} />
                <ReviewRow icon={Users} label="Crew" value={selectedTeam ? (teams.find(p => p.id === selectedTeam.parent_team_id) ? `${teams.find(p => p.id === selectedTeam.parent_team_id).name} — ${selectedTeam.name}` : selectedTeam.name) : '—'} />
                <ReviewRow icon={KeyRound} label="Permission Group" value={selectedGroup?.name || 'None (role-based)'} />
                <ReviewRow icon={Compass} label="Landing Page" value={landingPreview.label} highlight />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <Send className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 font-medium">A branded invite email will be sent to {form.email || 'them'}. They'll verify their account, set up their photo & phone, then land on <strong>{landingPreview.label}</strong>.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-slate-600 bg-slate-100 rounded-xl text-sm font-semibold hover:bg-slate-200 transition disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canProceed()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition shadow-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {saving ? 'Creating…' : 'Create & Send Invite'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide w-28 flex-shrink-0">{label}</span>
      <span className={'text-sm font-semibold truncate ' + (highlight ? 'text-[#2E5A1A]' : 'text-slate-700')}>{value || '—'}</span>
    </div>
  );
}