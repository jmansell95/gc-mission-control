import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useDivisionLoginConfig } from '@/hooks/useDivisionLoginConfig';
import LoginAnimationOverlay from '@/components/login/LoginAnimationOverlay';

const SESSION_KEY = 'post-login-animation-shown';

/**
 * PostLoginAnimation — plays the division-branded loading animation once
 * per session after the user signs in via Microsoft SSO.
 *
 * Renders null after the first time (tracked via sessionStorage) so page
 * refreshes don't re-trigger the animation. Placed in AuthenticatedApp
 * so it fires the moment the user is detected as authenticated.
 */
export default function PostLoginAnimation() {
  const { user, isAuthenticated } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Only show if authenticated, we have a user email, and haven't shown this session
    if (!isAuthenticated || !user?.email || done) return;
    try {
      const shown = sessionStorage.getItem(SESSION_KEY);
      if (shown) { setDone(true); return; }
    } catch { setDone(true); return; }

    setShouldShow(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
  }, [isAuthenticated, user?.email, done]);

  if (!shouldShow || done) return null;

  return (
    <LoginAnimationOverlay
      email={user?.email}
      onDone={() => { setDone(true); setShouldShow(false); }}
    />
  );
}