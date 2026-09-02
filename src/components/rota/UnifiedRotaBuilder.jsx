import React, { useState, useEffect } from 'react';
import { startOfWeek, format } from 'date-fns';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import { Plus, Drill } from 'lucide-react';

/**
 * Unified Rota Builder — wraps the WeeklyRotaBuilder with action buttons.
 * "Add Shift" opens the single-staff AssignmentModal.
 * "Assign Crew to Rig" opens the Crew-Rig assignment flow (Lead Driller + Second
 * Man → pick rig + dates, with mid-job rig swap).
 */
export default function UnifiedRotaBuilder({ selectedWeek, setSelectedWeek }) {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const handleAddShift = () => {
    window.dispatchEvent(new CustomEvent('gc-open-add-shift'));
  };

  const handleCrewRig = () => {
    window.dispatchEvent(new CustomEvent('gc-open-crew-rig'));
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleAddShift}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2E5A1A] text-white hover:bg-[#1c4a12] shadow-sm transition w-fit active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Shift
        </button>
        <button
          onClick={handleCrewRig}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition w-fit active:scale-95"
        >
          <Drill className="w-4 h-4" /> Assign Crew to Rig
        </button>
      </div>
      <WeeklyRotaBuilder selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
    </div>
  );
}