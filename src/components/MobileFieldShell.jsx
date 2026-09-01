import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Minimal full-screen shell for /m/ (mobile) field crew routes.
 * No sidebar, no admin chrome — just a clean full-height container
 * with safe-area padding for notched phones. The field pages
 * (StaffDashboard, DeliveryDashboard, etc.) render their own
 * mobile-first headers inside this shell.
 */
export default function MobileFieldShell() {
  return (
    <div className="h-[100dvh] bg-background safe-area-top safe-area-bottom overflow-hidden flex flex-col">
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}