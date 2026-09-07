import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Clock, ChevronRight, ClipboardList } from 'lucide-react';

/**
 * DutiesSummaryCard — compact card for the Today page showing overdue/due-today
 * items across all duty cycles. Links to the full My Duties page.
 *
 * Uses the getMyDuties backend function, cached with 60s refetch.
 */
export default function DutiesSummaryCard({ staffId, enabled = true }) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-duties-summary', staffId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyDuties', {});
      return res.data;
    },
    enabled: !!staffId && enabled,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-slate-200/60 rounded mb-3" />
        <div className="h-3 w-full bg-slate-200/40 rounded mb-2" />
        <div className="h-3 w-2/3 bg-slate-200/40 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, daily, weekly, monthly, yearly } = data;
  const { overdue, due_today, due_this_week, all_done } = summary;

  if (all_done && overdue === 0 && due_today === 0 && due_this_week === 0) {
    return (
      <button
        onClick={() => navigate('/my-duties')}
        type="button"
        className="w-full text-left active:scale-[0.98] transition touch-manipulation"
      >
        <div className="hub-glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">All duties up to date</p>
            <p className="text-xs text-slate-500">No overdue or due-today items</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>
      </button>
    );
  }

  // Build summary rows
  const rows = [];
  if (overdue > 0) {
    rows.push({
      icon: AlertTriangle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
      label: `${overdue} item${overdue > 1 ? 's' : ''} overdue`,
      sub: 'Needs immediate attention',
      urgent: true,
    });
  }
  if (due_today > 0) {
    const dueItems = [...daily, ...weekly, ...monthly, ...yearly].filter(i => i.due_status === 'due_today');
    rows.push({
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-500',
      label: `${due_today} daily check${due_today > 1 ? 's' : ''} due today`,
      sub: dueItems.slice(0, 2).map(i => i.label).join(' · ') || 'Complete before starting work',
      urgent: false,
    });
  }
  if (due_this_week > 0) {
    rows.push({
      icon: ClipboardList,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-500',
      label: `${due_this_week} item${due_this_week > 1 ? 's' : ''} due this week`,
      sub: 'Plan ahead to stay on track',
      urgent: false,
    });
  }

  // Show vehicle frequency info
  if (data.vehicle && data.vehicle.effective_frequency === 'daily') {
    rows.push({
      icon: Clock,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-500',
      label: `Daily vehicle checks active`,
      sub: `${data.vehicle.weekly_mileage_miles || 0} mi this week (300+ threshold)`,
      urgent: false,
    });
  }

  const visibleRows = rows.slice(0, 4);

  return (
    <button
      onClick={() => navigate('/my-duties')}
      type="button"
      className="w-full text-left active:scale-[0.98] transition touch-manipulation"
    >
      <div className="hub-glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-2.5 border-b border-slate-100/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-[#2E5A1A]" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-bold text-slate-900 flex-1">My Duties</p>
          {overdue > 0 && (
            <span className="text-[10px] font-bold text-red-600 px-2 py-0.5 rounded-full bg-red-50">
              {overdue} OVERDUE
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50">
          {visibleRows.map((row, i) => {
            const Icon = row.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-7 h-7 rounded-lg ${row.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${row.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${row.urgent ? 'text-red-700' : 'text-slate-800'} truncate`}>
                    {row.label}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{row.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length > 4 && (
          <div className="px-4 py-2 text-center">
            <span className="text-[10px] font-semibold text-slate-400">+{rows.length - 4} more · View all →</span>
          </div>
        )}
      </div>
    </button>
  );
}