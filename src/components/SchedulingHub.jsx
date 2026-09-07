import React, { useState, useEffect, useMemo } from 'react';
import { startOfWeek, addDays, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import UnifiedRotaBuilder from '@/components/rota/UnifiedRotaBuilder';
import CalendarView from '@/components/CalendarView';
import AvailabilityHeatmap from '@/components/rota/AvailabilityHeatmap';
import TemplateWeekCopy from '@/components/rota/TemplateWeekCopy';
import { Calendar, CalendarDays, CalendarClock, Navigation2, Loader2, Grid3x3, Users, AlertTriangle, CheckCircle2, Coffee } from 'lucide-react';
import { useSchedulingAssistant } from '@/components/SchedulingAssistantChat';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useToast } from '@/components/ui/use-toast';
import HubShell from '@/components/HubShell';
import { SCHEDULING_HELP_TOPICS, SCHEDULING_ONBOARDING, SCHEDULING_QUICK_LINKS } from '@/components/scheduling/schedulingHubContent';

// Unified scheduling hub — combines the weekly rota builder and the calendar
// view behind a single sidebar entry. `initialTab` lets legacy "rota" /
// "calendar" deep links land on the right tab.
export default function SchedulingHub({ initialTab = 'rota' }) {
  const [tab, setTab] = useState(initialTab);
  const [syncing, setSyncing] = useState(false);
  const { openChat } = useSchedulingAssistant();
  const { toast } = useToast();
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  const handleGeotabSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncGeotabTimesheets', { date: new Date().toISOString().slice(0, 10) });
      if (res.data?.ok) {
        toast({ title: 'GPS Timesheet Sync', description: res.data.message || 'Synced.' });
      } else {
        toast({ title: 'Sync failed', description: res.data?.error || 'Could not sync GPS timesheets.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message || 'Could not sync GPS timesheets.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

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

  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const tabs = [
    { id: 'rota', label: 'Rota Builder', icon: Calendar },
    { id: 'heatmap', label: 'Availability Heatmap', icon: Grid3x3 },
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
        <>
          <TemplateWeekCopy targetWeekStart={currentWeekStart} />
          <button onClick={handleGeotabSync} disabled={syncing} type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-60">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation2 className="w-4 h-4" />}
            <span className="hidden sm:inline">Sync GPS Timesheets</span>
            <span className="sm:hidden">GPS</span>
          </button>
          <button onClick={openChat} type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#244715] active:scale-[0.97] transition shadow-sm">
            <CalendarClock className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule Assistant</span>
            <span className="sm:hidden">Assistant</span>
          </button>
        </>
      }
    >
      {tab === 'rota' && <UnifiedRotaBuilder selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />}
      {tab === 'heatmap' && <AvailabilityHeatmap />}
      {tab === 'calendar' && <CalendarView />}
    </HubShell>
  );
}