import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, Bell, Truck, Save, Loader2, ShieldCheck, UserCog, Camera, Trash2, MapPin } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import ImageCropper from '@/components/ImageCropper';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

/**
 * Slide-out drawer for editing your own staff profile fields.
 * Keeps the user in context — no page navigation needed.
 */
export default function StaffProfileEditDrawer({ open, onOpenChange, staff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ phone: '', email_notifications_enabled: true, delivery_dashboard_enabled: false, avatar_url: '', phone_gps_consent: false });
  const [saving, setSaving] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (staff) {
      setForm({
        phone: staff.phone || '',
        email_notifications_enabled: staff.email_notifications_enabled ?? true,
        delivery_dashboard_enabled: staff.delivery_dashboard_enabled ?? false,
        avatar_url: staff.avatar_url || '',
        phone_gps_consent: staff.phone_gps_consent ?? false,
      });
    }
  }, [staff, open]);

  const handleSave = async () => {
    if (!staff?.id) {
      toast({ title: 'No profile linked', description: 'Contact your supervisor to set up your crew profile.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Staff.update(staff.id, {
        phone: form.phone,
        email_notifications_enabled: form.email_notifications_enabled,
        delivery_dashboard_enabled: form.delivery_dashboard_enabled,
        avatar_url: form.avatar_url,
        phone_gps_consent: form.phone_gps_consent,
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
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
      const res = await base44.functions.invoke('uploadProfilePhoto', { file: croppedFile });
      setForm(f => ({ ...f, avatar_url: res.data?.file_url || '' }));
      toast({ title: 'Photo updated', description: 'Save changes to confirm.' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' });
    }
    setUploadingAvatar(false);
  };

  const handleAvatarRemove = () => {
    setForm(f => ({ ...f, avatar_url: '' }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2.5 text-xl">
            <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center shadow-sm">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            Edit My Profile
          </SheetTitle>
          <SheetDescription>Update your contact details and notification preferences.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Profile Photo */}
          <div className="insight-card rounded-xl p-4">
            <div className="flex items-center gap-4">
              <ProfileAvatar name={staff?.name} avatarUrl={form.avatar_url} size={64} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Profile Photo</p>
                <p className="text-xs text-slate-500 mt-0.5">Shown in the sidebar and on your profile.</p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 transition">
                    <Camera className="w-3.5 h-3.5" />
                    {form.avatar_url ? 'Change' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                  </label>
                  {form.avatar_url && (
                    <button type="button" onClick={handleAvatarRemove}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Read-only identity fields */}
          <div className="insight-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Identity</p>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 truncate">{staff?.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <UserCog className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600">{staff?.name || '—'}</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">Name and email are managed by your supervisor. Contact them to change these.</p>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <Phone className="w-4 h-4 text-slate-400" /> Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="07XXX XXX XXX"
                className="w-full px-3.5 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
              />
            </div>

            <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Email Notifications</p>
                  <p className="text-xs text-slate-500 mt-0.5">Receive schedule reminders, assignment alerts and daily digests.</p>
                </div>
              </div>
              <Switch
                checked={form.email_notifications_enabled}
                onCheckedChange={(v) => setForm({ ...form, email_notifications_enabled: v })}
              />
            </div>

            <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Delivery Dashboard Access</p>
                  <p className="text-xs text-slate-500 mt-0.5">Show the Deliveries button on your device for collection and delivery tasks.</p>
                </div>
              </div>
              <Switch
                checked={form.delivery_dashboard_enabled}
                onCheckedChange={(v) => setForm({ ...form, delivery_dashboard_enabled: v })}
              />
            </div>

            <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Phone GPS Tracking</p>
                  <p className="text-xs text-slate-500 mt-0.5">Allow your phone GPS to auto-detect site arrival and departure — even when you're not in a tracked vehicle (e.g. travelling home by train).</p>
                </div>
              </div>
              <Switch
                checked={form.phone_gps_consent}
                onCheckedChange={(v) => setForm({ ...form, phone_gps_consent: v })}
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
        {avatarSrc && (
          <ImageCropper
            imageSrc={avatarSrc}
            aspect={1}
            onConfirm={handleAvatarCropConfirm}
            onCancel={() => setAvatarSrc(null)}
            title="Crop Profile Photo"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}