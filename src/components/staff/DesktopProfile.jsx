import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  UserCircle, ShieldCheck, GraduationCap, ClipboardList, TrendingUp,
  Pencil, Loader2, Mail, Phone, Briefcase, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import StaffProfileEditDrawer from '@/components/staff/StaffProfileEditDrawer';
import ComplianceWallet from '@/components/staff/ComplianceWallet';
import TrainingTab from '@/components/staff/TrainingTab';
import StaffWeeklySignCard from '@/components/timesheets/StaffWeeklySignCard';
import TimesheetHistory from '@/components/staff/TimesheetHistory';
import StaffBookings from '@/components/staff/StaffBookings';
import StaffPerformanceCard from '@/components/staff/StaffPerformanceCard';
import StaffPerformanceCharts from '@/components/staff/StaffPerformanceCharts';
import RolePerformanceDashboard from '@/components/staff/RolePerformanceDashboard';
import IncentiveDashboard from '@/components/staff/IncentiveDashboard';
import RewardsCatalogue from '@/components/staff/RewardsCatalogue';
import ProfileStats from '@/components/staff/ProfileStats';
import NoCrewProfileState from '@/components/staff/NoCrewProfileState';
import SelfServiceHub from '@/components/staff/SelfServiceHub';
import { resolveRole } from '@/utils/access';
import { FileText } from 'lucide-react';

const SECTIONS = [
  { key: 'overview', label: 'Personal Details', icon: UserCircle },
  { key: 'compliance', label: 'Compliance Wallet', icon: ShieldCheck },
  { key: 'training', label: 'Training', icon: GraduationCap },
  { key: 'timesheets', label: 'Timesheets', icon: ClipboardList },
  { key: 'performance', label: 'Performance & Incentives', icon: TrendingUp },
  { key: 'requests', label: 'My Requests', icon: FileText },
];

