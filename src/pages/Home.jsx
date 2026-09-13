import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { resolveRoleLandingPage } from '@/utils/access';
import Logo from '@/components/Logo';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;

    let cancelled = false;
    (async () => {
      try {
        let profileData = null;
        try {
          const res = await base44.functions.invoke('getMyStaffProfile');
          profileData = res.data;
          if (cancelled) return;
          setProfile(profileData);
        } catch {}

        const isPlatformAdmin = user.role === 'admin' || user.role === 'director';
        const isEnterpriseAdmin = isPlatformAdmin ||
          (Array.isArray(profileData?.managed_division_ids) && profileData.managed_division_ids.length > 0);

        const userDivisionId = profileData?.division_id || user?.division_id;
        if (!userDivisionId && !isEnterpriseAdmin) {
          navigate('/pending-access', { replace: true });
          return;
        }

        if (profileData?.onboarding_complete === false && !isEnterpriseAdmin) {
          navigate('/onboarding', { replace: true });
          return;
        }

        // Enterprise admins get the choice screen — redirect to the standalone
        // /choose-workspace route (outside AppShell) so it renders with zero
        // app chrome. If they've already chosen this session, go straight there.
        if (isEnterpriseAdmin) {
          const savedDestination = sessionStorage.getItem('post_login_destination');
          if (savedDestination === '/enterprise' || savedDestination === '/admin') {
            navigate(savedDestination, { replace: true });
          } else {
            navigate('/choose-workspace', { replace: true });
          }
          return;
        }

        // Non-enterprise users: route based on role
        const landing = resolveRoleLandingPage(profileData, isPlatformAdmin);
        navigate(landing, { replace: true });
      } catch {
        if (cancelled) return;
        if (user?.division_id) {
          navigate((user.role === 'admin' || user.role === 'director') ? '/enterprise' : '/staff-schedule', { replace: true });
        } else {
          navigate('/pending-access', { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [navigate, user, isAuthenticated, isLoadingAuth]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen page-bg-vibrant">
      <div className="mb-6 animate-float">
        <Logo height={48} />
      </div>
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-500 mt-4 font-medium">Loading your workspace…</p>
    </div>
  );
}