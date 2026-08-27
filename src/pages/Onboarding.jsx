import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { resolveRoleLandingPage } from '@/utils/access';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Phone, Loader2, Check, ArrowRight, Trash2 } from 'lucide-react';
import Logo from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import ImageCropper from '@/components/ImageCropper';

/**
 * First-login profile setup screen.
 *
 * Shown when Home.jsx detects the signed-in user's Staff record has
 * onboarding_complete === false. Collects a profile photo and phone
 * number, saves them, marks onboarding complete, then routes the user
 * to their role-based landing page.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        if (cancelled) return;
        const p = res.data;
        setProfile(p);
        setPhone(p?.phone || '');
        setAvatarUrl(p?.avatar_url || '');
      } catch (e) {
        // If we can't load the profile, fall back to a safe landing page
        if (!cancelled) navigate('/', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoadingAuth, isAuthenticated, user, navigate]);

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
    setUploading(true);
    try {
      const res = await base44.functions.invoke('uploadProfilePhoto', { file: croppedFile });
      setAvatarUrl(res.data?.file_url || '');
      toast({ title: 'Photo updated', description: 'Looks great!' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e?.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const finish = async (skipPhoto = false) => {
    if (!profile?.id) {
      toast({ title: 'No profile linked', description: 'Contact your supervisor to set up your crew profile.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Staff.update(profile.id, {
        phone,
        avatar_url: skipPhoto ? (profile.avatar_url || '') : avatarUrl,
        onboarding_complete: true,
      });
      const landing = resolveRoleLandingPage(profile, false);
      navigate(landing, { replace: true });
    } catch (e) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center page-bg-vibrant">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-vibrant flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-5 animate-float">
            <Logo variant="full" height={44} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center">
            Welcome{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 text-center max-w-xs">
            Let's finish setting up your profile so you can get started. This only takes a moment.
          </p>
        </div>

        <div className="insight-card rounded-2xl p-6 space-y-6">
          {/* Profile photo */}
          <div className="flex flex-col items-center text-center">
            <ProfileAvatar name={profile?.name} avatarUrl={avatarUrl} size={96} />
            <div className="flex items-center gap-2 mt-3">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold cursor-pointer hover:brightness-110 transition">
                <Camera className="w-3.5 h-3.5" />
                {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
              </label>
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl('')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
            {uploading && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <Phone className="w-4 h-4 text-slate-400" /> Mobile Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXX XXX XXX"
              className="w-full px-3.5 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">Used for schedule reminders and assignment alerts.</p>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <button
              onClick={() => finish(false)}
              disabled={saving || uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Complete Setup'}
            </button>
            <button
              onClick={() => finish(true)}
              disabled={saving || uploading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-medium transition disabled:opacity-50"
            >
              Skip for now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          You can update these anytime from your profile.
        </p>
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
    </div>
  );
}