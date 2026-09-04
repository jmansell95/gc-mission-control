import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HardHat, Sparkles, LayoutDashboard, ClipboardCheck, CalendarPlus, X, Clock,
  Wrench, ShieldCheck, Users, UserCog, UserCircle, TrendingUp, Trophy, ClipboardList,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import TimesheetHistory from '@/components/staff/TimesheetHistory';
import StaffWeeklySignCard from '@/components/timesheets/StaffWeeklySignCard';
import StaffBookings from '@/components/staff/StaffBookings';
import ProfileStats from '@/components/staff/ProfileStats';
import ComplianceWallet from '@/components/staff/ComplianceWallet';
import TeamMiniFeed from '@/components/staff/TeamMiniFeed';
import ManagerTimesheetApprovals from '@/components/ManagerTimesheetApprovals';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useAuth } from '@/lib/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { resolveRole, isOfficeStaff } from '@/utils/access';
import StaffProfileEditDrawer from '@/components/staff/StaffProfileEditDrawer';
import StaffPerformanceCard from '@/components/staff/StaffPerformanceCard';
import StaffPerformanceCharts from '@/components/staff/StaffPerformanceCharts';
import IncentiveDashboard from '@/components/staff/IncentiveDashboard';
import RewardsCatalogue from '@/components/staff/RewardsCatalogue';
import TrainingTab from '@/components/staff/TrainingTab';
import NoCrewProfileState from '@/components/staff/NoCrewProfileState';
import AutoTimesheetStatus from '@/components/staff/AutoTimesheetStatus';
import TrackingSettings from '@/components/staff/TrackingSettings';
import TrackingConsentModal from '@/components/staff/TrackingConsentModal';
import StaffMovementTimeline from '@/components/staff/StaffMovementTimeline';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import FieldPageShell from '@/components/field/FieldPageShell';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';

const ABSENCE_REASONS = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

const TABS = [
  { key: 'performance', label: 'Performance', icon: TrendingUp },
  { key: 'earnings', label: 'Earnings', icon: Trophy },
  { key: 'timesheets', label: 'Timesheets', icon: ClipboardList },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'crew', label: 'My Crew', icon: Users },
];

