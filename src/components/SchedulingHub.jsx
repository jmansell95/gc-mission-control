import React, { useState, useEffect, useMemo } from 'react';
import { startOfWeek, addDays, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import UnifiedRotaBuilder from '@/components/rota/UnifiedRotaBuilder';
import CalendarView from '@/components/CalendarView';
import ResourcePlanner from '@/components/rota/ResourcePlanner';
import { Calendar, CalendarDays, CalendarClock, Grid3x3, Users, AlertTriangle, CheckCircle2, Coffee } from 'lucide-react';
import { useSchedulingAssistant } from '@/components/SchedulingAssistantChat';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import HubShell from '@/components/HubShell';
import { SCHEDULING_HELP_TOPICS, SCHEDULING_ONBOARDING, SCHEDULING_QUICK_LINKS } from '@/components/scheduling/schedulingHubContent';

// Unified scheduling hub — combines the weekly rota builder and the calendar
// view behind a single sidebar entry. `initialTab` lets legacy "rota" /
// "calendar" deep links land on the right tab.
export default function SchedulingHub({ initialTab = 'rota' }) {
  const [tab, setTab] = useState(initialTab);
  const { openChat } = useSchedulingAssistant();
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const selectedWeekStartStr = format(selectedWeek, 'yyyy-MM-dd');
  const selectedWeekEndStr = format(addDays(selectedWeek, 6), 'yyyy-MM-dd');
  const [leaveFilter, setLeaveFilter] = useState('all');
  const { data: weekAssignments = [] } = useScopedEntity('RotaAssignment', { queryKey: ['rota-week-scheduling', selectedWeekStartStr], filter: { week_start: selectedWeekStartStr }, sort: '-created_date', limit: 500 });
  const { data: absences = [] } = useQuery({ queryKey: ['absences-scheduling'], queryFn: () => base44.entities.Absence.list() });

  const leaveFilterOrder = ['all', 'annual', 'sick', 'training'];
  const leaveFilterLabels = { all: 'All leave · click to filter', annual: 'Annual leave', sick: 'Sick', training: 'Training' };
  const cycleLeaveFilter = () => {
    const idx = leaveFilterOrder.indexOf(leaveFilter);
    setLeaveFilter(leaveFilterOrder[(idx + 1) % leaveFilterOrder.length]);
  };

  const schedStats = useMemo(() => {
    const onJob = weekAssignments.filter(a => a.assignment_type === 'job').length;
    const conflicts = weekAssignments.filter(a => a.has_conflict).length;
    // Staff on leave during the selected week: approved absences overlapping
    // the week + non-job rota assignments (annual_leave/sick/training) in that week
    const leaveByType = { annual: new Set(), sick: new Set(), training: new Set() };
    const allLeave = new Set();
    absences.forEach(a => {
      if (a.status === 'approved' && a.start_date <= selectedWeekEndStr && a.end_date >= selectedWeekStartStr) {
        allLeave.add(a.staff_id);
        const type = a.reason === 'sick' ? 'sick' : a.reason === 'training' ? 'training' : 'annual';
        leaveByType[type].add(a.staff_id);
      }
    });
    weekAssignments.forEach(a => {
      if (a.assignment_type === 'annual_leave') { allLeave.add(a.staff_id); leaveByType.annual.add(a.staff_id); }
      else if (a.assignment_type === 'sick') { allLeave.add(a.staff_id); leaveByType.sick.add(a.staff_id); }
      else if (a.assignment_type === 'training') { allLeave.add(a.staff_id); leaveByType.training.add(a.staff_id); }
    });
    const onLeave = leaveFilter === 'all' ? allLeave.size : (leaveByType[leaveFilter]?.size || 0);
    return { total: weekAssignments.length, onJob, onLeave, conflicts };
  }, [weekAssignments, absences, selectedWeekStartStr, selectedWeekEndStr, leaveFilter]);

  const tabs = [
    { id: 'rota', label: 'Rota Builder', icon: Calendar },
    { id: 'resource-planner', label: 'Resource Planner', icon: Grid3x3 },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];

  const stats = schedStats.total > 0 ? [
    { icon: Users, label: 'Assigned This Week', value: schedStats.total, sublabel: `w/c ${format(selectedWeek, 'dd MMM')}`, color: 'brand' },
    { icon: CheckCircle2, label: 'On Jobs', value: schedStats.onJob, sublabel: 'Field deployments', color: 'emerald' },
    { icon: Coffee, label: 'On Leave', value: schedStats.onLeave, sublabel: leaveFilterLabels[leaveFilter], color: 'amber', onClick: cycleLeaveFilter },
    { icon: AlertTriangle, label: 'Conflicts', value: schedStats.conflicts, sublabel: 'Double-booked', color: schedStats.conflicts > 0 ? 'rose' : 'slate' },
  ] : [];

  return (
    <HubShell
      hubKey="scheduling"
      icon={CalendarClock}
      eyebrow="Scheduling Hub"
      title="Scheduling"
      subtitle="Weekly rota, crew availability and the month calendar"
      breadcrumbs={[{ label: 'Scheduling Hub' }]}
      stats={stats}
      help={{ title: 'Scheduling Hub — how it works', topics: SCHEDULING_HELP_TOPICS }}
      onboarding={SCHEDULING_ONBOARDING}
      quickLinks={SCHEDULING_QUICK_LINKS}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        <button onClick={openChat} type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] text-white text-ui-caption font-semibold hover:bg-[#244715] active:scale-[0.97] transition shadow-sm">
          <CalendarClock className="w-4 h-4" />
          <span className="hidden sm:inline">Schedule Assistant</span>
          <span className="sm:hidden">Assistant</span>
        </button>
      }
    >
      {tab === 'rota' && <UnifiedRotaBuilder selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />}
      {tab === 'resource-planner' && <ResourcePlanner />}
      {tab === 'calendar' && <CalendarView />}
    </HubShell>
  );
}