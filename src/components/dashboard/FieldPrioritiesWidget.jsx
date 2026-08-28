import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, ClipboardCheck, Truck, Clock, ShieldAlert, ChevronRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import ModernBadge from '@/components/ui/ModernBadge';
import { useMittiStatus } from '@/hooks/useSafetyCultureStatus';

/**
 * Phase 3 — Field Tools: Field Priorities widget.
 *
 * Surfaces the top action items field crews need to tackle today:
 * - Compliance expiring within 7 days
 * - Pending briefing sign-offs
 * - Deliveries scheduled today
 * - Unacknowledged schedule changes
 */
export default function FieldPrioritiesWidget({ onNavigate }) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: deliveries = [] } = useQuery({
    queryKey: ['field-priorities-deliveries', today],
    queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: today, status: 'pending' }, '-created_date', 50),
  });

  const { data: safetyReports = [] } = useQuery({
    queryKey: ['field-priorities-safety'],
    queryFn: () => base44.entities.SafetyReport.filter({ status: 'open' }, '-created_date', 10),
  });
  const { isConnected: scConnected } = useMittiStatus();
  const safetyCount = scConnected ? safetyReports.length : 0;

  const { data: assignments = [] } = useQuery({
    queryKey: ['field-priorities-assignments', today],
    queryFn: () => base44.entities.RotaAssignment.filter({ date: today, briefing_completed: false }, '-created_date', 50),
  });

  const priorities = [
    { id: 'deliveries', icon: Truck, label: 'Deliveries Due Today', count: deliveries.length, variant: 'info', desc: deliveries.length > 0 ? `${deliveries.length} pending delivery/collection task(s)` : 'No deliveries scheduled', nav: 'logistics' },
    { id: 'briefings', icon: ClipboardCheck, label: 'Briefings Pending', count: assignments.length, variant: assignments.length > 0 ? 'warning' : 'ok', desc: assignments.length > 0 ? `${assignments.length} crew member(s) need briefing sign-off` : 'All briefings complete', nav: 'scheduling' },
    { id: 'safety', icon: ShieldAlert, label: 'Open Safety Items', count: safetyCount, variant: safetyCount > 0 ? 'danger' : 'ok', desc: scConnected ? (safetyCount > 0 ? `${safetyCount} open safety report(s)` : 'No open safety items') : 'Mitti not connected', nav: 'compliance' },
  ];

  const totalActions = priorities.reduce((sum, p) => sum + p.count, 0);

  return (
    <WidgetShell icon={AlertTriangle} title="Field Priorities" subtitle="Today's action items for field crews">
      {totalActions === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">All clear</p>
          <p className="text-xs text-slate-400 mt-0.5">No outstanding field actions for today</p>
        </div>
      ) : (
        <div className="space-y-2">
          {priorities.map(p => {
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => onNavigate?.(p.nav)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition text-left group">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  p.variant === 'danger' ? 'bg-rose-50' : p.variant === 'warning' ? 'bg-amber-50' : p.variant === 'info' ? 'bg-blue-50' : 'bg-emerald-50'
                }`}>
                  <Icon className={`w-4 h-4 ${
                    p.variant === 'danger' ? 'text-rose-600' : p.variant === 'warning' ? 'text-amber-600' : p.variant === 'info' ? 'text-blue-600' : 'text-emerald-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.label}</p>
                  <p className="text-xs text-slate-400 truncate">{p.desc}</p>
                </div>
                {p.count > 0 && <ModernBadge variant={p.variant}>{p.count}</ModernBadge>}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}