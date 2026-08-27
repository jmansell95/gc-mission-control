import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, GraduationCap, Calendar, Clock, MapPin, Users, Edit2, Trash2, ArrowLeft, CheckCircle2, UserPlus, Building2, BookOpen, Sparkles, Settings } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import TrainingOutcomeModal from '@/components/TrainingOutcomeModal';
import PendingReviewQueue from '@/components/training/PendingReviewQueue';
import CourseFormModal from '@/components/training/CourseFormModal';
import AddStaffToCourseModal from '@/components/training/AddStaffToCourseModal';
import { ViewHeader, PRIMARY_BTN, SECONDARY_BTN } from '@/components/training/TrainingHubRail';

const BOOKING_STATUS = {
  booked: { label: 'Booked', color: 'bg-blue-100 text-blue-700' },
  attended: { label: 'Attended', color: 'bg-violet-100 text-violet-700' },
  passed: { label: 'Passed', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  rebooked: { label: 'Rebooked', color: 'bg-amber-100 text-amber-700' },
};

export default function TrainingManager({ onBulkImport, onManage }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [outcomeBooking, setOutcomeBooking] = useState(null);

  const { data: courses = [], isLoading } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });
  const { data: bookings = [] } = useQuery({ queryKey: ['training-bookings'], queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: requirements = [] } = useQuery({ queryKey: ['training-requirements'], queryFn: () => base44.entities.TrainingRequirement.list('sort_order', 100) });
  const { data: providers = [] } = useQuery({ queryKey: ['training-providers'], queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }) });

  const categoryLabel = useMemo(() => {
    const m = {};
    requirements.forEach(r => { m[r.qualification_type] = r.label; });
    return m;
  }, [requirements]);
  const providerName = (id) => providers.find(p => p.id === id)?.name || '';

  const handleEdit = (c) => { setEditingCourse(c); setShowForm(true); };
  const handleNew = () => { setEditingCourse(null); setShowForm(true); };

  const handleDeleteCourse = async (id) => {
    if (!confirm('Delete this training course? Booked staff will remain but lose the link.')) return;
    await base44.entities.TrainingCourse.delete(id);
    queryClient.invalidateQueries({ queryKey: ['training-courses'] });
    setSelectedCourse(null);
    toast({ title: 'Course deleted' });
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
      <div className="space-y-4">
        <button onClick={() => setSelectedCourse(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Courses
        </button>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#2E5A1A] flex items-center justify-center flex-shrink-0 shadow-sm">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900">{selectedCourse.title}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{categoryLabel[selectedCourse.category] || 'Training'}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => handleEdit(selectedCourse)} className="p-2 text-[#2E5A1A] hover:bg-[#2E5A1A]/5 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
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
            {(selectedCourse.provider_id || selectedCourse.provider) && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Provider</p>
                  <p className="text-slate-700 font-medium truncate">{providerName(selectedCourse.provider_id) || selectedCourse.provider}</p>
                </div>
              </div>
            )}
          </div>
          {selectedCourse.address && <p className="text-sm text-slate-500 mt-3"><MapPin className="w-4 h-4 inline mr-1" />{selectedCourse.address}</p>}
          {selectedCourse.description && <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded-xl p-3">{selectedCourse.description}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Booked Staff ({courseBookings.length})</h2>
            </div>
            {unbookedStaff.length > 0 && (
              <button onClick={() => setShowAddStaff(true)} className={PRIMARY_BTN}>
                <UserPlus className="w-4 h-4" /> Add Staff
              </button>
            )}
          </div>

          {courseBookings.length === 0 ? (
            <EmptyState icon={Users} title="No staff booked yet" message="Add staff to this course using the button above." />
          ) : (
            <div className="space-y-2">
              {courseBookings.map(b => {
                const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.booked;
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
                        <button onClick={() => setOutcomeBooking(b)} className="text-xs px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg font-medium hover:bg-[#1c4a12] transition">Record Outcome</button>
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

        {showAddStaff && (
          <AddStaffToCourseModal course={selectedCourse} staff={staff}
            onClose={() => setShowAddStaff(false)}
            onAdded={() => setShowAddStaff(false)} />
        )}
        {showForm && (
          <CourseFormModal editing={editingCourse} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['training-courses'] }); }} />
        )}
        {outcomeBooking && (
          <TrainingOutcomeModal booking={outcomeBooking} course={selectedCourse} courses={courses} onClose={() => setOutcomeBooking(null)} />
        )}
      </div>
    );
  }

  // COURSE LIST VIEW
  const upcomingCourses = courses.filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'));
  const pastCourses = courses.filter(c => isPast(new Date(c.start_date + 'T00:00:00')) && c.start_date !== format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="space-y-4">
      <ViewHeader icon={BookOpen} title="Training Courses" subtitle="Book external training, track outcomes and upload certificates">
        <button onClick={handleNew} className={PRIMARY_BTN} type="button"><Plus className="w-4 h-4" /> New Course</button>
        <button onClick={onBulkImport} className={SECONDARY_BTN} type="button"><Sparkles className="w-4 h-4" /> Bulk Import</button>
        <button onClick={onManage} className={SECONDARY_BTN} type="button"><Settings className="w-4 h-4" /> Categories</button>
      </ViewHeader>

      <PendingReviewQueue />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
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
                    <button key={c.id} onClick={() => setSelectedCourse(c)} className="text-left bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#2E5A1A]/30 transition active:scale-[0.99]">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2E5A1A] flex items-center justify-center flex-shrink-0 shadow-sm">
                          <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-sm truncate">{c.title}</p>
                          <p className="text-xs text-slate-500">{categoryLabel[c.category] || 'Training'}</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{format(new Date(c.start_date + 'T00:00:00'), 'dd MMM yyyy')}{c.end_date !== c.start_date ? ` – ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}</p>
                        {c.start_time && <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{c.start_time}{c.end_time ? ` – ${c.end_time}` : ''}</p>}
                        {c.venue && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{c.venue}</p>}
                        {(c.provider_id || c.provider) && <p className="flex items-center gap-1.5"><Building2 className="w-3 h-3" />{providerName(c.provider_id) || c.provider}</p>}
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
                    <button key={c.id} onClick={() => setSelectedCourse(c)} className="text-left bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm hover:shadow-md transition active:scale-[0.99]">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
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

      {showForm && (
        <CourseFormModal editing={editingCourse} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['training-courses'] }); }} />
      )}
    </div>
  );
}