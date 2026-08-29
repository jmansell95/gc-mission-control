import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, isWeekend } from 'date-fns';
import {
  X, Drill, HardHat, Users, Briefcase, Calendar, CalendarClock,
  AlertTriangle, Loader2, CheckCircle2, ArrowLeftRight, Search,
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { sortAZ } from '@/utils';

const computeWeekStart = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return format(monday, 'yyyy-MM-dd');
};

const buildDateRange = (startStr, endStr, workWeekends = false) => {
  const days = [];
  let d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d <= end) {
    const isWeekendDay = isWeekend(d);
    if (workWeekends || !isWeekendDay) days.push(format(d, 'yyyy-MM-dd'));
    d = addDays(d, 1);
  }
  return days;
};

const genPairingId = () => `crew_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Crew-Rig Assignment Modal.
 *
 * Two modes:
 *  - 'create': pick a Lead Driller + Second Man (the crew), a Job, a Rig, and a
 *    date range → creates paired RotaAssignment entries for both crew members on
 *    each working day, all stamped with the same rig_asset_id + crew_pairing_id
 *    (+ crew_role) so they move as a unit.
 *  - 'swap': pick an existing crew-rig pairing → pick a new rig + the date to
 *    swap from → updates rig_asset_id on all future-dated assignments in that
 *    pairing, leaving past days (meterage/revenue) intact.
 */
export default function CrewRigAssignmentModal({ isOpen, onClose, staff, jobs, rigs, existingRotas, teams }) {
  const [mode, setMode] = useState('create');
  const [leadId, setLeadId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [jobId, setJobId] = useState('');
  const [rigId, setRigId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [workWeekends, setWorkWeekends] = useState(false);
  const [saving, setSaving] = useState(false);

  // swap mode
  const [pairingId, setPairingId] = useState('');
  const [newRigId, setNewRigId] = useState('');
  const [swapFromDate, setSwapFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setMode('create');
      setLeadId(''); setSecondId(''); setJobId(''); setRigId('');
      setStartDate(format(new Date(), 'yyyy-MM-dd')); setEndDate('');
      setWorkWeekends(false);
      setPairingId(''); setNewRigId('');
      setSwapFromDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [isOpen]);

  const drillingTeamIds = useMemo(() => {
    const ids = new Set();
    (teams || []).forEach(t => {
      if (['drilling', 'cp_drilling', 'rotary_drilling'].includes(t.job_type)) ids.add(t.id);
    });
    return ids;
  }, [teams]);

  // Drillers are identified by team membership OR job title — staff aren't
  // always linked to a drilling team via team_id, so fall back to job_title
  // matching (Cable Percussion Driller, Rotary Driller, Lead Driller, etc.)
  const isDriller = (s) =>
    drillingTeamIds.has(s.team_id) ||
    /\b(driller|lead driller|second man)\b/i.test(s.job_title || '');

  const drillers = useMemo(
    () => sortAZ((staff || []).filter(s => s.is_active !== false && isDriller(s)), 'name'),
    [staff, drillingTeamIds]
  );

  const activeRigs = useMemo(() => sortAZ((rigs || []).filter(r => r.is_active !== false), 'name'), [rigs]);

  // Existing crew-rig pairings (for swap mode)
  const pairings = useMemo(() => {
    const byPairing = {};
    (existingRotas || []).forEach(a => {
      if (!a.crew_pairing_id || !a.rig_asset_id) return;
      const job = jobs.find(j => j.id === a.job_id);
      const rig = (rigs || []).find(r => r.id === a.rig_asset_id);
      const lead = staff.find(s => s.id === a.staff_id && a.crew_role === 'lead_driller');
      const second = staff.find(s => s.id === a.staff_id && a.crew_role === 'second_man');
      if (!byPairing[a.crew_pairing_id]) {
        byPairing[a.crew_pairing_id] = {
          id: a.crew_pairing_id,
          job_id: a.job_id,
          job_name: job?.name || 'Unknown job',
          rig_id: a.rig_asset_id,
          rig_name: rig?.name || 'Unknown rig',
          lead_name: lead?.name || '',
          second_name: second?.name || '',
          dates: [],
          assignmentIds: [],
        };
      }
      if (lead) byPairing[a.crew_pairing_id].lead_name = lead.name;
      if (second) byPairing[a.crew_pairing_id].second_name = second.name;
      byPairing[a.crew_pairing_id].dates.push(a.assigned_date);
      byPairing[a.crew_pairing_id].assignmentIds.push(a.id);
    });
    return Object.values(byPairing).sort((a, b) => (b.dates[0] || '').localeCompare(a.dates[0] || ''));
  }, [existingRotas, jobs, rigs, staff]);

  const selectedJob = jobs.find(j => j.id === jobId);
  const jobEndDate = selectedJob?.end_date || '';
  const effectiveEnd = endDate || (jobEndDate && jobEndDate > startDate ? jobEndDate : startDate);
  const rangeDays = useMemo(
    () => startDate && effectiveEnd && effectiveEnd >= startDate ? buildDateRange(startDate, effectiveEnd, workWeekends) : [],
    [startDate, effectiveEnd, workWeekends]
  );

  const selectedPairing = pairings.find(p => p.id === pairingId);
  const swapRig = activeRigs.find(r => r.id === newRigId);

  // Conflict check: either crew member already has a shift on a date in range
  const conflictDates = useMemo(() => {
    if (mode !== 'create' || rangeDays.length === 0) return [];
    const conflicts = [];
    rangeDays.forEach(d => {
      [leadId, secondId].forEach(sid => {
        if (!sid) return;
        if ((existingRotas || []).some(r => r.staff_id === sid && r.assigned_date === d)) {
          conflicts.push({ date: d, staffId: sid });
        }
      });
    });
    return conflicts;
  }, [mode, rangeDays, leadId, secondId, existingRotas]);

  const canCreate = leadId && secondId && leadId !== secondId && jobId && rigId && rangeDays.length > 0 && conflictDates.length === 0;
  const canSwap = pairingId && newRigId && swapFromDate && newRigId !== selectedPairing?.rig_id;

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      const newPairingId = genPairingId();
      const leadDivision = staff.find(s => s.id === leadId)?.division_id || '';
      const secondDivision = staff.find(s => s.id === secondId)?.division_id || '';
      const assignments = [];
      rangeDays.forEach((dateStr, idx) => {
        [{ id: leadId, role: 'lead_driller', div: leadDivision }, { id: secondId, role: 'second_man', div: secondDivision }].forEach(m => {
          assignments.push({
            job_id: jobId,
            assignment_type: 'job',
            staff_id: m.id,
            division_id: m.div,
            assigned_date: dateStr,
            rig_asset_id: rigId,
            crew_pairing_id: newPairingId,
            crew_role: m.role,
            week_start: computeWeekStart(dateStr),
            start_time: '08:00',
            end_time: '17:00',
            work_weekends: !!workWeekends,
            status: 'assigned',
          });
        });
      });
      await base44.entities.RotaAssignment.bulkCreate(assignments);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['rig-perf-assignments'] });
      toast({ title: 'Crew assigned to rig', description: `${rangeDays.length} day${rangeDays.length !== 1 ? 's' : ''} · ${staff.find(s => s.id === leadId)?.name} (Lead) + ${staff.find(s => s.id === secondId)?.name} (Second) on ${(rigs || []).find(r => r.id === rigId)?.name}.` });
      onClose();
    } catch (e) {
      console.error('Crew-rig assignment failed:', e);
      toast({ title: 'Could not assign crew', description: e.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSwap = async () => {
    if (!canSwap || !selectedPairing) return;
    setSaving(true);
    try {
      // Fetch ALL assignments in this pairing (across weeks) so a mid-job swap
      // reaches future weeks too — the rota view only loads the current week.
      const allInPairing = await base44.entities.RotaAssignment.filter({ crew_pairing_id: pairingId });
      const toUpdate = (allInPairing || []).filter(a => a.assigned_date >= swapFromDate);
      if (toUpdate.length === 0) {
        toast({ title: 'Nothing to swap', description: 'No assignments in this pairing on or after the swap date.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      const updates = toUpdate.map(a => ({ id: a.id, rig_asset_id: newRigId }));
      await base44.entities.RotaAssignment.bulkUpdate(updates);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['rig-perf-assignments'] });
      toast({
        title: 'Rig swapped',
        description: `${selectedPairing.lead_name || 'Lead'} + ${selectedPairing.second_name || 'Second'} → ${swapRig?.name} from ${format(new Date(swapFromDate + 'T00:00:00'), 'dd MMM')}. ${toUpdate.length} shift${toUpdate.length !== 1 ? 's' : ''} updated.`,
      });
      onClose();
    } catch (e) {
      console.error('Rig swap failed:', e);
      toast({ title: 'Could not swap rig', description: e.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-slate-900">Crew → Rig Assignment</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => setMode('create')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${mode === 'create' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <HardHat className="w-4 h-4" /> New crew
            </button>
            <button type="button" onClick={() => setMode('swap')} disabled={pairings.length === 0}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'swap' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ArrowLeftRight className="w-4 h-4" /> Swap rig
            </button>
          </div>
          {pairings.length === 0 && mode === 'swap' && (
            <p className="text-[11px] text-slate-400 mt-2 text-center">No crew-rig pairings exist yet — create one first.</p>
          )}
        </div>

        <div className="p-5 space-y-4">
          {mode === 'create' ? (
            <>
              {/* Step 1: Crew */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-[#2E5A1A] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                  <p className="text-xs font-semibold text-slate-700">Choose the crew</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Lead Driller *</label>
                    <Select value={leadId} onValueChange={setLeadId}>
                      <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select Lead" /></SelectTrigger>
                      <SelectContent>
                        {drillers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Second Man *</label>
                    <Select value={secondId} onValueChange={setSecondId}>
                      <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select Second Man" /></SelectTrigger>
                      <SelectContent>
                        {drillers.map(s => <SelectItem key={s.id} value={s.id} disabled={s.id === leadId}>{s.name}{s.id === leadId ? ' (lead)' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {leadId && secondId && leadId === secondId && (
                  <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Lead and Second Man must be different people.</p>
                )}
              </div>

              {/* Step 2: Job + Rig */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-[#2E5A1A] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  <p className="text-xs font-semibold text-slate-700">Job & Rig</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Job *</label>
                    <Select value={jobId} onValueChange={setJobId}>
                      <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select Job" /></SelectTrigger>
                      <SelectContent>
                        {sortAZ(jobs.filter(j => j.status === 'in_progress' || j.status === 'planning'), 'name').map(j => (
                          <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Rig *</label>
                    <Select value={rigId} onValueChange={setRigId}>
                      <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select Rig" /></SelectTrigger>
                      <SelectContent>
                        {activeRigs.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Step 3: Dates */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-[#2E5A1A] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  <p className="text-xs font-semibold text-slate-700">Dates</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">From *</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">To {jobEndDate ? '(blank = job end)' : ''}</label>
                    <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={workWeekends} onChange={(e) => setWorkWeekends(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                  Include weekends
                </label>
                {rangeDays.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{rangeDays.length} working day{rangeDays.length !== 1 ? 's' : ''} · {format(new Date(rangeDays[0] + 'T00:00:00'), 'dd MMM')} → {format(new Date(rangeDays[rangeDays.length - 1] + 'T00:00:00'), 'dd MMM yyyy')}</span>
                  </div>
                )}
              </div>

              {conflictDates.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Existing shifts found</p>
                    <p className="text-amber-600 mt-0.5">{conflictDates.length} clash{conflictDates.length !== 1 ? 'es' : ''} — those dates will be skipped or pick different dates/crew.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleCreate} disabled={!canCreate || saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Assign Crew to Rig
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
              </div>
            </>
          ) : (
            <>
              {/* SWAP MODE */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Existing crew-rig pairing *</label>
                <Select value={pairingId} onValueChange={setPairingId}>
                  <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select a crew" /></SelectTrigger>
                  <SelectContent>
                    {pairings.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.lead_name || 'Lead'} + {p.second_name || 'Second'} · {p.rig_name} · {p.job_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPairing && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> <span className="font-medium text-slate-700">{selectedPairing.lead_name || 'Lead'} + {selectedPairing.second_name || 'Second'}</span></div>
                  <div className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-slate-400" /> <span className="text-slate-600">{selectedPairing.job_name}</span></div>
                  <div className="flex items-center gap-1.5"><Drill className="w-3.5 h-3.5 text-slate-400" /> <span className="text-slate-600">Current rig: <span className="font-semibold text-slate-800">{selectedPairing.rig_name}</span></span></div>
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> <span className="text-slate-600">{selectedPairing.dates.length} day{selectedPairing.dates.length !== 1 ? 's' : ''} assigned</span></div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">New rig *</label>
                <Select value={newRigId} onValueChange={setNewRigId}>
                  <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select replacement rig" /></SelectTrigger>
                  <SelectContent>
                    {activeRigs.filter(r => r.id !== selectedPairing?.rig_id).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Swap from date *</label>
                <input type="date" value={swapFromDate} onChange={(e) => setSwapFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 text-sm" />
                <p className="text-[11px] text-slate-400 mt-1">Past days stay on the old rig (history preserved). This date and onward move to the new rig.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleSwap} disabled={!canSwap || saving}
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                  Swap Rig
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}