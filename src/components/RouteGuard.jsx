import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { canAccessRoute, resolveRoleLandingPage } from '@/utils/access';

// Routes where a brand-new user who hasn't finished their first-login profile
// setup should be redirected to /onboarding. Deep-linking to these would
// otherwise bypass the onboarding gate that Home.jsx applies.
const ONBOARDING_GATED_ROUTES = ['/staff-schedule', '/staff-profile', '/admin', '/deliveries', '/scanner'];

// Route-level guard that enforces the site-wide lockdown.
// Drivers see deliveries only, field staff see schedule + profile only,
// office staff see admin. Anyone hitting a route they can't access is
// redirected to their own landing page.
export default function RouteGuard({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  // Super admins AND directors bypass the lockdown — directors manage divisions
  // so they need full route access within their assigned divisions.
  const isPlatformAdmin = user?.role === 'admin' || user?.role === 'director';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyStaffProfile');
      return res.data;
    },
    // Platform admins always have full access — no need to fetch the profile.
    enabled: !!isAuthenticated && !isLoadingAuth && !isPlatformAdmin,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Platform admins bypass the lockdown entirely — render immediately,
  // with no profile fetch and no loading spinner.
  if (isPlatformAdmin) return children;

  if (isLoadingAuth || isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Profile failed to load and we can't determine access — show a retry
  // screen instead of redirecting (which would loop).
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <p className="text-slate-700 font-semibold">Could not load your profile</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} type="button"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!canAccessRoute(profile, false, location.pathname)) {
    let landing = resolveRoleLandingPage(profile, false);
    // Safety net: if the resolved landing page is the same inaccessible route
    // we're already on, fall back to a guaranteed-safe default to avoid a
    // redirect loop.
    if (landing === location.pathname) {
      landing = '/staff-schedule';
    }
    return <Navigate to={landing} replace />;
  }

  // Onboarding gate — new users who haven't completed their first-login
  // profile setup are sent to /onboarding before they can enter a gated app
  // route (even via deep link). /onboarding itself and /pending-access are
  // exempt so the flow doesn't loop.
  if (
    profile.onboarding_complete === false &&
    ONBOARDING_GATED_ROUTES.includes(location.pathname) &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}