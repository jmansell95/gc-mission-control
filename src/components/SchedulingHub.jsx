import React, { useState, useEffect, useMemo } from 'react';
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
import TabBar from '@/components/TabBar';
import HubStatsBar from '@/components/dashboard/HubStatsBar';

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

  const todayStr = new Date().toISOString().slice(0, 10);
  const [leaveFilter, setLeaveFilter] = useState('all');
  const { data: todayAssignments = [] } = useScopedEntity('RotaAssignment', { queryKey: ['rota-today-scheduling', todayStr], filter: { assigned_date: todayStr }, sort: '-created_date', limit: 500 });
  const { data: absences = [] } = useQuery({ queryKey: ['absences-scheduling'], queryFn: () => base44.entities.Absence.list() });

  const leaveFilterOrder = ['all', 'annual', 'sick', 'training'];
  const leaveFilterLabels = { all: 'All leave · click to filter', annual: 'Annual leave', sick: 'Sick', training: 'Training' };
  const cycleLeaveFilter = () => {
    const idx = leaveFilterOrder.indexOf(leaveFilter);
    setLeaveFilter(leaveFilterOrder[(idx + 1) % leaveFilterOrder.length]);
  };

  const schedStats = useMemo(() => {
    const onJob = todayAssignments.filter(a => a.assignment_type === 'job').length;
    const conflicts = todayAssignments.filter(a => a.has_conflict).length;
    // Staff on leave today: approved absences + non-job rota assignments (annual_leave/sick/training)
    const leaveByType = { annual: new Set(), sick: new Set(), training: new Set() };
    const allLeave = new Set();
    absences.forEach(a => {
      if (a.status === 'approved' && a.start_date <= todayStr && a.end_date >= todayStr) {
        allLeave.add(a.staff_id);
        const type = a.reason === 'sick' ? 'sick' : a.reason === 'training' ? 'training' : 'annual';
        leaveByType[type].add(a.staff_id);
      }
    });
    todayAssignments.forEach(a => {
      if (a.assignment_type === 'annual_leave') { allLeave.add(a.staff_id); leaveByType.annual.add(a.staff_id); }
      else if (a.assignment_type === 'sick') { allLeave.add(a.staff_id); leaveByType.sick.add(a.staff_id); }
      else if (a.assignment_type === 'training') { allLeave.add(a.staff_id); leaveByType.training.add(a.staff_id); }
    });
    const onLeave = leaveFilter === 'all' ? allLeave.size : (leaveByType[leaveFilter]?.size || 0);
    return { total: todayAssignments.length, onJob, onLeave, conflicts };
  }, [todayAssignments, absences, todayStr, leaveFilter]);

  const currentWeekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();

  const tabs = [
    { id: 'rota', label: 'Rota Builder', icon: Calendar },
    { id: 'heatmap', label: 'Availability Heatmap', icon: Grid3x3 },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      {/* Scheduling KPI Bar — today's deployment snapshot */}
      {schedStats.total > 0 && (
        <HubStatsBar tiles={[
          { icon: Users, label: 'Assigned Today', value: schedStats.total, sublabel: 'Total shifts', color: 'brand' },
          { icon: CheckCircle2, label: 'On Jobs', value: schedStats.onJob, sublabel: 'Field deployments', color: 'emerald' },
          { icon: Coffee, label: 'On Leave', value: schedStats.onLeave, sublabel: leaveFilterLabels[leaveFilter], color: 'amber', onClick: cycleLeaveFilter },
          { icon: AlertTriangle, label: 'Conflicts', value: schedStats.conflicts, sublabel: 'Double-booked', color: schedStats.conflicts > 0 ? 'rose' : 'slate' },
        ]} />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />
        <div className="flex items-center gap-2 flex-wrap">
          <TemplateWeekCopy targetWeekStart={currentWeekStart} />
          <button onClick={handleGeotabSync} disabled={syncing} type="button"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition shadow-sm touch-manipulation select-none disabled:opacity-60">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation2 className="w-4 h-4" />}
            <span className="hidden sm:inline">Sync GPS Timesheets</span>
            <span className="sm:hidden">GPS</span>
          </button>
          <button onClick={openChat} type="button"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E5A1A] text-white text-sm font-medium hover:bg-[#1c4a12] active:scale-[0.98] transition shadow-sm touch-manipulation select-none">
            <CalendarClock className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule Assistant</span>
            <span className="sm:hidden">Assistant</span>
          </button>
        </div>
      </div>
      {tab === 'rota' && <UnifiedRotaBuilder />}
      {tab === 'heatmap' && <AvailabilityHeatmap />}
      {tab === 'calendar' && <CalendarView />}
    </div>
  );
}