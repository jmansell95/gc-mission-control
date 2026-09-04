import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, Users, UserPlus, CheckCircle2, Mail, Clock, Bell, BellOff, ShieldCheck, Hotel, Truck, KeyRound, Link2, Calendar, IdCard, Loader2, Cake, Fingerprint } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import StaffComplianceEditor from '@/components/staff/StaffComplianceEditor';
import HotelBookingsManager from '@/components/staff/HotelBookingsManager';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import PrintReportButton from '@/components/PrintReportButton';
import { CardGridSkeleton } from '@/components/StateViews';
import StaffShiftEditor from '@/components/StaffShiftEditor';
import StaffFormModal from '@/components/staff/StaffFormModal';
import StaffOnboardingWizard from '@/components/staff/StaffOnboardingWizard';
import AvailabilityCalendar from '@/components/staff/AvailabilityCalendar';
import StaffIDCard from '@/components/staff/StaffIDCard';
import ICalFeedButton from '@/components/staff/ICalFeedButton';
import { formatWorkerType } from '@/utils/format';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const workerBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

import { SYSTEM_ROLES } from '@/utils/access';

const roleBadge = {
  super_admin: 'bg-purple-100 text-purple-700 border border-purple-200',
  admin: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  management: 'bg-blue-100 text-blue-700 border border-blue-200',
  user: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  field: 'bg-amber-100 text-amber-700 border border-amber-200',
  read_only: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const roleLabel = Object.fromEntries(SYSTEM_ROLES.map(r => [r.value, r.label]));

export default function StaffManager() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(null);
  const [shiftOpenId, setShiftOpenId] = useState(null);
  const [complianceStaff, setComplianceStaff] = useState(null);
  const [hotelStaff, setHotelStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showIdCards, setShowIdCards] = useState(false);

  const queryClient = useQueryClient();

  const { data: staff = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [], isLoading: teamsLoading } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list().catch(() => []), enabled: !!isAdmin });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-hotel'], queryFn: () => base44.entities.Job.list() });

  const getUserForStaff = (member) => {
    if (member.user_id) return users.find(u => u.id === member.user_id);
    return users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());
  };

  // Explicitly link a Staff record to its User account (by email) and sync the
  // platform role so permissions resolve correctly. super_admin/admin on the
  // Staff record → User.role 'admin' (full platform admin); anything else → 'user'.
  const linkUserAccount = async (member, opts = {}) => {
    const user = users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase());
    if (!user) {
      if (!opts.silent) toast({ title: 'No matching user account', description: 'Send an app invite first to create their login.', variant: 'destructive' });
      return null;
    }
    try {
      const wantsAdmin = member.system_role === 'admin' || member.system_role === 'super_admin';
      const targetRole = wantsAdmin ? 'admin' : 'user';
      if (member.user_id !== user.id) {
        await base44.entities.Staff.update(member.id, { user_id: user.id });
      }
      if (user.role !== targetRole) {
        try { await base44.entities.User.update(user.id, { role: targetRole }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      if (!opts.silent) toast({ title: 'Account linked', description: `${member.name} is now linked to their login — permissions synced.` });
      return user;
    } catch (err) {
      if (!opts.silent) toast({ title: 'Could not link account', description: err?.message, variant: 'destructive' });
      return null;
    }
  };

  const handleEdit = (m) => { setEditingId(m.id); setShowForm(true); };

  const handleDelete = async (member) => {
    const linkedUser = getUserForStaff(member);
    const msg = linkedUser
      ? `Delete ${member.name}? Their linked user account will also be removed.`
      : `Delete ${member.name}?`;
    if (!confirm(msg)) return;
    try {
      if (linkedUser) {
        await base44.entities.User.delete(linkedUser.id);
        queryClient.invalidateQueries({ queryKey: ['users-list'] });
      }
      await base44.entities.Staff.delete(member.id);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: `${member.name} deleted` });
    } catch (error) {
      toast({ title: 'Could not delete crew member', description: error?.message, variant: 'destructive' });
    }
  };

  const handleInvite = async (member) => {
    setInviteLoading(member.id);
    try {
      // Step 1: Register the user — creates their account and sends an OTP
      // email. This makes them a "registered user" so the branded email
      // can reach them without a custom domain.
      const tempPassword = 'GC' + Math.random().toString(36).slice(2, 10) + '!';
      let registered = false;
      try {
        await base44.auth.register({ email: member.email, password: tempPassword });
        registered = true;
      } catch (regErr) {
        // If they already have an account (e.g. previously invited), skip
        // registration and try sending the branded email directly — they're
        // already a registered user.
        if (!String(regErr?.message || '').match(/already|exists/i)) {
          throw regErr;
        }
        registered = true; // already registered — proceed to branded email
      }

      // Step 2: Send the branded Ground Control invite email with a link to
      // the setup page. Works because the user is now registered.
      let brandedSent = false;
      if (registered) {
        try {
          const res = await base44.functions.invoke('sendBrandedInvite', {
            email: member.email,
            staff_name: member.name,
            temp_password: tempPassword,
          });
          brandedSent = (res.data || res)?.sent === true;
        } catch (_) { /* fall back below */ }
      }

      // Step 3: If the branded email failed for any reason, fall back to the
      // platform invite so the user still gets a working setup link.
      if (!brandedSent) {
        try { await base44.users.inviteUser(member.email, 'user'); } catch (_) {}
      }

      await base44.entities.Staff.update(member.id, { invite_sent: true });
      await queryClient.refetchQueries({ queryKey: ['users-list'] });
      const freshUsers = queryClient.getQueryData(['users-list']) || [];
      const matchedUser = freshUsers.find(u => u.email?.toLowerCase() === member.email.toLowerCase());
      if (matchedUser) {
        try { await base44.entities.Staff.update(member.id, { user_id: matchedUser.id }); } catch (_) {}
        const wantsAdmin = member.system_role === 'admin' || member.system_role === 'super_admin';
        if (matchedUser.role !== (wantsAdmin ? 'admin' : 'user')) {
          try { await base44.entities.User.update(matchedUser.id, { role: wantsAdmin ? 'admin' : 'user' }); } catch (_) {}
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({
        title: brandedSent ? 'Branded invite sent' : 'Invite sent',
        description: brandedSent
          ? `${member.email} — branded Ground Control email sent with a verification link.`
          : `${member.email} — invite sent.${matchedUser ? ' Account linked.' : ''}`,
      });
    } catch (error) {
      toast({ title: 'Could not send invite', description: error?.message || 'User may already have an account', variant: 'destructive' });
    }
    setInviteLoading(null);
  };

  const handleToggleDelivery = async (member) => {
    try {
      await base44.entities.Staff.update(member.id, { delivery_dashboard_enabled: !member.delivery_dashboard_enabled });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: member.delivery_dashboard_enabled ? 'Delivery access removed' : 'Delivery access granted', description: member.name });
    } catch (error) {
      toast({ title: 'Could not update', description: error?.message, variant: 'destructive' });
    }
  };

  const [resetLoading, setResetLoading] = useState(null);

  const handlePasswordReset = async (member) => {
    if (!member.email) {
      toast({ title: 'No email on file', description: 'Add an email address to this crew member first.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Send a password reset link to ${member.email}?`)) return;
    setResetLoading(member.id);
    try {
      await base44.auth.resetPasswordRequest(member.email);
      toast({ title: 'Password reset link sent', description: `Check ${member.email} for instructions.` });
    } catch (error) {
      toast({ title: 'Could not send reset link', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
    setResetLoading(null);
  };

  const buildStaffPrintHtml = () => {
    const rows = staff.map(s =>
      `<tr><td>${s.name}</td><td>${s.email}</td><td>${formatWorkerType(s.worker_type)}</td><td>${teams.find(t => t.id === s.team_id)?.name || '—'}</td><td>${getUserForStaff(s) ? 'Yes' : 'No'}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html><head><title>Crew Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:16px;margin-bottom:4px}p{color:#555;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:6px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafb}@media print{body{margin:10mm}}</style>
    </head><body><h1>Crew Report</h1>
    <p>${staff.length} crew members &nbsp;&middot;&nbsp; Printed ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    <table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Crew</th><th>App Access</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  };

  const resetForm = () => {
    setEditingId(null);
    setShowWizard(true);
  };

  const activeCount = staff.filter(s => getUserForStaff(s)).length;
  const readySsoCount = staff.filter(s => !getUserForStaff(s) && s.email).length;
  const noEmailCount = staff.filter(s => !s.email).length;

  const filteredStaff = staff.filter(member => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = teamFilter === 'all' || member.team_id === teamFilter;
    const matchesWorker = workerFilter === 'all' || member.worker_type === workerFilter;
    return matchesSearch && matchesTeam && matchesWorker;
  });

  return (
    <div>
      <SettingsSectionHeader
        icon={Users}
        title="Manage Crew"
        description={`${staff.length} crew member${staff.length === 1 ? '' : 's'} in total`}
        actions={
          <>
            <button
              onClick={() => setShowAvailability(!showAvailability)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition text-sm font-semibold ${
                showAvailability ? 'bg-[#2E5A1A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'
              }`}
            >
              <Calendar className="w-4 h-4" /> {showAvailability ? 'Back to List' : 'Availability'}
            </button>
            <button
              onClick={() => setShowIdCards(!showIdCards)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition text-sm font-semibold ${
                showIdCards ? 'bg-[#2E5A1A] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'
              }`}
            >
              <IdCard className="w-4 h-4" /> {showIdCards ? 'Back to List' : 'ID Cards'}
            </button>
            <PrintReportButton buildHtml={buildStaffPrintHtml} label="Print" />
            <button onClick={resetForm} className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> Add Crew Member
            </button>
          </>
        }
      />

      {showAvailability && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <AvailabilityCalendar />
        </div>
      )}

      {showIdCards && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <StaffIDCard />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Crew</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">App Access</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Ready for SSO</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{readySsoCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">No Email</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{noEmailCount}</p>
        </div>
      </div>

      {staffLoading || teamsLoading ? (
        <CardGridSkeleton count={6} />
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No crew yet. Add your first crew member above.</div>
      ) : (
        <div className="space-y-5">
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search crew by name or email..."
            showCount
            totalCount={filteredStaff.length}
            filters={[
              {
                value: teamFilter, onChange: setTeamFilter,
                options: [{ value: 'all', label: 'All Crews' }, ...teams.map(t => {
                  const parent = teams.find(p => p.id === t.parent_team_id);
                  return { value: t.id, label: parent ? `${parent.name} — ${t.name}` : t.name };
                })]
              },
              {
                value: workerFilter, onChange: setWorkerFilter,
                options: [
                  { value: 'all', label: 'All Worker Types' },
                  { value: 'direct_employee', label: 'Direct Employee' },
                  { value: 'subcontractor', label: 'Subcontractor' },
                  { value: 'agency', label: 'Agency Worker' },
                ]
              },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStaff.map(member => {
              const linkedUser = getUserForStaff(member);
              return (
                <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{member.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    {!linkedUser && (
                      member.email ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
                          <Mail className="w-3 h-3" /> Ready — log in with Microsoft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium border border-red-200">
                          <Mail className="w-3 h-3" /> No email — add one to enable login
                        </span>
                      )
                    )}
                    {linkedUser && !member.user_id && (
                      <button onClick={() => linkUserAccount(member)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-medium border border-violet-200 hover:bg-violet-100 transition">
                        <Link2 className="w-3 h-3" /> Link account
                      </button>
                    )}
                    {linkedUser && member.user_id && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Linked
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${workerBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>{formatWorkerType(member.worker_type)}</span>
                    {teams.find(t => t.id === member.team_id) && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">{teams.find(t => t.id === member.team_id).name}</span>
                    )}
                    {member.email_notifications_enabled === false && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500 flex items-center gap-1">
                        <BellOff className="w-3 h-3" /> Emails off
                      </span>
                    )}
                    {member.delivery_dashboard_enabled && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 flex items-center gap-1 border border-blue-200">
                        <Truck className="w-3 h-3" /> Driver
                      </span>
                    )}
                    {member.system_role && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[member.system_role] || 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel[member.system_role] || member.system_role}
                      </span>
                    )}
                  </div>

                  {member.manager_id && staff.find(s => s.id === member.manager_id) && (
                    <div className="text-xs text-slate-400 mb-3">Approves to: <span className="text-slate-600 font-medium">{staff.find(s => s.id === member.manager_id).name}</span></div>
                  )}

                  {(member.date_of_birth || member.ni_number) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-3">
                      {member.date_of_birth && (
                        <span className="inline-flex items-center gap-1">
                          <Cake className="w-3 h-3" />
                          DOB: <span className="text-slate-600 font-medium">{format(new Date(member.date_of_birth + 'T00:00:00'), 'dd MMM yyyy')}</span>
                        </span>
                      )}
                      {member.ni_number && (
                        <span className="inline-flex items-center gap-1">
                          <Fingerprint className="w-3 h-3" />
                          NI: <span className="text-slate-600 font-mono font-medium">{member.ni_number}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Schedule acknowledgement status */}
                  {member.last_acknowledged_week ? (
                    <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>Schedule acknowledged: <span className="text-slate-600 font-medium">{format(new Date(member.last_acknowledged_week + 'T00:00:00'), 'dd MMM yyyy')}</span>{member.schedule_acknowledged_at && <span className="text-slate-400"> at {format(new Date(member.schedule_acknowledged_at), 'HH:mm')}</span>}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span>Schedule not yet acknowledged</span>
                    </div>
                  )}

                  <div className="flex gap-1 justify-end mt-auto items-center">
                    <ICalFeedButton staffId={member.id} staffName={member.name} className="mr-1" />
                    <button onClick={() => handleToggleDelivery(member)} className={`p-2 rounded-lg transition ${member.delivery_dashboard_enabled ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`} title="Delivery dashboard access"><Truck className="w-4 h-4" /></button>
                    <button onClick={() => setHotelStaff(member)} className="p-2 rounded-lg transition text-blue-600 hover:bg-blue-50" title="Hotel bookings"><Hotel className="w-4 h-4" /></button>
                    <button onClick={() => setComplianceStaff(member)} className="p-2 rounded-lg transition text-emerald-600 hover:bg-emerald-50" title="Compliance"><ShieldCheck className="w-4 h-4" /></button>
                    <button onClick={() => setShiftOpenId(shiftOpenId === member.id ? null : member.id)} className={`p-2 rounded-lg transition ${shiftOpenId === member.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-100'}`} title="Shift times"><Clock className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(member)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(member)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {shiftOpenId === member.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">Shift times</p>
                      <StaffShiftEditor staffId={member.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Crew Member — guided per-business-stream onboarding wizard */}
      <StaffOnboardingWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        teams={teams}
        vehicles={vehicles}
        staffList={staff}
      />

      {/* Edit existing Crew Member — standardised FormModal popup */}
      <StaffFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); }}
        editing={editingId}
        staff={editingId ? staff.find(s => s.id === editingId) : null}
        teams={teams}
        vehicles={vehicles}
        staffList={staff}
      />

      {/* Compliance Editor Sheet */}
      <Sheet open={!!complianceStaff} onOpenChange={(open) => !open && setComplianceStaff(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              {complianceStaff?.name}'s Compliance
            </SheetTitle>
          </SheetHeader>
          {complianceStaff && <StaffComplianceEditor staffId={complianceStaff.id} staffName={complianceStaff.name} />}
        </SheetContent>
      </Sheet>

      {/* Hotel Bookings Sheet */}
      <Sheet open={!!hotelStaff} onOpenChange={(open) => !open && setHotelStaff(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Hotel className="w-5 h-5 text-blue-600" />
              {hotelStaff?.name}'s Hotel Bookings
            </SheetTitle>
          </SheetHeader>
          {hotelStaff && <HotelBookingsManager staffId={hotelStaff.id} staffName={hotelStaff.name} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}