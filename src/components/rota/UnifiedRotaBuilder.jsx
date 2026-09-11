import React from 'react';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';

/**
 * Unified Rota Builder — wraps the WeeklyRotaBuilder.
 * Hub-level action buttons (Add Shift, Assign Crew to Rig, Sync GPS
 * Timesheets) now live in the SchedulingHub header alongside every
 * other hub's action buttons for a consistent layout.
 */
export default function UnifiedRotaBuilder({ selectedWeek, setSelectedWeek }) {
  return (
    <WeeklyRotaBuilder selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
  );
}