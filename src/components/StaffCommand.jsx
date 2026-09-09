import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Users, Search, Plus, ShieldCheck, GraduationCap, CalendarDays, Hotel, User,
  Mail, Bell, BellOff, Truck, KeyRound, CheckCircle2, Clock, Trash2, Loader2,
  UserPlus, X, Save, Phone, Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import BulkInviteModal from '@/components/staff/BulkInviteModal';
import StaffComplianceEditor from '@/components/staff/StaffComplianceEditor';
import HotelBookingsManager from '@/components/staff/HotelBookingsManager';
import StaffShiftEditor from '@/components/StaffShiftEditor';
import { useConfigLists } from '@/hooks/useConfigLists';
import { formatWorkerType } from '@/utils/format';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { complianceDaysUntil } from '@/utils/complianceDate';
import { CardGridSkeleton } from '@/components/StateViews';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 text-sm transition";

// Maps a permission group to the platform user role needed for RLS.
// Only "Super Admin" / "Admin" groups need platform-level admin; everything
// else gets "user" and relies on the permission group for granular UI access.
const groupToPlatformRole = (groupId, groups) => {
  if (!groupId || !groups) return 'user';
  const g = groups.find(g => g.id === groupId);
  if (!g) return 'user';
  return (g.name === 'Super Admin' || g.name === 'Admin') ? 'admin' : 'user';
};

const TABS = [
  { id: 'profile', label: 'Profile & Access', icon: User },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'schedule', label: 'Schedule & Shifts', icon: CalendarDays },
  { id: 'bookings', label: 'Hotel Bookings', icon: Hotel },
];

const emptyStaff = { name: '', email: '', phone: '', worker_type: 'direct_employee', team_id: '', default_vehicle_id: '', manager_id: '', email_notifications_enabled: true, delivery_dashboard_enabled: false };

