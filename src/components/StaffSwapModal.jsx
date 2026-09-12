import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Search, UserPlus, Repeat, Check, AlertTriangle, Clock, CalendarOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Quick staff swap / add modal for the Rota Builder.
 * Two modes:
 *  - "swap": replace the assigned staff member with someone else (keeps job/date/vehicle)
 *  - "add":  add another crew member onto the same job & date
 */
export default function StaffSwapModal({ assignment, staff, jobs, teams, existingRotas, onClose }) {
  const [mode, setMode] = useState('swap'); // 'swap' | 'add'
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const job = jobs.find(j => j.id === assignment?.job_id);
  const currentStaff = staff.find(s => s.id === assignment?.staff_id);
  const dateStr = assignment?.assigned_date;
  const dow = dateStr ? new Date(dateStr + 'T00:00:00').getDay() : -1;

  const availability = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      // already assigned to this same job+date? skip self
      if (s.id === assignment?.staff_id) { map[s.id] = 'current'; return; }
      // on another job this day (still allowed — multi-job days supported)
      const hasOther = existingRotas.some(r => r.staff_id === s.id && r.assigned_date === dateStr);
      // recurring day off
      // (recurring/absence data isn't passed in; we surface the "has other shift" signal only)
      map[s.id] = hasOther ? 'busy' : 'free';
    });
    return map;
  }, [staff, assignment, existingRotas, dateStr]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let list = [...staff].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (q) list = list.filter(s => (s.name || '').toLowerCase().includes(q));
    return list;
  }, [staff, query]);

  const selectedStaff = staff.find(s => s.id === selectedId);
  const selectedTeamName = selectedStaff ? (teams.find(t => t.id === selectedStaff.team_id)?.name || 'No team') : '';
  const selectedStatus = selectedId ? availability[selectedId] : null;

  const handleConfirm = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      if (mode === 'swap') {
        await base44.entities.RotaAssignment.update(assignment.id, { staff_id: selectedId });
      } else {
        // Add another crew member — clone the shift minus briefing/sign-in state
        await base44.entities.RotaAssignment.create({
          job_id: assignment.job_id,
          staff_id: selectedId,
          assigned_date: assignment.assigned_date,
          week_start: assignment.week_start,
          vehicle_id: assignment.vehicle_id || '',
          start_time: assignment.start_time || '',
          end_time: assignment.end_time || '',
          notes: assignment.notes || '',
          is_overtime: !!assignment.is_overtime,
          rate_multiplier: assignment.rate_multiplier != null ? assignment.rate_multiplier : null,
          status: 'assigned',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (e) {
      console.error('Error swapping/adding staff:', e);
      alert('Could not save. ' + (e?.message || ''));
    }
    setSaving(false);
  };

  if (!assignment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{job?.name || 'Shift'}</h3>
            <p className="text-xs text-slate-400">
              {dateStr ? format(new Date(dateStr + 'T00:00:00'), 'EEE dd MMM yyyy') : ''} ·
              {' '}Now: {currentStaff?.name || '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-4">
            <button onClick={() => { setMode('swap'); setSelectedId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition ${mode === 'swap' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
              <Repeat className="w-4 h-4" /> Swap Staff
            </button>
            <button onClick={() => { setMode('add'); setSelectedId(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition ${mode === 'add' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
              <UserPlus className="w-4 h-4" /> Add Crew Member
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            {mode === 'swap'
              ? 'Replace the current crew member with someone else. The job, date, vehicle and times stay the same.'
              : 'Add a second crew member onto this job for the same date. Use this to put two people on one shift quickly.'}
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search crew..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          {/* Staff list */}
          <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-64 divide-y divide-slate-100">
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No crew found.</p>
            )}
            {filtered.map(s => {
              const teamName = teams.find(t => t.id === s.team_id)?.name || 'No team';
              const status = availability[s.id];
              const isSelected = selectedId === s.id;
              return (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {isSelected ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{(s.name || '?').charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{teamName}</p>
                  </div>
                  {status === 'current' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">Current</span>
                  )}
                  {status === 'busy' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> On another shift
                    </span>
                  )}
                  {status === 'free' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Free</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selection summary */}
          {selectedStaff && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              {selectedStatus === 'busy' && (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {selectedStaff.name} already has a shift this day — times may overlap.
                </span>
              )}
              {selectedStatus === 'free' && (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {selectedStaff.name} ({selectedTeamName}) is free this day.
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
            <button onClick={handleConfirm} disabled={!selectedId || saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'swap' ? <Repeat className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mode === 'swap' ? 'Swap Staff' : 'Add to Shift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}