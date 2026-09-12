import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Loader2, CheckCircle2, Repeat, CalendarRange, AlertTriangle } from 'lucide-react';
import { format, addDays, isWeekend } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CrewSuggesterAI from '@/components/jobs/CrewSuggesterAI';

const computeWeekStart = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return format(monday, 'yyyy-MM-dd');
};

const DAY_LABELS = [
  { val: 1, label: 'Mon' },
  { val: 2, label: 'Tue' },
  { val: 3, label: 'Wed' },
  { val: 4, label: 'Thu' },
  { val: 5, label: 'Fri' },
  { val: 6, label: 'Sat' },
  { val: 7, label: 'Sun' },
];

export default function QuickAssignStaffModal({ open, onClose, job, allStaff = [], rotas = [] }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('range'); // 'range' | 'recurring'
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState(job?.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(job?.end_date || job?.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [skipWeekends, setSkipWeekends] = useState(true);
  // Recurring mode state
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]); // Mon–Fri default
  const [recurringEnd, setRecurringEnd] = useState(job?.end_date || '');
  const [saving, setSaving] = useState(false);

  const assignedStaffIds = useMemo(() => new Set(rotas.map(r => r.staff_id)), [rotas]);

  const buildDateRange = (startStr, endStr) => {
    const days = [];
    let d = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (d <= end) {
      if (!skipWeekends || !isWeekend(d)) days.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return days;
  };

  const buildRecurringDates = (startStr, endStr, days) => {
    const dates = [];
    let d = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (d <= end) {
      const jsDay = d.getDay();
      const patternDay = jsDay === 0 ? 7 : jsDay; // 1=Mon … 7=Sun
      if (days.includes(patternDay)) dates.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return dates;
  };

  // Conflict detection — fetch each selected staff member's rotas on OTHER jobs
  // and flag any that overlap with the dates we're about to assign.
  const { data: conflictMap = {} } = useQuery({
    queryKey: ['staff-conflicts', selectedIds, job?.id],
    queryFn: async () => {
      if (selectedIds.length === 0) return {};
      const results = await Promise.all(
        selectedIds.map(id => base44.entities.RotaAssignment.filter({ staff_id: id }, '-created_date', 200))
      );
      const map = {};
      results.forEach((staffRotas, i) => {
        const sid = selectedIds[i];
        map[sid] = staffRotas.filter(r => r.job_id !== job.id);
      });
      return map;
    },
    enabled: selectedIds.length > 0 && !!job?.id,
  });

  const plannedDates = useMemo(() => {
    if (mode === 'recurring') {
      const end = recurringEnd || job?.end_date || endDate;
      return buildRecurringDates(startDate, end, workingDays);
    }
    return buildDateRange(startDate, endDate);
  }, [mode, startDate, endDate, recurringEnd, workingDays, job?.end_date]);

  const staffConflicts = useMemo(() => {
    const dateSet = new Set(plannedDates);
    const conflicts = {};
    for (const [sid, staffRotas] of Object.entries(conflictMap)) {
      const dates = [...new Set(staffRotas.map(r => r.assigned_date))].filter(d => dateSet.has(d));
      if (dates.length > 0) conflicts[sid] = dates;
    }
    return conflicts;
  }, [conflictMap, plannedDates]);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allStaff.filter(s => {
      if (s.is_active === false) return false;
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    });
  }, [allStaff, search]);

  const toggleStaff = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleDay = (val) => {
    setWorkingDays(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val].sort());
  };

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    try {
      let dates;
      let permanentCrew = [];
      if (mode === 'recurring') {
        const end = recurringEnd || job?.end_date || endDate;
        dates = buildRecurringDates(startDate, end, workingDays);
        // Build the permanent crew rule for auto-extension
        permanentCrew = selectedIds.map(id => {
          const s = allStaff.find(st => st.id === id);
          return {
            staff_id: id,
            staff_name: s?.name || '',
            working_days: [...workingDays],
            start_date: startDate,
            end_date: end || undefined,
          };
        });
      } else {
        dates = buildDateRange(startDate, endDate);
      }

      const assignments = [];
      selectedIds.forEach(staffId => {
        dates.forEach(date => {
          assignments.push({
            job_id: job.id,
            staff_id: staffId,
            assigned_date: date,
            week_start: computeWeekStart(date),
            status: 'assigned',
          });
        });
      });

      if (assignments.length > 0) {
        await base44.entities.RotaAssignment.bulkCreate(assignments);
      }

      // Save the permanent crew rule so future date extensions auto-fill
      if (mode === 'recurring' && permanentCrew.length > 0) {
        const existingCrew = Array.isArray(job.permanent_crew) ? job.permanent_crew : [];
        // Merge: replace entries for the same staff, add new ones
        const byId = new Map();
        for (const m of existingCrew) byId.set(m.staff_id, m);
        for (const m of permanentCrew) byId.set(m.staff_id, m);
        const merged = [...byId.values()];
        await base44.entities.Job.update(job.id, { permanent_crew: merged });
      }

      queryClient.invalidateQueries({ queryKey: ['rotas-for-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSelectedIds([]);
      setSearch('');
      onClose();
    } catch (err) {
      console.error('Quick assign error:', err);
    }
    setSaving(false);
  };

  const canAssign = selectedIds.length > 0 && (mode === 'range' || workingDays.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Quick Assign Staff
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Add crew to <span className="font-semibold text-slate-700">{job?.name}</span></p>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('range')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'range' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Date Range
            </button>
            <button
              type="button"
              onClick={() => setMode('recurring')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'recurring' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              <Repeat className="w-3.5 h-3.5" /> Recurring Weekly
            </button>
          </div>

          {/* AI Crew Suggester */}
          {job?.id && (
            <CrewSuggesterAI
              job={job}
              assignedDate={startDate}
              allStaff={allStaff}
              onApply={(staffId) => toggleStaff(staffId)}
            />
          )}

          {/* Date inputs */}
          {mode === 'range' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">From</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">To</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={skipWeekends} onChange={e => setSkipWeekends(e.target.checked)} className="rounded border-slate-300" />
                Skip weekends
              </label>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Working days</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map(d => {
                    const active = workingDays.includes(d.val);
                    return (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => toggleDay(d.val)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${active ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-primary/40'}`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Starts</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Until {recurringEnd ? '' : '(job end)'}</label>
                  <input type="date" value={recurringEnd} onChange={e => setRecurringEnd(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Crew repeat every selected day from the start date until the end date (or the job's end date if blank). The crew stays assigned automatically when the job is extended.
              </p>
            </>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Conflict warning */}
          {Object.keys(staffConflicts).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-semibold">Scheduling conflict detected</p>
                <p className="mt-0.5">
                  {Object.entries(staffConflicts).map(([sid, dates]) => {
                    const st = allStaff.find(x => x.id === sid);
                    return `${st?.name || 'Staff'} (${dates.length} date${dates.length > 1 ? 's' : ''})`;
                  }).join(', ')} already assigned to another job on overlapping dates.
                </p>
              </div>
            </div>
          )}

          {/* Staff list */}
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filteredStaff.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No staff found</p>
            ) : filteredStaff.map(s => {
              const isAssigned = assignedStaffIds.has(s.id);
              const isSelected = selectedIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStaff(s.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left ${isSelected ? 'bg-primary/5' : ''}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                    {(s.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{(s.worker_type || '').replace(/_/g, ' ') || 'Staff'}</p>
                  </div>
                  {isAssigned && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">On job</span>}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-slate-500">
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select staff above'}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">Cancel</button>
              <button onClick={handleAssign} disabled={saving || !canAssign} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}