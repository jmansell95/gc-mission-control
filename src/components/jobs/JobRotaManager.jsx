import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import {
  UserPlus, Trash2, Truck, Clock, X, Loader2, CalendarDays, Users, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * JobRotaManager — inline per-job rota management panel.
 * Lives in the Schedule & Crew tab and lets a manager:
 *  - See a week-by-week grid of who's assigned to THIS job
 *  - Add staff to a specific date (creates a RotaAssignment)
 *  - Remove staff from a date
 *  - Assign a vehicle alongside the staff member
 *
 * This is NOT the full Rota Builder — it's scoped to one job and
 * focused on quick add/remove for the dates this job runs.
 */
export default function JobRotaManager({ job, allStaff, vehicles, rotas }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [saving, setSaving] = useState(false);

  const jobRotas = useMemo(() => rotas.filter(r => r.job_id === job?.id), [rotas, job?.id]);

  const weekStart = useMemo(() => {
    const base = job?.start_date ? parseISO(job.start_date) : new Date();
    return startOfWeek(addDays(base, weekOffset * 7), { weekStartsOn: 1 });
  }, [job?.start_date, weekOffset]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const rotasByDate = useMemo(() => {
    const map = {};
    jobRotas.forEach(r => {
      if (!map[r.assigned_date]) map[r.assigned_date] = [];
      map[r.assigned_date].push(r);
    });
    return map;
  }, [jobRotas]);

  const handleAdd = async () => {
    if (!selectedStaffId || !addDate) return;
    setSaving(true);
    try {
      const dateStr = format(addDate, 'yyyy-MM-dd');
      const ws = format(startOfWeek(addDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const staff = allStaff.find(s => s.id === selectedStaffId);
      await base44.entities.RotaAssignment.create({
        job_id: job.id,
        staff_id: selectedStaffId,
        assigned_date: dateStr,
        week_start: ws,
        vehicle_id: selectedVehicleId || undefined,
        division_id: staff?.division_id || job.division_id || undefined,
        assignment_type: 'job',
        status: 'assigned',
      });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['job-rotas'] });
      toast({ title: 'Staff assigned', description: `${staff?.name || 'Staff member'} added for ${format(addDate, 'EEE dd MMM')}` });
      setShowAddModal(false);
      setSelectedStaffId('');
      setSelectedVehicleId('');
    } catch (err) {
      toast({ title: 'Error', description: err.message || 'Failed to assign staff', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleRemove = async (rotaId, staffName, dateStr) => {
    if (!confirm(`Remove ${staffName} from ${dateStr}?`)) return;
    try {
      await base44.entities.RotaAssignment.delete(rotaId);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['job-rotas'] });
      toast({ title: 'Removed', description: `${staffName} unassigned from ${dateStr}` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const availableStaff = allStaff.filter(s => s.is_active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="hub-glass rounded-3xl overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <CalendarDays className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-hub-section text-slate-900">Rota Manager</h3>
          <p className="text-hub-caption text-slate-500">Assign and remove staff for this job, week by week</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-700 min-w-[120px] text-center">
            {format(weekStart, 'dd MMM')} – {format(addDays(weekStart, 6), 'dd MMM')}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="px-3 sm:px-4 pb-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1.5 min-w-[700px]">
          {weekDates.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayRotas = rotasByDate[dateStr] || [];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div key={dateStr} className={`rounded-xl border ${isWeekend ? 'bg-slate-50/50 border-slate-100' : 'bg-white border-slate-200'} p-2 min-h-[140px] flex flex-col`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 uppercase">{format(date, 'EEE')}</span>
                    <span className="text-[11px] text-slate-400 ml-1">{format(date, 'dd/MM')}</span>
                  </div>
                  <button
                    onClick={() => { setAddDate(date); setShowAddModal(true); }}
                    className="p-1 rounded-md hover:bg-[#2E5A1A]/10 text-slate-400 hover:text-[#2E5A1A] transition"
                    title="Add staff"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 space-y-1">
                  {dayRotas.length === 0 ? (
                    <p className="text-[10px] text-slate-300 text-center mt-4">No one assigned</p>
                  ) : (
                    dayRotas.map(rota => {
                      const member = allStaff.find(s => s.id === rota.staff_id);
                      const vehicle = vehicles.find(v => v.id === rota.vehicle_id);
                      return (
                        <div key={rota.id} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 group">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-slate-800 truncate flex-1">{member?.name || 'Unknown'}</span>
                            <button
                              onClick={() => handleRemove(rota.id, member?.name || 'Staff', dateStr)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {vehicle && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <Truck className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-[9px] text-slate-500 font-mono">{vehicle.registration_number}</span>
                            </div>
                          )}
                          {rota.status === 'started' && <span className="text-[9px] text-blue-600 font-medium">● Started</span>}
                          {rota.status === 'completed' && <span className="text-[9px] text-emerald-600 font-medium">✓ Done</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && addDate && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Add Staff</h2>
                  <p className="text-emerald-100 text-xs">{format(addDate, 'EEEE, dd MMM yyyy')}</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/15">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Staff Member</label>
                <select
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] bg-white"
                >
                  <option value="">Select staff…</option>
                  {availableStaff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.worker_type?.replace('_', ' ') || 'employee'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Vehicle (optional)</label>
                <select
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] bg-white"
                >
                  <option value="">No vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} — {v.registration_number}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!selectedStaffId || saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#244715] disabled:opacity-50 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? 'Assigning…' : 'Assign to Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}