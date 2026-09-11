import React from 'react';
import FieldDashboard from './FieldDashboard';

/**
 * FieldHomeHub — the field staff landing page at /staff-schedule.
 * Now renders the redesigned personal dashboard (FieldDashboard) instead
 * of the old navigation card grid. Wrapped by FieldShell which provides
 * the header and persistent bottom navigation bar.
 */
export default function FieldHomeHub() {
  return <FieldDashboard />;
}