export default function StaffCommand() {
  const { toast } = useToast();
  const { getOptions } = useConfigLists();
  const workerTypeOptions = getOptions('worker_types');
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState('profile');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyStaff);
  const [adding, setAdding] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(null);

  const [showBulkInvite, setShowBulkInvite] = useState(false);

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: permissionGroups = [] } = useQuery({ queryKey: ['permission-groups'], queryFn: () => base44.entities.PermissionGroup.list('-created_date', 100) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => base44.entities.User.list().catch(() => []), enabled: !!isAdmin });
  const { data: compliance = [] } = useQuery({ queryKey: ['compliance-items'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }) });
  const { data: trainingBookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: courses = [] } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['all-rota-assignments'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const getUserForStaff = (m) => users.find(u => u.email?.toLowerCase() === m.email?.toLowerCase());
  const teamName = (id) => { const t = teams.find(t => t.id === id); if (!t) return '—'; const p = teams.find(p => p.id === t.parent_team_id); return p ? `${p.name} — ${t.name}` : t.name; };

  const filtered = useMemo(() => staff.filter(m => {
    const ms = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const mt = teamFilter === 'all' || m.team_id === teamFilter;
    return ms && mt;
  }), [staff, search, teamFilter]);

  // Auto-select first staff member
  React.useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = staff.find(s => s.id === selectedId);
  const selectedUser = selected ? getUserForStaff(selected) : null;
  const selectedCompliance = selected ? compliance.filter(c => c.reference_id === selected.id || c.reference_name === selected.name) : [];
  const selectedTraining = selected ? trainingBookings.filter(t => t.staff_id === selected.id) : [];
  const selectedAssignments = selected ? assignments.filter(a => a.staff_id === selected.id).sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date)).slice(0, 8) : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      const payload = { ...addForm };
      ['default_vehicle_id', 'manager_id', 'team_id', 'permission_group_id'].forEach(k => { if (payload[k] === '') delete payload[k]; });
      const created = await base44.entities.Staff.create(payload);
      if (addForm.email) {
        try {
          const inviteRole = groupToPlatformRole(addForm.permission_group_id, permissionGroups);
          await base44.users.inviteUser(addForm.email, inviteRole);
          await base44.entities.Staff.update(created.id, { invite_sent: true });
        } catch (err) { /* non-fatal */ }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setShowAdd(false);
      setAddForm(emptyStaff);
      setSelectedId(created.id);
      setTab('profile');
      toast({ title: 'Crew member added' });
    } catch (err) {
      toast({ title: 'Could not add', description: err?.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleInvite = async (m) => {
    if (!m.email) { toast({ title: 'No email on file', variant: 'destructive' }); return; }
    setInviteLoading(m.id);
    try {
      const role = groupToPlatformRole(m.permission_group_id, permissionGroups);
      await base44.users.inviteUser(m.email, role);
      await base44.entities.Staff.update(m.id, { invite_sent: true });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'App invite sent', description: m.email });
    } catch (err) {
      toast({ title: 'Could not send invite', description: err?.message, variant: 'destructive' });
    }
    setInviteLoading(null);
  };

  const handleDelete = async (m) => {
    const linked = getUserForStaff(m);
    if (!confirm(`Delete ${m.name}?${linked ? ' Their user account will also be removed.' : ''}`)) return;
    try {
      if (linked) { await base44.entities.User.delete(linked.id); queryClient.invalidateQueries({ queryKey: ['users-list'] }); }
      await base44.entities.Staff.delete(m.id);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setSelectedId(null);
      toast({ title: `${m.name} deleted` });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Staff Command</h2>
            <p className="text-sm text-slate-400">{staff.length} crew members · manage everything in one place</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBulkInvite(true)} className="inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-semibold">
            <UserPlus className="w-4 h-4" /> Bulk Invite
          </button>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Add Crew Member
          </button>
        </div>
      </div>

      {showBulkInvite && <BulkInviteModal onClose={() => setShowBulkInvite(false)} />}

      <div>
        {/* Staff list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" className={`${inputCls} pl-9`} />
            </div>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={inputCls}>
              <option value="all">All Crews</option>
              {teams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
            </select>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {isLoading ? <CardGridSkeleton count={4} /> : filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No crew found.</p>
            ) : filtered.map(m => {
              const linked = getUserForStaff(m);
              const isSel = m.id === selectedId;
              return (
                <button key={m.id} onClick={() => { setSelectedId(m.id); setDetailOpen(true); }} className={`w-full text-left flex items-center gap-3 px-3 py-3 border-b border-slate-50 transition ${isSel ? 'bg-[#2E5A1A]/5 border-l-[3px] border-l-[#2E5A1A]' : 'hover:bg-slate-50'}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">{m.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-400 truncate">{teamName(m.team_id)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${linked ? 'bg-emerald-100 text-emerald-700' : m.invite_sent ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {linked ? 'Active' : m.invite_sent ? 'Awaiting' : 'No invite'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Sheet — slide-out panel for editing a crew member */}
      <Sheet open={detailOpen && !!selected} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{selected?.name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-lg truncate">{selected?.name}</p>
                <p className="text-sm text-slate-400 truncate">{selected?.email}</p>
              </div>
              {selectedUser ? (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : selected?.invite_sent ? (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200 flex-shrink-0">
                  <Mail className="w-3 h-3" /> Awaiting
                </span>
              ) : (
                <button onClick={() => handleInvite(selected)} disabled={inviteLoading === selected?.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50 flex-shrink-0">
                  <UserPlus className="w-3 h-3" /> {inviteLoading === selected?.id ? 'Sending…' : 'Send invite'}
                </button>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${active ? 'border-[#2E5A1A] text-[#2E5A1A]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <Icon className="w-4 h-4" /> {t.label}
                  {t.id === 'compliance' && selectedCompliance.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">{selectedCompliance.length}</span>}
                  {t.id === 'training' && selectedTraining.length > 0 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded-full">{selectedTraining.length}</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="py-4">
            {tab === 'profile' && selected && (
              <ProfileTab staff={selected} user={selectedUser} teams={teams} permissionGroups={permissionGroups} vehicles={vehicles} staffList={staff} workerTypeOptions={workerTypeOptions}
                onInvite={() => handleInvite(selected)} inviteLoading={inviteLoading === selected.id}
                onDelete={() => handleDelete(selected)} />
            )}
            {tab === 'compliance' && selected && (
              <div>
                <ComplianceSummary items={selectedCompliance} />
                <StaffComplianceEditor staffId={selected.id} staffName={selected.name} />
              </div>
            )}
            {tab === 'training' && selected && (
              <TrainingTab bookings={selectedTraining} courses={courses} staffId={selected.id} staffName={selected.name} />
            )}
            {tab === 'schedule' && selected && (
              <ScheduleTab assignments={selectedAssignments} jobs={jobs} staffId={selected.id} />
            )}
            {tab === 'bookings' && selected && (
              <HotelBookingsManager staffId={selected.id} staffName={selected.name} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add Crew Member</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input required type="text" placeholder="Full name *" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className={inputCls} />
              <input required type="email" placeholder="Email *" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} className={inputCls} />
              <input type="tel" placeholder="Phone (optional)" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} className={inputCls} />
              <select value={addForm.worker_type} onChange={e => setAddForm({ ...addForm, worker_type: e.target.value })} className={inputCls}>
                {workerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select required value={addForm.team_id} onChange={e => setAddForm({ ...addForm, team_id: e.target.value })} className={inputCls}>
                <option value="">Select crew *</option>
                {teams.map(t => <option key={t.id} value={t.id}>{teamName(t.id)}</option>)}
              </select>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-700 font-medium">Access managed at enterprise level via Settings → Access Levels.</p>
              </div>
              <button type="submit" disabled={adding} className="w-full px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50 flex items-center justify-center gap-2">
                {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Save className="w-4 h-4" /> Add & Send Invite</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ staff: m, user, teams, permissionGroups, vehicles, staffList, workerTypeOptions, onInvite, inviteLoading, onDelete }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(m);
  const [saving, setSaving] = useState(false);

  // Re-sync when the selected staff member changes
  React.useEffect(() => { setForm(m); }, [m]);

  const clean = (d) => {
    const c = { ...d };
    ['default_vehicle_id', 'manager_id', 'team_id', 'permission_group_id'].forEach(k => { if (c[k] === '') delete c[k]; });
    return c;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const original = m;
      if (original.email && original.email.toLowerCase() !== (form.email || '').toLowerCase()) {
        form.invite_sent = false;
      }
      await base44.entities.Staff.update(m.id, clean(form));
      // Sync platform user role from the assigned permission group
      if (user && form.permission_group_id !== m.permission_group_id) {
        const newRole = groupToPlatformRole(form.permission_group_id, permissionGroups);
        if (newRole !== user.role) {
          await base44.entities.User.update(user.id, { role: newRole });
          queryClient.invalidateQueries({ queryKey: ['users-list'] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Profile updated' });
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggle = async (key) => {
    const newVal = !m[key];
    setForm(prev => ({ ...prev, [key]: newVal }));
    try {
      await base44.entities.Staff.update(m.id, { [key]: newVal });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['my-staff-profile'] });
    } catch (err) {
      setForm(prev => ({ ...prev, [key]: !newVal }));
      toast({ title: 'Could not update', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name"><input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} /></Field>
        <Field label="Email"><input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} required className={inputCls} /></Field>
        <Field label="Phone"><input type="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
        <Field label="Worker Type">
          <select value={form.worker_type || 'direct_employee'} onChange={e => setForm({ ...form, worker_type: e.target.value })} className={inputCls}>
            {workerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Crew">
          <select value={form.team_id || ''} onChange={e => setForm({ ...form, team_id: e.target.value })} className={inputCls}>
            <option value="">Select crew</option>
            {teams.map(t => { const p = teams.find(p => p.id === t.parent_team_id); return <option key={t.id} value={t.id}>{p ? `${p.name} — ${t.name}` : t.name}</option>; })}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-700 font-medium">Access permissions are managed at the enterprise level via Settings → Access Levels. Assign this crew member to a group or crew from there.</p>
          </div>
        </div>
        <Field label="Default Vehicle">
          <select value={form.default_vehicle_id || ''} onChange={e => setForm({ ...form, default_vehicle_id: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
          </select>
        </Field>
        <Field label="Timesheet Manager">
          <select value={form.manager_id || ''} onChange={e => setForm({ ...form, manager_id: e.target.value })} className={inputCls}>
            <option value="">None (Admin approves)</option>
            {staffList.filter(s => s.id !== m.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-3 pt-2">
        <ToggleChip active={form.email_notifications_enabled !== false} onClick={() => toggle('email_notifications_enabled')} icon={form.email_notifications_enabled === false ? BellOff : Bell} label="Schedule emails" />
        <ToggleChip active={!!form.delivery_dashboard_enabled} onClick={() => toggle('delivery_dashboard_enabled')} icon={Truck} label="Delivery dashboard" />
      </div>

      {/* App access status */}
      {user && (
        <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-slate-700">App account active</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
        </button>
        <button type="button" onClick={onInvite} disabled={inviteLoading} className="inline-flex items-center gap-1.5 px-3 py-2 text-blue-700 bg-blue-50 rounded-lg text-sm font-medium hover:bg-blue-100 transition disabled:opacity-50">
          {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Send App Invite
        </button>
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition ml-auto">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
    </form>
  );
}

function TrainingTab({ bookings, courses, staffId, staffName }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusColor = { booked: 'bg-blue-50 text-blue-700', attended: 'bg-slate-100 text-slate-600', passed: 'bg-emerald-50 text-emerald-700', failed: 'bg-red-50 text-red-700', rebooked: 'bg-amber-50 text-amber-700' };

  if (bookings.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No training booked yet. Use the Training Manager to book a course for {staffName}.</p>;
  }
  return (
    <div className="space-y-2">
      {bookings.map(b => {
        const course = courses.find(c => c.id === b.course_id);
        return (
          <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-[#2E5A1A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{course?.name || 'Training course'}</p>
              <p className="text-xs text-slate-400">{course?.date ? format(new Date(course.date + 'T00:00'), 'dd MMM yyyy') : ''} {course?.location ? `· ${course.location}` : ''}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[b.status] || 'bg-slate-100'}`}>{b.status}</span>
            {b.certificate_url && <a href={b.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2E5A1A] hover:underline">View cert</a>}
          </div>
        );
      })}
    </div>
  );
}

function ScheduleTab({ assignments, jobs, staffId }) {
  if (assignments.length === 0) {
    return (
      <div>
        <p className="text-sm text-slate-400 text-center py-6 mb-4">No assignments yet.</p>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Shift times</p>
          <StaffShiftEditor staffId={staffId} />
        </div>
      </div>
    );
  }
  const statusColor = { assigned: 'bg-slate-100 text-slate-600', started: 'bg-amber-50 text-amber-700', completed: 'bg-emerald-50 text-emerald-700' };
  return (
    <div>
      <div className="space-y-2 mb-4">
        {assignments.map(a => {
          const job = jobs.find(j => j.id === a.job_id);
          return (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
              <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{job?.name || 'Unknown job'}</p>
                <p className="text-xs text-slate-400">{format(new Date(a.assigned_date + 'T00:00'), 'EEE dd MMM')} {a.start_time ? `· ${a.start_time}${a.end_time ? `–${a.end_time}` : ''}` : ''}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[a.status] || 'bg-slate-100'}`}>{a.status}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Default shift times</p>
        <StaffShiftEditor staffId={staffId} />
      </div>
    </div>
  );
}

function ComplianceSummary({ items }) {
  if (items.length === 0) return null;
  const expired = items.filter(i => i.expiry_date && i.status_override === 'auto' && (complianceDaysUntil(i.expiry_date) ?? 0) < 0);
  const expiring = items.filter(i => { const d = complianceDaysUntil(i.expiry_date); return i.expiry_date && i.status_override === 'auto' && d !== null && d >= 0 && d <= 30; });
  if (expired.length === 0 && expiring.length === 0) return null;
  return (
    <div className={`rounded-lg px-3 py-2.5 mb-4 text-sm ${expired.length > 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
      {expired.length > 0 && <p className="font-medium">{expired.length} expired item{expired.length > 1 ? 's' : ''}</p>}
      {expiring.length > 0 && <p className="font-medium">{expiring.length} expiring within 30 days</p>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? 'bg-[#2E5A1A]/10 text-[#2E5A1A] border-[#2E5A1A]/30' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
      <Icon className="w-3.5 h-3.5" /> {label} {active ? 'on' : 'off'}
    </button>
  );
}