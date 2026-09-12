import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Car, ShieldCheck, ClipboardCheck, HardHat, FileText, Clock,
  CheckCircle2, AlertTriangle, ChevronRight, Calendar, Truck,
  Wrench, Leaf, Award, RefreshCw, Loader2, ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, slideUp } from '@/lib/fieldAnimations';
import FieldPageShell from '@/components/field/FieldPageShell';
import FieldContainer from '@/components/field/FieldContainer';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';
import { useFieldData } from '@/components/field/FieldDataProvider';
import StaffTaskList from '@/components/field/StaffTaskList';

const CATEGORY_ICONS = {
  vehicle_check: Car,
  powra: ShieldCheck,
  equipment: ClipboardCheck,
  ppe: HardHat,
  timesheet: FileText,
  keylogbook: FileText,
  assets: Truck,
  toolbox_talk: HardHat,
  coshh: ShieldCheck,
  calibration: Wrench,
  environmental: Leaf,
  safety_audit: ShieldCheck,
  cscs_card: Award,
  cpcs_card: Award,
  npors_card: Award,
  driver_license: Car,
  first_aid_cert: ShieldCheck,
  forklift: Wrench,
  dbs_certificate: FileText,
  loler_puwer: Wrench,
  other: FileText,
};

const STATUS_STYLES = {
  overdue: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', pill: 'bg-red-100 text-red-700', label: 'Overdue', icon: AlertTriangle, iconColor: 'text-red-500' },
  due_today: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-700', label: 'Due Today', icon: Clock, iconColor: 'text-amber-500' },
  due_this_week: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', pill: 'bg-blue-100 text-blue-700', label: 'Due This Week', icon: Clock, iconColor: 'text-blue-500' },
  on_track: { bg: 'bg-emerald-50/50', border: 'border-emerald-200/60', text: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-700', label: 'On Track', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  done: { bg: 'bg-emerald-50/50', border: 'border-emerald-200/60', text: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-700', label: 'Done', icon: CheckCircle2, iconColor: 'text-emerald-500' },
};

const CYCLE_CONFIG = [
  { key: 'daily', label: 'Daily', icon: Clock, desc: 'Every shift' },
  { key: 'weekly', label: 'Weekly', icon: Calendar, desc: 'Once per week' },
  { key: 'monthly', label: 'Monthly', icon: RefreshCw, desc: 'Once per month' },
  { key: 'yearly', label: 'Yearly', icon: Award, desc: 'Annual renewals' },
];

