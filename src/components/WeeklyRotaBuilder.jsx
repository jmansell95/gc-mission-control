import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format, subWeeks } from 'date-fns';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, X, Copy,
  MapPin, Truck, Clock, CheckCircle2, PlayCircle, ClipboardCheck,
  Users, Briefcase, Search, Filter, StickyNote, Save, Send, Loader2, CalendarDays,
  LogIn, LogOut, Repeat, Layers, Trash2, AlertTriangle, Zap, Warehouse
} from 'lucide-react';
import AssignmentModal from '@/components/AssignmentModal';
import ComplianceBlockModal from '@/components/ComplianceBlockModal';
import StaffSwapModal from '@/components/StaffSwapModal';
import StaffRotaManager from '@/components/rota/StaffRotaManager';
import CrewRigAssignmentModal from '@/components/rota/CrewRigAssignmentModal';
import { EmptyState, ErrorState, RotaSkeleton, Skeleton, SkeletonText } from '@/components/StateViews';
import { formatJobType } from '@/utils/format';
import { getJobPrimaryType } from '@/utils/jobTeams';
import { getCrewLabel } from '@/utils/terminology';
import { getCurrentTimeStr, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { computeRotaWarnings } from '@/utils/rotaWarnings';
import { useDivision } from '@/contexts/DivisionContext';
import { sortAZ } from '@/utils';
import { buildDriverStaffIds } from '@/utils/driverDetection';
import RotaWeatherBadge from '@/components/rota/RotaWeatherBadge';
import VirtualDepotCard from '@/components/rota/VirtualDepotCard';
import DeliveryInFrontBanner from '@/components/rota/DeliveryInFrontBanner';
import DepotDutyBadge from '@/components/rota/DepotDutyBadge';
import { getDeliveryInFrontState } from '@/utils/deliveryInFront';
import LiveDriverBadge from '@/components/rota/LiveDriverBadge';
import StaffTrackingBadge from '@/components/staff/StaffTrackingBadge';
import RotaDayCards from '@/components/rota/RotaDayCards';
import TodayCrewPopup from '@/components/rota/TodayCrewPopup';
import RotaSuggestionsPopup from '@/components/rota/RotaSuggestionsPopup';
import RigLinkPill from '@/components/rota/RigLinkPill';
import { removeRigLink } from '@/hooks/useRigLink';
import { useToast } from '@/components/ui/use-toast';
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

// Crew sub-line for subcontractor workers.
// Resolves 2-man crew pairings (Lead Driller + Second Man) from DrillingCrew
// groupings linked to the parent subcontractor. Shows one line per crew:
// 'Lead: X · Second: Y' (or 'Lead: X' if no second man). Agency workers are
// individuals — no sub-line is shown.
const crewSubLine = (member, crewsByParent) => {
  if (!member) return null;
  if (member.worker_type !== 'subcontractor') return null;
  const crews = crewsByParent?.[member.id];
  if (!crews || crews.length === 0) return null;
  const lines = crews.map(c => {
    const parts = [];
    if (c.lead_driller_name) parts.push(`Lead: ${c.lead_driller_name}`);
    if (c.second_man_name) parts.push(`Second: ${c.second_man_name}`);
    return parts.join(' · ');
  }).filter(Boolean);
  return lines.length > 0 ? lines.join('  |  ') : null;
};

export default function WeeklyRotaBuilder({ selectedWeek: propSelectedWeek, setSelectedWeek: propSetSelectedWeek }) {
  const [internalWeek, setInternalWeek] = useState(new Date());
  const selectedWeek = propSelectedWeek ?? internalWeek;
  const setSelectedWeek = propSetSelectedWeek ?? setInternalWeek;
  const [smartFillLoading, setSmartFillLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, assignment: null, defaultStaffId: '', defaultDate: '' });

  // Listen for the "Add Shift" button dispatched by UnifiedRotaBuilder.
  // Opens the smart AssignmentModal with empty defaults (no pre-selected staff/date).
  useEffect(() => {
    const handler = () => setModal({ isOpen: true, assignment: null, defaultStaffId: '', defaultDate: '' });
    const crewRigHandler = () => setCrewRigOpen(true);
    window.addEventListener('gc-open-add-shift', handler);
    window.addEventListener('gc-open-crew-rig', crewRigHandler);
    return () => {
      window.removeEventListener('gc-open-add-shift', handler);
      window.removeEventListener('gc-open-crew-rig', crewRigHandler);
    };
  }, []);
  const [teamFilter, setTeamFilter] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showWeekends, setShowWeekends] = useState(false);
  const [trackMode, setTrackMode] = useState('vehicles'); // 'vehicles' | 'crew'
  const [complianceViolations, setComplianceViolations] = useState(null);
  const [swapAssignment, setSwapAssignment] = useState(null);
  const [rotaManagerStaff, setRotaManagerStaff] = useState(null);
  const [crewRigOpen, setCrewRigOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeDivisionId } = useDivision();
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [], isLoading: staffLoading, isError: staffError, refetch: refetchStaff } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  // Real-time vehicle updates — keeps the live driver badge fresh on the
  // rota without a manual reload. Invalidates the vehicles query so the
  // current_operator / operator_updated_at fields stay current.
  useEffect(() => {
    const unsubscribe = base44.entities.Vehicle.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    });
    return unsubscribe;
  }, [queryClient]);
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: recurring = [] } = useQuery({ queryKey: ['recurring-absences'], queryFn: () => base44.entities.RecurringAbsence.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: recurringDepot = [] } = useQuery({ queryKey: ['recurring-depot-duty'], queryFn: () => base44.entities.RecurringDepotDuty.filter({ is_active: true }) });
  const { data: deliveries = [] } = useQuery({ queryKey: ['deliveries-for-drivers'], queryFn: () => base44.entities.DeliveryLog.list() });
  const { data: drillingCrews = [] } = useQuery({ queryKey: ['drilling-crews-rota'], queryFn: () => base44.entities.DrillingCrew.list('name', 500) });
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-active-rota'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });
  const { data: bankHolidays = [] } = useQuery({ queryKey: ['bank-holidays'], queryFn: () => base44.entities.BankHoliday.list() });
  const { data: shutdownPeriods = [] } = useQuery({ queryKey: ['shutdown-periods'], queryFn: () => base44.entities.ShutdownPeriod.filter({ is_active: true }) });
  const driverStaffIds = useMemo(() => buildDriverStaffIds(deliveries), [deliveries]);
  // Map of parent_staff_id → array of DrillingCrew groupings, for rota sub-lines
  const crewsByParent = useMemo(() => {
    const map = {};
    for (const c of drillingCrews) {
      if (!c.parent_staff_id) continue;
      if (!map[c.parent_staff_id]) map[c.parent_staff_id] = [];
      map[c.parent_staff_id].push(c);
    }
    return map;
  }, [drillingCrews]);

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

  // Group staff by their MAIN JOB this week so managers can see who is on
  // which job at a glance. Each staff member's main job is the one they're
  // assigned to the most days this week (ties broken by earliest day).
  // Depot duty is its own group; staff with no assignments go in 'Unassigned'.
  // Members within each group are sorted alphabetically by name.
  const mainJobByStaff = {};
  rotas.forEach(r => {
    if (r.assignment_type && r.assignment_type !== 'job' && r.assignment_type !== 'yard_depot') return;
    const key = r.assignment_type === 'yard_depot' ? '__depot__' : (r.job_id || '__unassigned__');
    if (!mainJobByStaff[r.staff_id]) mainJobByStaff[r.staff_id] = {};
    if (!mainJobByStaff[r.staff_id][key]) mainJobByStaff[r.staff_id][key] = { count: 0, firstDate: r.assigned_date };
    mainJobByStaff[r.staff_id][key].count++;
    if (r.assigned_date < mainJobByStaff[r.staff_id][key].firstDate) mainJobByStaff[r.staff_id][key].firstDate = r.assigned_date;
  });
  const resolvedMainJob = {};
  Object.keys(mainJobByStaff).forEach(staffId => {
    const entries = Object.entries(mainJobByStaff[staffId]);
    entries.sort((a, b) => b[1].count - a[1].count || a[1].firstDate.localeCompare(b[1].firstDate));
    resolvedMainJob[staffId] = entries[0][0];
  });

  const jobGroupsMap = {};
  filteredStaff.forEach(s => {
    let mainKey = resolvedMainJob[s.id];
    if (!mainKey) {
      // No rota assignments this week — depot team staff go in the Depot group,
      // everyone else goes in Unassigned.
      const team = teams.find(t => t.id === s.team_id);
      const isDepotTeam = team?.category === 'depot' || team?.job_type === 'depot' || /depot/i.test(team?.name || '');
      mainKey = isDepotTeam ? '__depot__' : '__unassigned__';
    }
    if (!jobGroupsMap[mainKey]) jobGroupsMap[mainKey] = [];
    jobGroupsMap[mainKey].push(s);
  });
  const staffByGroup = Object.entries(jobGroupsMap).map(([key, members]) => {
    members.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (key === '__depot__') return { key, label: 'Depot Staff', members, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' };
    if (key === '__unassigned__') return { key, label: 'Unassigned', members, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-300' };
    const job = jobs.find(j => j.id === key);
    const colors = jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
    return { key, label: job?.name || 'Unassigned', members, color: colors.text, bg: colors.bg, border: colors.border };
  });
  // Sort: real jobs by name first, then Depot Duty, then Unassigned.
  staffByGroup.sort((a, b) => {
    const aSpecial = a.key === '__depot__' || a.key === '__unassigned__';
    const bSpecial = b.key === '__depot__' || b.key === '__unassigned__';
    if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
    if (a.key === '__depot__') return -1;
    if (b.key === '__depot__') return 1;
    return a.label.localeCompare(b.label);
  });

  const rotasByStaff = {};
  filteredStaff.forEach(s => { rotasByStaff[s.id] = Array.from({ length: days.length }, () => []); });
  rotas.forEach(rota => {
    // Non-job assignments (annual_leave, sick, training) are shown via the
    // leaveState banner, not as job cards — skip them here to avoid "Unknown".
    if (rota.assignment_type && rota.assignment_type !== 'job' && rota.assignment_type !== 'yard_depot') return;
    const dayIndex = days.findIndex(d => format(d, 'yyyy-MM-dd') === rota.assigned_date);
    if (dayIndex !== -1 && rotasByStaff[rota.staff_id]) {
      rotasByStaff[rota.staff_id][dayIndex].push(rota);
    }
  });

  const leaveState = (staffId, dateStr) => {
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
    // Bank holiday — applies to ALL staff types
    const bh = bankHolidays.find(b => b.holiday_date === dateStr);
    if (bh) return { recurring: false, label: bh.name || 'Bank Holiday', type: 'bank_holiday' };
    // Shutdown period — direct employees only (unless applies_to is 'all')
    const member = staff.find(s => s.id === staffId);
    if (member) {
      const shutdown = shutdownPeriods.find(s => s.is_active !== false && s.start_date <= dateStr && s.end_date >= dateStr && (s.applies_to === 'all' || member.worker_type === 'direct_employee'));
      if (shutdown) return { recurring: false, label: shutdown.label || shutdown.name || 'Shutdown', type: 'shutdown' };
    }
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
    if (rec) return { recurring: true, label: rec.label || 'Day Off' };
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

  // Continuous depot duty — virtual card helpers
  const getDepotRuleForStaff = (staffId) => recurringDepot.find(r => r.staff_id === staffId && r.is_active !== false);
  const isDepotDutyDate = (rule, dateStr) => {
    if (!rule) return false;
    if (rule.start_date && dateStr < rule.start_date) return false;
    if (rule.end_date && dateStr > rule.end_date) return false;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const days = Array.isArray(rule.days_of_week) && rule.days_of_week.length > 0 ? rule.days_of_week : [1, 2, 3, 4, 5];
    return days.includes(dow);
  };
  const handleStopDepotDuty = async (rule) => {
    if (!confirm('Stop this continuous depot duty?\n\nNo future weeks will show depot duty for this staff member. Already-scheduled shifts stay intact.')) return;
    try {
      await base44.entities.RecurringDepotDuty.update(rule.id, { is_active: false, end_date: format(new Date(), 'yyyy-MM-dd') });
      queryClient.invalidateQueries({ queryKey: ['recurring-depot-duty'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
    } catch (e) { console.error('Error stopping depot duty:', e); }
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

  // Remove a rig link from a shift (+ its partner) without deleting the shift.
  const handleRemoveRigLink = async (assignment) => {
    try {
      await removeRigLink(assignment, rotas);
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast({ title: 'Rig link removed', description: 'The shift stays assigned — only the rig was unlinked.' });
    } catch (e) {
      toast({ title: 'Could not remove rig link', description: e.message || 'Something went wrong.', variant: 'destructive' });
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
  const [cleaningUp, setCleaningUp] = useState(false);
  const handleCleanupDuplicates = async () => {
    if (!confirm('Delete duplicate assignments?\n\nThis removes extra shifts so each staff member (except drivers) has at most one assignment per day. The earliest shift on each duplicate day is kept; the rest are deleted.')) return;
    setCleaningUp(true);
    try {
      const res = await base44.functions.invoke('cleanupDuplicateAssignments', {});
      const d = res.data || {};
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      setNotice({ type: 'success', msg: d.message || `Deleted ${d.deleted} duplicate assignment(s).` });
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'Failed to clean up duplicates' });
    } finally {
      setCleaningUp(false);
    }
  };
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

    // Yard / Depot duty — non-billable overhead shift (no job)
    if (assignment.assignment_type === 'yard_depot') {
      return (
        <div key={assignment.id} className="group relative px-2.5 py-2 rounded-lg text-xs border-l-[3px] border-amber-400 bg-amber-50 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-150"
          onClick={() => handleEditAssignment(assignment)}>
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="font-bold text-amber-900 truncate flex-1 leading-tight flex items-center gap-1">
              <Warehouse className="w-3 h-3 flex-shrink-0" /> Depot Duty
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
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
          {(assignment.start_time || assignment.end_time) && (
            <div className="flex items-center gap-1 text-amber-700 mb-1">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{assignment.start_time || '—'} - {assignment.end_time || '—'}</span>
            </div>
          )}
          {assignment.notes && (
            <div className="flex items-start gap-1 text-amber-700 mb-1">
              <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
              <span className="truncate italic">{assignment.notes}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-amber-200/50">
            <span className={`inline-flex items-center gap-0.5 ${status.text}`}>
              <StatusIcon className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">{status.label}</span>
            </span>
            {assignment.completed_at && (
              <span className="text-[10px] text-amber-600 font-medium">Submitted</span>
            )}
          </div>
        </div>
      );
    }

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
          {assignment.rig_asset_id && (
          <div className="mb-1">
          <RigLinkPill assignment={assignment} rigs={rigs} allAssignments={rotas} staff={staff} onRemove={handleRemoveRigLink} size="xs" />
          </div>
          )}
          {job?.location && (
          <div className="flex items-center gap-1 text-slate-500 mb-1">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{job.location}</span>
          </div>
          )}
        {trackMode === 'crew' ? (
          <div className="mb-1">
            <StaffTrackingBadge staffId={assignment.staff_id} compact />
          </div>
        ) : vehicle && (
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
              <TodayCrewPopup
                rotas={rotas}
                staff={staff}
                jobs={jobs}
                teams={teams}
                todayStr={todayStr}
                onEditAssignment={handleEditAssignment}
              />
              <RotaSuggestionsPopup warnings={rotaWarnings} />
              <button onClick={handleCleanupDuplicates} disabled={cleaningUp}
                title="Remove duplicate assignments (keep one shift per staff per day; drivers exempt)"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm font-medium disabled:opacity-50">
                {cleaningUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} <span className="hidden sm:inline">{cleaningUp ? 'Cleaning…' : 'Clean Duplicates'}</span>
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
            <div className="hidden lg:flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 px-1.5 py-1">
              <button
                onClick={() => setTrackMode('vehicles')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${trackMode === 'vehicles' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Truck className="w-3.5 h-3.5" /> Vehicles
              </button>
              <button
                onClick={() => setTrackMode('crew')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${trackMode === 'crew' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <MapPin className="w-3.5 h-3.5" /> Crew GPS
              </button>
            </div>
            {(teamFilter || staffSearch) && (
              <span className="text-xs text-slate-500 self-center">
                {filteredStaff.length} of {staff.length} staff
              </span>
            )}
          </div>
        </div>
      </div>

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
        absences={absences}
        recurring={recurring}
        driverStaffIds={driverStaffIds}
      />
      {/* Crew → Rig Assignment Modal (Lead Driller + Second Man → rig, with swap) */}
      <CrewRigAssignmentModal
        isOpen={crewRigOpen}
        onClose={() => setCrewRigOpen(false)}
        staff={staff}
        jobs={jobs}
        rigs={rigs}
        existingRotas={rotas}
        teams={teams}
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
                          {crewSubLine(member, crewsByParent) && (
                            <p className="text-[10px] text-blue-600 font-medium truncate">{crewSubLine(member, crewsByParent)}</p>
                          )}
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
                    const dif = getDeliveryInFrontState({ deliveries, assignments: rotas, staffId: member.id, dateStr: dayStr });
                    return (
                      <td key={`${member.id}-${dayIdx}`} className={`px-2 py-2 align-top ${isToday ? 'bg-emerald-50/40' : ''} ${ls ? (ls.recurring ? 'bg-slate-100/70' : ls.type === 'yard_depot' ? 'bg-amber-50/60' : ls.type === 'bank_holiday' ? 'bg-blue-50/60' : ls.type === 'shutdown' ? 'bg-purple-50/60' : 'bg-red-50/60') : ''} group/cell`}>
                        <Droppable droppableId={`${member.id}|${dayStr}`}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}
                              className={`space-y-1.5 min-h-[44px] rounded-lg transition ${snapshot.isDraggingOver ? 'bg-emerald-50/70 ring-2 ring-emerald-300/60' : ''}`}>
                              {ls && ls.type !== 'yard_depot' && (
                                <div className={`px-2 py-1 rounded text-[10px] font-bold text-center ${
                                  ls.recurring ? 'bg-slate-200 text-slate-600' :
                                  ls.type === 'sick' ? 'bg-rose-100 text-rose-600' :
                                  ls.type === 'training' ? 'bg-violet-100 text-violet-600' :
                                  ls.type === 'yard_depot' ? 'bg-amber-100 text-amber-700' :
                                  ls.type === 'bank_holiday' ? 'bg-blue-100 text-blue-700' :
                                  ls.type === 'shutdown' ? 'bg-purple-100 text-purple-700' :
                                  'bg-red-100 text-red-600'
                                }`}>
                                  {(ls.label || 'ON LEAVE').toUpperCase()}
                                </div>
                              )}
                              {/* Delivery-in-front banner — active delivery surfaces above depot duty */}
                              {dif.deliveryInFront && (
                                <DeliveryInFrontBanner deliveries={dif.activeDeliveries} jobs={jobs} vehicles={vehicles} />
                              )}
                              {/* Multi-job count badge — shows when 2+ jobs are assigned */}
                              {isMulti && !ls && (
                                <div className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-[#2E5A1A] text-white text-[9px] font-bold">
                                  <Layers className="w-2.5 h-2.5" /> {sortedAssignments.length} JOBS
                                </div>
                              )}
                              {(!ls || ls.type === 'yard_depot') && sortedAssignments.map((assignment, aIdx) => (
                                <Draggable draggableId={assignment.id} index={aIdx} key={assignment.id}>
                                  {(p) => (
                                    <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                      className={`active:cursor-grabbing ${isMulti && aIdx > 0 ? 'border-l-2 border-l-[#2E5A1A]/30' : ''}`}>
                                      {assignment.assignment_type === 'yard_depot' && dif.deliveryInFront ? (
                                        <DepotDutyBadge assignment={assignment} onEdit={() => handleEditAssignment(assignment)} />
                                      ) : (
                                        renderAssignmentCard(assignment, { isMulti, jobIndex: aIdx + 1 })
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {(() => {
                                const depotRule = getDepotRuleForStaff(member.id);
                                const hasRealDepot = dayAssignments.some(a => a.assignment_type === 'yard_depot');
                                if (depotRule && isDepotDutyDate(depotRule, dayStr) && !hasRealDepot && !ls) {
                                  return <VirtualDepotCard rule={depotRule} dayStr={dayStr} onStop={handleStopDepotDuty} />;
                                }
                                return null;
                              })()}
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

      {/* Mobile Day Cards — grouped by job */}
      <div className="lg:hidden">
        <RotaDayCards
          days={days}
          todayStr={todayStr}
          rotas={rotas}
          filteredStaff={filteredStaff}
          staff={staff}
          jobs={jobs}
          teams={teams}
          rigs={rigs}
          onEditAssignment={handleEditAssignment}
          onRemoveRigLink={handleRemoveRigLink}
          staffLoading={staffLoading}
          staffError={staffError}
          refetchStaff={refetchStaff}
        />
      </div>
                          </div>
                          );
                          }