export default function DesktopProfile() {
  const location = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

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
              id: s.id, name: s.name, email: s.email || '', avatar_url: s.avatar_url || null,
              phone: s.phone || '', job_title: s.job_title || '',
              team_id: s.team_id || null, team: team ? { id: team.id, name: team.name, job_type: team.job_type || null } : null,
              is_admin: false, permission_group: null, system_role: s.system_role || 'field',
              no_staff_profile: false, is_other: true,
            });
          } else { setStaff(null); }
        } catch (e) { if (!cancelled) setStaff(null); }
        finally { if (!cancelled) setLoading(false); }
      } else {
        try {
          const res = await base44.functions.invoke('getMyStaffProfile');
          if (cancelled) return;
          if (res.data?.id || res.data?.is_admin) setStaff(res.data);
          else if (isPlatformAdmin) setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true });
        } catch (e) {
          if (cancelled) return;
          if (isPlatformAdmin) setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true });
        } finally { if (!cancelled) setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [targetStaffId]);

  const { data: absences = [] } = useQuery({
    queryKey: ['my-absences', staff?.id],
    queryFn: () => base44.entities.Absence.filter({ staff_id: staff.id }, '-start_date', 20),
    enabled: !!staff?.id
  });
  const upcomingAbsences = absences.filter(a => new Date(a.end_date + 'T00:00:00') >= new Date() && a.status !== 'rejected');

  const handleCreateCrewProfile = async () => {
    setCreatingProfile(true);
    try {
      const res = await base44.functions.invoke('ensureMyStaffProfile');
      if (res.data?.id) setStaff(res.data);
      toast({ title: 'Crew profile created', description: 'You can now track your own performance, incentives and timesheets.' });
    } catch (e) {
      toast({ title: 'Error creating profile', description: e.message, variant: 'destructive' });
    } finally { setCreatingProfile(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm hub-glass rounded-2xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-700 font-bold text-lg">No profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your administrator to get set up.</p>
        </div>
      </div>
    );
  }

  const role = resolveRole(staff, staff.is_admin);
  const roleLabel = staff.permission_group?.name || (role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null);
  const noProfile = !staff.id;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ── Hero Header ── */}
      <div className="hub-glass rounded-2xl p-5 md:p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <ProfileAvatar name={staff.name} avatarUrl={staff.avatar_url} size={72} />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight break-words">{staff.name}</h1>
              <p className="text-slate-500 text-sm font-medium mt-0.5">
                {roleLabel || staff.team?.name || 'Staff Member'}
              </p>
              {staff.team?.name && (
                <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> {staff.team.name}
                </p>
              )}
            </div>
          </div>
          {!viewingOther && (
            <button onClick={() => setShowEditDrawer(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition active:scale-95 shadow-sm">
              <Pencil className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>

        {/* Contact pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {staff.email && (
            <a href={`mailto:${staff.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {staff.email}
            </a>
          )}
          {staff.phone && (
            <a href={`tel:${staff.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> {staff.phone}
            </a>
          )}
          {staff.job_title && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E5A1A]/5 border border-[#2E5A1A]/15 text-xs font-medium text-[#2E5A1A]">
              <Briefcase className="w-3.5 h-3.5" /> {staff.job_title}
            </span>
          )}
        </div>
      </div>

      {/* ── Quick Stats Row ── */}
      {staff.id && (
        <div className="mb-4">
          <ProfileStats staffId={staff.id} jobType={staff.team?.job_type} />
        </div>
      )}

      {/* ── Sidebar + Content Layout ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="hub-glass rounded-2xl p-2 lg:sticky lg:top-4">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {SECTIONS.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                      isActive
                        ? 'bg-[#2E5A1A] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Personal Details */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Full Name</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{staff.name || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</label>
                    <p className="text-sm font-medium text-slate-800 mt-1 break-words">{staff.email || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Phone</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{staff.phone || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Job Title</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{staff.job_title || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Crew / Team</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{staff.team?.name || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Access Level</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{roleLabel || '—'}</p>
                  </div>
                </div>
              </div>

              {upcomingAbsences.length > 0 && (
                <div className="hub-glass rounded-2xl p-5 md:p-6">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" /> Upcoming Time Off
                  </h2>
                  <div className="space-y-2">
                    {upcomingAbsences.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
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
            </div>
          )}

          {/* Compliance Wallet */}
          {activeSection === 'compliance' && (staff.id ? (
            <div className="hub-glass rounded-2xl p-5 md:p-6">
              <ComplianceWallet staffId={staff.id} staffName={staff.name} />
            </div>
          ) : <NoCrewProfileState tab="compliance" onGoAdmin={null} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}

          {/* Training */}
          {activeSection === 'training' && (staff.id ? (
            <div className="hub-glass rounded-2xl p-5 md:p-6">
              <TrainingTab staffId={staff.id} staffName={staff.name} teamId={staff.team_id} canManageTeam={isPlatformAdmin} />
            </div>
          ) : <NoCrewProfileState tab="training" onGoAdmin={null} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}

          {/* Timesheets */}
          {activeSection === 'timesheets' && (staff.id ? (
            <div className="space-y-4">
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <StaffWeeklySignCard staffId={staff.id} staffName={staff.name} />
              </div>
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Timesheet History</h2>
                <TimesheetHistory staffId={staff.id} />
              </div>
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Bookings History</h2>
                <StaffBookings staffId={staff.id} />
              </div>
            </div>
          ) : <NoCrewProfileState tab="timesheets" onGoAdmin={null} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}

          {/* Performance & Incentives */}
          {activeSection === 'performance' && (staff.id ? (
            <div className="space-y-4">
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <RolePerformanceDashboard staffId={staff.id} staffName={staff.name} jobTitle={staff.job_title} />
              </div>
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <StaffPerformanceCharts staffId={staff.id} staffName={staff.name} />
              </div>
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <IncentiveDashboard staffId={staff.id} staffName={staff.name} teamId={staff.team_id} />
              </div>
              <div className="hub-glass rounded-2xl p-5 md:p-6">
                <RewardsCatalogue staffId={staff.id} staffName={staff.name} />
              </div>
            </div>
          ) : <NoCrewProfileState tab="performance" onGoAdmin={null} onCreateProfile={isPlatformAdmin ? handleCreateCrewProfile : null} creating={creatingProfile} />)}

          {/* My Requests — Self-service hub (holiday, expense, payslip, shift swap, messages) */}
          {activeSection === 'requests' && (staff.id ? (
            <SelfServiceHub
              staff={staff}
              divisionId={staff.division_id}
              isManager={isPlatformAdmin}
              initialTab="requests"
            />
          ) : (
            <div className="hub-glass rounded-2xl p-5 md:p-6">
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">No crew profile</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">Create your crew profile to submit and manage requests.</p>
                {isPlatformAdmin && (
                  <button onClick={handleCreateCrewProfile} disabled={creatingProfile}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition active:scale-95 disabled:opacity-50">
                    {creatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Create Crew Profile
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Drawer */}
      <StaffProfileEditDrawer open={showEditDrawer} onOpenChange={setShowEditDrawer} staff={staff} />
    </div>
  );
}