import React from 'react';
import { Outlet } from 'react-router-dom';
import StaffTabBar from '@/components/staff/StaffTabBar';
import { FieldDataProvider } from '@/components/field/FieldDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Shared layout route for all five field crew pages (Today, Upcoming, Scan,
 * Profile, More). Provides the fresh field background, the persistent bottom
 * tab bar on every breakpoint, and wraps children in the shared data provider
 * so navigation between pages doesn't re-fetch.
 *
 * ErrorBoundary wraps the Outlet so a render crash in any field page shows
 * a visible error message + retry button instead of a blank white screen.
 */
export default function FieldShell() {
  return (
    <FieldDataProvider>
      <div className="h-[100dvh] field-bg flex flex-col overflow-hidden safe-area-top">
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden mobile-app-content"
          style={{
            paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <StaffTabBar />
      </div>
    </FieldDataProvider>
  );
}