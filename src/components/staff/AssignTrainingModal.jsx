import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  X, Search, Calendar, Users, Loader2, GraduationCap, CheckCircle2,
  MapPin, Clock, Plus, AlertCircle, Building2,
} from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

export default function AssignTrainingModal({ preselectedStaffIds = [], preselectedCategory = null, staff, courses, bookings = [], onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState(preselectedStaffIds);
  const [saving, setSaving] = useState(false);
  const [providerOverrides, setProviderOverrides] = useState({}); // { courseId: providerId }

  const { data: providers = [] } = useQuery({
    queryKey: ['training-providers'],
    queryFn: () => base44.entities.Supplier.filter({ is_training_provider: true }),
  });
  const providerName = (id) => providers.find(p => p.id === id)?.name || '';

  const availableCourses = useMemo(() => {
    let list = courses.filter(c => c.status !== 'cancelled' && c.status !== 'completed');
    if (preselectedCategory) list = list.filter(c => c.category === preselectedCategory);
    return list.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [courses, preselectedCategory]);

  const selectedCourses = useMemo(() =>
    availableCourses.filter(c => selectedCourseIds.includes(c.id)),
  [availableCourses, selectedCourseIds]);

  const filteredStaff = useMemo(() => staff.filter(s =>
    s.is_active !== false && (
      !search || s.name.toLowerCase().includes(search.toLowerCase())
    )
  ), [staff, search]);

  const toggleStaff = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCourse = (courseId) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(x => x !== courseId) : [...prev, courseId]
    );
  };

  const removeCourse = (courseId) => {
    setSelectedCourseIds(prev => prev.filter(x => x !== courseId));
  };

  // Check which staff are already booked on each selected course
  const getAlreadyBooked = (courseId, staffId) => {
    return bookings.some(b => b.course_id === courseId && b.staff_id === staffId);
  };

  const handleAssign = async () => {
    if (selectedCourseIds.length === 0) { toast({ title: 'Select at least one course', variant: 'destructive' }); return; }
    if (selectedStaffIds.length === 0) { toast({ title: 'Select at least one crew member', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const newBookings = [];
      for (const courseId of selectedCourseIds) {
        for (const staffId of selectedStaffIds) {
          if (!getAlreadyBooked(courseId, staffId)) {
            const s = staff.find(x => x.id === staffId);
            newBookings.push({
              course_id: courseId,
              staff_id: staffId,
              staff_name: s?.name || '',
              status: 'booked',
            });
          }
        }
      }
      if (newBookings.length === 0) {
        toast({ title: 'All selected crew are already booked on these courses' });
        onClose();
        return;
      }
      // Persist any provider overrides onto the courses
      for (const courseId of selectedCourseIds) {
        const override = providerOverrides[courseId];
        if (override !== undefined) {
          const course = courses.find(c => c.id === courseId);
          if (course && course.provider_id !== override) {
            try { await base44.entities.TrainingCourse.update(courseId, { provider_id: override || '' }); } catch (_) {}
          }
        }
      }
      const created = await base44.entities.TrainingBooking.bulkCreate(newBookings);
      // Notify each newly booked staff member
      const createdArray = Array.isArray(created) ? created : [created];
      for (const b of createdArray) {
        try { await base44.functions.invoke('notifyTrainingBooking', { booking_id: b.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['training-courses'] });
      const courseNames = selectedCourses.map(c => c.title).join(', ');
      toast({ title: `${newBookings.length} booking${newBookings.length === 1 ? '' : 's'} created`, description: courseNames });
      onClose();
    } catch (err) {
      toast({ title: 'Could not assign', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const totalPotentialBookings = selectedCourseIds.length * selectedStaffIds.length;
  const alreadyBookedCount = useMemo(() => {
    let count = 0;
    selectedCourseIds.forEach(cid => {
      selectedStaffIds.forEach(sid => {
        if (getAlreadyBooked(cid, sid)) count++;
      });
    });
    return count;
  }, [selectedCourseIds, selectedStaffIds, bookings]);
  const newBookingsCount = totalPotentialBookings - alreadyBookedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Assign Training</h3>
              <p className="text-xs text-slate-500">Select courses and crew — book multiple at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Selected courses chips + provider picker */}
        {selectedCourses.length > 0 && (
          <div className="mb-4 p-3 bg-[#2E5A1A]/5 rounded-xl border border-[#2E5A1A]/15">
            <p className="text-[10px] font-bold text-[#2E5A1A] uppercase tracking-wide mb-2">Selected Courses ({selectedCourses.length})</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedCourses.map(c => (
                <div key={c.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-white border border-[#2E5A1A]/20 rounded-full text-xs font-medium text-slate-700 shadow-sm">
                  <Calendar className="w-3 h-3 text-[#2E5A1A]" />
                  <span className="truncate max-w-[140px]">{c.title}</span>
                  <button onClick={() => removeCourse(c.id)} className="w-4 h-4 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center transition flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {/* Per-course provider picker — smart-linked to the course's category */}
            <div className="space-y-1.5">
              {selectedCourses.map(c => {
                const currentProviderId = providerOverrides[c.id] !== undefined ? providerOverrides[c.id] : (c.provider_id || '');
                const matchingProviders = c.category ? providers.filter(p => p.training_services?.includes(c.category)) : providers;
                return (
                  <div key={c.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-600 truncate flex-1 min-w-0">{c.title}</span>
                    <select value={currentProviderId} onChange={e => setProviderOverrides(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A] bg-white max-w-[160px]">
                      <option value="">{c.category && matchingProviders.length === 0 ? 'No match' : 'No provider'}</option>
                      {matchingProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Course selection */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
            {selectedCourses.length > 0 ? 'Add More Courses' : '1. Select Courses'}
            {preselectedCategory && ' (filtered)'}
          </label>
          {availableCourses.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400">No upcoming courses{preselectedCategory ? ' for this category' : ''}.</p>
              <button onClick={() => { onClose(); navigate('/staff', { state: { initialTab: 'training' } }); }}
                className="text-xs text-[#2E5A1A] font-semibold hover:underline mt-1">
                Create a course in the Courses tab →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {availableCourses.map(c => {
                const isSelected = selectedCourseIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleCourse(c.id)}
                    className={'w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ' +
                      (isSelected ? 'border-[#2E5A1A] bg-[#2E5A1A]/5 ring-1 ring-[#2E5A1A]/20' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                    <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (isSelected ? 'bg-[#2E5A1A]' : 'bg-blue-100')}>
                      {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Calendar className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{c.title}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>{format(new Date(c.start_date + 'T00:00'), 'dd MMM yyyy')}</span>
                        {c.venue && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{c.venue}</span></>}
                      </p>
                      {(c.provider_id || c.provider) && <p className="text-[10px] text-[#2E5A1A] font-medium flex items-center gap-0.5 mt-0.5"><Building2 className="w-2.5 h-2.5" />{providerName(c.provider_id) || c.provider}</p>}
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-[#2E5A1A] bg-[#2E5A1A]/10 px-2 py-0.5 rounded-full flex-shrink-0">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff selection */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">2. Select Crew ({selectedStaffIds.length} selected)</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crew…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto border border-slate-100 rounded-xl">
            {filteredStaff.map(s => {
              const checked = selectedStaffIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStaff(s.id)}
                  className={'w-full flex items-center gap-3 p-2.5 transition text-left ' + (checked ? 'bg-[#2E5A1A]/5' : 'hover:bg-slate-50')}>
                  <div className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ' + (checked ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white')}>
                    {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-[10px]">{s.name.charAt(0)}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary bar */}
        {selectedCourseIds.length > 0 && selectedStaffIds.length > 0 && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
            <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              {newBookingsCount > 0
                ? `${newBookingsCount} new booking${newBookingsCount === 1 ? '' : 's'} will be created`
                : 'All selected crew are already booked on these courses'}
              {alreadyBookedCount > 0 && ` · ${alreadyBookedCount} already booked`}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
          <button onClick={handleAssign} disabled={saving || selectedCourseIds.length === 0 || selectedStaffIds.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {saving ? 'Booking…' : `Book ${selectedStaffIds.length} ${selectedStaffIds.length === 1 ? 'person' : 'crew'} on ${selectedCourseIds.length} ${selectedCourseIds.length === 1 ? 'course' : 'courses'}`}
          </button>
        </div>
      </div>
    </div>
  );
}