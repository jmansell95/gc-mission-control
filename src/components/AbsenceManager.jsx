import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarX, Plus, CheckCircle2, XCircle, Trash2, Repeat, Clock, Users,
  CalendarDays, Power, Sparkles, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchableStaffSelect from '@/components/SearchableStaffSelect';
import CompanyHolidaysSettings from '@/components/settings/CompanyHolidaysSettings';

const reasonConfig = {
  holiday: { label: 'Holiday', badge: 'bg-blue-100 text-blue-700' },
  sick: { label: 'Sick Leave', badge: 'bg-red-100 text-red-700' },
  personal: { label: 'Personal', badge: 'bg-purple-100 text-purple-700' },
  training: { label: 'Training', badge: 'bg-amber-100 text-amber-700' },
  weekend: { label: 'Weekend', badge: 'bg-slate-200 text-slate-700' },
  other: { label: 'Other', badge: 'bg-slate-100 text-slate-600' }
};

const statusConfig = {
  pending: { label: 'Pending', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' }
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AbsenceManager() {
  const [tab, setTab] = useState('requests');
  const [showForm, setShowForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({ staff_id: '', start_date: '', end_date: '', reason: 'holiday', notes: '' });
  const [recurringForm, setRecurringForm] = useState({ staff_id: '', days_of_week: [], label: 'Weekends', reason: 'weekend' });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [expandedStaff, setExpandedStaff] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list('-created_date', 100) });
  const { data: allStaffRaw = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  // Only direct employees accrue holiday pay and appear in absence management —
  // subcontractor firms, agency-supplied labour, and other non-payroll staff are excluded.
  const staff = allStaffRaw.filter(s => s.worker_type === 'direct_employee');
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });

  // Keep the Absence Accrual tab in sync — recalculate accruals whenever an
  // absence is created, approved, rejected, or deleted so days_taken matches.
  const recalcAccruals = async () => {
    try {
      await base44.functions.invoke('calculateHolidayAccruals', {});
      queryClient.invalidateQueries({ queryKey: ['holiday-accruals'] });
    } catch (e) { console.error('Accrual recalc failed:', e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.Absence.create({ ...formData, status: 'pending' });
    setFormData({ staff_id: '', start_date: '', end_date: '', reason: 'holiday', notes: '' });
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['absences'] });
    recalcAccruals();
  };

  const handleApprove = async (id) => {
    const absence = absences.find(a => a.id === id);
    if (!absence) return;
    // Prevent approving a request that overlaps an existing approved absence
    // for the same staff member (the concurrent-leave bug).
    const overlap = absences.find(a =>
      a.id !== id &&
      a.staff_id === absence.staff_id &&
      a.status === 'approved' &&
      a.start_date && a.end_date &&
      a.start_date <= absence.end_date && a.end_date >= absence.start_date
    );
    if (overlap) {
      if (!confirm(`This leave overlaps an existing approved absence (${overlap.start_date} → ${overlap.end_date}). Approve anyway? The overlapping dates will have duplicate leave records.`)) return;
    }
    await base44.entities.Absence.update(id, { status: 'approved' });
    // Replace existing shifts with leave so the absence fully replaces any scheduled shifts
    try {
      await base44.functions.invoke('replaceShiftsWithLeave', {
        staff_id: absence.staff_id,
        start_date: absence.start_date,
        end_date: absence.end_date,
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (e) {
      console.error('Failed to replace shifts with leave:', e);
    }
    queryClient.invalidateQueries({ queryKey: ['absences'] });
    recalcAccruals();
  };
  const handleReject = async (id) => { await base44.entities.Absence.update(id, { status: 'rejected' }); queryClient.invalidateQueries({ queryKey: ['absences'] }); recalcAccruals(); };
  const handleDelete = async (id) => { await base44.entities.Absence.delete(id); queryClient.invalidateQueries({ queryKey: ['absences'] }); recalcAccruals(); };

  const toggleDay = (d) => {
    setRecurringForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d].sort()
    }));
  };

  const handleRecurringSubmit = async (e) => {
    e.preventDefault();
    if (!recurringForm.staff_id || recurringForm.days_of_week.length === 0) return;
    await base44.entities.RecurringAbsence.create({
      staff_id: recurringForm.staff_id,
      days_of_week: recurringForm.days_of_week,
      label: recurringForm.label || 'Day Off',
      reason: recurringForm.reason,
      is_active: true
    });
    setRecurringForm({ staff_id: '', days_of_week: [], label: 'Weekends', reason: 'weekend' });
    setShowRecurringForm(false);
    queryClient.invalidateQueries({ queryKey: ['recurring-absences'] });
  };

  const handleRecurringDelete = async (id) => { await base44.entities.RecurringAbsence.delete(id); queryClient.invalidateQueries({ queryKey: ['recurring-absences'] }); };
  const handleRecurringToggle = async (r) => { await base44.entities.RecurringAbsence.update(r.id, { is_active: !r.is_active }); queryClient.invalidateQueries({ queryKey: ['recurring-absences'] }); };

  const handleBulkWeekends = async () => {
    const withWeekends = staff.filter(s => !recurring.some(r => r.staff_id === s.id && Array.isArray(r.days_of_week) && r.days_of_week.includes(0) && r.days_of_week.includes(6)));
    if (withWeekends.length === 0) { alert('All staff already have weekends off set up.'); return; }
    if (!confirm(`Add weekends (Sat & Sun) off for ${withWeekends.length} staff member${withWeekends.length === 1 ? '' : 's'}?\n\nThis will show on every week's rota automatically.`)) return;
    setBulkLoading(true);
    try {
      await base44.entities.RecurringAbsence.bulkCreate(
        withWeekends.map(s => ({ staff_id: s.id, days_of_week: [0, 6], label: 'Weekends', reason: 'weekend', is_active: true }))
      );
      queryClient.invalidateQueries({ queryKey: ['recurring-absences'] });
    } catch (e) { console.error(e); alert('Could not add weekends for all staff.'); }
    setBulkLoading(false);
  };

  const validAbsences = absences.filter(a => staff.some(s => s.id === a.staff_id));
  const pendingCount = validAbsences.filter(a => a.status === 'pending').length;
  const today = format(new Date(), 'yyyy-MM-dd');
  const onLeaveToday = validAbsences.filter(a => a.status === 'approved' && a.start_date <= today && a.end_date >= today);
  const activeRecurring = recurring.filter(r => r.is_active !== false);

  const filteredAbsences = validAbsences.filter(a => statusFilter === 'all' || a.status === statusFilter);

  const requestsByStaff = staff.map(s => ({
    staff: s,
    items: filteredAbsences.filter(a => a.staff_id === s.id)
  })).filter(x => x.items.length > 0);

  const toggleStaffExpand = (id) => {
    setExpandedStaff(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recurringByStaff = staff.map(s => ({
    staff: s,
    items: recurring.filter(r => r.staff_id === s.id)
  })).filter(x => x.items.length > 0);

  return (
    <div>
      <SettingsSectionHeader icon={CalendarX} title="Absence Management" description="Approve leave requests and recurring days off" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full stat-gradient-amber opacity-10" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl stat-gradient-amber flex items-center justify-center mb-2.5">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{pendingCount}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Pending Requests</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full stat-gradient-blue opacity-10" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl stat-gradient-blue flex items-center justify-center mb-2.5">
              <Users className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{onLeaveToday.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">On Leave Today</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full stat-gradient-violet opacity-10" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl stat-gradient-violet flex items-center justify-center mb-2.5">
              <Repeat className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{activeRecurring.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Recurring Days Off</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full stat-gradient-brand opacity-10" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center mb-2.5">
              <CalendarX className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{validAbsences.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total Requests</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5 border-b border-slate-200">
        <button onClick={() => setTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === 'requests' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CalendarDays className="w-4 h-4" /> Requests
        </button>
        <button onClick={() => setTab('recurring')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === 'recurring' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Repeat className="w-4 h-4" /> Recurring Days Off
        </button>
        <button onClick={() => setTab('holidays')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === 'holidays' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CalendarDays className="w-4 h-4" /> Company Holidays
        </button>
      </div>

      {/* REQUESTS TAB */}
      {tab === 'requests' && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'pending', 'approved', 'rejected'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${statusFilter === f ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium">
              <Plus className="w-4 h-4" /> Log Absence
            </button>
          </div>

          <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setFormData({ staff_id: '', start_date: '', end_date: '', reason: 'holiday', notes: '' }); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Log Absence</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
                    <SearchableStaffSelect staff={staff} value={formData.staff_id} onChange={(id) => setFormData({ ...formData, staff_id: id })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                    <select value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                      {Object.entries(reasonConfig).filter(([k]) => k !== 'weekend').map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                    <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                    <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                    <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm">Submit Request</button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {requestsByStaff.length === 0 ? (
            <div className="hub-glass rounded-2xl p-10 text-center text-slate-400 text-sm">
              No absence requests{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
            </div>
          ) : (
            <div className="space-y-3">
              {requestsByStaff.map(({ staff: s, items }) => {
                const pendingN = items.filter(a => a.status === 'pending').length;
                const isExpanded = expandedStaff.has(s.id);
                const nextUp = items
                  .filter(a => a.status === 'pending' || (a.status === 'approved' && a.end_date >= today))
                  .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
                return (
                  <div key={s.id} className="hub-glass rounded-2xl overflow-hidden">
                    <button onClick={() => toggleStaffExpand(s.id)}
                      className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition text-left">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{s.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm truncate">{s.name}</p>
                        <p className="text-xs text-slate-500">
                          {items.length} request{items.length !== 1 ? 's' : ''}
                          {nextUp && <span className="text-slate-400"> · Next: {format(new Date(nextUp.start_date + 'T00:00:00'), 'dd MMM')} → {format(new Date(nextUp.end_date + 'T00:00:00'), 'dd MMM')}</span>}
                        </p>
                      </div>
                      {pendingN > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex-shrink-0">
                          {pendingN} pending
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-slate-50 border-t border-slate-100">
                        {items.map(a => {
                          const reason = reasonConfig[a.reason] || reasonConfig.other;
                          const status = statusConfig[a.status] || statusConfig.pending;
                          return (
                            <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <CalendarX className="w-3.5 h-3.5 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{format(new Date(a.start_date + 'T00:00:00'), 'dd MMM')} → {format(new Date(a.end_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                                  {a.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reason.badge}`}>{reason.label}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>{status.label}</span>
                                {a.status === 'pending' && (
                                  <>
                                    <button onClick={() => handleApprove(a.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleReject(a.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject"><XCircle className="w-4 h-4" /></button>
                                  </>
                                )}
                                <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RECURRING TAB */}
      {tab === 'recurring' && (
        <div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Repeat className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Recurring days off appear on every week's rota automatically</p>
              <p className="text-xs text-slate-500 mt-0.5">Set regular days off (e.g. weekends) once — they'll show on the rota grid every week without re-entering them.</p>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button onClick={handleBulkWeekends} disabled={bulkLoading || staff.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50">
                <Sparkles className="w-4 h-4" /> {bulkLoading ? 'Adding…' : 'Add Weekends for All Staff'}
              </button>
            </div>
            <button onClick={() => setShowRecurringForm(!showRecurringForm)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Recurring Day Off
            </button>
          </div>

          <Dialog open={showRecurringForm} onOpenChange={(open) => { setShowRecurringForm(open); if (!open) setRecurringForm({ staff_id: '', days_of_week: [], label: 'Weekends', reason: 'weekend' }); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Recurring Day Off</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRecurringSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
                    <SearchableStaffSelect staff={staff} value={recurringForm.staff_id} onChange={(id) => setRecurringForm({ ...recurringForm, staff_id: id })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                    <input type="text" value={recurringForm.label} onChange={e => setRecurringForm({ ...recurringForm, label: e.target.value })}
                      placeholder="e.g. Weekends, Regular Day Off"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Days Off (repeats every week) *</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, d) => (
                      <button type="button" key={d} onClick={() => toggleDay(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${recurringForm.days_of_week.includes(d) ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-[#5A8C1E]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={!recurringForm.staff_id || recurringForm.days_of_week.length === 0}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setShowRecurringForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {recurringByStaff.length === 0 ? (
            <div className="hub-glass rounded-2xl p-10 text-center text-slate-400 text-sm">
              No recurring days off set up yet. Use “Add Weekends for All Staff” to set everyone up in one click, or add a custom pattern per staff member.
            </div>
          ) : (
            <div className="space-y-3">
              {recurringByStaff.map(({ staff: s, items }) => (
                <div key={s.id} className="hub-glass rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-xs">{s.name.charAt(0)}</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {items.map(r => {
                      const reason = reasonConfig[r.reason] || reasonConfig.other;
                      const days = (r.days_of_week || []).slice().sort().map(d => DAY_LABELS[d]).join(', ');
                      return (
                        <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-3">
                            <Power className={`w-4 h-4 flex-shrink-0 ${r.is_active !== false ? 'text-emerald-500' : 'text-slate-300'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{r.label || 'Day Off'} <span className="text-slate-400 font-normal">· {days}</span></p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${reason.badge}`}>{reason.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => handleRecurringToggle(r)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition" title={r.is_active !== false ? 'Pause' : 'Resume'}>
                              <Power className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleRecurringDelete(r.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            )}
            </div>
            )}

            {/* COMPANY HOLIDAYS TAB */}
            {tab === 'holidays' && (
            <CompanyHolidaysSettings />
            )}
            </div>
            );
            }