import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Wrench, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';
import UsageHoursWidget from '@/components/righub/UsageHoursWidget';

/**
 * Fleet Hub → Maintenance tab.
 *
 * Surfaces the full vehicle maintenance booking manager (the same one used
 * in Settings → Vehicles) plus a one-tap "Run predictive auto-booking now"
 * button that invokes the autoBookMaintenance backend function on demand
 * — so managers can trigger the daily engine immediately instead of waiting
 * for the 06:30 scheduled run.
 */
export default function FleetMaintenancePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('autoBookMaintenance', {});
      const n = res.data?.autoBooked ?? 0;
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      toast({
        title: n > 0 ? `${n} booking${n === 1 ? '' : 's'} auto-created` : 'Nothing to book',
        description: n > 0 ? 'New bookings are in Requested status — call the garage in to confirm.' : 'No vehicles are due MOT or service within the warning window.',
      });
    } catch (e) {
      toast({ title: 'Could not run auto-booking', description: e?.message, variant: 'destructive' });
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="hub-glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">Predictive Maintenance Engine</h3>
            <p className="text-sm text-slate-500">Auto-books MOT & service requests for vehicles due within 14 days. Runs daily at 06:30 — run it on demand below.</p>
          </div>
        </div>
        <button onClick={runNow} disabled={running}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg font-semibold text-sm hover:brightness-110 active:scale-95 transition disabled:opacity-50 flex-shrink-0 shadow-sm">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {running ? 'Running…' : 'Run Auto-Booking Now'}
        </button>
      </div>

      <VehicleMaintenanceManager />

      {/* Usage-based maintenance (rigs & plant) */}
      <UsageHoursWidget />
    </div>
  );
}