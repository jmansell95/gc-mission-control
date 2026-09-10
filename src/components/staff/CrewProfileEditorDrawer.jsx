import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, UserCog, Mail, Phone, Briefcase, Users, Calendar, Hash, Shield, ShieldCheck, Truck, Bell, Camera, Trash2, KeyRound, PoundSterling, Building2 } from 'lucide-react';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import ImageCropper from '@/components/ImageCropper';
import StaffPermissionPopup from '@/components/access/StaffPermissionPopup';
import { useAuth } from '@/lib/AuthContext';

/**
 * Full admin editor for a crew (Staff) profile — all fields editable.
 * Side drawer, consistent with StaffProfileEditDrawer styling.
 */
export default function CrewProfileEditorDrawer({ open, onOpenChange, staff, teams = [], onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

  const { data: permissionGroups = [] } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => base44.entities.PermissionGroup.list(),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-all-crew-drawer'],
    queryFn: () => base44.entities.Division.list('name', 50),
  });
  const { user: currentUser } = useAuth();
  const isPlatformAdmin = currentUser?.role === 'admin';
  const { data: myProfileArr } = useQuery({
    queryKey: ['my-staff-profile-crew-drawer', currentUser?.id],
    queryFn: () => base44.entities.Staff.filter({ user_id: currentUser.id }, '-created_date', 1),
    enabled: !!currentUser?.id,
  });
  const mySystemRole = myProfileArr?.[0]?.system_role;
  const canEditFinancials = isPlatformAdmin || mySystemRole === 'admin' || mySystemRole === 'super_admin' || mySystemRole === 'management';

  const currentGroupName = permissionGroups.find((g) => g.id === staff?.permission_group_id)?.name || '';

  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name || '',
        email: staff.email || '',
        phone: staff.phone || '',
        job_title: staff.job_title || '',
        worker_type: staff.worker_type || 'direct_employee',
        team_id: staff.team_id || '',
        date_of_birth: staff.date_of_birth || '',
        ni_number: staff.ni_number || '',
        permission_group_id: staff.permission_group_id || '',
        division_id: staff.division_id || '',
        day_rate: staff.day_rate ?? null,
        company: staff.company || '',
        lead_driller_name: staff.lead_driller_name || '',
        lead_driller_phone: staff.lead_driller_phone || '',
        second_man_name: staff.second_man_name || '',
        second_man_phone: staff.second_man_phone || '',
        market_dojo_onboarded: staff.market_dojo_onboarded === true,
        delivery_dashboard_enabled: staff.delivery_dashboard_enabled === true,
        email_notifications_enabled: staff.email_notifications_enabled !== false,
        is_active: staff.is_active !== false,
        avatar_url: staff.avatar_url || '',
        user_id: staff.user_id || '',
      });
    }
  }, [staff, open]);

  if (!staff || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        job_title: form.job_title,
        worker_type: form.worker_type,
        team_id: form.team_id || null,
        date_of_birth: form.date_of_birth || null,
        ni_number: form.ni_number,
        permission_group_id: form.permission_group_id || null,
        division_id: form.division_id || null,
        day_rate: form.day_rate,
        company: form.company,
        lead_driller_name: form.lead_driller_name,
        lead_driller_phone: form.lead_driller_phone,
        second_man_name: form.second_man_name,
        second_man_phone: form.second_man_phone,
        market_dojo_onboarded: form.market_dojo_onboarded,
        delivery_dashboard_enabled: form.delivery_dashboard_enabled,
        email_notifications_enabled: form.email_notifications_enabled,
        is_active: form.is_active,
        avatar_url: form.avatar_url,
      };
      await base44.entities.Staff.update(staff.id, payload);
      // Sync platform user roles when access-level or division changes
      try { await base44.functions.invoke('syncStaffUserRoles', { staff_ids: [staff.id] }); } catch (_) {}
      // SSO auto-link: if this staff member has an email but no linked user
      // account, silently link them if a matching platform user already exists.
      if (form.email && !form.user_id) {
        try {
          const res = await base44.functions.invoke('getUnlinkedUsers');
          const unlinked = res?.data?.unlinked || [];
          const existingUser = unlinked.find((u) => (u.email || '').toLowerCase() === form.email.toLowerCase());
          if (existingUser) {
            await base44.entities.Staff.update(staff.id, { user_id: existingUser.id, invite_sent: true });
          }
        } catch (e) { /* best-effort silent link */ }
      }
      toast({ title: 'Profile saved', description: `${form.name} updated.` });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarCropConfirm = async (croppedFile) => {
    setAvatarSrc(null);
    setUploadingAvatar(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file: croppedFile });
      set('avatar_url', res.file_url);
    } catch (e) {
      toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' });
    }
    setUploadingAvatar(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2.5 text-xl">
            <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center shadow-sm">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            Edit Crew Profile
          </SheetTitle>
          <SheetDescription>Update any field for this crew member. Changes save to their Staff record.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Avatar */}
          <div className="insight-card rounded-xl p-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar name={form.name} avatarUrl={form.avatar_url} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Profile Photo</p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 transition">
                    <Camera className="w-3.5 h-3.5" />
                    {form.avatar_url ? 'Change' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                  </label>
                  {form.avatar_url && (
                    <button type="button" onClick={() => set('avatar_url', '')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="insight-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <UserCog className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Identity</p>
            </div>
            <Field icon={UserCog} label="Full Name">
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </Field>
            <Field icon={Mail} label="Email">
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
            </Field>
            <Field icon={Phone} label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
            </Field>
            <Field icon={Briefcase} label="Job Title">
              <input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} className={inputCls} />
            </Field>
            {form.user_id && (
              <p className="text-[11px] text-emerald-600 pt-1 border-t border-slate-100 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Linked to platform user
              </p>
            )}
          </div>

          {/* Assignment */}
          <div className="insight-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <Users className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Assignment</p>
            </div>
            <Field label="Worker Type">
              <select value={form.worker_type} onChange={(e) => set('worker_type', e.target.value)} className={inputCls}>
                <option value="direct_employee">Direct Employee</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="agency">Agency</option>
              </select>
            </Field>
            <Field icon={Users} label="Team / Crew">
              <select value={form.team_id} onChange={(e) => set('team_id', e.target.value)} className={inputCls}>
                <option value="">— Unassigned —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field icon={KeyRound} label="Access Level">
              <select value={form.permission_group_id} onChange={(e) => set('permission_group_id', e.target.value)} className={inputCls}>
                <option value="">Default (Field Staff)</option>
                {permissionGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            {isPlatformAdmin && (
              <Field icon={Building2} label="Business Stream">
                <select value={form.division_id} onChange={(e) => set('division_id', e.target.value)} className={inputCls}>
                  <option value="">Inherit from crew</option>
                  {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          {/* Financial — admin + management */}
          {canEditFinancials && (
            <div className="insight-card rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2.5 mb-1">
                <PoundSterling className="w-4 h-4 text-[#2E5A1A]" />
                <p className="text-sm font-semibold text-slate-700">Financial</p>
              </div>
              <Field icon={PoundSterling} label="Day Rate (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.day_rate ?? ''}
                  onChange={(e) => set('day_rate', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 180.00"
                  className={inputCls}
                />
                <p className="text-[10px] text-slate-400 mt-1">Internal cost per day in GBP. Used for labour cost calculations. Leave blank to fall back to the rate card.</p>
              </Field>
            </div>
          )}

          {/* Subcontractor / Agency Details — conditional */}
          {(form.worker_type === 'subcontractor' || form.worker_type === 'agency') && (
            <div className="insight-card rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2.5 mb-1">
                <Building2 className="w-4 h-4 text-[#2E5A1A]" />
                <p className="text-sm font-semibold text-slate-700">Subcontractor / Agency Details</p>
              </div>
              <Field icon={Building2} label="Company">
                <input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Company / agency name" className={inputCls} />
              </Field>
              <Field icon={UserCog} label="Lead Driller Name">
                <input value={form.lead_driller_name} onChange={(e) => set('lead_driller_name', e.target.value)} className={inputCls} />
              </Field>
              <Field icon={Phone} label="Lead Driller Phone">
                <input type="tel" value={form.lead_driller_phone} onChange={(e) => set('lead_driller_phone', e.target.value)} className={inputCls} />
              </Field>
              <Field icon={UserCog} label="Second Man Name">
                <input value={form.second_man_name} onChange={(e) => set('second_man_name', e.target.value)} className={inputCls} />
              </Field>
              <Field icon={Phone} label="Second Man Phone">
                <input type="tel" value={form.second_man_phone} onChange={(e) => set('second_man_phone', e.target.value)} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <input type="checkbox" checked={form.market_dojo_onboarded === true} onChange={(e) => set('market_dojo_onboarded', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Onboarded in Market Dojo</span>
              </label>
            </div>
          )}

          {/* Permissions — managed on the dedicated Access Levels page */}
          <div className="insight-card rounded-xl p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <Shield className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Permissions</p>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {currentGroupName ? `Currently in "${currentGroupName}".` : 'No permission group assigned yet.'} Access is managed on the dedicated Access Levels page.
            </p>
            <button
              type="button"
              onClick={() => setShowPermissionPopup(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition"
            >
              <KeyRound className="w-3.5 h-3.5" /> Manage Permissions
            </button>
          </div>

          {/* Sensitive (admin-only) */}
          <div className="insight-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <Shield className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Compliance (Admin Only)</p>
            </div>
            <Field icon={Calendar} label="Date of Birth">
              <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className={inputCls} />
            </Field>
            <Field icon={Hash} label="NI Number">
              <input value={form.ni_number} onChange={(e) => set('ni_number', e.target.value)} placeholder="AB123456C" className={inputCls} />
            </Field>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <ToggleRow icon={Bell} color="amber" title="Email Notifications" desc="Schedule reminders and alerts."
              checked={form.email_notifications_enabled} onChange={(v) => set('email_notifications_enabled', v)} />
            <ToggleRow icon={Truck} color="blue" title="Delivery Dashboard" desc="Show the Driver Hub on their device."
              checked={form.delivery_dashboard_enabled} onChange={(v) => set('delivery_dashboard_enabled', v)} />
            <ToggleRow icon={UserCog} color="emerald" title="Active" desc="Inactive crew can't be assigned to jobs."
              checked={form.is_active} onChange={(v) => set('is_active', v)} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {avatarSrc && (
          <ImageCropper imageSrc={avatarSrc} aspect={1} onConfirm={handleAvatarCropConfirm} onCancel={() => setAvatarSrc(null)} title="Crop Profile Photo" />
        )}
      </SheetContent>

      {showPermissionPopup && (
        <StaffPermissionPopup staff={staff} onClose={() => setShowPermissionPopup(false)} />
      )}
    </Sheet>
  );
}

const inputCls = "w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition";

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ icon: Icon, color, title, desc, checked, onChange }) {
  const colorMap = {
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-lg ${colorMap[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}