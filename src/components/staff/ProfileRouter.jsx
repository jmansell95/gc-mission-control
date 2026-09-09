import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import FieldShell from '@/components/field/FieldShell';
import StaffProfile from '@/pages/StaffProfile';
import { Loader2 } from 'lucide-react';

/**
 * ProfileRouter — checks the current user's staff type and routes them to
 * the correct profile experience:
 *   - Field Team staff → mobile-first StaffProfile (wrapped in FieldShell)
 *   - Office staff (Super Admin, Management, Users, Read Only, Scanner Only)
 *     → DesktopProfile at /admin/profile
 *
 * Platform admins without a Staff record default to the desktop profile.
 */
export default function ProfileRouter() {
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Platform admins always get the desktop profile
      if (user?.role === 'admin') {
        if (cancelled) return;
        setProfile({ is_admin: true, system_role: 'super_admin' });
        setLoading(false);
        return;
      }
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        if (cancelled) return;
        setProfile(res.data);
      } catch (e) {
        if (cancelled) return;
        setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  // No profile resolved — fall through to the field profile (handles the
  // "no staff record" state with its own empty-state UI)
  if (!profile) {
    return (
      <FieldShell>
        <StaffProfile />
      </FieldShell>
    );
  }

  // Field team staff → mobile-first profile
  const isField = profile.system_role === 'field' && !profile.is_admin;
  if (isField) {
    return (
      <FieldShell>
        <StaffProfile />
      </FieldShell>
    );
  }

  // Office staff → desktop profile
  return <Navigate to="/admin/profile" replace state={location.state} />;
}