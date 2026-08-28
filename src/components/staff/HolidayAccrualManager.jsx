import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Loader2, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Holiday pay accrual manager — shows each active staff member's holiday year
// balance: entitlement, days taken, days remaining, and accrued-to-date.
// Managers can recalculate all accruals with one click.

export default function HolidayAccrualManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [calculating, setCalculating] = useState(false);

  const { data: accruals = [], isLoading } = useQuery({
    queryKey: ['holiday-accruals'],
    queryFn: () => base44.entities.HolidayPayAccrual.list('-days_remaining'),
  });

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const res = await base44.functions.invoke('calculateHolidayAccruals', {});
      toast({
        title: '✓ Accruals recalculated',
        description: `Updated ${res?.data?.staff_count || 0} staff records.`,
      });
      queryClient.invalidateQueries({ queryKey: ['holiday-accruals'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Calendar}
        title="Holiday Pay Accrual"
        description="Track holiday entitlement, days taken, and accrued balances per staff member."
        actions={
          <Button onClick={handleRecalculate} disabled={calculating} className="bg-[#2E5A1A] hover:bg-[#1c4a12] text-white">
            {calculating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Recalculate All
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : accruals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-400">No accrual records yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Recalculate All" to generate accrual records for all active staff.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {accruals.map((a) => {
            const pct = a.total_entitlement_days > 0 ? (a.days_accrued_to_date / a.total_entitlement_days) * 100 : 0;
            const takenPct = a.total_entitlement_days > 0 ? (a.days_taken / a.total_entitlement_days) * 100 : 0;
            const overdrawn = a.days_taken > a.days_accrued_to_date;
            return (
              <div key={a.id} className="insight-card rounded-xl p-4 relative overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{a.staff_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">
                      Year: {(a.holiday_year_start || '').slice(0, 7)} → {(a.holiday_year_end || '').slice(0, 7)}
                    </p>
                  </div>
                  {overdrawn && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Overdrawn
                    </span>
                  )}
                </div>

                {/* Accrual progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Accrued</span>
                    <span className="font-semibold text-slate-700">{a.days_accrued_to_date || 0} / {a.total_entitlement_days || 28} days</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>

                {/* Taken bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Taken</span>
                    <span className={`font-semibold ${overdrawn ? 'text-rose-600' : 'text-slate-700'}`}>
                      {a.days_taken || 0} days
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${overdrawn ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, takenPct)}%` }} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-sm font-bold text-emerald-700 tabular-nums">{a.days_remaining || 0}</p>
                    <p className="text-[9px] uppercase text-slate-500 font-semibold">Remaining</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-sm font-bold text-blue-700 tabular-nums">{a.days_carried_over || 0}</p>
                    <p className="text-[9px] uppercase text-slate-500 font-semibold">Carried</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-sm font-bold text-slate-600 tabular-nums">{a.accrual_rate_per_day?.toFixed(3) || '0'}</p>
                    <p className="text-[9px] uppercase text-slate-500 font-semibold">Per Day</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}