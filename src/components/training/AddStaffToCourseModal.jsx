import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { X, Search, Users, Loader2, CheckCircle2, UserPlus } from 'lucide-react';

/**
 * AddStaffToCourseModal — popup modal for booking staff onto a course from
 * the course detail view. Replaces the old inline checkbox section in
 * TrainingManager. Searchable crew list with bulk-select; only shows staff
 * not already booked on the course.
 */
export default function AddStaffToCourseModal({ course, staff, onClose, onAdded }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: allBookings = [] } = useQuery({
    queryKey: ['training-bookings'],
    queryFn: () => base44.entities.TrainingBooking.list('-created_date', 500),
  });
  const existingIds = useMemo(() => allBookings.filter(b => b.course_id === course?.id).map(b => b.staff_id), [allBookings, course?.id]);

  const unbookedStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter(s => s.is_active !== false && !existingIds.includes(s.id))
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [staff, search, existingIds]);

  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBook = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      const created = await base44.entities.TrainingBooking.bulkCreate(
        selectedIds.map(sid => {
          const s = staff.find(st => st.id === sid);
          return { course_id: course.id, staff_id: sid, staff_name: s?.name || '', status: 'booked' };
        })
      );
      const createdArray = Array.isArray(created) ? created : [created];
      for (const b of createdArray) {
        try { await base44.functions.invoke('notifyTrainingBooking', { booking_id: b.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast({ title: `${selectedIds.length} staff booked`, description: 'They have been notified by email.' });
      onAdded?.();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base truncate">Add Staff to Course</h3>
              <p className="text-xs text-white/70 truncate">{course?.title || ''}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg transition flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crew…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
          </div>

          {unbookedStaff.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No unbooked crew match your search.</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto border border-slate-100 rounded-xl">
              {unbookedStaff.map(s => {
                const checked = selectedIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggle(s.id)} type="button"
                    className={'w-full flex items-center gap-3 p-2.5 transition text-left ' + (checked ? 'bg-[#2E5A1A]/5' : 'hover:bg-slate-50')}>
                    <div className={'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ' + (checked ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white')}>
                      {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-[10px]">{s.name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
            <button onClick={handleBook} disabled={saving || selectedIds.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {saving ? 'Booking…' : `Book ${selectedIds.length} Staff`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}