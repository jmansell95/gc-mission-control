import React, { useState } from 'react';
import UnifiedMobileDrawer from './UnifiedMobileDrawer';
import FieldBottomNav from '@/components/field/FieldBottomNav';

/**
 * MobileNavShell — holds the shared drawer open state and renders both
 * the UnifiedMobileDrawer (slide-out navigation) and the FieldBottomNav
 * (persistent 5-tab bottom bar with Home, Today, Scan, Tools, More).
 *
 * The "More" tab opens the drawer. This replaces the old single-button
 * MobileMenuBar with a proper field-optimised bottom navigation.
 */
export default function MobileNavShell() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <UnifiedMobileDrawer open={open} onClose={() => setOpen(false)} />
      <FieldBottomNav onMoreClick={() => setOpen(true)} />
    </>
  );
}