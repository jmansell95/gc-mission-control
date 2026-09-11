import React, { useState } from 'react';
import UnifiedMobileDrawer from './UnifiedMobileDrawer';
import MobileMenuBar from './MobileMenuBar';

/**
 * MobileNavShell — holds the shared drawer open state and renders both
 * the UnifiedMobileDrawer (slide-out navigation) and the MobileMenuBar
 * (persistent bottom bar with the Menu button).
 *
 * This lifts the drawer's open/close state out of UnifiedMobileDrawer so
 * the bottom bar's Menu button can drive it. Replaces the old floating
 * hamburger button that overlapped page content.
 *
 * Usage: drop <MobileNavShell /> wherever <UnifiedMobileDrawer /> was
 * previously rendered (MobileAppShell, FieldShell, AppLayout).
 */
export default function MobileNavShell() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <UnifiedMobileDrawer open={open} onClose={() => setOpen(false)} />
      <MobileMenuBar onMenuClick={() => setOpen(true)} />
    </>
  );
}