import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle, Trash2, RotateCcw, Loader2, CheckCircle2, Clock, MapPin, Calendar, CalendarClock, CalendarDays, User, Phone, Briefcase, FileText, ShieldX, ShieldAlert, Drill, Search } from 'lucide-react';
import { evaluateAssignmentCompliance, qualLabel } from '@/utils/complianceLock';
import { sortAZ } from '@/utils';
import LeaveCaptureModal from '@/components/rota/LeaveCaptureModal';

function JobStatusBadge({ status }) {
  const config = {
    planning: { label: 'Planning', cls: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Done', cls: 'bg-slate-100 text-slate-500' },
    on_hold: { label: 'On Hold', cls: 'bg-amber-100 text-amber-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
    decommissioning: { label: 'Decom', cls: 'bg-purple-100 text-purple-700' },
  };
  const c = config[status] || { label: status || 'Unknown', cls: 'bg-slate-100 text-slate-500' };
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.cls}`}>{c.label}</span>;
}
import { format, differenceInDays, addDays } from 'date-fns';
import { isStaffOutsideJobTeams, getJobTeamIds } from '@/utils/jobTeams';
import { isWeekend, buildRateMap } from '@/utils/overtime';
import { findConflict, suggestAutoTimes, getDailyShiftSummary } from '@/utils/rotaScheduling';

export default function AssignmentModal({ isOpen, onClose, assignment, defaultStaffId, defaultDate, weekStartStr, staff, jobs, vehicles, existingRotas }) {
  const [formData, setFormData] = useState({ job_id: '', staff_id: '', assigned_date: '', vehicle_id: '', rig_asset_id: '', start_time: '', end_time: '', notes: '', is_overtime: false, rate_multiplier: '', start_delayed: false, actual_start_date: '', work_weekends: false });
  const [leaveModal, setLeaveModal] = useState(null); // { staffId, staffName, jobId, jobName, spanStart, spanEnd }
  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [timeConflict, setTimeConflict] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [complianceOverride, setComplianceOverride] = useState(false);
  const [rigComplianceOverride, setRigComplianceOverride] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [showCompletedJobs, setShowCompletedJobs] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState('today'); // 'today' | 'custom' | 'full_job'
  const [customEndDate, setCustomEndDate] = useState('');
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-staff-all'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }) });
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-active'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true, is_active: true }) });
  const rateMap = buildRateMap(overtimeRates);

  // Helper: find the staff member's division_id for the rota assignment
  const getStaffDivisionId = (staffId) => staff.find(s => s.id === staffId)?.division_id || '';

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
      const dow = d.getDay();
      const isWeekendDay = dow === 0 || dow === 6;
      if (workWeekends || !isWeekendDay) {
        days.push(format(d, 'yyyy-MM-dd'));
      }
      d = addDays(d, 1);
    }
    return days;
  };

  const isEditing = !!assignment;

  useEffect(() => {
    if (isOpen) {
      if (assignment) {
        setFormData({
          job_id: assignment.job_id || '',
          staff_id: assignment.staff_id || '',
          assigned_date: assignment.assigned_date || '',
          vehicle_id: assignment.vehicle_id || '',
          rig_asset_id: assignment.rig_asset_id || '',
          start_time: assignment.start_time || '',
          end_time: assignment.end_time || '',
          notes: assignment.notes || '',
          is_overtime: !!assignment.is_overtime,
          rate_multiplier: assignment.rate_multiplier != null ? String(assignment.rate_multiplier) : '',
          start_delayed: !!assignment.start_delayed,
          actual_start_date: assignment.actual_start_date || '',
          work_weekends: !!assignment.work_weekends
        });
      } else {
        const defaults = getStaffDefaultTimes(defaultStaffId);
        setFormData({
          job_id: '',
          staff_id: defaultStaffId || '',
          assigned_date: defaultDate || '',
          vehicle_id: '',
          rig_asset_id: '',
          start_time: defaults.start_time,
          end_time: defaults.end_time,
          notes: '',
          is_overtime: false,
          rate_multiplier: '',
          start_delayed: false,
          actual_start_date: '',
          work_weekends: false
        });
      }
      setConflictWarnings([]);
      setTimeConflict(null);
      setComplianceOverride(false);
      setRigComplianceOverride(false);
      setAssignmentMode('today');
      setCustomEndDate('');
    }
  }, [isOpen, assignment, defaultStaffId, defaultDate]);

  if (!isOpen) return null;

  const checkConflicts = (staffId, date, vehicleId, startTime, endTime) => {
    const warnings = [];
    let timeConflict = null;
    if (staffId && date) {
      const dup = existingRotas.some(r => r.staff_id === staffId && r.assigned_date === date && r.id !== assignment?.id);
      if (dup) warnings.push('This staff member already has an assignment on this date — multi-job days are supported. The times below auto-adjust so they won\'t overlap.');
      const dow = new Date(date + 'T00:00:00').getDay();
      const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
      if (rec) warnings.push(`Staff is regularly off (${rec.label || 'Day Off'}) on this day.`);
      const onLeave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= date && a.end_date >= date);
      if (onLeave) warnings.push('Staff has an approved absence (leave) on this date.');
      // Time overlap (hard block)
      if (startTime && endTime) {
        timeConflict = findConflict(existingRotas, staffId, date, startTime, endTime, assignment?.id);
        if (timeConflict) {
          const cj = jobs.find(j => j.id === timeConflict.job_id);
          warnings.push(`Time clash with "${cj?.name || 'another shift'}" (${timeConflict.start_time}–${timeConflict.end_time}). Pick a different time or the clash must be resolved.`);
        }
      }
    }
    if (vehicleId && date) {
      const vehClash = existingRotas.some(r => r.vehicle_id === vehicleId && r.assigned_date === date && r.id !== assignment?.id && r.staff_id !== staffId);
      if (vehClash) warnings.push('This vehicle is already assigned to another staff member on this date.');
    }
    return { warnings, timeConflict };
  };

  const getStaffDefaultTimes = (staffId) => {
    const member = staff.find(s => s.id === staffId);
    const team = teams.find(t => t.id === member?.team_id);
    if (team?.job_type === 'depot' || /depot/i.test(team?.name || '')) {
      return { start_time: '07:00', end_time: '16:00' };
    }
    return { start_time: '08:00', end_time: '17:00' };
  };

  const handleStaffChange = (staffId) => {
    // When the staff already has a shift this date, auto-suggest a non-overlapping slot.
    let suggested = null;
    if (!isEditing && staffId && formData.assigned_date) {
      const dayCount = existingRotas.filter(r => r.staff_id === staffId && r.assigned_date === formData.assigned_date).length;
      if (dayCount > 0) {
        suggested = suggestAutoTimes(existingRotas, staffId, formData.assigned_date);
      }
    }
    const defaults = isEditing ? {} : (suggested || getStaffDefaultTimes(staffId));
    setFormData(prev => ({ ...prev, staff_id: staffId, ...defaults }));
    if (staffId && formData.assigned_date) {
      const res = checkConflicts(staffId, formData.assigned_date, formData.vehicle_id, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else { setConflictWarnings([]); setTimeConflict(null); }
  };

  const handleJobChange = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    const plannedStart = job?.start_date || '';
    // Keep the clicked date (defaultDate), don't override with the job's planned start.
    // Only fall back to the job start if no date was clicked (e.g. editing with no defaultDate).
    const dateToUse = formData.assigned_date || plannedStart;
    setFormData(prev => {
      const next = { ...prev, job_id: jobId, assigned_date: dateToUse, start_delayed: false, actual_start_date: '' };
      if (dateToUse) {
        const weekend = isWeekend(dateToUse);
        if (weekend && !prev.is_overtime && prev.rate_multiplier === '') {
          next.is_overtime = true;
          next.rate_multiplier = String(rateMap[new Date(dateToUse + 'T00:00:00').getDay()] ?? 1.5);
        }
        if (!weekend && prev.is_overtime && prev.rate_multiplier === '') {
          next.is_overtime = false;
        }
      }
      return next;
    });
    if (dateToUse && formData.staff_id) {
      const res = checkConflicts(formData.staff_id, dateToUse, formData.vehicle_id, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else {
      setConflictWarnings([]);
      setTimeConflict(null);
    }
    setJobSearch('');
    setJobDropdownOpen(false);
  };

  const selectedJob = jobs.find(j => j.id === formData.job_id);
  const isDrillingJob = selectedJob && selectedJob.drilling_method && selectedJob.drilling_method !== 'not_applicable';
  const selectedRig = rigs.find(r => r.id === formData.rig_asset_id);
  const selectedStaff = staff.find(s => s.id === formData.staff_id);
  const selectedStaffTeam = selectedStaff ? teams.find(t => t.id === selectedStaff.team_id) : null;
  const isDrillerStaff = selectedStaffTeam && (selectedStaffTeam.job_type === 'cp_drilling' || selectedStaffTeam.job_type === 'rotary_drilling');
  // Active jobs shown by default; completed jobs included only when searching or toggled
  const activeStatuses = ['planning', 'in_progress'];
  const filteredJobsList = jobs.filter(job => {
    const isActive = activeStatuses.includes(job.status);
    const q = jobSearch.toLowerCase().trim();
    const matchesSearch = !q || (job.name || '').toLowerCase().includes(q) || (job.location || '').toLowerCase().includes(q) || (job.job_reference || '').toLowerCase().includes(q);
    if (isActive && matchesSearch) return true;
    if (!isActive && (q || showCompletedJobs) && matchesSearch) return true;
    return false;
  }).sort((a, b) => {
    const aActive = activeStatuses.includes(a.status) ? 0 : 1;
    const bActive = activeStatuses.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (a.name || '').localeCompare(b.name || '');
  });
  const effectiveStartDisplay = formData.start_delayed && formData.actual_start_date ? formData.actual_start_date : formData.assigned_date;
  const jobEndDate = selectedJob?.end_date || '';
  const customEndValid = assignmentMode === 'custom' && customEndDate && effectiveStartDisplay && customEndDate >= effectiveStartDisplay;
  const fullJobEnd = assignmentMode === 'full_job' && jobEndDate && effectiveStartDisplay && jobEndDate > effectiveStartDisplay ? jobEndDate : '';
  const rangeEndDate = customEndValid ? customEndDate : fullJobEnd;
  const multiDayDays = (!isEditing && rangeEndDate) ? buildDateRange(effectiveStartDisplay, rangeEndDate, formData.work_weekends) : [];
  const teamMismatch = isStaffOutsideJobTeams(selectedStaff, selectedJob, teams);
  const requiredTeamNames = selectedJob ? getJobTeamIds(selectedJob).map(id => teams.find(t => t.id === id)?.name).filter(Boolean) : [];
  const selectedStaffTeamName = selectedStaff ? (teams.find(t => t.id === selectedStaff.team_id)?.name || 'No team') : '';

  // Compliance hard-lock: evaluate required qualifications for the selected staff + job
  const complianceEval = evaluateAssignmentCompliance({ staff: selectedStaff, job: selectedJob, teams, complianceItems });
  const complianceBlocked = complianceEval.blocked.length > 0;
  const complianceExpiring = complianceEval.expiring.length > 0;

  // Equipment compliance hard-lock: expired rigs cannot be assigned to jobs
  const rigComplianceBlocked = isDrillerStaff && selectedRig && selectedRig.compliance_status === 'expired';

  const handleDateChange = (date) => {
    const weekend = isWeekend(date);
    const dayCount = formData.staff_id ? existingRotas.filter(r => r.staff_id === formData.staff_id && r.assigned_date === date && r.id !== assignment?.id).length : 0;
    const suggested = (dayCount > 0 && !isEditing) ? suggestAutoTimes(existingRotas, formData.staff_id, date) : null;
    setFormData(prev => {
      const next = { ...prev, assigned_date: date };
      if (suggested) { next.start_time = suggested.start_time; next.end_time = suggested.end_time; }
      if (weekend && !prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = true;
        next.rate_multiplier = String(rateMap[new Date(date + 'T00:00:00').getDay()] ?? 1.5);
      }
      if (!weekend && prev.is_overtime && prev.rate_multiplier === '') {
        next.is_overtime = false;
      }
      return next;
    });
    if (date && formData.staff_id) {
      const res = checkConflicts(formData.staff_id, date, formData.vehicle_id, suggested?.start_time || formData.start_time, suggested?.end_time || formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    } else {
      setConflictWarnings([]);
      setTimeConflict(null);
    }
  };

  const toggleOvertime = (on) => {
    setFormData(prev => {
      const next = { ...prev, is_overtime: on };
      if (on && (!prev.rate_multiplier || prev.rate_multiplier === '')) {
        const dow = prev.assigned_date ? new Date(prev.assigned_date + 'T00:00:00').getDay() : 6;
        next.rate_multiplier = String(rateMap[dow] ?? 1.5);
      }
      return next;
    });
  };

  const handleVehicleChange = (vehicleId) => {
    setFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
    if (formData.staff_id && formData.assigned_date) {
      const res = checkConflicts(formData.staff_id, formData.assigned_date, vehicleId, formData.start_time, formData.end_time);
      setConflictWarnings(res.warnings);
      setTimeConflict(res.timeConflict);
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (next.staff_id && next.assigned_date && next.start_time && next.end_time) {
        const res = checkConflicts(next.staff_id, next.assigned_date, next.vehicle_id, next.start_time, next.end_time);
        setConflictWarnings(res.warnings);
        setTimeConflict(res.timeConflict);
      }
      return next;
    });
  };

  // Live day summary for the selected staff+date (multi-job indicator)
  const daySummary = (formData.staff_id && formData.assigned_date)
    ? getDailyShiftSummary(existingRotas, formData.staff_id, formData.assigned_date)
    : null;
  const showAutoSuggest = daySummary && daySummary.assignments.length > 0 && !isEditing;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Hard block: expired or missing required qualifications can't be assigned unless overridden.
    if (complianceBlocked && !complianceOverride) {
      alert(`Compliance hard-lock — ${selectedStaff?.name || 'this staff member'} is missing or has expired required qualifications:\n\n${complianceEval.blocked.map(q => '• ' + qualLabel(q)).join('\n')}\n\nTo assign anyway, tick "Override compliance block" in the warning below.`);
      return;
    }
    // Hard block: expired rig compliance (LOLER/PUWER) cannot be assigned unless overridden.
    if (rigComplianceBlocked && !rigComplianceOverride) {
      alert(`Equipment compliance hard-lock — ${selectedRig?.name || 'this rig'} has expired LOLER/PUWER compliance and cannot be assigned to a job.\n\nTo assign anyway, tick "Override equipment compliance block" in the warning below.`);
      return;
    }
    if (teamMismatch) {
      if (!confirm(`This staff member (${selectedStaffTeamName}) is not in the required teams for this job (${requiredTeamNames.join(', ')}).\n\nAssign anyway?`)) return;
    }
    // Hard block: overlapping shift times can't be saved.
    if (timeConflict) {
      alert(`This shift's times overlap with another shift for the same person on this date. Adjust the start/end time first.`);
      return;
    }
    if (conflictWarnings.length > 0) {
      if (!confirm('There are scheduling conflicts:\n\n' + conflictWarnings.map(w => '• ' + w).join('\n') + '\n\nAdd anyway?')) return;
    }
    if (!formData.assigned_date) {
      alert('Please select a date for this assignment.');
      return;
    }
    try {
      let openLeaveModal = false;
      const rateMultiplier = formData.rate_multiplier === '' ? null : Number(formData.rate_multiplier);
      const effectiveStart = formData.start_delayed && formData.actual_start_date ? formData.actual_start_date : formData.assigned_date;
      const customEndValid = assignmentMode === 'custom' && customEndDate && effectiveStart && customEndDate >= effectiveStart;
      const fullJobEnd = assignmentMode === 'full_job' && selectedJob?.end_date && selectedJob.end_date > effectiveStart ? selectedJob.end_date : '';
      const rangeEnd = customEndValid ? customEndDate : fullJobEnd;
      const isMultiDay = !isEditing && !!rangeEnd;
      const staffDivisionId = getStaffDivisionId(formData.staff_id);
      if (isEditing) {
        const payload = {
          ...formData,
          division_id: staffDivisionId,
          rig_asset_id: formData.rig_asset_id || '',
          rate_multiplier: rateMultiplier,
          actual_start_date: formData.start_delayed ? (formData.actual_start_date || null) : null
        };
        if (formData.start_delayed && formData.actual_start_date) payload.assigned_date = formData.actual_start_date;
        await base44.entities.RotaAssignment.update(assignment.id, payload);
      } else if (isMultiDay) {
        const days = buildDateRange(effectiveStart, rangeEnd, formData.work_weekends);
        const assignments = days.map((dateStr, idx) => ({
          job_id: formData.job_id,
          staff_id: formData.staff_id,
          division_id: staffDivisionId,
          assigned_date: dateStr,
          vehicle_id: formData.vehicle_id || '',
          rig_asset_id: formData.rig_asset_id || '',
          week_start: computeWeekStart(dateStr),
          start_time: formData.start_time || '',
          end_time: formData.end_time || '',
          notes: formData.notes || '',
          is_overtime: !!formData.is_overtime,
          rate_multiplier: rateMultiplier,
          work_weekends: !!formData.work_weekends,
          start_delayed: idx === 0 ? !!formData.start_delayed : false,
          actual_start_date: idx === 0 ? (formData.start_delayed ? (formData.actual_start_date || null) : null) : null,
          status: 'assigned'
        }));
        await base44.entities.RotaAssignment.bulkCreate(assignments);
        // Auto-open the leave capture popup so the manager can log annual-leave
        // date ranges that fall within this assignment span (skippable).
        const createdStaff = staff.find(s => s.id === formData.staff_id);
        const createdJob = jobs.find(j => j.id === formData.job_id);
        setLeaveModal({
          staffId: formData.staff_id,
          staffName: createdStaff?.name || '',
          jobId: formData.job_id,
          jobName: createdJob?.name || '',
          spanStart: effectiveStart,
          spanEnd: rangeEnd,
        });
        openLeaveModal = true;
      } else {
        await base44.entities.RotaAssignment.create({
          job_id: formData.job_id,
          staff_id: formData.staff_id,
          division_id: staffDivisionId,
          assigned_date: effectiveStart,
          vehicle_id: formData.vehicle_id || '',
          rig_asset_id: formData.rig_asset_id || '',
          week_start: computeWeekStart(effectiveStart),
          start_time: formData.start_time || '',
          end_time: formData.end_time || '',
          notes: formData.notes || '',
          is_overtime: !!formData.is_overtime,
          rate_multiplier: rateMultiplier,
          work_weekends: !!formData.work_weekends,
          start_delayed: !!formData.start_delayed,
          actual_start_date: formData.start_delayed ? (formData.actual_start_date || null) : null,
          status: 'assigned'
        });
      }
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      if (!openLeaveModal) onClose();
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  };

  const handleResetBriefing = async () => {
    if (!confirm('Reset the briefing for this shift?\n\nThe crew member will need to complete the site briefing again before they can start work.')) return;
    setResetting(true);
    try {
      await base44.functions.invoke('resetAssignmentBriefing', { assignment_id: assignment.id });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error resetting briefing:', error);
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this shift?')) return;
    try {
      await base44.entities.RotaAssignment.delete(assignment.id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-900">{isEditing ? 'Edit Shift' : 'New Shift'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  onFocus={() => setJobDropdownOpen(true)}
                  onBlur={() => setTimeout(() => { setJobDropdownOpen(false); if (formData.job_id) setJobSearch(''); }, 150)}
                  placeholder={selectedJob ? `${selectedJob.name}${selectedJob.location ? ` · ${selectedJob.location}` : ''}` : 'Search active jobs by name or location…'}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm"
                />
                {selectedJob && !jobSearch && (
                  <button type="button" onClick={() => { setJobSearch(' '); setJobDropdownOpen(true); }}
                    className="absolute right-2.5 top-2 text-[11px] text-emerald-600 font-semibold hover:underline">
                    Change
                  </button>
                )}
                {jobDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                    {filteredJobsList.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-sm text-slate-400">No matching jobs.</p>
                        {!showCompletedJobs && (
                          <button type="button" onClick={() => setShowCompletedJobs(true)}
                            className="mt-1 text-xs text-emerald-600 font-medium hover:underline">
            Include completed jobs in search →
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {!showCompletedJobs && !jobSearch && (
                          <button type="button" onClick={() => setShowCompletedJobs(true)}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-slate-400 hover:text-emerald-600 font-medium border-b border-slate-100 bg-slate-50/50">
            Only showing active jobs · Click to include completed →
                          </button>
                        )}
                        {filteredJobsList.map(job => (
                          <button key={job.id} type="button"
                            onMouseDown={(e) => { e.preventDefault(); handleJobChange(job.id); }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition ${formData.job_id === job.id ? 'bg-emerald-50' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800 truncate flex-1">{job.name}</span>
                              <JobStatusBadge status={job.status} />
                              {formData.job_id === job.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                            </div>
                            {job.location && <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{job.location}</p>}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectedJob && requiredTeamNames.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">Required teams: {requiredTeamNames.join(', ')}</p>
              )}
            </div>
            {selectedJob && (
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <Briefcase className="w-4 h-4 text-emerald-700" />
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedJob.name}</p>
                  {selectedJob.job_reference && (
                    <span className="ml-auto text-[11px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">{selectedJob.job_reference}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedJob.location && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedJob.location}</span>
                    </div>
                  )}
                  {selectedJob.start_date && (
                    <div className="flex items-center gap-1.5 text-slate-600 bg-white/60 rounded-md px-1.5 py-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate"><span className="text-slate-400">Planned:</span> <span className="font-semibold text-slate-700">{format(new Date(selectedJob.start_date + 'T00:00:00'), 'dd MMM yyyy')}</span> → {selectedJob.end_date ? format(new Date(selectedJob.end_date + 'T00:00:00'), 'dd MMM yyyy') : 'TBC'}</span>
                    </div>
                  )}
                  {selectedJob.project_manager && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">PM: {selectedJob.project_manager}</span>
                    </div>
                  )}
                  {selectedJob.site_contact_phone && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{selectedJob.site_contact_name ? `${selectedJob.site_contact_name} · ` : ''}{selectedJob.site_contact_phone}</span>
                    </div>
                  )}
                </div>
                {selectedJob.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 pt-1 border-t border-slate-200">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{selectedJob.notes}</p>
                  </div>
                )}
              </div>
            )}
            {selectedJob?.start_date && selectedJob.status === 'planning' && (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-semibold text-slate-800">Job Start Timing</p>
                </div>
                <p className="text-xs text-slate-500 mb-2.5">
                  Planned start: <span className="font-semibold text-slate-700">{format(new Date(selectedJob.start_date + 'T00:00:00'), 'dd MMM yyyy')}</span>. Is the job starting on time?
                </p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => { setFormData(prev => ({ ...prev, start_delayed: false, actual_start_date: '', assigned_date: selectedJob.start_date })); if (formData.staff_id) setConflictWarnings(checkConflicts(formData.staff_id, selectedJob.start_date, formData.vehicle_id)); }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${!formData.start_delayed ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> On time
                  </button>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, start_delayed: true, actual_start_date: prev.actual_start_date || prev.assigned_date || selectedJob.start_date }))}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${formData.start_delayed ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <AlertTriangle className="w-3.5 h-3.5" /> Delayed
                  </button>
                </div>
                {formData.start_delayed && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Actual start date</label>
                    <input type="date" value={formData.actual_start_date} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, actual_start_date: v, assigned_date: v })); if (formData.staff_id) setConflictWarnings(checkConflicts(formData.staff_id, v, formData.vehicle_id)); else setConflictWarnings([]); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 text-sm" />
                    {formData.actual_start_date && selectedJob.start_date && formData.actual_start_date > selectedJob.start_date && (
                      <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {differenceInDays(new Date(formData.actual_start_date + 'T00:00:00'), new Date(selectedJob.start_date + 'T00:00:00'))} day(s) behind planned start
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member *</label>
              <select value={formData.staff_id} onChange={(e) => handleStaffChange(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Staff</option>
                {sortAZ(staff, 'name').map(s => {
                  const teamName = teams.find(t => t.id === s.team_id)?.name || 'No team';
                  const aligned = selectedJob ? !isStaffOutsideJobTeams(s, selectedJob, teams) : false;
                  return <option key={s.id} value={s.id}>{s.name} — {teamName}{selectedJob && aligned ? ' ✓' : ''}</option>;
                })}
              </select>
              {selectedJob && (
                <p className="text-[11px] text-slate-400 mt-1">All staff are listed. Those in the required teams are marked ✓.</p>
              )}
              {formData.assigned_date && staff.length > 0 && (() => {
                const date = formData.assigned_date;
                const dow = new Date(date + 'T00:00:00').getDay();
                const free = staff.filter(s => {
                  if (existingRotas.some(r => r.staff_id === s.id && r.assigned_date === date && r.id !== assignment?.id)) return false;
                  if (recurring.some(r => r.staff_id === s.id && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow))) return false;
                  if (absences.some(a => a.staff_id === s.id && a.status === 'approved' && a.start_date <= date && a.end_date >= date)) return false;
                  return true;
                });
                return (
                  <p className="text-[11px] mt-1">
                    <span className="text-emerald-700 font-medium">{free.length} available</span>
                    <span className="text-slate-400"> · {staff.length - free.length} busy/off</span>
                  </p>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assignment Date</label>
              <input type="date" value={formData.assigned_date} onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              <p className="text-[11px] text-slate-400 mt-1">{defaultDate ? 'The day you clicked in the rota' : 'Pick a date for this shift'}</p>
            </div>
            {!isEditing && selectedJob && effectiveStartDisplay && (
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-semibold text-slate-800">Assignment Duration</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button type="button" onClick={() => setAssignmentMode('today')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition ${assignmentMode === 'today' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Today only
                  </button>
                  <button type="button" onClick={() => setAssignmentMode('custom')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition ${assignmentMode === 'custom' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Custom range
                  </button>
                  <button type="button" onClick={() => setAssignmentMode('full_job')}
                    disabled={!jobEndDate || jobEndDate <= effectiveStartDisplay}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed ${assignmentMode === 'full_job' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Full job
                  </button>
                </div>
                {assignmentMode === 'custom' && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">End date</label>
                    <input type="date" value={customEndDate} min={effectiveStartDisplay}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                    {customEndDate && customEndDate < effectiveStartDisplay && (
                      <p className="text-[11px] text-red-600 mt-1">End date must be on or after the assignment date.</p>
                    )}
                  </div>
                )}
                {assignmentMode === 'full_job' && (!jobEndDate || jobEndDate <= effectiveStartDisplay) && (
                  <p className="text-[11px] text-slate-400">This job has no end date beyond the assignment date — use "Today only" or "Custom range".</p>
                )}
              </div>
            )}
            {multiDayDays.length > 0 && (
              <div className="sm:col-span-2 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CalendarClock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Assignments will be created for each day from <strong>{format(new Date(effectiveStartDisplay + 'T00:00:00'), 'dd MMM')}</strong> to <strong>{format(new Date(rangeEndDate + 'T00:00:00'), 'dd MMM yyyy')}</strong> ({multiDayDays.length} day{multiDayDays.length !== 1 ? 's' : ''}).</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                <option value="">Select Vehicle (Optional)</option>
                {sortAZ(vehicles, 'registration_number').map(v => {
                  const driver = v.geotab_keeper_name || v.geotab_driver_name || v.current_operator_name;
                  return <option key={v.id} value={v.id}>{v.registration_number}{driver ? ` — ${driver}` : ''}</option>;
                })}
              </select>
            </div>
            {isDrillerStaff && (
              <div className="sm:col-span-2 rounded-lg border border-emerald-300 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Drill className="w-4 h-4 text-emerald-700" />
                  <p className="text-xs font-semibold text-slate-800">Drilling Rig — Dynamic Crew</p>
                  <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-medium ml-auto">Crew = Rig</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">Drilling crews are formed by the rig, not by crew number. Pick the rig this driller is operating — the Lead Driller + Second Man on the same rig form the crew.</p>
                <select value={formData.rig_asset_id} onChange={(e) => setFormData({ ...formData, rig_asset_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                  <option value="">Select Rig</option>
                  {sortAZ(rigs, 'name').map(r => <option key={r.id} value={r.id}>{r.name}{r.serial_number ? ` — ${r.serial_number}` : ''}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}</option>)}
                </select>
                {selectedRig && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    {selectedRig.rig_type && selectedRig.rig_type !== 'n/a' && (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{selectedRig.rig_type.toUpperCase()}</span>
                    )}
                    {selectedRig.serial_number && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">S/N: {selectedRig.serial_number}</span>
                    )}
                    {selectedRig.compliance_status && (
                      <span className={`px-2 py-0.5 rounded-full font-medium ${selectedRig.compliance_status === 'compliant' ? 'bg-emerald-100 text-emerald-700' : selectedRig.compliance_status === 'expiring' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{selectedRig.compliance_status}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Shift Hours</p>
                    <p className="text-[11px] text-slate-400">Site hours 08:00–17:00{daySummary ? ` · ${daySummary.assignments.length} shift${daySummary.assignments.length !== 1 ? 's' : ''} today` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={formData.start_time} onChange={(e) => handleTimeChange('start_time', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600" />
                  <span className="text-slate-300">→</span>
                  <input type="time" value={formData.end_time} onChange={(e) => handleTimeChange('end_time', e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              {showAutoSuggest && (
                <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1.5">
                  <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                  This is the {daySummary.assignments.length + 1}{['st','nd','rd'][Math.min(daySummary.assignments.length, 2)] || 'th'} job today — times auto-fit to avoid overlapping.
                </div>
              )}
              {showAutoSuggest && daySummary.assignments.length > 0 && (
                <div className="space-y-1">
                  {daySummary.assignments.map((a, i) => {
                    const exJob = jobs.find(j => j.id === a.job_id);
                    return (
                      <div key={a.id || i} className="flex items-center gap-2 text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#2E5A1A] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="font-medium text-slate-700 truncate flex-1">{exJob?.name || 'Job'}</span>
                        {a.start_time && <span className="text-slate-400 font-mono flex-shrink-0">{a.start_time}{a.end_time ? `–${a.end_time}` : ''}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {daySummary && daySummary.hasOverlap && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Existing shifts on this day overlap — resolve before publishing.
                </div>
              )}
            </div>
            {/* Overtime */}
            <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Overtime Shift</p>
                    <p className="text-[11px] text-slate-400">
                      {isWeekend(formData.assigned_date)
                        ? 'Weekend date — overtime suggested.'
                        : 'Enable to bill this shift at an overtime rate.'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => toggleOvertime(!formData.is_overtime)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${formData.is_overtime ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${formData.is_overtime ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {formData.is_overtime && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Rate multiplier</label>
                  <select value={formData.rate_multiplier} onChange={(e) => setFormData({ ...formData, rate_multiplier: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 text-sm">
                    <option value="">Use day default</option>
                    <option value="1.5">1.5x (time-and-a-half)</option>
                    <option value="2">2.0x (double time)</option>
                    <option value="2.5">2.5x</option>
                    <option value="3">3.0x</option>
                  </select>
                  {formData.rate_multiplier && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md whitespace-nowrap">
                      {Number(formData.rate_multiplier).toFixed(1)}x
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Work weekends toggle — per-assignment. Off by default; multi-day
                generation skips Sat/Sun unless this is on. */}
            <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Work weekends</p>
                    <p className="text-[11px] text-slate-400">Include Sat/Sun in this assignment range (off by default — no weekend work for active jobs).</p>
                  </div>
                </div>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, work_weekends: !prev.work_weekends }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${formData.work_weekends ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${formData.work_weekends ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {!formData.work_weekends && multiDayDays.length > 0 && (() => {
                const skipped = (() => {
                  const all = buildDateRange(effectiveStartDisplay, rangeEndDate, true);
                  return all.filter(d => !multiDayDays.includes(d));
                })();
                return skipped.length > 0 ? (
                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {skipped.length} weekend day{skipped.length === 1 ? '' : 's'} skipped in this range.
                  </p>
                ) : null;
              })()}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                placeholder="Add any notes for this assignment..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm resize-none" />
            </div>
          </div>
          {teamMismatch && (
            <div className="mt-3 flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Team alignment warning</p>
                <p className="text-xs text-orange-600 mt-0.5">{selectedStaff?.name} ({selectedStaffTeamName}) is not in the required teams for this job ({requiredTeamNames.join(', ')}). You can still assign them.</p>
              </div>
            </div>
          )}
          {selectedJob && selectedStaff && !teamMismatch && requiredTeamNames.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{selectedStaff.name} is in a required team for this job.</span>
            </div>
          )}
          {complianceBlocked && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldX className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">Compliance hard-lock</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {selectedStaff?.name} cannot be assigned — required qualifications are missing or expired:
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {complianceEval.missing.map((q) => (
                      <li key={`m-${q}`} className="text-xs text-red-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {qualLabel(q)} <span className="text-red-400">— missing</span>
                      </li>
                    ))}
                    {complianceEval.expired.map((q) => (
                      <li key={`e-${q}`} className="text-xs text-red-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {qualLabel(q)} <span className="text-red-400">— expired</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-red-700 cursor-pointer bg-white/60 rounded-md px-2.5 py-2 border border-red-200">
                <input type="checkbox" checked={complianceOverride} onChange={(e) => setComplianceOverride(e.target.checked)} className="w-4 h-4 accent-red-600" />
                Override — assign anyway and accept responsibility
              </label>
            </div>
          )}
          {!complianceBlocked && complianceExpiring && (
            <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Expiring qualifications</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {complianceEval.expiring.map((q) => qualLabel(q)).join(', ')} expire(s) within 30 days. Assignment is allowed, but book renewal training soon.
                </p>
              </div>
            </div>
          )}
          {rigComplianceBlocked && (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldX className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">Equipment compliance hard-lock</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {selectedRig?.name} has expired LOLER/PUWER compliance and cannot be assigned to a job until it passes inspection.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-red-700 cursor-pointer bg-white/60 rounded-md px-2.5 py-2 border border-red-200">
                <input type="checkbox" checked={rigComplianceOverride} onChange={(e) => setRigComplianceOverride(e.target.checked)} className="w-4 h-4 accent-red-600" />
                Override — assign anyway and accept responsibility
              </label>
            </div>
          )}
          {conflictWarnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {conflictWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {isEditing ? 'Update Assignment' : multiDayDays.length > 1 ? `Add ${multiDayDays.length} Assignments` : 'Add Assignment'}
            </button>
            {isEditing && assignment.briefing_signed && (
              <button type="button" onClick={handleResetBriefing} disabled={resetting}
                className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition font-medium text-sm flex items-center gap-1.5 disabled:opacity-50">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset Briefing
              </button>
            )}
            {isEditing && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      </div>
      {leaveModal && (
        <LeaveCaptureModal
          open={!!leaveModal}
          onClose={() => setLeaveModal(null)}
          staffId={leaveModal.staffId}
          staffName={leaveModal.staffName}
          jobId={leaveModal.jobId}
          jobName={leaveModal.jobName}
          spanStart={leaveModal.spanStart}
          spanEnd={leaveModal.spanEnd}
        />
      )}
    </div>
  );
}