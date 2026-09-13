import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import PostLoginChoiceScreen from '@/components/login/PostLoginChoiceScreen';

/**
 * Standalone route for the post-login workspace choice screen.
 *
 * This page lives OUTSIDE AppShell / FieldShell so it renders with zero app
 * chrome — no bottom bar, no drawer, no header. Just the two choice cards
 * on a branded background. Home.jsx redirects here when an enterprise admin
 * hasn't yet chosen a destination this session.
 */
export default function ChooseWorkspace() {
  const { divisions } = useDivision();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        setProfile(res.data);
      } catch {}
    })();
  }, []);

  const divisionName = profile?.division_id
    ? divisions.find((d) => d.id === profile.division_id)?.name
    : null;

  return <PostLoginChoiceScreen profile={profile} divisionName={divisionName} />;
}