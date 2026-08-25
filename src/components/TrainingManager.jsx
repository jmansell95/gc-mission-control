import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, GraduationCap, Calendar, Clock, MapPin, Users, X, Edit2, Trash2, ArrowLeft, CheckCircle2, XCircle, UserPlus, Phone } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import TrainingOutcomeModal from '@/components/TrainingOutcomeModal';
import PendingReviewQueue from '@/components/training/PendingReviewQueue';

const CATEGORIES = [
  { value: 'cscs_card', label: 'CSCS Card' },
  { value: 'cpcs_card', label: 'CPCS Card' },
  { value: 'npors_card', label: 'NPORS Card' },
  { value: 'first_aid_cert', label: 'First Aid Certificate' },
  { value: 'driver_license', label: 'Driver Licence' },
  { value: 'dbs_certificate', label: 'DBS Certificate' },
  { value: 'forklift', label: 'Forklift Training' },
  { value: 'other', label: 'Other Training' },
];

const BOOKING_STATUS = {
  booked: { label: 'Booked', color: 'bg-blue-100 text-blue-700' },
  attended: { label: 'Attended', color: 'bg-violet-100 text-violet-700' },
  passed: { label: 'Passed', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  rebooked: { label: 'Rebooked', color: 'bg-amber-100 text-amber-700' },
};

const emptyCourse = {
  title: '', category: 'other', provider: '', provider_phone: '',
  venue: '', address: '', start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(new Date(), 'yyyy-MM-dd'), start_time: '08:00', end_time: '16:00',
  description: '', default_expiry_months: ''
};

export default function TrainingManager() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyCourse);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [outcomeBooking, setOutcomeBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const handleCourseSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.TrainingCourse.update(editingId, { ...formData, default_expiry_months: formData.default_expiry_months ? parseInt(formData.default_expiry_months) : null });
      } else {
        await base44.entities.TrainingCourse.create({ ...formData, default_expiry_months: formData.default_expiry_months ? parseInt(formData.default_expiry_months) : null });
      }
      queryClient.invalidateQueries({ queryKey: ['training-courses'] });
      toast({ title: editingId ? 'Course updated' : 'Course created' });
      setFormData(emptyCourse); setShowForm(false); setEditingId(null);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (c) => { setFormData({ ...emptyCourse, ...c, default_expiry_months: c.default_expiry_months || '' }); setEditingId(c.id); setShowForm(true); };

  const handleDeleteCourse = async (id) => {
    if (!confirm('Delete this training course? Booked staff will remain but lose the link.')) return;
    await base44.entities.TrainingCourse.delete(id);
    queryClient.invalidateQueries({ queryKey: ['training-courses'] });
    setSelectedCourse(null);
    toast({ title: 'Course deleted' });
  };

  const handleAddStaff = async () => {
    setSaving(true);
    try {
      const existing = bookings.filter(b => b.course_id === selectedCourse.id).map(b => b.staff_id);
      const toAdd = selectedStaffIds.filter(sid => !existing.includes(sid));
      if (toAdd.length === 0) {
        toast({ title: 'No new staff to add', description: 'These staff are already booked on this course.' });
        setSaving(false); return;
      }
      const created = await base44.entities.TrainingBooking.bulkCreate(
        toAdd.map(sid => {
          const s = staff.find(st => st.id === sid);
          return { course_id: selectedCourse.id, staff_id: sid, staff_name: s?.name || '', status: 'booked' };
        })
      );
      // Notify each newly booked staff member
      const createdArray = Array.isArray(created) ? created : [created];
      for (const b of createdArray) {
        try { await base44.functions.invoke('notifyTrainingBooking', { booking_id: b.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast({ title: `${toAdd.length} staff booked`, description: 'They have been notified by email.' });
      setShowAddStaff(false); setSelectedStaffIds([]);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRemoveBooking = async (bookingId) => {
    if (!confirm('Remove this staff member from the course?')) return;
    await base44.entities.TrainingBooking.delete(bookingId);
    queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
    toast({ title: 'Staff removed from course' });
  };

  const handleMarkAttended = async (bookingId) => {
    await base44.entities.TrainingBooking.update(bookingId, { status: 'attended' });
    queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
  };

  // COURSE DETAIL VIEW
  if (selectedCourse) {
    const courseBookings = bookings.filter(b => b.course_id === selectedCourse.id);
    const upcoming = isFuture(new Date(selectedCourse.start_date + 'T00:00:00'));
    const unbookedStaff = staff.filter(s => s.is_active !== false && !courseBookings.some(b => b.staff_id === s.id));

    return (
      <div>
        <button onClick={() => setSelectedCourse(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{selectedCourse.title}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{CATEGORIES.find(c => c.value === selectedCourse.category)?.label || 'Training'}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => handleEdit(selectedCourse)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDeleteCourse(selectedCourse.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-slate-700 font-medium">{format(new Date(selectedCourse.start_date + 'T00:00:00'), 'dd MMM yyyy')}{selectedCourse.end_date && selectedCourse.end_date !== selectedCourse.start_date ? ` – ${format(new Date(selectedCourse.end_date + 'T00:00:00'), 'dd MMM')}` : ''}</p>
              </div>
            </div>
            {selectedCourse.start_time && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Time</p>
                  <p className="text-slate-700 font-medium">{selectedCourse.start_time}{selectedCourse.end_time ? ` – ${selectedCourse.end_time}` : ''}</p>
                </div>
              </div>
            )}
            {selectedCourse.venue && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Venue</p>
                  <p className="text-slate-700 font-medium truncate">{selectedCourse.venue}</p>
                </div>
              </div>
            )}
            {selectedCourse.provider && (
              <div className="flex items-center gap-2 text-sm">
                <GraduationCap className="w-4 h-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Provider</p>
                  <p className="text-slate-700 font-medium truncate">{selectedCourse.provider}</p>
                </div>
              </div>
            )}
          </div>
          {selectedCourse.address && <p className="text-sm text-slate-500 mt-3"><MapPin className="w-4 h-4 inline mr-1" />{selectedCourse.address}</p>}
          {selectedCourse.provider_phone && (
            <a href={`tel:${selectedCourse.provider_phone}`} className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium mt-2 hover:underline">
              <Phone className="w-4 h-4" />{selectedCourse.provider_phone}
            </a>
          )}
          {selectedCourse.description && <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded-lg p-3">{selectedCourse.description}</p>}
        </div>

        {/* Booked staff */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Booked Staff ({courseBookings.length})</h2>
            </div>
            {unbookedStaff.length > 0 && (
              <button onClick={() => setShowAddStaff(!showAddStaff)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
                <UserPlus className="w-4 h-4" /> Add Staff
              </button>
            )}
          </div>

          {showAddStaff && (
            <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Select staff to book onto this course:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {unbookedStaff.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                    <input type="checkbox" checked={selectedStaffIds.includes(s.id)} onChange={e => {
                      setSelectedStaffIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                    }} className="w-4 h-4 accent-emerald-600" />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleAddStaff} disabled={saving || selectedStaffIds.length === 0} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">
                  {saving ? 'Booking…' : `Book ${selectedStaffIds.length} Staff`}
                </button>
                <button onClick={() => { setShowAddStaff(false); setSelectedStaffIds([]); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
              </div>
            </div>
          )}

          {courseBookings.length === 0 ? (
            <EmptyState icon={Users} title="No staff booked yet" message="Add staff to this course using the button above." />
          ) : (
            <div className="space-y-2">
              {courseBookings.map(b => {
                const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.booked;
                const s = staff.find(st => st.id === b.staff_id);
                return (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-600">
                      {b.staff_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{b.staff_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </div>
                      {b.status === 'failed' && b.failure_reason && <p className="text-xs text-red-500 mt-0.5 truncate">Reason: {b.failure_reason}</p>}
                      {b.status === 'passed' && b.certificate_title && <p className="text-xs text-emerald-600 mt-0.5 truncate">Certificate: {b.certificate_title}</p>}
                      {b.status === 'rebooked' && <p className="text-xs text-amber-600 mt-0.5">Rebooked onto another course</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {upcoming && b.status === 'booked' && (
                        <button onClick={() => handleMarkAttended(b.id)} className="text-xs px-2.5 py-1.5 bg-violet-100 text-violet-700 rounded-lg font-medium hover:bg-violet-200 transition">Mark Attended</button>
                      )}
                      {b.status === 'attended' && (
                        <button onClick={() => setOutcomeBooking(b)} className="text-xs px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 transition">Record Outcome</button>
                      )}
                      {(b.status === 'booked' || b.status === 'attended') && (
                        <button onClick={() => setOutcomeBooking(b)} className="text-xs px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition">Outcome</button>
                      )}
                      {b.status === 'failed' && (
                        <button onClick={() => setOutcomeBooking(b)} className="text-xs px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition">Rebook / Edit</button>
                      )}
                      <button onClick={() => handleRemoveBooking(b.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {outcomeBooking && (
          <TrainingOutcomeModal
            booking={outcomeBooking}
            course={selectedCourse}
            courses={courses}
            onClose={() => setOutcomeBooking(null)}
          />
        )}
      </div>
    );
  }

  // COURSE LIST VIEW
  const upcomingCourses = courses.filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'));
  const pastCourses = courses.filter(c => isPast(new Date(c.start_date + 'T00:00:00')) && c.start_date !== format(new Date(), 'yyyy-MM-dd'));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Training Courses</h2>
          <p className="text-sm text-slate-500">Book external training, track outcomes and upload certificates</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyCourse); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> New Course
        </button>
      </div>

      <PendingReviewQueue />

      {showForm && (
        <form onSubmit={handleCourseSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Course' : 'New Training Course'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Course Title *</label>
              <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required placeholder="e.g. Forklift Operator Training"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Certificate Validity (months)</label>
              <input type="number" value={formData.default_expiry_months} onChange={e => setFormData({ ...formData, default_expiry_months: e.target.value })} placeholder="e.g. 36"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Training Provider</label>
              <input type="text" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider Phone</label>
              <input type="text" value={formData.provider_phone} onChange={e => setFormData({ ...formData, provider_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Venue Name</label>
              <input type="text" value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Venue Address</label>
              <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
              <input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Daily Start Time</label>
              <input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Daily End Time</label>
              <input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description / Notes</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'} Course
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={GraduationCap} title="No training courses yet" message="Create a course to book staff onto external training. When they pass, certificates are added to their compliance wallet." />
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingCourses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Upcoming ({upcomingCourses.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcomingCourses.map(c => {
                  const courseBookings = bookings.filter(b => b.course_id === c.id);
                  const passedCount = courseBookings.filter(b => b.status === 'passed').length;
                  return (
                    <button key={c.id} onClick={() => setSelectedCourse(c)} className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition active:scale-[0.99]">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-sm truncate">{c.title}</p>
                          <p className="text-xs text-slate-500">{CATEGORIES.find(cat => cat.value === c.category)?.label || 'Training'}</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy')}{c.end_date !== c.start_date ? ` – ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}</p>
                        {c.start_time && <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{c.start_time}{c.end_time ? ` – ${c.end_time}` : ''}</p>}
                        {c.venue && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{c.venue}</p>}
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600">{courseBookings.length} booked</span>
                        {passedCount > 0 && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{passedCount} passed</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {pastCourses.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">Past Courses ({pastCourses.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-70">
                {pastCourses.map(c => {
                  const courseBookings = bookings.filter(b => b.course_id === c.id);
                  return (
                    <button key={c.id} onClick={() => setSelectedCourse(c)} className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition active:scale-[0.99]">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-700 text-sm truncate">{c.title}</p>
                          <p className="text-xs text-slate-400">{format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{courseBookings.length} staff attended</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}