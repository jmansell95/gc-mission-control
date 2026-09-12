import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, Clock, AlertCircle, Repeat, ChevronRight,
  ChevronDown, Calendar, User, Loader2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useFieldData } from '@/components/field/FieldDataProvider';

const PRIORITY_STYLES = {
  urgent: { pill: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  high: { pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  medium: { pill: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  low: { pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

/**
 * StaffTaskList — shows the field staff member's assigned tasks
 * (ad-hoc + recurring) grouped by due status, with tap-to-complete.
 * Designed for the field app MyDutiesPage.
 */
export default function StaffTaskList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ctx = useFieldData();
  const { staff } = ctx || {};
  const [expandedId, setExpandedId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [completionNote, setCompletionNote] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-staff-tasks', staff?.id],
    queryFn: async () => {
      const list = await base44.entities.StaffTask.filter({
        assigned_to_staff_id: staff.id,
        status: { $in: ['pending', 'in_progress', 'overdue'] },
      });
      return list.sort((a, b) => {
        const aOver = a.status === 'overdue' ? 0 : 1;
        const bOver = b.status === 'overdue' ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        return new Date(a.due_date) - new Date(b.due_date);
      });
    },
    enabled: !!staff?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const handleComplete = async (taskId) => {
    setCompletingId(taskId);
    try {
      await base44.functions.invoke('completeStaffTask', {
        task_id: taskId,
        completion_note: completionNote || '',
      });
      queryClient.invalidateQueries({ queryKey: ['my-staff-tasks', staff?.id] });
      toast({ title: 'Task completed!', description: 'Your manager has been notified.' });
      setCompletionNote('');
      setExpandedId(null);
    } catch (e) {
      toast({ title: 'Could not complete task', description: e.message, variant: 'destructive' });
    }
    setCompletingId(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const groups = useMemo(() => {
    const overdue = tasks.filter(t => t.status === 'overdue' || (t.status === 'pending' && t.due_date < today));
    const dueToday = tasks.filter(t => t.status !== 'overdue' && t.due_date === today);
    const dueThisWeek = tasks.filter(t => t.status !== 'overdue' && t.due_date > today && t.due_date <= weekFromNow);
    const onTrack = tasks.filter(t => t.status !== 'overdue' && t.due_date > weekFromNow);
    return { overdue, dueToday, dueThisWeek, onTrack };
  }, [tasks, today, weekFromNow]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="field-card rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">No assigned tasks</p>
        <p className="text-xs text-slate-400 mt-0.5">You're all caught up!</p>
      </div>
    );
  }

  const sections = [
    { key: 'overdue', label: 'Overdue', items: groups.overdue, color: 'text-rose-600' },
    { key: 'dueToday', label: 'Due Today', items: groups.dueToday, color: 'text-amber-600' },
    { key: 'dueThisWeek', label: 'This Week', items: groups.dueThisWeek, color: 'text-blue-600' },
    { key: 'onTrack', label: 'Upcoming', items: groups.onTrack, color: 'text-emerald-600' },
  ].filter(s => s.items.length > 0);

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section.key}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className={`text-xs font-bold ${section.color}`}>{section.label}</span>
            <span className="text-xs text-slate-400">&middot;</span>
            <span className="text-xs font-semibold text-slate-500">{section.items.length} task{section.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {section.items.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                expanded={expandedId === task.id}
                onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)}
                completing={completingId === task.id}
                completionNote={completionNote}
                onNoteChange={setCompletionNote}
                onComplete={() => handleComplete(task.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, expanded, onToggle, completing, completionNote, onNoteChange, onComplete }) {
  const priority = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const isOverdue = task.status === 'overdue' || (task.status === 'pending' && task.due_date < new Date().toISOString().slice(0, 10));

  return (
    <div className={`field-card rounded-2xl overflow-hidden border ${isOverdue ? 'border-rose-200' : 'border-slate-200/60'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3.5 text-left active:scale-[0.99] transition"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-rose-100' : task.is_recurring ? 'bg-blue-100' : 'bg-slate-100'}`}>
          {isOverdue ? (
            <AlertCircle className="w-5 h-5 text-rose-500" />
          ) : task.is_recurring ? (
            <Repeat className="w-5 h-5 text-blue-500" />
          ) : (
            <Clock className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-900">{task.title}</p>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${priority.pill}`}>
              {task.priority}
            </span>
            {task.is_recurring && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-100 text-blue-700 inline-flex items-center gap-0.5">
                <Repeat className="w-2.5 h-2.5" /> Recurring
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>Due {task.due_date}{task.due_time ? ` at ${task.due_time}` : ''}</span>
            {task.assigned_by_name && (
              <>
                <span>&middot;</span>
                <User className="w-3 h-3" />
                <span>{task.assigned_by_name}</span>
              </>
            )}
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pl-16 space-y-3">
          {task.description && (
            <p className="text-sm text-slate-600">{task.description}</p>
          )}
          {task.linked_job_name && (
            <p className="text-xs text-slate-400">Job: {task.linked_job_name}</p>
          )}
          {task.linked_vehicle_name && (
            <p className="text-xs text-slate-400">Vehicle: {task.linked_vehicle_name}</p>
          )}

          <div className="space-y-2">
            <textarea
              value={completionNote}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add a completion note (optional)..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={onComplete}
              disabled={completing}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
            >
              {completing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Complete</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}