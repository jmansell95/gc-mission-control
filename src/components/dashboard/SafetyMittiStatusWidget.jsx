import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronRight, ClipboardCheck, AlertCircle, Car } from 'lucide-react';
import { format } from 'date-fns';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

/**
 * SafetyMittiStatusWidget — hero tile showing today's crew safety compliance.
 * Counts how many shifts completed daily checks / POWRA via Mitti today vs
 * total active shifts. Deep-links to the Compliance Hub safety view.
 */
export default function SafetyMittiStatusWidget({ onNavigate }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { isConnected: mittiConnected, isLoading: mittiLoading } = useMittiStatus();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['safety-bento-rotas', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });

  const { data: safetyReports = [] } = useQuery({
    queryKey: ['safety-bento-reports'],
    queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }, '-created_date', 50),
  });

  const stats = useMemo(() => {
    const activeShifts = assignments.filter(a => a.status !== 'completed' || a.completed_at);
    const totalShifts = activeShifts.length;
    const vehicleChecksDone = activeShifts.filter(a => a.mitti_vehicle_check_at).length;
    const powraDone = activeShifts.filter(a => a.mitti_powra_at).length;
    const bothDone = activeShifts.filter(a => a.mitti_vehicle_check_at && a.mitti_powra_at).length;
    const checksPending = totalShifts - bothDone;
    const openSafetyCount = mittiConnected ? safetyReports.length : 0;
    const criticalCount = mittiConnected ? safetyReports.filter(r => r.severity === 'critical' || r.severity === 'high').length : 0;

    return {
      totalShifts,
      vehicleChecksDone,
      powraDone,
      bothDone,
      checksPending,
      openSafetyCount,
      criticalCount,
      compliancePct: totalShifts > 0 ? Math.round((bothDone / totalShifts) * 100) : 0,
    };
  }, [assignments, safetyReports, mittiConnected]);

  const handleClick = () => {
    if (onNavigate) onNavigate('compliance');
    else navigate('/compliance?filter=safety');
  };

  if (isLoading || mittiLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 min-h-[280px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Safety / Mitti Status</h3>
        </div>
        <WidgetLoadingState rows={3} />
      </div>
    );
  }

  const isHealthy = stats.checksPending === 0 && stats.criticalCount === 0;
  const hasWarning = stats.criticalCount > 0 || stats.checksPending > 0;

  return (
    <div
      className="insight-card rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Safety / Mitti Status</h3>
              <p className="text-[11px] text-white/70">
                {mittiConnected ? 'Mitti connected' : 'Mitti not connected'} · {format(new Date(), 'EEE dd MMM')}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {stats.totalShifts === 0 ? (
          <WidgetEmptyState icon={ClipboardCheck} title="No shifts today" message="No active shifts to check." />
        ) : (
          <>
            {/* Big compliance number */}
            <div className="mb-4">
              <div className="flex items-end gap-2">
                <p className={`text-4xl font-bold tabular-nums leading-none ${isHealthy ? 'text-emerald-600' : hasWarning ? 'text-amber-600' : 'text-slate-700'}`}>
                  {stats.compliancePct}%
                </p>
                {isHealthy ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500 mb-1" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1.5">
                {stats.bothDone} of {stats.totalShifts} shifts fully checked
              </p>
            </div>

            {/* Check breakdown */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Car className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">Vehicle Checks</p>
                  <p className="text-[10px] text-slate-400">{stats.vehicleChecksDone} of {stats.totalShifts} done</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-slate-700">{stats.vehicleChecksDone}/{stats.totalShifts}</span>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">POWRA</p>
                  <p className="text-[10px] text-slate-400">{stats.powraDone} of {stats.totalShifts} done</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-slate-700">{stats.powraDone}/{stats.totalShifts}</span>
              </div>

              {mittiConnected && stats.openSafetyCount > 0 && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-800">Open Safety Items</p>
                    <p className="text-[10px] text-rose-500">{stats.criticalCount} critical</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-rose-700">{stats.openSafetyCount}</span>
                </div>
              )}
            </div>

            {/* Pending action */}
            {stats.checksPending > 0 && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <p className="text-[11px] font-semibold text-amber-700">
                  {stats.checksPending} shift{stats.checksPending !== 1 ? 's' : ''} pending safety checks
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}