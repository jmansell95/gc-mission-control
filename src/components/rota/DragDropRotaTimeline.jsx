import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Calendar, Users, Briefcase, Loader2, GripVertical, Coffee, Stethoscope, Warehouse } from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';

// Drag-and-Drop Rota Timeline — Google-Calendar-style drag interface
// where managers assign staff to jobs by dragging cards across the
// week grid. Also supports drag-to-move between days and jobs.

const ASSIGNMENT_TYPE_CONFIG = {
  job: { icon: Briefcase, color: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Job' },
  annual_leave: { icon: Coffee, color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'AL' },
  sick: { icon: Stethoscope, color: 'bg-rose-100 text-rose-700 border-rose-300', label: 'Sick' },
  training: { icon: Users, color: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Training' },
  yard_depot: { icon: Warehouse, color: 'bg-slate-100 text-slate-700 border-slate-300', label: 'Yard' },
};

export default function DragDropRotaTimeline({ weekStart: propWeekStart }) {
  const [weekStart, setWeekStart] = useState(propWeekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);
  const { activeDivisionId } = useDivision();

  const { data: staff = [] } = useQuery({
    queryKey: ['rota-staff-dnd'],
    queryFn: async () => { const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 100); return r.data || r || []; },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['rota-jobs-dnd'],
    queryFn: async () => { const r = await base44.entities.Job.filter({ status: { $in: ['planning', 'in_progress'] } }, 'name', 50); return r.data || r || []; },
  });

  const { data: existingAssignments = [], refetch } = useQuery({
    queryKey: ['rota-assignments-dnd', weekStart, activeDivisionId || 'overview'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDivisionScopedData', { entity: 'RotaAssignment', division_id: activeDivisionId, filter: { week_start: weekStart }, sort: 'assigned_date', limit: 500 });
      return res.data?.data || [];
    },
  });

  useEffect(() => {
    if (existingAssignments.length > 0) setAssignments(existingAssignments);
  }, [existingAssignments]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(new Date(weekStart), i);
      return { date: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE dd') };
    });
  }, [weekStart]);

  const getAssignments = (staffId, date) => assignments.filter(a => a.staff_id === staffId && a.assigned_date === date);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const sourceParts = source.droppableId.split('|');
    const destParts = destination.droppableId.split('|');
    const staffId = destParts[0];
    const date = destParts[1];

    // Moving from unassigned pool to a day
    if (source.droppableId === 'unassigned-pool') {
      const jobId = result.draggableId.replace('job-', '');
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;
      const newAssignment = {
        staff_id: staffId,
        assigned_date: date,
        week_start: weekStart,
        job_id: jobId,
        assignment_type: 'job',
        status: 'assigned',
      };
      setAssignments([...assignments, newAssignment]);
      try {
        await base44.entities.RotaAssignment.create(newAssignment);
        refetch();
      } catch (err) { /* revert on error */ refetch(); }
      return;
    }

    // Moving between days (reassign)
    const sourceStaffId = sourceParts[0];
    const sourceDate = sourceParts[1];
    const moving = assignments.find(a => a.staff_id === sourceStaffId && a.assigned_date === sourceDate && a.id === result.draggableId);
    if (!moving) return;

    // Update local state
    const updated = assignments.map(a =>
      a.id === moving.id ? { ...a, staff_id: staffId, assigned_date: date } : a
    );
    setAssignments(updated);

    // Update backend
    if (moving.id) {
      try {
        await base44.entities.RotaAssignment.update(moving.id, { staff_id: staffId, assigned_date: date });
      } catch (err) { refetch(); }
    }
  };

  const removeAssignment = async (assignment) => {
    if (!assignment.id) return;
    setAssignments(assignments.filter(a => a !== assignment));
    try { await base44.entities.RotaAssignment.delete(assignment.id); } catch (err) { refetch(); }
  };

  return (
    <div className="hub-glass rounded-2xl p-4 overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2E5A1A]" />
          <h3 className="font-bold text-slate-800">Drag & Drop Rota</h3>
          <span className="text-xs text-slate-400">Week of {format(new Date(weekStart), 'dd MMM yyyy')}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setWeekStart(format(addDays(new Date(weekStart), -7), 'yyyy-MM-dd'))}
            className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">← Prev</button>
          <button onClick={() => setWeekStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))}
            className="px-3 py-1 text-xs rounded-lg bg-emerald-100 text-emerald-700 font-medium">Today</button>
          <button onClick={() => setWeekStart(format(addDays(new Date(weekStart), 7), 'yyyy-MM-dd'))}
            className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">Next →</button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3">
          {/* Unassigned job pool */}
          <div className="w-48 flex-shrink-0">
            <Droppable droppableId="unassigned-pool">
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}
                  className={`rounded-xl border-2 border-dashed p-2 min-h-[300px] transition ${snapshot.isDraggingOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2 text-center">Available Jobs</p>
                  {jobs.map((job, i) => (
                    <Draggable key={job.id} draggableId={`job-${job.id}`} index={i}>
                      {(prov) => (
                        <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                          className="bg-white border border-emerald-200 rounded-lg p-2 mb-1.5 cursor-grab hover:shadow-md transition">
                          <p className="text-xs font-semibold text-slate-700 truncate">{job.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{job.location || ''}</p>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Rota grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `120px repeat(7, minmax(100px, 1fr))` }}>
              {/* Header row */}
              <div></div>
              {days.map(d => (
                <div key={d.date} className="text-center text-xs font-semibold text-slate-600 py-1.5 bg-slate-50 rounded-lg">
                  {d.label}
                </div>
              ))}

              {/* Staff rows */}
              {staff.slice(0, 15).map(s => (
                <React.Fragment key={s.id}>
                  <div className="flex items-center px-2 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(s.full_name || s.name || '?').charAt(0)}
                    </div>
                    <span className="ml-2 text-xs font-medium text-slate-700 truncate">{s.full_name || s.name}</span>
                  </div>
                  {days.map(d => {
                    const cellAssignments = getAssignments(s.id, d.date);
                    return (
                      <Droppable key={`${s.id}|${d.date}`} droppableId={`${s.id}|${d.date}`}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.droppableProps}
                            className={`min-h-[44px] rounded-lg p-1 transition ${snapshot.isDraggingOver ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'bg-slate-50/50'}`}>
                            {cellAssignments.map((a, i) => {
                              const cfg = ASSIGNMENT_TYPE_CONFIG[a.assignment_type] || ASSIGNMENT_TYPE_CONFIG.job;
                              const Icon = cfg.icon;
                              const job = jobs.find(j => j.id === a.job_id);
                              return (
                                <Draggable key={a.id || `${a.staff_id}-${a.assigned_date}-${i}`} draggableId={a.id || `new-${i}`} index={i}>
                                  {(prov) => (
                                    <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                      className={`flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs mb-0.5 cursor-grab ${cfg.color}`}>
                                      <Icon className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate flex-1">{job?.name || a.non_job_label || cfg.label}</span>
                                      <button onClick={() => removeAssignment(a)} className="text-slate-400 hover:text-rose-500 flex-shrink-0">×</button>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </DragDropContext>

      <p className="text-xs text-slate-400 mt-3">
        Drag jobs from the left panel onto a staff member's day to assign them. Drag assignment cards between days to move them. Click × to remove.
      </p>
    </div>
  );
}