function DutyCard({ item, mittiUrls, onAction }) {
  const Icon = CATEGORY_ICONS[item.category] || FileText;
  const status = STATUS_STYLES[item.due_status] || STATUS_STYLES.on_track;
  const StatusIcon = status.icon;

  const handleAction = () => {
    if (item.action_type === 'mitti_form') {
      const url = item.action_url === 'vehicle_check' ? mittiUrls.vehicleCheckUrl
        : item.action_url === 'powra' ? mittiUrls.powraUrl
        : item.action_url === 'equipment' ? mittiUrls.equipmentCheckUrl
        : null;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } else if (item.action_type === 'navigate') {
      onAction(item.action_url);
    } else if (item.action_type === 'shift_wizard') {
      onAction('/staff-schedule');
    }
  };

  return (
    <motion.div variants={slideUp} whileTap={{ scale: 0.97 }} className={`field-card rounded-2xl p-3.5 border ${status.border} ${status.bg} transition`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className={`w-5 h-5 ${status.iconColor}`} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{item.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{item.frequency}</p>
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${status.pill} flex-shrink-0`}>
              {status.label}
            </span>
          </div>

          {item.last_completed_at && (
            <p className="text-[10px] text-slate-400 mt-1">
              Last done: {new Date(item.last_completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {item.days_until_expiry != null && item.days_until_expiry >= 0 && (
                <span className="ml-2">· Expires in {item.days_until_expiry} days</span>
              )}
            </p>
          )}
          {item.expiry_date && !item.last_completed_at && (
            <p className="text-[10px] text-slate-400 mt-1">
              Expires: {item.expiry_date}
              {item.days_until_expiry != null && item.days_until_expiry >= 0 && (
                <span className="ml-2">· {item.days_until_expiry} days</span>
              )}
            </p>
          )}

          {item.mitti_verified && (
            <div className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-600">
              <CheckCircle2 className="w-3 h-3" /> Verified by Mitti
            </div>
          )}
        </div>

        {/* Action button */}
        <button
          onClick={handleAction}
          type="button"
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center active:scale-90 transition hover:border-primary/30"
        >
          {item.action_type === 'mitti_form' ? (
            <ExternalLink className="w-4 h-4 text-primary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function MyDutiesPage() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { staff, activeDivision } = ctx;
  const mittiUrls = useMittiCheckLinks();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-duties', staff?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyDuties', {});
      return res.data;
    },
    enabled: !!staff?.id,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return (
    <FieldPageShell
      staff={staff}
      stats={data ? [
        { label: 'Overdue', value: data.summary.overdue, icon: AlertTriangle, gradient: data.summary.overdue > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate' },
        { label: 'Due Today', value: data.summary.due_today, icon: Clock, gradient: data.summary.due_today > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate' },
        { label: 'This Week', value: data.summary.due_this_week, icon: Calendar, gradient: 'stat-gradient-blue' },
      ] : []}
      transparent
      contentClassName="pb-24"
      accentColor={activeDivision?.color}
    >
      <FieldContainer space="5">
        {/* Summary banner */}
        {data && (
          <div className={`field-card rounded-2xl p-4 ${data.summary.all_done ? 'border-emerald-200 bg-emerald-50/40' : data.summary.overdue > 0 ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${data.summary.all_done ? 'bg-emerald-100' : data.summary.overdue > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                {data.summary.all_done ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {data.summary.all_done
                    ? 'All duties up to date'
                    : `${data.summary.overdue} overdue · ${data.summary.due_today} due today · ${data.summary.due_this_week} this week`}
                </p>
                {data.vehicle && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vehicle: {data.vehicle.name || data.vehicle.registration_number || 'N/A'} ·{' '}
                    {data.vehicle.effective_frequency === 'daily' ? 'Daily checks (300+ mi/week)' : 'Weekly checks'}
                    {data.vehicle.weekly_mileage_miles > 0 && ` · ${data.vehicle.weekly_mileage_miles} mi this week`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="field-card rounded-2xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Could not load duties</p>
            <p className="text-xs text-slate-400 mt-1">Please try again in a moment.</p>
          </div>
        )}

        {/* Assigned tasks (ad-hoc + recurring from StaffTask entity) */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Assigned Tasks</h2>
              <p className="text-[10px] text-slate-400">Tasks from your manager</p>
            </div>
          </div>
          <StaffTaskList />
        </div>

        {/* Duty cycles */}
        {data && CYCLE_CONFIG.map((cycle) => {
          const items = data[cycle.key] || [];
          if (items.length === 0) return null;
          const CycleIcon = cycle.icon;
          return (
            <div key={cycle.key}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center">
                  <CycleIcon className="w-4 h-4 text-primary" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{cycle.label}</h2>
                  <p className="text-[10px] text-slate-400">{cycle.desc}</p>
                </div>
                <span className="ml-auto text-[10px] font-bold text-slate-400 px-2 py-1 rounded-full bg-slate-100">
                  {items.filter(i => i.due_status === 'done' || i.due_status === 'on_track').length}/{items.length} done
                </span>
              </div>
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2.5">
                {items.map((item, i) => (
                  <DutyCard key={`${cycle.key}-${i}`} item={item} mittiUrls={mittiUrls} onAction={navigate} />
                ))}
              </motion.div>
            </div>
          );
        })}
      </FieldContainer>
    </FieldPageShell>
  );
}