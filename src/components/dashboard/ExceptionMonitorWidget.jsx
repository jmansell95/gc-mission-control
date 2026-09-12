import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import {
  AlertOctagon, Clock, ShieldAlert, Truck, Ruler, RotateCcw,
  ChevronRight, RefreshCw, Loader2, CheckCircle2, Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import WidgetActionFooter from '@/components/dashboard/WidgetActionFooter';

const SEVERITY = {
  critical: { label: 'Critical', dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  warning: { label: 'Warning', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  info: { label: 'Info', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

// A focused "Needs Attention" monitor — aggregates every operational exception
// into one prioritised list so admins manage by exception, not by raw data.
// Each item links to the relevant page/section for resolution.
export default function ExceptionMonitorWidget({ onNavigate }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'warning'

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nowMs = Date.now();

  const { data: timesheets = [], isLoading: tsLoading } = useQuery({
    queryKey: ['exception-timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 200),
  });

  const { data: complianceItems = [] } = useQuery({
    queryKey: ['exception-compliance'],
    queryFn: () => base44.entities.ComplianceItem.list('-created_date', 300),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['exception-vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['exception-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const { data: todayRotas = [] } = useQuery({
    queryKey: ['exception-rotas-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });

  const { data: offHire = [] } = useQuery({
    queryKey: ['exception-offhire'],
    queryFn: () => base44.entities.JobCostItem.filter({ hire_status: 'on_hire' }, '-created_date', 200),
  });

  // ── Compute exceptions ──
  const exceptions = useMemo(() => {
    const items = [];

    // 1. Overdue submitted timesheets (>48h awaiting approval)
    const overdueTs = timesheets.filter(t =>
      t.status === 'submitted' && t.created_date &&
      (nowMs - new Date(t.created_date).getTime()) > 48 * 3600 * 1000
    );
    overdueTs.forEach(t => {
      const job = jobs.find(j => j.id === t.job_id);
      items.push({
        id: `ts-${t.id}`,
        severity: 'warning',
        icon: Clock,
        title: 'Timesheet awaiting approval >48h',
        detail: `${t.staff_name || 'Staff'} · ${job?.name || 'No job'} · ${format(new Date(t.date || t.created_date), 'dd MMM')}`,
        navTarget: 'staff',
        ageDays: Math.floor((nowMs - new Date(t.created_date).getTime()) / 86400000),
      });
    });

    // 2. Expired compliance items (staff + equipment)
    const expired = complianceItems.filter(i => {
      if (!i.expiry_date || i.status_override !== 'auto') return false;
      const days = differenceInDays(new Date(i.expiry_date + 'T00:00:00'), new Date());
      return days < 0;
    });
    expired.slice(0, 8).forEach(i => {
      items.push({
        id: `comp-${i.id}`,
        severity: 'critical',
        icon: ShieldAlert,
        title: `${i.title || i.qualification_type || 'Compliance'} expired`,
        detail: `${i.reference_name || 'Unknown'} · expired ${i.expiry_date ? format(new Date(i.expiry_date), 'dd MMM yyyy') : ''}`,
        navTarget: 'compliance',
        ageDays: i.expiry_date ? Math.abs(differenceInDays(new Date(i.expiry_date + 'T00:00:00'), new Date())) : 0,
      });
    });

    // 3. Vehicles with expired MOT or service
    vehicles.forEach(v => {
      const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null') ? v.mot_expiry : null;
      if (motExpiry) {
        const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), new Date());
        if (d < 0) {
          items.push({
            id: `mot-${v.id}`,
            severity: 'critical',
            icon: Truck,
            title: 'MOT expired',
            detail: `${v.registration_number || v.name} · expired ${format(new Date(motExpiry), 'dd MMM yyyy')}`,
            navTarget: 'assets',
            ageDays: Math.abs(d),
          });
        } else if (d <= 30) {
          items.push({
            id: `motdue-${v.id}`,
            severity: 'warning',
            icon: Truck,
            title: 'MOT due soon',
            detail: `${v.registration_number || v.name} · ${d} days left`,
            navTarget: 'assets',
            ageDays: 0,
          });
        }
      }
      if (v.service_due_date && v.service_due_date !== 'null') {
        const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), new Date());
        if (d < 0) {
          items.push({
            id: `svc-${v.id}`,
            severity: 'critical',
            icon: Truck,
            title: 'Service overdue',
            detail: `${v.registration_number || v.name} · due ${format(new Date(v.service_due_date), 'dd MMM yyyy')}`,
            navTarget: 'assets',
            ageDays: Math.abs(d),
          });
        }
      }
    });

    // 4. Drilling jobs active today with no meterage logged
    const drillingJobIds = new Set(
      jobs.filter(j => (j.status === 'in_progress' || j.status === 'decommissioning') &&
        (j.drilling_method === 'cp' || j.drilling_method === 'rotary' || j.drilling_method === 'mixed')
      ).map(j => j.id)
    );
    const todayDrillingRotas = todayRotas.filter(r => drillingJobIds.has(r.job_id) && (r.status || 'assigned') === 'completed');
    todayDrillingRotas.forEach(r => {
      if (!r.meterage || r.meterage === 0) {
        const job = jobs.find(j => j.id === r.job_id);
        items.push({
          id: `meter-${r.id}`,
          severity: 'warning',
          icon: Ruler,
          title: 'Missing meterage',
          detail: `${r.staff_name || 'Crew'} · ${job?.name || 'Job'} · shift completed, 0m recorded`,
          navTarget: 'staff',
          ageDays: 0,
        });
      }
    });

    // 5. Off-hire gear still on charge (decommissioning jobs with on_hire items)
    const decompJobIds = new Set(jobs.filter(j => j.status === 'decommissioning' || j.status === 'completed').map(j => j.id));
    const staleOnHire = offHire.filter(c => decompJobIds.has(c.job_id));
    staleOnHire.slice(0, 6).forEach(c => {
      const job = jobs.find(j => j.id === c.job_id);
      items.push({
        id: `offhire-${c.id}`,
        severity: 'warning',
        icon: RotateCcw,
        title: 'Gear still on hire after job end',
        detail: `${c.description || c.asset_name || 'Item'} · ${job?.name || 'Job'} · return to supplier`,
        navTarget: 'logistics',
        ageDays: 0,
      });
    });

    // Sort: critical first, then warning
    const order = { critical: 0, warning: 1, info: 2 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);
    return items;
  }, [timesheets, complianceItems, vehicles, jobs, todayRotas, offHire, nowMs]);

  const filtered = filter === 'all' ? exceptions : exceptions.filter(e => e.severity === filter);
  const criticalCount = exceptions.filter(e => e.severity === 'critical').length;
  const warningCount = exceptions.filter(e => e.severity === 'warning').length;
  const isLoading = tsLoading;

  // Oldest open days — the max age of any exception
  const oldestOpenDays = exceptions.length > 0
    ? Math.max(...exceptions.map(e => e.ageDays || 0))
    : 0;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['exception-'] });
    toast({ title: 'Exception monitor refreshed' });
  };

  const handleItemClick = (navTarget) => {
    if (onNavigate && navTarget) onNavigate(navTarget);
  };

  const handleTriage = () => {
    const firstCritical = exceptions.find(e => e.severity === 'critical');
    const target = firstCritical || exceptions[0];
    if (target?.navTarget) handleItemClick(target.navTarget);
  };

  return (
    <div className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-rose-500 to-rose-700 px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Needs Attention</h3>
              <p className="text-[11px] text-white/70">
                {exceptions.length} item{exceptions.length !== 1 ? 's' : ''} requiring action
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <RefreshCw className="w-4 h-4 text-white/80" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* New stat: oldest open days */}
        {oldestOpenDays > 0 && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
            <Calendar className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-bold text-rose-700">Oldest issue: {oldestOpenDays}d ago</span>
          </div>
        )}

        {/* Severity summary + filter pills */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex p-1 bg-slate-100 rounded-lg gap-0.5">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${filter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              All <span className="tabular-nums ml-1"><AnimatedNumber value={exceptions.length} /></span>
            </button>
            <button onClick={() => setFilter('critical')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${filter === 'critical' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Critical <span className="tabular-nums"><AnimatedNumber value={criticalCount} /></span>
            </button>
            <button onClick={() => setFilter('warning')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${filter === 'warning' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning <span className="tabular-nums"><AnimatedNumber value={warningCount} /></span>
            </button>
          </div>
        </div>

        {/* Exception list */}
        {isLoading ? (
          <WidgetLoadingState rows={4} />
        ) : filtered.length === 0 ? (
          <WidgetEmptyState icon={CheckCircle2} title="All clear" message="No exceptions detected. Everything is on track." />
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto flex-1">
            {filtered.map((item, i) => {
              const sev = SEVERITY[item.severity];
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => handleItemClick(item.navTarget)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition hover:shadow-sm ${sev.bg} ${sev.border}`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${sev.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.detail}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Footer — deep-link + quick-action */}
        <WidgetActionFooter
          deepLinkLabel="Compliance Hub"
          onDeepLink={() => onNavigate?.('compliance')}
          quickActionLabel="Triage First"
          onQuickAction={handleTriage}
        />
      </div>
    </div>
  );
}