import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/lib/AuthContext';
import {
  Building2, Users, Briefcase, PoundSterling, ArrowRight, ArrowLeft,
  UserCog, LogOut, HelpCircle, Shield, Crown, Mail, Phone, Calendar,
  TrendingUp, ClipboardCheck, Truck, Sparkles,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import EnterpriseProfileEditDrawer from '@/components/enterprise/EnterpriseProfileEditDrawer';

/**
 * Enterprise Profile — a global, cross-division profile view shown when the
 * user is at the enterprise level (no active division). Unlike StaffProfile,
 * which is scoped to a single division, this page shows enterprise-wide
 * identity, role, managed divisions, and cross-division stats.
 */
export default function EnterpriseProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { divisions, permittedDivisions, setActiveDivision, isSuperAdmin, isDirector, isEnterpriseAdmin } = useDivision();
  const [showEditDrawer, setShowEditDrawer] = useState(false);

  // Clear division context on mount — this is an enterprise-level page.
  useEffect(() => { setActiveDivision(null); }, [setActiveDivision]);

  const { data: myProfile } = useQuery({
    queryKey: ['ent-profile-my-staff'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const { data: staff = [] } = useQuery({ queryKey: ['ent-profile-staff'], queryFn: () => base44.entities.Staff.list('-created_date', 5000) });
  const { data: jobs = [] } = useQuery({ queryKey: ['ent-profile-jobs'], queryFn: () => base44.entities.Job.list('-created_date', 5000) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['ent-profile-vehicles'], queryFn: () => base44.entities.Vehicle.list('-created_date', 5000) });
  const { data: invoices = [] } = useQuery({ queryKey: ['ent-profile-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 500) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['ent-profile-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });

  const displayName = myProfile?.name || user?.full_name || user?.email || 'User';
  const displayAvatar = myProfile?.avatar_url || null;
  const displayEmail = user?.email || myProfile?.email || '';
  const displayPhone = myProfile?.phone || '';

  const roleLabel = isSuperAdmin ? 'Super Admin' : isDirector ? 'Director' : isEnterpriseAdmin ? 'Enterprise Admin' : 'User';

  const enterDivision = (d) => {
    setActiveDivision(d.id);
    const landing = d.landing_page || '/admin';
    navigate(landing, { state: { section: 'overview' } });
  };

  const globalStats = {
    divisions: permittedDivisions.length,
    activeDivisions: permittedDivisions.filter(d => d.status === 'active').length,
    staff: staff.filter(s => permittedDivisions.some(d => d.id === s.division_id)).length,
    activeJobs: jobs.filter(j => permittedDivisions.some(d => d.id === j.division_id) && (j.status || 'planning') === 'in_progress').length,
    vehicles: vehicles.filter(v => permittedDivisions.some(d => d.id === v.division_id)).length,
    pendingTs: timesheets.filter(t => staff.some(s => s.id === t.staff_id && permittedDivisions.some(d => d.id === s.division_id)) && t.status === 'submitted').length,
    totalOutstanding: invoices.filter(i => i.status && i.status !== 'paid' && i.status !== 'void').reduce((sum, i) => sum + (i.gross_total || 0), 0),
  };

  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

  const statTiles = [
    { label: 'Business Streams', value: globalStats.divisions, sub: globalStats.activeDivisions + ' active', icon: Building2, gradient: 'stat-gradient-emerald' },
    { label: 'Total Crew', value: globalStats.staff, sub: 'across all divisions', icon: Users, gradient: 'stat-gradient-blue' },
    { label: 'Active Jobs', value: globalStats.activeJobs, sub: 'in progress', icon: Briefcase, gradient: 'stat-gradient-amber' },
    { label: 'Fleet', value: globalStats.vehicles, sub: 'vehicles', icon: Truck, gradient: 'stat-gradient-violet' },
    { label: 'Ts Queue', value: globalStats.pendingTs, sub: 'awaiting approval', icon: ClipboardCheck, gradient: 'stat-gradient-rose' },
    { label: 'Outstanding', value: gbp(globalStats.totalOutstanding), sub: 'unpaid invoices', icon: PoundSterling, gradient: 'stat-gradient-indigo' },
  ];

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />
      {/* Desktop top bar — visible only on lg+ since EnterpriseHeader is mobile-only */}
      <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/enterprise')} type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition">
              <ArrowLeft className="w-4 h-4" /> Enterprise
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">My Profile</span>
          </div>
        </div>
      </div>
      <div className="px-4 pt-5 pb-24 lg:pt-8 lg:px-8 lg:pb-10 space-y-5 max-w-5xl mx-auto">
        {/* Back link + title */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 touch-manipulation">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        {/* Identity card — responsive mobile / tablet / desktop */}
        <section className="insight-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-6">
          {/* Mobile (<640px) — stacked, compact avatar */}
          <div className="sm:hidden">
            <div className="flex items-center gap-3">
              <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={56} />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight truncate">{displayName}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm mt-1">
                  {isSuperAdmin ? <Crown className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
                  {roleLabel}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-2">Enterprise-level access — all divisions</p>
            <div className="flex flex-col gap-1.5 mt-2">
              {displayEmail && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> <span className="truncate">{displayEmail}</span>
                </div>
              )}
              {displayPhone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> <span className="truncate">{displayPhone}</span>
                </div>
              )}
            </div>
            <button onClick={() => setShowEditDrawer(true)} type="button"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-95 touch-manipulation mt-3">
              <UserCog className="w-4 h-4" /> Edit Profile
            </button>
          </div>

          {/* Tablet (640px+) & Desktop (1024px+) — horizontal layout */}
          <div className="hidden sm:flex items-start gap-4">
            <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={72} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight truncate">{displayName}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm">
                  {isSuperAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium mt-1">Enterprise-level access — all divisions</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
                {displayEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" /> <span className="truncate">{displayEmail}</span>
                  </div>
                )}
                {displayPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" /> <span className="truncate">{displayPhone}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setShowEditDrawer(true)} type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-95 touch-manipulation flex-shrink-0">
              <UserCog className="w-4 h-4" /> Edit
            </button>
          </div>
        </section>

        {/* Enterprise stats */}
        <section className="insight-card rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Enterprise Overview</h2>
              <p className="text-xs text-slate-500">Live rollup across every division you manage</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
            {statTiles.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.label} className={t.gradient + ' rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white relative overflow-hidden shadow-md'}>
                  <div className="absolute right-2 top-2 opacity-20"><Icon className="w-7 h-7 sm:w-8 sm:h-8" /></div>
                  <div className="relative">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mb-1.5 sm:mb-2">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{t.label}</p>
                    <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tabular-nums">{t.value}</p>
                    <p className="text-[10px] text-white/70 mt-0.5 truncate">{t.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Managed divisions */}
        <section>
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Your Business Streams</h2>
              <p className="text-xs text-slate-500">Tap a division to enter its workspace</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {permittedDivisions.map(d => {
              const divColor = d.color || '#2E5A1A';
              const dStaff = staff.filter(s => s.division_id === d.id);
              const dJobs = jobs.filter(j => j.division_id === d.id);
              const activeJobs = dJobs.filter(j => (j.status || 'planning') === 'in_progress').length;
              return (
                <button key={d.id} onClick={() => enterDivision(d)}
                  className="insight-card relative rounded-2xl overflow-hidden text-left group">
                  <div className="h-16 px-4 flex items-center gap-3" style={{ background: 'linear-gradient(90deg, ' + divColor + ', ' + divColor + '99)' }}>
                    <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-white truncate drop-shadow-sm">{d.name}</h3>
                      <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wide">{d.code}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-base font-extrabold text-slate-900 tabular-nums">{dStaff.filter(s => s.is_active !== false).length}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Crew</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-base font-extrabold text-slate-900 tabular-nums">{activeJobs}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Active</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-base font-extrabold text-slate-900 tabular-nums">{dJobs.length}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Jobs</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
                        Enter <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quick links */}
        <section className="insight-card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/enterprise/help')} type="button"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-95 touch-manipulation">
            <HelpCircle className="w-4 h-4" /> Help Guides
          </button>
          <button onClick={() => navigate('/enterprise')} type="button"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-95 touch-manipulation">
            <Sparkles className="w-4 h-4" /> Enterprise Dashboard
          </button>
          <button onClick={() => base44.auth.logout('/')} type="button"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-semibold transition active:scale-95 touch-manipulation ml-auto">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </section>
      </div>

      {/* Edit Profile Drawer — self-contained enterprise drawer, no division dependency */}
      <EnterpriseProfileEditDrawer open={showEditDrawer} onOpenChange={setShowEditDrawer} staff={myProfile} />
    </div>
  );
}