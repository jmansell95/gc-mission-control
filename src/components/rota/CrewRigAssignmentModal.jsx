import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  // Fetch primary-rig assignments for the selected job (create mode) so we can
  // auto-select an on-site rig and block when no rig has been added yet.
  const { data: jobRigAssignments = [], refetch: refetchJobRigs } = useQuery({
    queryKey: ['crew-rig-job-assignments', jobId],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: jobId, role: 'primary_rig' }),
    enabled: !!jobId,
  });

  // When a job is chosen, default the From date to the job's start_date (not
  // today). Clear any previous rig selection so the auto-select effect can fire.
  useEffect(() => {
    if (!jobId) return;
    const job = jobs.find(j => j.id === jobId);
    setStartDate(job?.start_date || format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setRigId('');
  }, [jobId, jobs]);

  // Auto-select an on-site rig and pre-fill its dates when rig assignments load.
  // Only fires when the user hasn't manually picked a rig yet (rigId is empty).
  useEffect(() => {
    if (!jobId || jobRigAssignments.length === 0 || rigId) return;
    const job = jobs.find(j => j.id === jobId);
    const onSite = jobRigAssignments.filter(a => a.status === 'on_site' || a.status === 'assigned');
    if (onSite.length === 1) {
      setRigId(onSite[0].asset_id);
      setStartDate(onSite[0].arrived_on_site_date || onSite[0].assigned_date || job?.start_date || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(onSite[0].returned_date || job?.end_date || '');
    } else if (onSite.length > 1) {
      const firstOnSite = onSite.find(a => a.status === 'on_site') || onSite[0];
      setStartDate(firstOnSite.arrived_on_site_date || firstOnSite.assigned_date || job?.start_date || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(firstOnSite.returned_date || job?.end_date || '');
    }
  }, [jobId, jobRigAssignments, rigId, jobs]);

  // Re-check rig assignments when the modal regains focus (e.g. after the user
  // navigates away to add a rig and comes back).
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => { if (jobId) refetchJobRigs(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [isOpen, jobId, refetchJobRigs]);

  const drillingTeamIds = useMemo(() => {
    const ids = new Set();
    (teams || []).forEach(t => {
      if (['drilling', 'cp_drilling', 'rotary_drilling'].includes(t.job_type)) ids.add(t.id);
      // Also match teams whose name signals a drilling crew, even when the
      // team's job_type field is blank (e.g. "Rotary Crew (Dynamic)").
      if (/\b(drilling|driller|rotary|cable percussion|\bcp\b)\b/i.test(t.name || '')) ids.add(t.id);
    });
    return ids;
  }, [teams]);

  // Drillers are identified by team membership OR job title — staff aren't
  // always linked to a drilling team via team_id, so fall back to job_title
  // matching (Cable Percussion Driller, Rotary Driller, Lead Driller, etc.)
  const drillers = useMemo(
    () => sortAZ((staff || []).filter(s =>
      s.is_active !== false && (
        drillingTeamIds.has(s.team_id) ||
        /\b(driller|lead driller|second man)\b/i.test(s.job_title || '')
      )
    ), 'name'),
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

  // For swap mode: fetch rig assignments for the selected pairing's job so we
  // can restrict the new-rig picker to rigs already on that job.
  const swapJobId = selectedPairing?.job_id || '';
  const { data: swapJobRigAssignments = [] } = useQuery({
    queryKey: ['crew-rig-job-assignments', swapJobId],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: swapJobId, role: 'primary_rig' }),
    enabled: !!swapJobId,
  });

  // Fetch both crew members' shifts so we can preview which dates are
  // linkable (both have an existing shift on the selected job that day) vs
  // skipped (no shift on that job). The rig is stamped ONTO existing shifts —
  // no new records are created, so nothing conflicts with the rota.
  const [previewShifts, setPreviewShifts] = useState({ lead: [], second: [] });
  useEffect(() => {
    if (mode !== 'create' || !leadId || !secondId) return;
    let cancelled = false;
    Promise.all([
      base44.entities.RotaAssignment.filter({ staff_id: leadId }),
      base44.entities.RotaAssignment.filter({ staff_id: secondId }),
    ]).then(([l, s]) => { if (!cancelled) setPreviewShifts({ lead: l || [], second: s || [] }); })
      .catch(() => { if (!cancelled) setPreviewShifts({ lead: [], second: [] }); });
    return () => { cancelled = true; };
  }, [mode, leadId, secondId]);

  const linkableDays = useMemo(() => {
    if (mode !== 'create' || rangeDays.length === 0 || !jobId) return [];
    const rangeSet = new Set(rangeDays);
    const isJobShift = a => rangeSet.has(a.assigned_date) && a.job_id === jobId &&
      (!a.assignment_type || a.assignment_type === 'job' || a.assignment_type === 'yard_depot');
    const leadByDate = {};
    previewShifts.lead.forEach(a => { if (isJobShift(a)) leadByDate[a.assigned_date] = a; });
    const secondByDate = {};
    previewShifts.second.forEach(a => { if (isJobShift(a)) secondByDate[a.assigned_date] = a; });
    return rangeDays.filter(d => leadByDate[d] && secondByDate[d]);
  }, [mode, rangeDays, jobId, previewShifts]);

  const skippedDays = useMemo(() => rangeDays.filter(d => !linkableDays.includes(d)), [rangeDays, linkableDays]);

  // Rigs already assigned to the selected job (create mode) — used to block
  // the flow when none exist and to highlight on-site rigs in the picker.
  const onSiteRigIds = useMemo(
    () => new Set(jobRigAssignments.filter(a => a.status === 'on_site' || a.status === 'assigned').map(a => a.asset_id)),
    [jobRigAssignments]
  );
  const hasJobRigs = onSiteRigIds.size > 0;

  // Swap mode: restrict the new-rig picker to rigs already on the pairing's job.
  const swapOnSiteRigIds = useMemo(
    () => new Set(swapJobRigAssignments.filter(a => a.status === 'on_site' || a.status === 'assigned').map(a => a.asset_id)),
    [swapJobRigAssignments]
  );
  const swapRigOptions = swapOnSiteRigIds.size > 0
    ? activeRigs.filter(r => swapOnSiteRigIds.has(r.id) && r.id !== selectedPairing?.rig_id)
    : activeRigs.filter(r => r.id !== selectedPairing?.rig_id);

  const canCreate = leadId && secondId && leadId !== secondId && jobId && rigId && linkableDays.length > 0 && hasJobRigs;
  const canSwap = pairingId && newRigId && swapFromDate && newRigId !== selectedPairing?.rig_id;

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      const newPairingId = genPairingId();
      const rangeSet = new Set(rangeDays);
      const isJobShift = a => rangeSet.has(a.assigned_date) && a.job_id === jobId &&
        (!a.assignment_type || a.assignment_type === 'job' || a.assignment_type === 'yard_depot');
      const leadByDate = {};
      previewShifts.lead.forEach(a => { if (isJobShift(a)) leadByDate[a.assigned_date] = a; });
      const secondByDate = {};
      previewShifts.second.forEach(a => { if (isJobShift(a)) secondByDate[a.assigned_date] = a; });

      const updates = [];
      linkableDays.forEach(d => {
        const leadShift = leadByDate[d];
        const secondShift = secondByDate[d];
        if (leadShift) updates.push({ id: leadShift.id, rig_asset_id: rigId, crew_pairing_id: newPairingId, crew_role: 'lead_driller' });
        if (secondShift) updates.push({ id: secondShift.id, rig_asset_id: rigId, crew_pairing_id: newPairingId, crew_role: 'second_man' });
      });
      if (updates.length === 0) {
        toast({ title: 'No shifts to link', description: 'Neither crew member has a shift on this job in the selected range.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      await base44.entities.RotaAssignment.bulkUpdate(updates);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['rig-perf-assignments'] });
      const rigName = (rigs || []).find(r => r.id === rigId)?.name || 'rig';
      const leadName = staff.find(s => s.id === leadId)?.name || 'Lead';
      const secondName = staff.find(s => s.id === secondId)?.name || 'Second';
      toast({
        title: 'Rig linked to crew',
        description: `${linkableDays.length} day${linkableDays.length !== 1 ? 's' : ''} · ${leadName} (Lead) + ${secondName} (Second) on ${rigName}${skippedDays.length > 0 ? ` · ${skippedDays.length} skipped (no shift on this job)` : ''}.`,
      });
      onClose();
    } catch (e) {
      console.error('Crew-rig link failed:', e);
      toast({ title: 'Could not link rig', description: e.message || 'Something went wrong.', variant: 'destructive' });
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
                  <p className="text-xs font-semibold text-slate-700">Choose the crew <span className="font-normal text-slate-400">(must already have shifts on the job)</span></p>
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
                    {hasJobRigs ? (
                      <Select value={rigId} onValueChange={setRigId}>
                        <SelectTrigger className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><SelectValue placeholder="Select Rig" /></SelectTrigger>
                        <SelectContent>
                          {activeRigs.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.serial_number ? ` — ${r.serial_number}` : ''}{r.colour ? ` · ${r.colour}` : ''}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}{onSiteRigIds.has(r.id) ? ' · on site' : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-amber-800">No rig added to this job yet</p>
                            <p className="text-amber-700 mt-0.5">Add a rig to this job first, then assign the crew to it.</p>
                            <button
                              type="button"
                              onClick={() => {
                                const job = jobs.find(j => j.id === jobId);
                                if (job) {
                                  window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'job-detail', job, jobTab: 'equipment' } }));
                                }
                                onClose();
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition active:scale-95"
                            >
                              <Drill className="w-3.5 h-3.5" /> Add Rig to Job
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                    {selectedJob?.start_date && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Job starts {format(new Date(selectedJob.start_date + 'T00:00:00'), 'dd MMM yyyy')}
                      </p>
                    )}
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

              {rangeDays.length > 0 && jobId && leadId && secondId && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <p className="font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Drill className="w-3.5 h-3.5 text-[#2E5A1A]" />
                    The rig is stamped onto existing shifts — no new shifts are created.
                  </p>
                  {linkableDays.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide mb-1">Will be linked ({linkableDays.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {linkableDays.map(d => (
                          <span key={d} className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 text-[10px] text-emerald-800 font-medium">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {format(new Date(d + 'T00:00:00'), 'dd MMM')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {skippedDays.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Skipped — no shift on this job ({skippedDays.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {skippedDays.map(d => (
                          <span key={d} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 font-medium">
                            <CalendarClock className="w-2.5 h-2.5" />
                            {format(new Date(d + 'T00:00:00'), 'dd MMM')}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Assign these crew members to the job first, then link the rig.</p>
                    </div>
                  )}
                  {linkableDays.length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      Neither crew member has a shift on this job in the selected range. Assign them to the job on the rota first.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleCreate} disabled={!canCreate || saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Link Rig to Crew
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
                    {swapRigOptions.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}{r.serial_number ? ` — ${r.serial_number}` : ''}{r.colour ? ` · ${r.colour}` : ''}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {swapOnSiteRigIds.size > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">Showing rigs already on this job.</p>
                )}
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