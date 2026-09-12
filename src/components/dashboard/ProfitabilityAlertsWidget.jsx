import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, PoundSterling, Loader2, RefreshCw, ChevronRight } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const SEVERITY_STYLES = {
  high: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
};

export default function ProfitabilityAlertsWidget({ onSelectJob }) {
  const [expanded, setExpanded] = useState(null);

  const { data: result, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['profitability-alerts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkJobBudgetAlerts', { action: 'check' });
      return res.data || res;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const alerts = result?.alert_jobs || [];
  const checked = result?.checked || 0;
  const highCount = result?.high_severity || 0;

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${alerts.length > 0 ? 'bg-rose-100' : 'bg-emerald-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${alerts.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {alerts.length > 0 ? `${alerts.length} job${alerts.length === 1 ? '' : 's'} flagged` : 'All jobs healthy'}
            </p>
            <p className="text-[11px] text-slate-400">{checked} active jobs checked{highCount > 0 && ` · ${highCount} high severity`}</p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <TrendingDown className="w-6 h-6 text-emerald-500 rotate-180" />
          </div>
          <p className="text-sm font-medium text-slate-600">No budget or margin alerts</p>
          <p className="text-xs text-slate-400 mt-0.5">All active jobs are within thresholds</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {alerts.map((a, i) => {
            const topSeverity = a.alerts[0]?.severity || 'medium';
            const style = SEVERITY_STYLES[topSeverity] || SEVERITY_STYLES.medium;
            const isOpen = expanded === i;
            return (
              <div key={i} className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
                >
                  <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.job_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.alert_count} alert{a.alert_count === 1 ? '' : 's'} · {a.top_severity} severity
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {a.alerts?.map((al, j) => {
                      const alStyle = SEVERITY_STYLES[al.severity] || SEVERITY_STYLES.medium;
                      return (
                        <div key={j} className="flex items-start gap-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold ${alStyle.badge} flex-shrink-0`}>
                            {al.severity === 'high' ? 'HIGH' : 'MED'}
                          </span>
                          <span className="text-slate-600 leading-relaxed">{al.message}</span>
                        </div>
                      );
                    })}
                    {onSelectJob && (
                      <button
                        onClick={() => onSelectJob({ id: a.job_id, name: a.job_name })}
                        className="mt-2 text-xs font-semibold text-primary hover:underline"
                      >
                        Open job →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}