export default function StaffProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { openChat } = useStaffAssistant();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState('compliance');
  const [absenceForm, setAbsenceForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd'), reason: 'holiday', notes: '' });
  const [savingAbsence, setSavingAbsence] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const targetStaffId = location.state?.staffId || null;
  const viewingOther = !!targetStaffId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (targetStaffId) {
        try {
          const list = await base44.entities.Staff.filter({ id: targetStaffId });
          const s = list[0];
          if (cancelled) return;
          if (s) {
            let team = null;
            if (s.team_id) {
              try { const teams = await base44.entities.Team.filter({ id: s.team_id }); team = teams[0] || null; } catch (_) {}
            }
            setStaff({
              id: s.id,
              name: s.name,
              email: s.email || '',
              avatar_url: s.avatar_url || null,
              team_id: s.team_id || null,
              team: team ? { id: team.id, name: team.name, job_type: team.job_type || null, category: team.category || null } : null,
              is_admin: false,
              permission_group: null,
              system_role: s.system_role || 'field',
              no_staff_profile: false,
              is_other: true,
            });
          } else {
            setStaff(null);
          }
        } catch (e) {
          if (!cancelled) setStaff(null);
        } finally { if (!cancelled) setLoading(false); }
      } else {
        try {
          const res = await base44.functions.invoke('getMyStaffProfile');
          if (cancelled) return;
          if (res.data?.id || res.data?.is_admin) {
            setStaff(res.data);
          } else if (isPlatformAdmin) {
            setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true });
          }
        } catch (e) {
          if (cancelled) return;
          if (isPlatformAdmin) {
            setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true });
          }
        } finally { if (!cancelled) setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [targetStaffId]);

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: mgrTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: absences = [] } = useQuery({
    queryKey: ['my-absences', staff?.id],
    queryFn: () => base44.entities.Absence.filter({ staff_id: staff.id }, '-start_date', 20),
    enabled: !!staff?.id
  });

  const reporters = staff ? allStaff.filter(s => s.manager_id === staff.id) : [];
  const pendingCount = mgrTimesheets.filter(t => reporters.some(r => r.id === t.staff_id) && t.status === 'submitted').length;
  const upcomingAbsences = absences.filter(a => new Date(a.end_date + 'T00:00:00') >= new Date() && a.status !== 'rejected');

  const handleCreateCrewProfile = async () => {
    setCreatingProfile(true);
    try {
      const res = await base44.functions.invoke('ensureMyStaffProfile');
      if (res.data?.id) setStaff(res.data);
      toast({ title: 'Crew profile created', description: 'You can now track your own performance, incentives and timesheets.' });
    } catch (e) {
      toast({ title: 'Error creating profile', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleSaveAbsence = async () => {
    if (!absenceForm.start_date || !absenceForm.end_date) return;
    setSavingAbsence(true);
    try {
      await base44.entities.Absence.create({ staff_id: staff.id, ...absenceForm, status: 'pending' });
      try { await base44.functions.invoke('notifyAbsenceRequest', { staff_id: staff.id, ...absenceForm }); } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ['my-absences', staff.id] });
      toast({ title: 'Time off requested', description: 'Your manager will review this request.' });
      setShowAbsenceForm(false);
      setAbsenceForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd'), reason: 'holiday', notes: '' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setSavingAbsence(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8faf9' }}>
        <div className="w-12 h-12 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6" style={{ background: '#f8faf9' }}>
        <div className="text-center max-w-sm bg-white rounded-3xl shadow-sm p-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">No crew profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your supervisor to get set up.</p>
        </div>
      </div>
    );
  }

  const role = resolveRole(staff, staff.is_admin);
  const roleLabel = staff.permission_group?.name || (role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null);
  const canAccessAdmin = isOfficeStaff(staff, staff.is_admin);
  const noProfile = !staff.id;

  return (
    <FieldPageShell
      title="My Profile"
      subtitle={`${staff.name}${staff.team?.name ? ' · ' + staff.team.name : ''}`}
      icon={UserCircle}
      fixedHeader
      onBack={() => navigate(-1)}
      actions={
        <button onClick={() => setShowEditDrawer(true)} type="button"
          className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center transition active:scale-95 touch-manipulation hover:shadow-md">
          <UserCog className="w-4 h-4 text-slate-600" />
        </button>
      }
    >
      <DivisionIdentityBar />
      <RedAlertBanner />

      {/* ── Clean Canvas: soft off-white background, white cards ── */}
      <div style={{ background: '#f8faf9' }}>
        {/* Compact white hero card */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 pt-4">
          <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-4">
              <ProfileAvatar name={staff.name} avatarUrl={staff.avatar_url} size={64} />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight break-words">{staff.name}</h1>
                <p className="text-slate-500 text-sm font-medium mt-0.5">
                  {roleLabel || staff.team?.name || 'Crew Member'}
                </p>
              </div>
            </div>

            {/* Quick action pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {canAccessAdmin && (
                <button onClick={() => navigate('/admin')} type="button"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E5A1A] text-white text-sm font-semibold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0 hover:bg-[#1c4a12]">
                  <LayoutDashboard className="w-4 h-4" /> Admin
                </button>
              )}
              {!viewingOther && (<>
              <button onClick={() => setShowAbsenceForm(true)} type="button"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0 hover:bg-slate-200">
                <CalendarPlus className="w-4 h-4" /> Time Off
              </button>
              {reporters.length > 0 && (
                <button onClick={() => setShowApprovals(true)} type="button"
                  className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0 hover:bg-slate-200">
                  <ClipboardCheck className="w-4 h-4" /> Approvals
                  {pendingCount > 0 && <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{pendingCount}</span>}
                </button>
              )}
              <button onClick={openChat} type="button"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0 hover:bg-slate-200">
                <Sparkles className="w-4 h-4" /> Assistant
              </button>
              </>)}
            </div>
          </div>
        </div>

        {/* Quick Stats — 2x2 grid of white cards */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-3">
          <ProfileStats staffId={staff.id} jobType={staff.team?.job_type} />
        </div>

        {/* Zero-touch timesheet status — shows today's auto-built timesheet */}
        {!viewingOther && staff?.id && (
          <div className="max-w-4xl mx-auto px-4 md:px-6 mt-3">
            <AutoTimesheetStatus staffId={staff.id} />
          </div>
        )}

        {/* Today's GPS movements — geofence timeline + breadcrumb trail */}
        {staff?.id && (
          <div className="max-w-4xl mx-auto px-4 md:px-6 mt-3">
            <StaffMovementTimeline staffId={staff.id} staffName={staff.name} />
          </div>
        )}

        {/* Scrollable single-line tab bar */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-5">
          <div className="md:grid md:grid-cols-5 md:gap-1.5">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar md:contents">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const disabled = tab.key === 'crew' && !staff.team_id;
                return (
                  <button key={tab.key} onClick={() => !disabled && setActiveTab(tab.key)} type="button" disabled={disabled}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition touch-manipulation flex-shrink-0 whitespace-nowrap ${
                      isActive ? 'bg-[#2E5A1A] text-white shadow-sm' :
                      disabled ? 'bg-slate-100 text-slate-300' :
                      'bg-white text-slate-600 shadow-sm hover:bg-slate-50'
                    }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content — white rounded cards on off-white background */}
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
          {activeTab === 'performance' && (staff.id
            ? <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <StaffPerformanceCard staffId={staff.id} />
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <StaffPerformanceCharts staffId={staff.id} staffName={staff.name} />
                </div>
              </div>
            : <NoCrewProfileState tab="performance" onGoAdmin={() => navigate('/admin')} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}
          {activeTab === 'earnings' && (staff.id
            ? <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <IncentiveDashboard staffId={staff.id} staffName={staff.name} teamId={staff.team_id} />
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <RewardsCatalogue staffId={staff.id} staffName={staff.name} />
                </div>
              </div>
            : <NoCrewProfileState tab="earnings" onGoAdmin={() => navigate('/admin')} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}
          {activeTab === 'timesheets' && (staff.id ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                <StaffWeeklySignCard staffId={staff.id} staffName={staff.name} />
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                <TimesheetHistory staffId={staff.id} />
              </div>
              {upcomingAbsences.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-900">Upcoming Time Off</h2>
                  </div>
                  <div className="space-y-2">
                    {upcomingAbsences.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700 font-medium capitalize">{a.reason}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{format(new Date(a.start_date + 'T00:00:00'), 'dd MMM')} – {format(new Date(a.end_date + 'T00:00:00'), 'dd MMM')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-auto ${
                          a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-900">Bookings History</h2>
                </div>
                <StaffBookings staffId={staff.id} />
              </div>
            </div>
          ) : <NoCrewProfileState tab="timesheets" onGoAdmin={() => navigate('/admin')} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}
          {activeTab === 'compliance' && (staff.id
            ? <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <TrainingTab staffId={staff.id} staffName={staff.name} teamId={staff.team_id} canManageTeam={canAccessAdmin || isPlatformAdmin} />
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                  <ComplianceWallet staffId={staff.id} staffName={staff.name} />
                </div>
                {!viewingOther && (
                  <TrackingSettings staff={staff} onSignConsent={() => setShowConsentModal(true)} />
                )}
              </div>
            : <NoCrewProfileState tab="compliance" onGoAdmin={() => navigate('/admin')} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}
          {activeTab === 'crew' && (staff.team_id
            ? <div className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
                <TeamMiniFeed teamId={staff.team_id} currentStaffId={staff.id} />
              </div>
            : <NoCrewProfileState tab="crew" onGoAdmin={() => navigate('/admin')} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}
        </div>
      </div>

      {/* Approvals Sheet */}
      <Sheet open={showApprovals} onOpenChange={setShowApprovals}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              Timesheet Approvals
            </SheetTitle>
          </SheetHeader>
          <ManagerTimesheetApprovals staffId={staff.id} />
        </SheetContent>
      </Sheet>

      {/* Edit Profile Drawer */}
      <StaffProfileEditDrawer open={showEditDrawer} onOpenChange={setShowEditDrawer} staff={staff} />

      {/* Absence Request Modal — full-screen on mobile */}
      {showAbsenceForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center" onClick={() => !savingAbsence && setShowAbsenceForm(false)}>
          <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-md sm:rounded-2xl sm:shadow-xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Request Time Off</h3>
              <button onClick={() => setShowAbsenceForm(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition touch-manipulation">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                  <input type="date" value={absenceForm.start_date} onChange={e => setAbsenceForm({ ...absenceForm, start_date: e.target.value })}
                    className="w-full px-3 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                  <input type="date" value={absenceForm.end_date} min={absenceForm.start_date} onChange={e => setAbsenceForm({ ...absenceForm, end_date: e.target.value })}
                    className="w-full px-3 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                <select value={absenceForm.reason} onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full px-3 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  {ABSENCE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                <textarea value={absenceForm.notes} onChange={e => setAbsenceForm({ ...absenceForm, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </div>
              <button onClick={handleSaveAbsence} disabled={savingAbsence || !absenceForm.start_date || !absenceForm.end_date}
                className="w-full px-4 py-3 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-semibold disabled:opacity-50 touch-manipulation active:scale-95">
                {savingAbsence ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GPS Tracking Consent Modal — opened from the tracking settings card */}
      {showConsentModal && (
        <TrackingConsentModal
          open={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          onDecline={() => setShowConsentModal(false)}
          staff={staff}
        />
      )}
    </FieldPageShell>
  );
}