import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import UnifiedMobileDrawer from './UnifiedMobileDrawer';
import FieldBottomNav from '@/components/field/FieldBottomNav';
import EnterpriseBottomNav from '@/components/mobile/EnterpriseBottomNav';
import { getNavContext } from '@/utils/navContext';

/**
 * MobileNavShell — context-aware mobile navigation holder.
 *
 * Detects the current route's navigation context and renders the appropriate
 * navigation chrome:
 *
 *   • 'choice'   → nothing (the bare choice screen has no nav)
 *   • 'enterprise' → EnterpriseBottomNav (minimal Menu button) + the
 *                    context-aware UnifiedMobileDrawer (enterprise links)
 *   • 'stream'   → FieldBottomNav (5-tab field bar) + the context-aware
 *                  UnifiedMobileDrawer (stream links + Back to Enterprise)
 *
 * The drawer (UnifiedMobileDrawer) is shared — it detects the same context
 * and renders the appropriate set of links.
 */
export default function MobileNavShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const ctx = getNavContext(location.pathname);

  if (ctx === 'choice') return null;

  if (ctx === 'enterprise') {
    return (
      <>
        <UnifiedMobileDrawer open={open} onClose={() => setOpen(false)} />
        <EnterpriseBottomNav onMenuClick={() => setOpen(true)} />
      </>
    );
  }

  return (
    <>
      <UnifiedMobileDrawer open={open} onClose={() => setOpen(false)} />
      <FieldBottomNav onMoreClick={() => setOpen(true)} />
    </>
  );
}