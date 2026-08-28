import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  FileText, CloudSun, Boxes, Info,
} from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import WidgetShell from '@/components/dashboard/WidgetShell';

const STATUS_CONFIG = {
  green: { icon: CheckCircle2, ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', iconColor: 'text-emerald-600' },
  amber: { icon: AlertTriangle, ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', iconColor: 'text-amber-600' },
  red: { icon: ShieldAlert, ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-700', iconColor: 'text-rose-600' },
};

const GATE_ICONS = {
  rams: FileText,
  briefing: ShieldCheck,
  weather: CloudSun,
  equipment: Boxes,
};

export default function SiteReadinessGate({ jobId, rotaAssignmentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['site-readiness', jobId, rotaAssignmentId],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkSiteReadiness', {
        job_id: jobId,
        rota_assignment_id: rotaAssignmentId,
      });
      return res.data;
    },
    enabled: !!jobId,
    refetchInterval: 60000,
  });

  if (!jobId) {
    return (
      <WidgetShell title="Site Readiness Gate" subtitle="Safety pre-start checks" icon={ShieldCheck}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Info className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Select a job to view its readiness gates.</p>
        </div>
      </WidgetShell>
    );
  }

  if (isLoading) {
    return (
      <WidgetShell title="Site Readiness Gate" subtitle="Safety pre-start checks" icon={ShieldCheck}>
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </WidgetShell>
    );
  }

  if (!data) return null;

  const { gates = [], all_clear, blocking_count, caution_count } = data;

  const subtitle = all_clear
    ? 'All checks passed — cleared to start'
    : `${blocking_count} blocking · ${caution_count} caution`;

  return (
    <WidgetShell
      title="Site Readiness Gate"
      subtitle={subtitle}
      icon={all_clear ? ShieldCheck : ShieldAlert}
    >
      <div className="space-y-2">
        {gates.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-4">No active gates for this job.</p>
        )}
        {gates.map(gate => {
          const cfg = STATUS_CONFIG[gate.status] || STATUS_CONFIG.amber;
          const GateIcon = GATE_ICONS[gate.key] || ShieldCheck;
          const StatusIcon = cfg.icon;
          return (
            <div key={gate.key} className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${cfg.bg} ${cfg.ring}`}>
              <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0">
                <GateIcon className={`w-4 h-4 ${cfg.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{gate.label}</p>
                <p className="text-xs text-slate-500 truncate">{gate.detail}</p>
              </div>
              <StatusIcon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
            </div>
          );
        })}
        {all_clear && gates.length > 0 && (
          <div className="flex items-center gap-2 bg-emerald-600 rounded-xl p-3 mt-2">
            <CheckCircle2 className="w-5 h-5 text-white" />
            <p className="text-sm font-bold text-white">Cleared to Start Work</p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}