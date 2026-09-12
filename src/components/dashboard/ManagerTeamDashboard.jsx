import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Users, Clock, AlertTriangle, CheckCircle2, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

/**
 * ManagerTeamDashboard — per-manager team view showing direct reports
 * with their today's assignments, pending timesheet approvals, compliance
 * status, and training gaps. Accessible from the admin dashboard by
 * managers who have staff reporting to them.
 */
export default function ManagerTeamDashboard() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  const { data: myStaff = [], isLoading } = useQuery({
    queryKey: ['my-team-staff'],
    queryFn: async () => {
      const me = await base44.auth.me();
      if (!me) return [];
      const myStaffRecords = await base44.entities.Staff.filter({ manager_id: me.id });
      return myStaffRecords.filter(s => s.is_active !== false);
    },
  });

  const myStaffIds = useMemo(() => myStaff.map(s => s.id), [myStaff]);

  const { data: todaysAssignments = [] } = useQuery({
    queryKey: ['team-today', myStaffIds.join(',')],
    queryFn: async () => {
      if (myStaffIds.length === 0) return [];
      const all = await base44.entities.RotaAssignment.list('-created_date', 500);
      return all.filter(a => a.assigned_date === todayStr && myStaffIds.includes(a.staff_id));
    },
    enabled: myStaffIds.length > 0,
  });

  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['team-pending-timesheets', myStaffIds.join(',')],
    queryFn: async () => {
      if (myStaffIds.length === 0) return [];
      const all = await base44.entities.Timesheet.list('-created_date', 500);
      return all.filter(t => t.status === 'submitted' && myStaffIds.includes(t.staff_id));
    },
    enabled: myStaffIds.length > 0,
  });

  const { data: complianceItems = [] } = useQuery({
    queryKey: ['team-compliance', myStaffIds.join(',')],
    queryFn: async () => {
      if (myStaffIds.length === 0) return [];
      const all = await base44.entities.ComplianceItem.filter({ category: 'staff' });
      return all.filter(c => myStaffIds.includes(c.reference_id));
    },
    enabled: myStaffIds.length > 0,
  });

  const { data: trainingBookings = [] } = useQuery({
    queryKey: ['team-training-gaps'],
    queryFn: async () => base44.entities.TrainingBooking.filter({ status: 'suggested' }),
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['team-jobs'], queryFn: () => base44.entities.Job.list() });

  const todayCount = todaysAssignments.length;
  const pendingCount = pendingTimesheets.length;
  const expiringCompliance = complianceItems.filter(c => {
    if (!c.expiry_date) return false;
    const exp = c.expiry_date.length === 7 ? new Date(c.expiry_date + '-01') : new Date(c.expiry_date);
    const days = Math.floor((exp - new Date()) / 86400000);
    return days <= 30 && days >= -30;
  });
  const trainingGaps = trainingBookings.filter(b => myStaffIds.includes(b.staff_id));

  const staffCards = useMemo(() => {
    return myStaff.map(s => {
      const today = todaysAssignments.filter(a => a.staff_id === s.id);
      const pending = pendingTimesheets.filter(t => t.staff_id === s.id);
      const compliance = expiringCompliance.filter(c => c.reference_id === s.id);
      const training = trainingGaps.filter(b => b.staff_id === s.id);
      return { ...s, todayCount: today.length, todayJobs: today.map(a => jobs.find(j => j.id === a.job_id)?.name).filter(Boolean), pendingCount: pending.length, complianceCount: compliance.length, trainingCount: training.length };
    });
  }, [myStaff, todaysAssignments, pendingTimesheets, expiringCompliance, trainingGaps, jobs]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (myStaff.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-12">
        <PageHeader icon={Users} title="My Team" subtitle="Your direct reports at a glance" />
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No direct reports</p>
          <p className="text-xs text-slate-400 mt-1">Staff assigned to you as their manager will appear here with their live status.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="My Team"
        subtitle={`${myStaff.length} direct report${myStaff.length !== 1 ? 's' : ''} — live status today`}
        stats={[
          { label: 'On Site Today', value: todayCount, icon: Calendar },
          { label: 'Pending Approvals', value: pendingCount, icon: Clock },
          { label: 'Compliance Alerts', value: expiringCompliance.length, icon: AlertTriangle },
          { label: 'Training Gaps', value: trainingGaps.length, icon: CheckCircle2 },
        ]}
      />

      {/* Staff cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {staffCards.map(s => (
          <div key={s.id} className="hub-glass rounded-2xl p-4 hover:shadow-lg transition cursor-pointer" onClick={() => setSelectedStaffId(selectedStaffId === s.id ? null : s.id)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-600">
                  {s.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.job_title || '—'}</p>
                </div>
              </div>
              {s.todayCount > 0 && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full ring-1 ring-emerald-200">ON SITE</span>
              )}
            </div>

            {s.todayJobs.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Today</p>
                <p className="text-xs text-slate-700">{s.todayJobs.join(', ')}</p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {s.pendingCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-full ring-1 ring-amber-200">
                  {s.pendingCount} timesheet{s.pendingCount > 1 ? 's' : ''} pending
                </span>
              )}
              {s.complianceCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded-full ring-1 ring-rose-200">
                  {s.complianceCount} compliance alert{s.complianceCount > 1 ? 's' : ''}
                </span>
              )}
              {s.trainingCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full ring-1 ring-blue-200">
                  {s.trainingCount} training gap{s.trainingCount > 1 ? 's' : ''}
                </span>
              )}
              {s.pendingCount === 0 && s.complianceCount === 0 && s.trainingCount === 0 && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full ring-1 ring-emerald-200">All clear</span>
              )}
            </div>

            {selectedStaffId === s.id && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 animate-slide-up">
                <button onClick={(e) => { e.stopPropagation(); window.location.href = `/staff?staff=${s.id}`; }} className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-primary">
                  Open staff profile <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); window.location.href = `/staff?staff=${s.id}&tab=timesheets`; }} className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-primary">
                  Review timesheets <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); window.location.href = `/staff?staff=${s.id}&tab=compliance`; }} className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-primary">
                  View compliance <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}