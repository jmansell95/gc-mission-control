import React, { useState } from 'react';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import { Plus, Drill, Navigation2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * Unified Rota Builder — wraps the WeeklyRotaBuilder with action buttons.
 * "Add Shift" opens the single-staff AssignmentModal.
 * "Assign Crew to Rig" opens the Crew-Rig assignment flow (Lead Driller + Second
 * Man → pick rig + dates, with mid-job rig swap).
 * "Sync GPS Timesheets" triggers the Geotab timesheet sync for today.
 */
export default function UnifiedRotaBuilder({ selectedWeek, setSelectedWeek }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleAddShift = () => {
    window.dispatchEvent(new CustomEvent('gc-open-add-shift'));
  };

  const handleCrewRig = () => {
    window.dispatchEvent(new CustomEvent('gc-open-crew-rig'));
  };

  const handleGeotabSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncGeotabTimesheets', { date: new Date().toISOString().slice(0, 10) });
      if (res.data?.ok) {
        toast({ title: 'GPS Timesheet Sync', description: res.data.message || 'Synced.' });
      } else {
        toast({ title: 'Sync failed', description: res.data?.error || 'Could not sync GPS timesheets.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message || 'Could not sync GPS timesheets.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleAddShift}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] text-white text-ui-caption font-semibold hover:bg-[#1c4a12] shadow-sm transition w-fit active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Shift
        </button>
        <button
          onClick={handleCrewRig}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-amber-600 text-white text-ui-caption font-semibold hover:bg-amber-700 shadow-sm transition w-fit active:scale-95"
        >
          <Drill className="w-4 h-4" /> Assign Crew to Rig
        </button>
        <button
          onClick={handleGeotabSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-600 text-white text-ui-caption font-semibold hover:bg-blue-700 shadow-sm transition w-fit active:scale-95 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation2 className="w-4 h-4" />}
          <span className="hidden sm:inline">Sync GPS Timesheets</span>
          <span className="sm:hidden">GPS</span>
        </button>
      </div>
      <WeeklyRotaBuilder selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
    </div>
  );
}