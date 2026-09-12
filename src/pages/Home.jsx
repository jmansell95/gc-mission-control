import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { resolveRoleLandingPage } from '@/utils/access';
import Logo from '@/components/Logo';
import PostLoginChoiceScreen from '@/components/login/PostLoginChoiceScreen';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [error, setError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;

    let cancelled = false;
    (async () => {
      try {
        // Fetch the staff profile for all users (including admins) so we can
        // determine enterprise admin status and the division name.
        let profileData = null;
        try {
          const res = await base44.functions.invoke('getMyStaffProfile');
          profileData = res.data;
          if (cancelled) return;
          setProfile(profileData);
        } catch {}

        // Determine enterprise admin status: platform admin/director OR the
        // Staff record's managed_division_ids is non-empty (enterprise admin).
        const isPlatformAdmin = user.role === 'admin' || user.role === 'director';
        const isEnterpriseAdmin = isPlatformAdmin ||
          (Array.isArray(profileData?.managed_division_ids) && profileData.managed_division_ids.length > 0);

        // If the user has no division assigned and isn't an enterprise admin,
        // send them to the pending page.
        const userDivisionId = profileData?.division_id || user?.division_id;
        if (!userDivisionId && !isEnterpriseAdmin) {
          navigate('/pending-access', { replace: true });
          return;
        }

        // First-time users who haven't completed profile setup go to onboarding
        // (enterprise admins skip this — they may not have a Staff record yet).
        if (profileData?.onboarding_complete === false && !isEnterpriseAdmin) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Enterprise admins get the choice screen (unless they've already
        // chosen a destination this session).
        if (isEnterpriseAdmin) {
          const savedDestination = sessionStorage.getItem('post_login_destination');
          if (savedDestination === '/enterprise' || savedDestination === '/admin') {
            navigate(savedDestination, { replace: true });
          } else {
            setShowChoice(true);
          }
          return;
        }

        // Non-enterprise users: route based on role
        const landing = resolveRoleLandingPage(profileData, isPlatformAdmin);
        navigate(landing, { replace: true });
      } catch (err) {
        if (cancelled) return;
        setError(true);
        // Fallback: check division_id from the user record
        if (user?.division_id) {
          navigate((user.role === 'admin' || user.role === 'director') ? '/enterprise' : '/staff-schedule', { replace: true });
        } else {
          navigate('/pending-access', { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [navigate, user, isAuthenticated, isLoadingAuth]);

  // Enterprise admin choice screen
  if (showChoice) {
    return <PostLoginChoiceScreen profile={profile} divisionName={profile?.division_name || profile?.division_id} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen page-bg-vibrant">
      <div className="mb-6 animate-float">
        <Logo variant="full" height={48} />
      </div>
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-500 mt-4 font-medium">Loading your workspace…</p>
    </div>
  );
}