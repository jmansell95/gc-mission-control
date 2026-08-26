import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format, subWeeks } from 'date-fns';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X, Copy,
  MapPin, Truck, Clock, CheckCircle2, PlayCircle, ClipboardCheck,
  Users, Briefcase, Search, Filter, StickyNote, Save, Send, Loader2, CalendarDays,
  LogIn, LogOut, Repeat, Layers, Trash2, AlertTriangle, Zap
} from 'lucide-react';
import AssignmentModal from '@/components/AssignmentModal';
import ComplianceBlockModal from '@/components/ComplianceBlockModal';
import StaffSwapModal from '@/components/StaffSwapModal';
import StaffRotaManager from '@/components/rota/StaffRotaManager';
import { EmptyState, ErrorState, RotaSkeleton, Skeleton, SkeletonText } from '@/components/StateViews';
import { formatJobType } from '@/utils/format';
import { getJobPrimaryType } from '@/utils/jobTeams';
import { getCrewLabel } from '@/utils/terminology';
import { getCurrentTimeStr, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { computeRotaWarnings } from '@/utils/rotaWarnings';
import RotaWarningsPanel from '@/components/RotaWarningsPanel';
import { useDivision } from '@/contexts/DivisionContext';
import { sortAZ } from '@/utils';
import RotaWeatherBadge from '@/components/rota/RotaWeatherBadge';
const jobTypeColors = {
  drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  groundworks: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  cp_drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  rotary_drilling: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  enabling_works: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  depot: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' }
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, dot: 'bg-slate-400', text: 'text-slate-500' },
  started: { label: 'Started', icon: PlayCircle, dot: 'bg-blue-500', text: 'text-blue-600' },
  completed: { label: 'Done', icon: CheckCircle2, dot: 'bg-emerald-500', text: 'text-emerald-600' }
};

