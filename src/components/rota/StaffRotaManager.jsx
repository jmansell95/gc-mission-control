import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import {
  X, Trash2, Calendar, Save, Loader2, AlertTriangle, User, Briefcase,
  MapPin, Truck, Clock, ArrowRight, CalendarRange
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * StaffRotaManager — per-staff rota editor for the Weekly Rota Builder.
 *
 * Lets a manager fix mistakes after assigning a week's rota to a crew member:
 *   • Delete the crew member's ENTIRE rota for the week (all jobs).
 *   • Per job: edit the date of any individual shift, or remove the crew
 *     member from that job for the whole week.
 *
 * Only operates on the current week (week_start filter) and only on job
 * assignments (leave/sick/training rows are left untouched).
 */
export default function StaffRotaManager({ open, onClose, staff, weekStartStr, rotas = [], jobs = [], vehicles = [] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { activeDivisionId } = useDivision();

  // Fetch ALL of this crew member's rota assignments across every week (not
  // just the current one) so the manager can edit the full job duration.
  const { data: allStaffRotas = [], isLoading: loadingRotas } = useQuery({
    queryKey: ['staff-all-rotas', staff?.id, activeDivisionId || 'overview'],
    queryFn: async () => {
      if (!staff?.id) return [];
      const res = await base44.functions.invoke('getDivisionScopedData', {
        entity: 'RotaAssignment',
        division_id: activeDivisionId,
        filter: { staff_id: staff.id },
      });
      return res.data?.data || [];
    },
    enabled: open && !!staff?.id,
  });

  // Default the date filter to the crew member's full assignment span once data loads.
  useEffect(() => {
    if (open && allStaffRotas.length > 0 && !dateFrom && !dateTo) {
      const dates = allStaffRotas
        .filter(r => r.staff_id === staff?.id && (!r.assignment_type || r.assignment_type === 'job'))
        .map(r => r.assigned_date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        setDateFrom(dates[0]);
        setDateTo(dates[dates.length - 1]);
      }
    }
  }, [open, allStaffRotas, staff?.id]);

  // This staff member's job assignments across the full span (filtered by the
  // From/To date range), grouped by job.
  const staffRotas = useMemo(() => {
    let arr = allStaffRotas.filter(r =>
      r.staff_id === staff?.id &&
      (!r.assignment_type || r.assignment_type === 'job')
    );
    if (dateFrom) arr = arr.filter(r => r.assigned_date >= dateFrom);
    if (dateTo) arr = arr.filter(r => r.assigned_date <= dateTo);
    return arr.sort((a, b) => (a.assigned_date || '').localeCompare(b.assigned_date || ''));
  }, [allStaffRotas, staff?.id, dateFrom, dateTo]);

  const byJob = useMemo(() => {
    const map = {};
    staffRotas.forEach(r => {
      const jid = r.job_id || 'unassigned';
      if (!map[jid]) map[jid] = [];
      map[jid].push(r);
    });
    return map;
  }, [staffRotas]);

  // Editable date state: { [assignmentId]: 'yyyy-MM-dd' }
  const [dateEdits, setDateEdits] = useState({});
  // Track which assignments have been removed locally (optimistic)
  const [removedJobIds, setRemovedJobIds] = useState(new Set());
  // Per-job day-shift input values (the "wrong week" quick fix)
  const [shiftDays, setShiftDays] = useState({});

  // Reset local state whenever the modal opens for a (possibly) different staff
  React.useEffect(() => {
    if (open) {
      setDateEdits({});
      setRemovedJobIds(new Set());
    }
  }, [open, staff?.id, weekStartStr]);

  if (!staff) return null;

  const jobEntries = Object.entries(byJob).filter(([jid]) => !removedJobIds.has(jid));
  const totalActive = jobEntries.reduce((n, [, arr]) => n + arr.length, 0);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['rotas'] });
    queryClient.invalidateQueries({ queryKey: ['rota-week'] });
    queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
    queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
  };

  // Save all edited dates for a single job's assignments.
  const handleSaveJob = async (jid, assignments) => {
    const updates = assignments
      .map(a => ({ id: a.id, original: a.assigned_date, next: dateEdits[a.id] }))
      .filter(u => u.next && u.next !== u.original);
    if (updates.length === 0) {
      toast({ title: 'No date changes to save' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.RotaAssignment.bulkUpdate(
        updates.map(u => ({ id: u.id, assigned_date: u.next }))
      );
      // Clear the saved edits from local state
      setDateEdits(prev => {
        const next = { ...prev };
        updates.forEach(u => delete next[u.id]);
        return next;
      });
      invalidateAll();
      toast({ title: `Updated ${updates.length} shift date${updates.length === 1 ? '' : 's'}` });
    } catch (e) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Shift every shift for a job by a number of days (the "wrong week" fix).
  const handleShiftJob = async (jid, assignments) => {
    const delta = parseInt(shiftDays[jid] || '0', 10);
    if (!delta) { toast({ title: 'Enter a number of days to shift' }); return; }
    setSaving(true);
    try {
      const updates = assignments.map(a => {
        const d = parseISO(a.assigned_date + 'T00:00:00');
        const nd = new Date(d.getTime() + delta * 86400000);
        return { id: a.id, assigned_date: format(nd, 'yyyy-MM-dd') };
      });
      await base44.entities.RotaAssignment.bulkUpdate(updates);
      setShiftDays(prev => ({ ...prev, [jid]: '' }));
      invalidateAll();
      toast({ title: `Shifted ${updates.length} shift${updates.length === 1 ? '' : 's'} by ${delta > 0 ? '+' : ''}${delta} day${Math.abs(delta) === 1 ? '' : 's'}` });
    } catch (e) {
      toast({ title: 'Failed to shift', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Remove the crew member from a single job for the whole week.
  const handleRemoveFromJob = async (jid, assignments) => {
    const job = jobs.find(j => j.id === jid);
    const name = jid === 'unassigned' ? 'this job' : (job?.name || 'this job');
    if (!confirm(`Remove ${staff.name} from ${name} for the whole week?\n\n${assignments.length} shift${assignments.length === 1 ? '' : 's'} will be deleted.`)) return;
    setDeleting(true);
    try {
      if (jid === 'unassigned') {
        // No real job_id to filter on — delete each shift by ID.
        await Promise.all(assignments.map(a => base44.entities.RotaAssignment.delete(a.id)));
      } else {
        await base44.entities.RotaAssignment.deleteMany({
          staff_id: staff.id,
          job_id: jid,
          week_start: weekStartStr,
        });
      }
      setRemovedJobIds(prev => new Set(prev).add(jid));
      invalidateAll();
      toast({ title: `Removed from ${name}`, description: `${assignments.length} shift${assignments.length === 1 ? '' : 's'} deleted` });
    } catch (e) {
      toast({ title: 'Failed to remove', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Delete the crew member's ENTIRE rota for the week (all jobs).
  const handleDeleteAll = async () => {
    if (staffRotas.length === 0) { toast({ title: 'No shifts to delete' }); return; }
    if (!confirm(
      `DELETE ${staff.name.toUpperCase()}'S ENTIRE ROTA FOR THIS WEEK?\n\n` +
      `${staffRotas.length} shift${staffRotas.length === 1 ? '' : 's'} across ${jobEntries.length} job${jobEntries.length === 1 ? '' : 's'} will be permanently removed.\n\n` +
      `This cannot be undone.`
    )) return;
    setDeleting(true);
    try {
      await base44.entities.RotaAssignment.deleteMany({
        staff_id: staff.id,
        week_start: weekStartStr,
      });
      invalidateAll();
      toast({ title: 'Entire week\'s rota deleted', description: `${staffRotas.length} shift${staffRotas.length === 1 ? '' : 's'} removed` });
      onClose();
    } catch (e) {
      toast({ title: 'Failed to delete rota', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const jobTypeColor = (job) => {
    const t = job?.job_type || job?.primary_discipline;
    if (t === 'drilling' || t === 'cp_drilling') return 'bg-amber-50 border-amber-300 text-amber-800';
    if (t === 'groundworks') return 'bg-emerald-50 border-emerald-300 text-emerald-800';
    if (t === 'rotary_drilling') return 'bg-blue-50 border-blue-300 text-blue-800';
    return 'bg-slate-50 border-slate-300 text-slate-700';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 pr-8">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 font-bold text-sm">{staff.name?.charAt(0) || '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate">{staff.name}</p>
              <p className="text-xs font-normal text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Rota manager · week of {weekStartStr}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {staffRotas.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No shifts this week</p>
            <p className="text-xs text-slate-400 mt-1">This crew member has no assignments for the selected week.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Per-job sections */}
            {jobEntries.map(([jid, assignments]) => {
              const job = jobs.find(j => j.id === jid);
              const colors = jobTypeColor(job);
              const dates = [...new Set(assignments.map(a => a.assigned_date))].sort();
              const hasEdits = assignments.some(a => dateEdits[a.id] && dateEdits[a.id] !== a.assigned_date);
              return (
                <div key={jid} className={`rounded-xl border-2 ${colors.split(' ').slice(1).join(' ')} overflow-hidden`}>
                  {/* Job header */}
                  <div className={`px-4 py-3 border-b ${colors.split(' ')[0]} ${colors.split(' ')[2]} flex items-center gap-2`}>
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{jid === 'unassigned' ? 'Unassigned' : (job?.name || 'Unknown job')}</p>
                      <p className="text-xs opacity-80 flex items-center gap-2 flex-wrap">
                        <span>{assignments.length} shift{assignments.length === 1 ? '' : 's'}</span>
                        {dates.length > 0 && <span>· {dates[0]}{dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ''}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromJob(jid, assignments)}
                      disabled={deleting}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white/70 hover:bg-white text-red-600 rounded-lg text-xs font-semibold transition disabled:opacity-50 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove from job
                    </button>
                  </div>

                  {/* Shift date editor */}
                  <div className="p-4 space-y-3 bg-white">
                    {/* Quick shift row */}
                    <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100">
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> Shift all dates by:
                      </span>
                      <input
                        type="number"
                        value={shiftDays[jid] || ''}
                        onChange={(e) => setShiftDays(prev => ({ ...prev, [jid]: e.target.value }))}
                        placeholder="e.g. -7 or +1"
                        className="w-24 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-xs text-slate-400">days</span>
                      <button
                        onClick={() => handleShiftJob(jid, assignments)}
                        disabled={saving || !shiftDays[jid]}
                        className="ml-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-40"
                      >
                        Apply shift
                      </button>
                    </div>

                    {/* Individual date editors */}
                    <div className="space-y-1.5">
                      {assignments.map(a => {
                        const vehicle = vehicles.find(v => v.id === a.vehicle_id);
                        const changed = dateEdits[a.id] && dateEdits[a.id] !== a.assigned_date;
                        return (
                          <div key={a.id} className="flex items-center gap-2 py-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                {a.start_time || a.end_time ? `${a.start_time || '—'}–${a.end_time || '—'}` : 'All day'}
                                {vehicle && <span className="flex items-center gap-0.5"><Truck className="w-3 h-3" />{vehicle.registration_number}</span>}
                              </div>
                            </div>
                            <input
                              type="date"
                              value={dateEdits[a.id] ?? a.assigned_date}
                              onChange={(e) => setDateEdits(prev => ({ ...prev, [a.id]: e.target.value }))}
                              className={`px-2 py-1 text-sm border rounded-md focus:outline-none focus:border-emerald-600 ${changed ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {hasEdits && (
                      <button
                        onClick={() => handleSaveJob(jid, assignments)}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save date changes
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Delete entire week's rota */}
            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-100 transition text-sm font-bold disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {staff.name.split(' ')[0]}'s entire rota for this week ({totalActive} shifts)
              </button>
              <p className="text-xs text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3" /> This removes every shift across all jobs — use only to start over.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}