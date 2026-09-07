import React from 'react';
import { Outlet } from 'react-router-dom';
import StaffTabBar from '@/components/staff/StaffTabBar';
import { FieldDataProvider } from '@/components/field/FieldDataProvider';

/**
 * Shared layout route for all five field crew pages (Today, Upcoming, Scan,
 * Profile, More). Provides the fresh field background, the persistent bottom
 * tab bar on every breakpoint, and wraps children in the shared data provider
 * so navigation between pages doesn't re-fetch.
 */
export default function FieldShell() {
  return (
    <FieldDataProvider>
      <div className="min-h-screen field-bg flex flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <StaffTabBar />
      </div>
    </FieldDataProvider>
  );
}