export default function WeeklyRotaBuilder() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, assignment: null, defaultStaffId: '', defaultDate: '' });

  // Listen for the "Add Shift" button dispatched by UnifiedRotaBuilder.
  // Opens the smart AssignmentModal with empty defaults (no pre-selected staff/date).
  useEffect(() => {
    const handler = () => setModal({ isOpen: true, assignment: null, defaultStaffId: '', defaultDate: '' });
    window.addEventListener('gc-open-add-shift', handler);
    return () => window.removeEventListener('gc-open-add-shift', handler);
  }, []);
  const [teamFilter, setTeamFilter] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showWeekends, setShowWeekends] = useState(false);
  const [complianceViolations, setComplianceViolations] = useState(null);
  const [swapAssignment, setSwapAssignment] = useState(null);
  const [todayCrewExpanded, setTodayCrewExpanded] = useState(false);
  const [rotaManagerStaff, setRotaManagerStaff] = useState(null);

  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [], isLoading: staffLoading, isError: staffError, refetch: refetchStaff } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas', weekStartStr, activeDivisionId || 'overview'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDivisionScopedData', {
        entity: 'RotaAssignment',
        division_id: activeDivisionId,
        filter: { week_start: weekStartStr },
      });
      return res.data?.data || [];
    }
  });

  const { data: weekRecord } = useQuery({
    queryKey: ['rota-week', weekStartStr],
    queryFn: async () => { const list = await base44.entities.RotaWeek.filter({ week_start: weekStartStr }); return list[0] || null; }
  });
  const isPublished = weekRecord?.status === 'published';

  const days = Array.from({ length: showWeekends ? 7 : 5 }, (_, i) => addDays(weekStart, i));

  // Filter staff by team and search
  const filteredStaff = staff.filter(s => {
    if (teamFilter && s.team_id !== teamFilter) return false;
    if (staffSearch && !s.name.toLowerCase().includes(staffSearch.toLowerCase())) return false;
    return true;
  });

  // Group staff by team category for visual separation on the rota:
  // Field Teams → Depot Teams → Management → Unassigned.
  // Each group gets a coloured header row so managers can instantly see
  // where field crews, depot staff, and management are for any given day.
  const STAFF_GROUPS = [
    { key: 'field_ops', label: 'Field Team Staff', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
          { key: 'depot', label: 'Depot Team Staff', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
    { key: 'management', label: 'Management', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300' },
    { key: 'unassigned', label: 'Unassigned', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-300' },
  ];
  const staffByGroup = STAFF_GROUPS.map(g => ({
    ...g,
    members: filteredStaff.filter(s => {
      const team = teams.find(t => t.id === s.team_id);
      const cat = team?.category;
      // Agency workers and subcontractors without a depot/management team
      // are treated as field team staff so managers see them on the rota.
      const isExternalFieldWorker = s.worker_type === 'agency' || s.worker_type === 'subcontractor';
      if (g.key === 'field_ops') return cat === 'field_ops' || (!cat && isExternalFieldWorker);
      if (g.key === 'unassigned') return !cat && !isExternalFieldWorker;
      return cat === g.key;
    }),
  }));

  const rotasByStaff = {};
  filteredStaff.forEach(s => { rotasByStaff[s.id] = Array.from({ length: days.length }, () => []); });
  rotas.forEach(rota => {
    // Non-job assignments (annual_leave, sick, training) are shown via the
    // leaveState banner, not as job cards — skip them here to avoid "Unknown".
    if (rota.assignment_type && rota.assignment_type !== 'job') return;
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === rota.assigned_date);
    if (dayIndex !== -1 && rotasByStaff[rota.staff_id]) {
      rotasByStaff[rota.staff_id][dayIndex].push(rota);
    }
  });

  const leaveState = (staffId, dateStr) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
    if (rec) return { recurring: true, label: rec.label || 'Day Off' };
    // Check for non-job rota assignments (annual_leave, sick, training) — these
    // are imported from the planner and give us a specific type + label.
    const nonJobRota = rotas.find(r => r.staff_id === staffId && r.assigned_date === dateStr && r.assignment_type && r.assignment_type !== 'job');
    if (nonJobRota) {
      if (nonJobRota.assignment_type === 'sick') return { recurring: false, label: 'Sick', type: 'sick' };
      if (nonJobRota.assignment_type === 'training') return { recurring: false, label: 'Training', type: 'training' };
      if (nonJobRota.assignment_type === 'yard_depot') return { recurring: false, label: 'Depot', type: 'yard_depot' };
      return { recurring: false, label: 'On Leave', type: 'annual_leave' };
    }
    const leave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= dateStr && a.end_date >= dateStr);
    if (leave) return { recurring: false, label: 'On Leave', type: 'annual_leave' };
    return null;
  };

  // Dates in the past, or today after the working day ends, are locked —
  // managers can't add or move assignments to them.
  const isDateLocked = (dateStr) => {
    if (dateStr < todayStr) return true;
    if (dateStr === todayStr) return getCurrentTimeStr() > SITE_CLOSE_TIME;
    return false;
  };

  // Dynamic drilling group — shown as a pill badge next to the staff name
  // instead of as the team/job-title text. Strips "Dynamic" from the title.
  const getDynamicTeamInfo = (member) => {
    const team = teams.find(t => t.id === member.team_id);
    const name = team?.name || '';
    const isDynamic = /\bdynamic\b/i.test(name);
    const stripped = name.replace(/\s*\(?\bdynamic\b\)?\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    const displayName = isDynamic
      ? (stripped || member.job_title || 'Drilling Crew')
      : (name || (member.worker_type === 'agency' ? 'Agency Worker' : member.worker_type === 'subcontractor' ? 'Subcontractor' : 'Unassigned'));
    return { isDynamic, displayName };
  };

  const handleCellClick = (staffId, dateStr) => {
    if (isDateLocked(dateStr)) return;
    const ls = leaveState(staffId, dateStr);
    if (ls && !confirm(`This staff member is marked as ${ls.label} on this date. Assign them anyway?`)) return;
    setModal({ isOpen: true, assignment: null, defaultStaffId: staffId, defaultDate: dateStr });
  };

  const handleEditAssignment = (assignment) => {
    setModal({ isOpen: true, assignment, defaultStaffId: '', defaultDate: '' });
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    try {
      await base44.entities.RotaAssignment.delete(id);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const [srcStaff, srcDate] = source.droppableId.split('|');
    const [dstStaff, dstDate] = destination.droppableId.split('|');
    if (srcStaff === dstStaff && srcDate === dstDate) return;
    if (isDateLocked(dstDate)) return;
    const dstLeave = leaveState(dstStaff, dstDate);
    if (dstLeave && !confirm(`This staff member is marked as ${dstLeave.label} on this date. Move the assignment anyway?`)) return;
    const assignment = rotas.find(r => r.id === draggableId);
    if (!assignment) return;
    try {
      await base44.entities.RotaAssignment.update(assignment.id, { staff_id: dstStaff, assigned_date: dstDate });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error moving assignment:', error);
    }
  };

  const handleSmartFill = async () => {
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekStr = format(prevWeekStart, 'yyyy-MM-dd');
    setSmartFillLoading(true);
    try {
      const res = await base44.functions.invoke('getDivisionScopedData', {
        entity: 'RotaAssignment',
        division_id: activeDivisionId,
        filter: { week_start: prevWeekStr },
      });
      const prevWeekRotas = res.data?.data || [];
      if (prevWeekRotas.length === 0) {
        alert('No assignments found for last week to copy.');
        setSmartFillLoading(false);
        return;
      }
      if (!confirm(`Copy ${prevWeekRotas.length} assignments from last week to this week?`)) {
        setSmartFillLoading(false);
        return;
      }
      const newAssignments = prevWeekRotas.map(r => {
        const prevDate = new Date(r.assigned_date + 'T00:00:00');
        return {
          job_id: r.job_id,
          staff_id: r.staff_id,
          assigned_date: format(addDays(prevDate, 7), 'yyyy-MM-dd'),
          vehicle_id: r.vehicle_id || '',
          start_time: r.start_time || '',
          end_time: r.end_time || '',
          notes: r.notes || '',
          is_overtime: !!r.is_overtime,
          rate_multiplier: r.rate_multiplier != null ? r.rate_multiplier : null,
          week_start: weekStartStr,
          status: 'assigned'
        };
      });
      await base44.entities.RotaAssignment.bulkCreate(newAssignments);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error smart filling:', error);
      alert('Failed to copy assignments.');
    }
    setSmartFillLoading(false);
  };

  // Multi-week copy: replicate THIS week's assignments forward N weeks so a
  // stable plan can be propagated without re-entering every shift by hand.
  const handleCopyForward = async () => {
    if (rotas.length === 0) { setNotice({ type: 'error', msg: 'Nothing in this week to copy yet.' }); return; }
    const input = window.prompt(`Copy this week's ${rotas.length} assignments forward how many weeks?`, '2');
    if (!input) return;
    const weeks = parseInt(input, 10);
    if (isNaN(weeks) || weeks < 1 || weeks > 8) { setNotice({ type: 'error', msg: 'Enter a number of weeks between 1 and 8.' }); return; }
    if (!confirm(`Replicate this week's ${rotas.length} assignments across the next ${weeks} ${weeks === 1 ? 'week' : 'weeks'}?`)) return;
    setSmartFillLoading(true);
    try {
      const all = [];
      for (let w = 1; w <= weeks; w++) {
        const targetWeekStart = format(addDays(weekStart, w * 7), 'yyyy-MM-dd');
        rotas.forEach(r => {
          const srcDate = new Date(r.assigned_date + 'T00:00:00');
          all.push({
            job_id: r.job_id,
            staff_id: r.staff_id,
            assigned_date: format(addDays(srcDate, w * 7), 'yyyy-MM-dd'),
            vehicle_id: r.vehicle_id || '',
            start_time: r.start_time || '',
            end_time: r.end_time || '',
            notes: r.notes || '',
            is_overtime: !!r.is_overtime,
            rate_multiplier: r.rate_multiplier != null ? r.rate_multiplier : null,
            week_start: targetWeekStart,
            status: 'assigned'
          });
        });
      }
      await base44.entities.RotaAssignment.bulkCreate(all);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      setNotice({ type: 'success', msg: `Copied ${rotas.length} assignments × ${weeks} weeks (${all.length} shifts created).` });
    } catch (error) {
      console.error('Error copying forward:', error);
      setNotice({ type: 'error', msg: 'Failed to copy assignments forward.' });
    }
    setSmartFillLoading(false);
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      if (weekRecord) {
        await base44.entities.RotaWeek.update(weekRecord.id, { status: 'draft', superseded: false });
      } else {
        await base44.entities.RotaWeek.create({ week_start: weekStartStr, status: 'draft' });
        // Supersede all previously published weeks so staff can't see old schedules
        await base44.entities.RotaWeek.updateMany(
          { status: 'published', superseded: { $ne: true } },
          { $set: { superseded: true } }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['rota-week'] });
      queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
      setNotice({ type: 'success', msg: 'Draft saved. Staff will see the new schedule once you submit it.' });
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'Failed to save draft' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitWeek = async (force = false) => {
    if (rotas.length === 0) { setNotice({ type: 'error', msg: 'No assignments to submit yet.' }); return; }
    const label = `${format(weekStart, 'dd MMM')} – ${format(addDays(weekStart, 6), 'dd MMM yyyy')}`;
    if (!force && !confirm(`Submit the rota for ${label}?\n\nThis will email each assigned staff member their personal schedule.`)) return;
    setPublishing(true);
    try {
      const res = await base44.functions.invoke('publishRotaWeek', { weekStart: weekStartStr, force });
      const d = res.data || {};
      setComplianceViolations(null);
      queryClient.invalidateQueries({ queryKey: ['rota-week'] });
      queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
      const parts = [`Rota published — ${d.emailed || 0} staff emailed`];
      if (d.jobsActivated) parts.push(`${d.jobsActivated} job(s) activated`);
      if (d.skipped) parts.push(`${d.skipped} without a valid email`);
      if (d.disabled) parts.push('schedule email is disabled in Settings');
      setNotice({ type: 'success', msg: parts.join(', ') + '.' });
    } catch (e) {
      const errData = e.response?.data || e.response || {};
      if (errData.error === 'compliance_violations' && errData.violations) {
        setComplianceViolations(errData.violations);
      } else {
        setNotice({ type: 'error', msg: errData.error || e.message || 'Failed to publish rota' });
      }
    } finally {
      setPublishing(false);
    }
  };

  // Delete the entire draft week: removes all assignments for this week and the
  // RotaWeek record itself. Only available while the week is still a draft
  // (not yet published to staff). Published weeks are protected.
  const [deletingDraft, setDeletingDraft] = useState(false);
  const handleDeleteDraft = async () => {
    if (isPublished) return;
    const label = `${format(weekStart, 'dd MMM')} – ${format(addDays(weekStart, 6), 'dd MMM yyyy')}`;
    const count = rotas.length;
    if (!confirm(
      `DELETE THIS DRAFT ROTA?\n\n` +
      `Week of ${label}\n\n` +
      `This will permanently remove ${count} assignment${count === 1 ? '' : 's'} and clear the draft.\n` +
      `Staff will NOT be notified (the rota was never published).\n\n` +
      `This cannot be undone.`
    )) return;
    setDeletingDraft(true);
    try {
      // Remove all assignments for this week
      if (count > 0) {
        await base44.entities.RotaAssignment.deleteMany({ week_start: weekStartStr });
      }
      // Remove the draft RotaWeek record so the week resets to "unscheduled"
      if (weekRecord) {
        await base44.entities.RotaWeek.delete(weekRecord.id);
      }
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rota-week'] });
      queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      setNotice({ type: 'success', msg: `Draft rota deleted — ${count} assignment${count === 1 ? '' : 's'} removed.` });
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'Failed to delete draft rota' });
    } finally {
      setDeletingDraft(false);
    }
  };

  const goToPrevWeek = () => setSelectedWeek(prev => addDays(prev, -7));
  const goToNextWeek = () => setSelectedWeek(prev => addDays(prev, 7));

  const jobRotas = rotas.filter(r => !r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot');
  const totalAssignments = jobRotas.length;
  const staffWorking = [...new Set(jobRotas.map(r => r.staff_id))].length;
  const jobsActive = [...new Set(jobRotas.map(r => r.job_id).filter(Boolean))].length;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const rotaWarnings = computeRotaWarnings({
    weekStartStr,
    rotas,
    staff,
    jobs,
    absences,
    recurring,
  });

  const renderAssignmentCard = (assignment, opts = {}) => {
    const job = jobs.find(j => j.id === assignment.job_id);
    const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
    const client = clients.find(c => c.id === job?.client_id);
    const colors = jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
    const { isMulti = false, jobIndex = 0 } = opts;

    const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
    const StatusIcon = status.icon;
    return (
      <div key={assignment.id} className={`group relative px-2.5 py-2 rounded-lg text-xs border-l-[3px] cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-150 ${assignment.is_overtime ? 'border-l-amber-400 ring-1 ring-amber-200/60' : ''} ${colors.bg} ${colors.border}`}
        onClick={() => handleEditAssignment(assignment)}>
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="font-bold text-slate-900 truncate flex-1 leading-tight">{job?.name || 'Unknown'}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {job && <RotaWeatherBadge job={job} />}
            {isMulti && (
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#2E5A1A] text-white font-bold whitespace-nowrap">
                #{jobIndex}
              </span>
            )}
            {assignment.is_overtime && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold whitespace-nowrap">
                OT{assignment.rate_multiplier ? ` ${Number(assignment.rate_multiplier)}x` : ''}
              </span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }}
            className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded transition">
            <X className="w-3 h-3" />
          </button>
        </div>
        {job?.location && (
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {vehicle && (
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <Truck className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="font-mono truncate">{vehicle.registration_number}</span>
          </div>
        )}
        {(assignment.start_time || assignment.end_time) && (
          <div className="flex items-center gap-1 text-slate-500 mb-1">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{assignment.start_time || '—'} - {assignment.end_time || '—'}</span>
          </div>
        )}
        {assignment.arrived_on_site_at && (
          <div className="flex items-center gap-1 text-emerald-600 mb-1">
            <LogIn className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">Arrived {format(new Date(assignment.arrived_on_site_at), 'HH:mm')}</span>
          </div>
        )}
        {assignment.early_leave_reason && (
          <div className="flex items-center gap-1 text-amber-600 mb-1">
            <LogOut className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">Left early · {assignment.early_leave_reason}</span>
          </div>
        )}
        {assignment.notes && (
          <div className="flex items-start gap-1 text-slate-500 mb-1">
            <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
            <span className="truncate italic">{assignment.notes}</span>
          </div>
        )}
        {client && (
          <div className="text-slate-400 truncate mb-1">{client.name}</div>
        )}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
          <span className={`inline-flex items-center gap-0.5 ${status.text}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            <span className="text-[10px] font-medium">{status.label}</span>
          </span>
          {assignment.briefing_signed && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <ClipboardCheck className="w-2.5 h-2.5" />
            </span>
          )}
          {assignment.shift_status === 'confirmed' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✓ Confirmed</span>
          )}
          {assignment.shift_status === 'declined' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">✗ Declined</span>
          )}
          {assignment.meterage > 0 && (
            <span className="text-[10px] text-amber-600 font-medium">{assignment.meterage}m</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); setSwapAssignment(assignment); }}
            className="ml-auto text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded-md transition flex items-center gap-0.5">
            <Repeat className="w-2.5 h-2.5" /> Swap/Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Compact action header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm mb-4 overflow-hidden">
        <div className="relative px-4 md:px-5 py-3.5 md:py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pl-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight leading-tight">Rota Builder</h1>
                <p className="text-slate-500 text-[11px] md:text-xs">Drag to move · click a cell to add</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={handleSmartFill} disabled={smartFillLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium disabled:opacity-50">
                <Copy className="w-4 h-4" /> <span className="hidden sm:inline">{smartFillLoading ? '...' : 'Copy Last Week'}</span>
              </button>
              <button onClick={() => setModal({ isOpen: true, assignment: null, defaultStaffId: '', defaultDate: '' })}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-semibold shadow-sm">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Shift</span>
              </button>
              <button onClick={handleSaveDraft} disabled={savingDraft}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium disabled:opacity-50">
                {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} <span className="hidden sm:inline">Draft</span>
              </button>
              <button onClick={() => handleSubmitWeek()} disabled={publishing}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition text-sm font-semibold disabled:opacity-50 shadow-sm">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} <span className="hidden sm:inline">{isPublished ? 'Resend' : 'Publish'}</span>
              </button>
              {weekRecord && !isPublished && (
                <button onClick={handleDeleteDraft} disabled={deletingDraft || rotas.length === 0}
                  title={rotas.length === 0 ? 'No assignments to delete' : 'Delete this draft rota and all its assignments'}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  {deletingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} <span className="hidden sm:inline">Delete Draft</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {notice && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${notice.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <span className="font-medium flex-1">{notice.msg}</span>
          <button onClick={() => setNotice(null)} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Draft state banner — makes it unmistakable that this week has NOT been
          published to staff yet. Shown whenever a draft RotaWeek record exists. */}
      {weekRecord && !isPublished && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">This is a DRAFT rota — staff cannot see it yet</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {rotas.length > 0
                ? `${rotas.length} assignment${rotas.length === 1 ? '' : 's'} saved as draft. Click Publish to email the schedule to your crew, or Delete Draft to scrap it and start over.`
                : 'No assignments yet. Add shifts, then Publish to email the schedule to your crew.'}
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wide flex-shrink-0">
            <Clock className="w-3.5 h-3.5" /> Draft
          </span>
        </div>
      )}

      {/* Week Navigator + Stats + Filters — single compact strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2.5 mb-3">
        {/* Row 1: week nav + stat pills */}
        {/* Row 1: date picker + filters — all on one line */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 mb-2">
          <div className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 px-1.5 py-1 w-full sm:w-auto sm:flex-shrink-0">
            <button onClick={goToPrevWeek} className="p-1 hover:bg-slate-200 rounded-md transition"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
            <div className="text-sm font-semibold text-slate-900 flex-1 sm:min-w-[140px] text-center">
              {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM yyyy')}
            </div>
            <button onClick={goToNextWeek} className="p-1 hover:bg-slate-200 rounded-md transition"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <button onClick={() => setSelectedWeek(new Date())}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${weekStartStr === format(new Date(), 'yyyy-MM-dd') ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
              Today
            </button>
            <input type="date" value={weekStartStr} onChange={(e) => setSelectedWeek(new Date(e.target.value))}
              className="text-xs px-1.5 py-1 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-600 text-slate-600 w-full sm:w-[120px]" />
          </div>

          {/* Stat pills — centered in the middle */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:flex-1 justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-slate-900 tabular-nums">{totalAssignments}</span>
              <span className="text-slate-500">Shifts</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-900 tabular-nums">{staffWorking}</span>
              <span className="text-slate-500">Crew</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs">
              <Briefcase className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-bold text-slate-900 tabular-nums">{jobsActive}</span>
              <span className="text-slate-500">Jobs</span>
            </span>
            {weekRecord && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${isPublished ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                {isPublished ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                <span className="font-bold text-slate-900">{isPublished ? 'Published' : 'Draft'}</span>
              </span>
            )}
          </div>

          {/* Filters — right side */}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:flex-shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg border border-slate-200 px-2.5 py-1.5 flex-1 sm:min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input type="text" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff..."
                className="flex-1 text-sm focus:outline-none bg-transparent text-slate-700 placeholder:text-slate-400 w-full sm:w-[120px]" />
              {staffSearch && (
                <button onClick={() => setStaffSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg border border-slate-200 px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                className="text-sm focus:outline-none bg-transparent text-slate-700 font-medium">
                <option value="">All Teams</option>
                {sortAZ(teams, 'name').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowWeekends(v => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${showWeekends ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
              <CalendarDays className="w-3.5 h-3.5" />
              {showWeekends ? 'Mon–Sun' : 'Mon–Fri'}
            </button>
            {(teamFilter || staffSearch) && (
              <span className="text-xs text-slate-500 self-center">
                {filteredStaff.length} of {staff.length} staff
              </span>
            )}
          </div>
        </div>
      </div>

      <RotaWarningsPanel warnings={rotaWarnings} />

      {/* Today's Crew — collapsed toggle bar, sits right under the filters */}
      {(() => {
        const todayRotas = rotas.filter(r => r.assigned_date === todayStr && (!r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot'));
        const todayCrew = [...new Set(todayRotas.map(r => r.staff_id))];
        const todayLeave = rotas.filter(r => r.assigned_date === todayStr && r.assignment_type && r.assignment_type !== 'job');
        const byJob = {};
        todayRotas.forEach(r => {
          if (r.assignment_type === 'yard_depot') {
            if (!byJob['depot']) byJob['depot'] = [];
            byJob['depot'].push(r);
          } else {
            const jid = r.job_id || 'unassigned';
            if (!byJob[jid]) byJob[jid] = [];
            byJob[jid].push(r);
          }
        });
        const jobGroups = Object.entries(byJob);
        return (
          <div className="mb-3 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setTodayCrewExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100/60 transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Today's Crew</h3>
                <span className="text-[11px] text-slate-400">{format(new Date(), 'EEEE dd MMM')}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500"><strong className="text-slate-900">{todayCrew.length}</strong> on site</span>
                <span className="text-slate-500"><strong className="text-slate-900">{jobGroups.length}</strong> jobs</span>
                {todayLeave.length > 0 && <span className="text-amber-600"><strong className="text-amber-700">{todayLeave.length}</strong> off</span>}
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${todayCrewExpanded ? 'rotate-90' : ''}`} />
              </div>
            </button>
            {todayCrewExpanded && (
              todayRotas.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-300" />
                  No crew assigned for today — add shifts in the grid below or import from the planner.
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {jobGroups.map(([jid, group]) => {
                    const job = jobs.find(j => j.id === jid);
                    const colors = jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
                    return (
                      <div key={jid} className={`rounded-lg border ${colors.border} ${colors.bg} px-3 py-2`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <p className="text-sm font-bold text-slate-800 truncate flex-1">{jid === 'depot' ? 'Depot Duty' : (job?.name || 'Unassigned')}</p>
                          {job?.location && <span className="hidden sm:flex items-center gap-0.5 text-xs text-slate-400 truncate max-w-[140px]"><MapPin className="w-3 h-3" />{job.location}</span>}
                          <span className="text-[10px] font-bold text-slate-500 bg-white/70 rounded-full px-1.5 py-0.5 flex-shrink-0">{group.length}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.map(a => {
                            const member = staff.find(s => s.id === a.staff_id);
                            const status = statusConfig[a.status || 'assigned'] || statusConfig.assigned;
                            const StatusIcon = status.icon;
                            return (
                              <button key={a.id} onClick={() => handleEditAssignment(a)}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-2.5 py-1 hover:shadow-sm hover:border-emerald-300 transition group">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-emerald-700 font-bold text-[10px]">{member?.name?.charAt(0) || '?'}</span>
                                </span>
                                <span className="text-xs font-medium text-slate-700 leading-none">{member?.name || 'Unknown'}</span>
                                <StatusIcon className={`w-3 h-3 ${status.text}`} />
                                {a.briefing_signed && <ClipboardCheck className="w-3 h-3 text-emerald-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        );
      })()}

      {/* Per-day capacity strip */}
      <div className="hidden lg:flex gap-2 mb-3 pl-[228px]">
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayRotas = rotas.filter(r => r.assigned_date === dayStr && (!r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot'));
          const dayCrew = [...new Set(dayRotas.map(r => r.staff_id))].length;
          const overlaps = dayRotas.length > 1
            ? dayRotas.filter(r => r.start_time && r.end_time && dayRotas.some(o => o.id !== r.id && o.staff_id === r.staff_id && o.start_time && o.end_time && (() => { const a = r.start_time.replace(':',''), b = r.end_time.replace(':',''), c = o.start_time.replace(':',''), d = o.end_time.replace(':',''); return a < d && c < b; })())).length
            : 0;
          const isToday = dayStr === todayStr;
          return (
            <div key={dayStr} className={`flex-1 rounded-xl border px-2.5 py-2 text-center transition ${isToday ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-emerald-700' : 'text-slate-400'}`}>{format(day, 'EEE')}</p>
              <p className={`text-lg font-bold leading-tight ${isToday ? 'text-emerald-700' : 'text-slate-800'}`}>{dayRotas.length}</p>
              <p className="text-[9px] text-slate-400">{dayCrew} crew · shifts</p>
              {overlaps > 0 && <p className="text-[9px] text-red-600 font-semibold mt-0.5">⚠ {overlaps} clash</p>}
            </div>
          );
        })}
      </div>

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, assignment: null, defaultStaffId: '', defaultDate: '' })}
        assignment={modal.assignment}
        defaultStaffId={modal.defaultStaffId}
        defaultDate={modal.defaultDate}
        weekStartStr={weekStartStr}
        staff={staff}
        jobs={jobs}
        vehicles={vehicles}
        existingRotas={rotas}
      />

      <ComplianceBlockModal
        open={!!complianceViolations}
        violations={complianceViolations || []}
        publishing={publishing}
        onForce={() => handleSubmitWeek(true)}
        onCancel={() => { setComplianceViolations(null); setPublishing(false); }}
      />

      {swapAssignment && (
        <StaffSwapModal
          assignment={swapAssignment}
          staff={staff}
          jobs={jobs}
          teams={teams}
          existingRotas={rotas}
          onClose={() => setSwapAssignment(null)}
        />
      )}

      {rotaManagerStaff && (
        <StaffRotaManager
          open={!!rotaManagerStaff}
          onClose={() => setRotaManagerStaff(null)}
          staff={rotaManagerStaff}
          weekStartStr={weekStartStr}
          rotas={rotas}
          jobs={jobs}
          vehicles={vehicles}
        />
      )}

      {/* Desktop Grid */}
      <div className="hidden lg:block bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        {staffLoading ? (
          <RotaSkeleton />
        ) : staffError ? (
          <ErrorState message="Couldn't load the rota" onRetry={refetchStaff} />
        ) : (
        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}><table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 text-white">
                <th className="px-4 py-3.5 text-left font-semibold text-sm w-56 sticky left-0 z-10 bg-gradient-to-r from-emerald-900 to-emerald-800 border-r border-white/10">Staff</th>
                {days.map(day => {
                  const isToday = format(day, 'yyyy-MM-dd') === todayStr;
                  return (
                    <th key={day.toISOString()} className={`px-3 py-3.5 text-center font-semibold text-sm whitespace-nowrap transition ${isToday ? 'bg-emerald-600 ring-2 ring-emerald-400 ring-inset' : 'hover:bg-emerald-800/50'} ${isDateLocked(format(day, 'yyyy-MM-dd')) ? 'opacity-50' : ''}`}>
                      <div className="text-[11px] font-normal opacity-75 uppercase tracking-wide">{format(day, 'EEE')}</div>
                      <div className="text-base font-bold">{format(day, 'dd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffByGroup.map(group => (
                <React.Fragment key={group.key}>
                  {group.members.length > 0 && (
                    <tr className={`border-b-2 ${group.border}`}>
                      <td colSpan={days.length + 1} className={`px-4 py-2 ${group.bg} sticky left-0 z-10`}>
                        <span className={`text-xs font-bold uppercase tracking-wide ${group.color}`}>
                          {group.label} · {group.members.length}
                        </span>
                      </td>
                    </tr>
                  )}
                  {group.members.map((member, idx) => (
                <tr key={member.id} className={`border-b border-slate-100 transition hover:bg-emerald-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-3 sticky left-0 z-10 bg-inherit border-r border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-slate-900 text-sm whitespace-nowrap truncate">{member.name}</p>
                          {member.worker_type === 'agency' && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">AGENCY</span>
                          )}
                          {member.worker_type === 'subcontractor' && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">SUBCON</span>
                          )}
                        </div>
                        {getDynamicTeamInfo(member).isDynamic && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 self-start text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">
                            <Zap className="w-2.5 h-2.5" /> DYNAMIC
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 truncate">{getDynamicTeamInfo(member).displayName}</p>
                          <button
                            onClick={() => setRotaManagerStaff(member)}
                            title="Manage this crew member's rota — edit dates or delete"
                            className="mt-0.5 text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-1.5 py-0.5 rounded transition inline-flex items-center gap-0.5"
                          >
                            <Calendar className="w-2.5 h-2.5" /> Manage
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                  {days.map((day, dayIdx) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayAssignments = rotasByStaff[member.id]?.[dayIdx] || [];
                    // Sort by start_time so multi-job days show in chronological order
                    const sortedAssignments = [...dayAssignments].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
                    const isMulti = sortedAssignments.length >= 2;
                    const isToday = dayStr === todayStr;
                    const ls = leaveState(member.id, dayStr);
                    return (
                      <td key={`${member.id}-${dayIdx}`} className={`px-2 py-2 align-top ${isToday ? 'bg-emerald-50/40' : ''} ${ls ? (ls.recurring ? 'bg-slate-100/70' : ls.type === 'yard_depot' ? 'bg-amber-50/60' : 'bg-red-50/60') : ''} group/cell`}>
                        <Droppable droppableId={`${member.id}|${dayStr}`}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}
                              className={`space-y-1.5 min-h-[44px] rounded-lg transition ${snapshot.isDraggingOver ? 'bg-emerald-50/70 ring-2 ring-emerald-300/60' : ''}`}>
                              {ls && (
                                <div className={`px-2 py-1 rounded text-[10px] font-bold text-center ${
                                  ls.recurring ? 'bg-slate-200 text-slate-600' :
                                  ls.type === 'sick' ? 'bg-rose-100 text-rose-600' :
                                  ls.type === 'training' ? 'bg-violet-100 text-violet-600' :
                                  ls.type === 'yard_depot' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-600'
                                }`}>
                                  {(ls.label || 'ON LEAVE').toUpperCase()}
                                </div>
                              )}
                              {/* Multi-job count badge — shows when 2+ jobs are assigned */}
                              {isMulti && !ls && (
                                <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-[#2E5A1A] text-white text-[9px] font-bold">
                                  <Layers className="w-2.5 h-2.5" /> {sortedAssignments.length} JOBS
                                </div>
                              )}
                              {sortedAssignments.map((assignment, aIdx) => (
                                <Draggable draggableId={assignment.id} index={aIdx} key={assignment.id}>
                                  {(p) => (
                                    <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                      className={`active:cursor-grabbing ${isMulti && aIdx > 0 ? 'border-l-2 border-l-[#2E5A1A]/30' : ''}`}>
                                      {renderAssignmentCard(assignment, { isMulti, jobIndex: aIdx + 1 })}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {!isDateLocked(dayStr) && (
                                <button onClick={() => handleCellClick(member.id, dayStr)}
                                  className="w-full py-1 text-[10px] text-slate-300 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition flex items-center justify-center gap-0.5 opacity-0 group-hover/cell:opacity-100">
                                  <Plus className="w-2.5 h-2.5" /> Add
                                </button>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
                  ))}
                </React.Fragment>
              ))}
              {filteredStaff.length === 0 && (
                <tr><td colSpan={days.length + 1} className="px-4 py-8 text-center text-slate-400 text-sm">
                  {staff.length === 0 ? 'No crew found. Add staff in Settings.' : 'No crew match your filters.'}
                </td></tr>
              )}
            </tbody>
          </table></DragDropContext>
        </div>
        )}
      </div>

      {/* Mobile Day Cards */}
      <div className="lg:hidden space-y-3">
        {staffLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <Skeleton className="h-5 w-24 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : staffError ? (
          <ErrorState message="Couldn't load the rota" onRetry={refetchStaff} />
        ) : days.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const isToday = dayStr === todayStr;
          const dayAssignments = rotas.filter(r => r.assigned_date === dayStr && (!r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot') && filteredStaff.some(s => s.id === r.staff_id));
          // Group by staff member so multi-job days show as stacked cards per person
          const byStaff = {};
          dayAssignments.forEach(r => {
            if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
            byStaff[r.staff_id].push(r);
          });
          Object.values(byStaff).forEach(arr => arr.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59')));
          return (
            <div key={dayStr} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${isToday ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white' : 'bg-slate-50 border-b border-slate-100'}`}>
                <div className="flex items-center gap-2">
                  {isToday && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />}
                  <span className={`font-bold text-sm ${isToday ? 'text-white' : 'text-slate-800'}`}>{format(day, 'EEEE')}</span>
                </div>
                <span className={`text-xs font-medium ${isToday ? 'text-emerald-100' : 'text-slate-500'}`}>{format(day, 'dd MMM')} · {dayAssignments.length} shifts · {Object.keys(byStaff).length} crew</span>
              </div>
              {dayAssignments.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">No assignments</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {Object.entries(byStaff).map(([staffId, staffAssignments]) => {
                    const member = staff.find(s => s.id === staffId);
                    const isMulti = staffAssignments.length >= 2;
                    return (
                      <div key={staffId} className="px-4 py-3">
                        {/* Staff header row with multi-job badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-xs">{member?.name?.charAt(0) || '?'}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate flex-1">{member?.name || 'Unknown'}</p>
                          {isMulti && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#2E5A1A] text-white">
                              <Layers className="w-2.5 h-2.5" /> {staffAssignments.length} jobs
                            </span>
                          )}
                          <button
                            onClick={() => setRotaManagerStaff(member)}
                            className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition flex items-center gap-0.5 flex-shrink-0"
                          >
                            <Calendar className="w-3 h-3" /> Manage
                          </button>
                        </div>
                        {member && getDynamicTeamInfo(member).isDynamic && (
                          <span className="inline-flex items-center gap-0.5 self-start text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 mb-2">
                            <Zap className="w-2.5 h-2.5" /> DYNAMIC
                          </span>
                        )}
                        {/* Stacked job cards */}
                        <div className={`space-y-1.5 ${isMulti ? 'pl-2 border-l-2 border-[#2E5A1A]/20' : ''}`}>
                          {staffAssignments.map((assignment, idx) => {
                            const job = jobs.find(j => j.id === assignment.job_id);
                            const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
                            const client = clients.find(c => c.id === job?.client_id);
                            const colors = jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
                            const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
                            const StatusIcon = status.icon;
                            return (
                              <div key={assignment.id} className={`rounded-lg border-l-[3px] cursor-pointer hover:shadow-sm transition ${colors.bg} ${colors.border} px-2.5 py-2 ${isMulti ? 'relative' : ''}`}
                                onClick={() => handleEditAssignment(assignment)}>
                                <div className="flex items-start justify-between gap-1 mb-1">
                                   <span className="font-bold text-slate-900 truncate flex-1 text-xs leading-tight">{assignment.assignment_type === 'yard_depot' ? 'Depot Duty' : (job?.name || '—')}</span>
                                   <div className="flex items-center gap-1 flex-shrink-0">
                                     {job && <RotaWeatherBadge job={job} />}
                                     {isMulti && <span className="text-[8px] px-1 py-0.5 rounded-full bg-[#2E5A1A] text-white font-bold">#{idx + 1}</span>}
                                   </div>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); setSwapAssignment(assignment); }} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition" title="Swap / add staff">
                                      <Repeat className="w-3 h-3" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }} className="p-1 text-red-400 hover:bg-red-50 rounded transition">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 text-xs">
                                  {job && <span className={`px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>{formatJobType(getJobPrimaryType(job, teams))}</span>}
                                  {vehicle && <span className="flex items-center gap-0.5 text-slate-500"><Truck className="w-3 h-3" />{vehicle.registration_number}</span>}
                                  {job?.location && <span className="flex items-center gap-0.5 text-slate-500"><MapPin className="w-3 h-3" />{job.location}</span>}
                                  {(assignment.start_time || assignment.end_time) && <span className="flex items-center gap-0.5 text-slate-500"><Clock className="w-3 h-3" />{assignment.start_time || '—'}{assignment.end_time ? `–${assignment.end_time}` : ''}</span>}
                                  <span className={`inline-flex items-center gap-0.5 ${status.text}`}><StatusIcon className="w-3 h-3" />{status.label}</span>
                                  {assignment.briefing_signed && <span className="inline-flex items-center text-emerald-600"><ClipboardCheck className="w-3 h-3" />Briefed</span>}
                                  {assignment.arrived_on_site_at && <span className="inline-flex items-center gap-0.5 text-emerald-600"><LogIn className="w-3 h-3" />{format(new Date(assignment.arrived_on_site_at), 'HH:mm')}</span>}
                                  {assignment.meterage > 0 && <span className="text-amber-600 font-medium">{assignment.meterage}m</span>}
                                </div>
                                {assignment.is_overtime && (
                                  <span className="mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                    OT{assignment.rate_multiplier ? ` ${Number(assignment.rate_multiplier)}x` : ''}
                                  </span>
                                )}
                                {assignment.notes && (
                                  <div className="mt-1 flex items-start gap-1 text-[10px] text-slate-500">
                                    <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
                                    <span className="italic truncate">{assignment.notes}</span>
                                  </div>
                                )}
                                {client && <p className="text-[10px] text-slate-400 mt-1">{client.name}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
                </div>
                );
                })}
                </div>
                </div>
                );
                }