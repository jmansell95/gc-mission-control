import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ClipboardList, Plus, Calendar, AlertCircle, CheckCircle2,
  Clock, Filter, Search, Repeat, User, ChevronDown, ChevronRight,
  Trash2, X, Edit3, Power, PowerOff,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import AssignTaskModal from '@/components/staff/AssignTaskModal';

const PRIORITY_COLORS = {
  urgent: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};

/**
 * StaffTasksTab — the task management sub-tab for the Staff Hub.
 * Shows a staff selector + their assigned tasks, with the ability
 * to create ad-hoc tasks, assign from templates, and manage
 * RecurringDutyTemplate records.
 */
export default function StaffTasksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Fetch all staff
  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff-tasks-hub'],
    queryFn: () => base44.entities.Staff.list('-name', 500),
  });

  // Fetch all tasks
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['all-staff-tasks'],
    queryFn: () => base44.entities.StaffTask.list('-created_date', 500),
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['recurring-duty-templates'],
    queryFn: () => base44.entities.RecurringDutyTemplate.list('-created_date', 200),
  });

  // Task counts per staff
  const staffTaskCounts = useMemo(() => {
    const counts = {};
    allTasks.forEach(t => {
      if (!counts[t.assigned_to_staff_id]) counts[t.assigned_to_staff_id] = { total: 0, pending: 0, overdue: 0 };
      counts[t.assigned_to_staff_id].total++;
      if (t.status === 'pending' || t.status === 'in_progress') counts[t.assigned_to_staff_id].pending++;
      if (t.status === 'overdue') counts[t.assigned_to_staff_id].overdue++;
    });
    return counts;
  }, [allTasks]);

  const filteredStaff = useMemo(() => {
    return allStaff
      .filter(s => s.is_active !== false)
      .filter(s => !search || (s.name || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allStaff, search]);

  const selectedStaff = allStaff.find(s => s.id === selectedStaffId);
  const selectedStaffTasks = useMemo(() => {
    if (!selectedStaffId) return [];
    return allTasks
      .filter(t => t.assigned_to_staff_id === selectedStaffId)
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .sort((a, b) => {
        // Overdue first, then by due date
        const aOver = a.status === 'overdue' ? 0 : 1;
        const bOver = b.status === 'overdue' ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        return new Date(a.due_date) - new Date(b.due_date);
      });
  }, [allTasks, selectedStaffId, statusFilter]);

  const handleCancelTask = async (taskId) => {
    try {
      await base44.entities.StaffTask.update(taskId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'Manager',
      });
      queryClient.invalidateQueries({ queryKey: ['all-staff-tasks'] });
      toast({ title: 'Task cancelled' });
    } catch (e) {
      toast({ title: 'Failed to cancel', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ui-heading font-bold text-slate-900">Task Assignment</h2>
          <p className="text-ui-caption text-slate-500 mt-0.5">
            {allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length} active · {allTasks.filter(t => t.status === 'overdue').length} overdue · {templates.length} templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplateManager(!showTemplateManager)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95"
          >
            <Repeat className="w-4 h-4" /> Templates
          </button>
          <button
            onClick={() => selectedStaffId ? setShowAssignModal(true) : toast({ title: 'Select a staff member first' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Assign Task
          </button>
        </div>
      </div>

      {showTemplateManager ? (
        <RecurringDutyTemplateManager templates={templates} allStaff={allStaff} onClose={() => setShowTemplateManager(false)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Staff list */}
          <div className="lg:col-span-1">
            <div className="hub-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search staff…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredStaff.map(staff => {
                  const counts = staffTaskCounts[staff.id] || { total: 0, pending: 0, overdue: 0 };
                  const isSelected = selectedStaffId === staff.id;
                  return (
                    <button
                      key={staff.id}
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-slate-50 ${
                        isSelected ? 'bg-primary/8' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                        {(staff.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{staff.name}</p>
                        <p className="text-xs text-slate-400 truncate">{staff.job_title || ''}</p>
                      </div>
                      {counts.overdue > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-ui-micro font-bold flex items-center justify-center">
                          {counts.overdue}
                        </span>
                      )}
                      {counts.pending > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-ui-micro font-bold flex items-center justify-center">
                          {counts.pending}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Task list for selected staff */}
          <div className="lg:col-span-2">
            {!selectedStaffId ? (
              <div className="hub-glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-500">Select a staff member to view their tasks</p>
              </div>
            ) : (
              <div className="hub-glass rounded-2xl overflow-hidden">
                {/* Staff header */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold">
                      {(selectedStaff?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{selectedStaff?.name}</p>
                      <p className="text-xs text-slate-400">{selectedStaff?.job_title || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['all', 'pending', 'completed', 'overdue'].map(f => (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                          statusFilter === f ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Task cards */}
                <div className="max-h-[55vh] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-8 text-center text-sm text-slate-400">Loading tasks…</div>
                  ) : selectedStaffTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">No tasks {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'assigned'}</div>
                  ) : (
                    selectedStaffTasks.map(task => (
                      <div key={task.id} className="border-b border-slate-50">
                        <button
                          onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {task.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : task.status === 'overdue' ? (
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                            ) : task.is_recurring ? (
                              <Repeat className="w-5 h-5 text-blue-500" />
                            ) : (
                              <Clock className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-semibold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {task.title}
                              </p>
                              <span className={`px-1.5 py-0.5 rounded-md text-ui-micro font-bold border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                                {task.priority}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-md text-ui-micro font-semibold ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}>
                                {task.status?.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Due {task.due_date}{task.due_time ? ` at ${task.due_time}` : ''}
                              {task.is_recurring && ' · Recurring'}
                              {task.assigned_by_name && ` · by ${task.assigned_by_name}`}
                            </p>
                          </div>
                          {expandedTaskId === task.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                        {expandedTaskId === task.id && (
                          <div className="px-4 pb-3 pl-12 space-y-2">
                            {task.description && <p className="text-sm text-slate-600">{task.description}</p>}
                            {task.completion_note && <p className="text-sm text-emerald-600 italic">"{task.completion_note}"</p>}
                            {task.completed_at && <p className="text-xs text-slate-400">Completed {new Date(task.completed_at).toLocaleString()} by {task.completed_by}</p>}
                            {task.status !== 'completed' && task.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelTask(task.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel Task
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAssignModal && selectedStaff && (
        <AssignTaskModal
          staff={selectedStaff}
          templates={templates}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            setShowAssignModal(false);
            queryClient.invalidateQueries({ queryKey: ['all-staff-tasks'] });
          }}
        />
      )}
    </div>
  );
}

/**
 * RecurringDutyTemplateManager — inline panel for creating and
 * managing RecurringDutyTemplate records.
 */
function RecurringDutyTemplateManager({ templates, allStaff, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const handleToggleActive = async (template) => {
    try {
      await base44.entities.RecurringDutyTemplate.update(template.id, { is_active: !template.is_active });
      queryClient.invalidateQueries({ queryKey: ['recurring-duty-templates'] });
      toast({ title: template.is_active ? 'Template paused' : 'Template activated' });
    } catch (e) {
      toast({ title: 'Failed to update', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await base44.entities.RecurringDutyTemplate.delete(template.id);
      queryClient.invalidateQueries({ queryKey: ['recurring-duty-templates'] });
      toast({ title: 'Template deleted' });
    } catch (e) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Recurring Duty Templates</h3>
          <p className="text-xs text-slate-400 mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''} · auto-generates tasks on schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingTemplate(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
            Back to Tasks
          </button>
        </div>
      </div>

      {showForm && (
        <TemplateForm
          template={editingTemplate}
          allStaff={allStaff}
          onClose={() => { setShowForm(false); setEditingTemplate(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditingTemplate(null);
            queryClient.invalidateQueries({ queryKey: ['recurring-duty-templates'] });
          }}
        />
      )}

      <div className="divide-y divide-slate-50">
        {templates.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No templates yet. Create one to auto-generate recurring tasks for your crew.
          </div>
        ) : (
          templates.map(t => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Repeat className={`w-5 h-5 ${t.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${t.is_active ? 'text-slate-800' : 'text-slate-400'}`}>{t.name}</p>
                <p className="text-xs text-slate-400">
                  {t.frequency} · {t.assigned_staff_ids?.length || 0} staff
                  {t.next_due_date && ` · next: ${t.next_due_date}`}
                </p>
              </div>
              <button
                onClick={() => handleToggleActive(t)}
                className={`p-2 rounded-lg transition ${t.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                title={t.is_active ? 'Pause' : 'Activate'}
              >
                {t.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setEditingTemplate(t); setShowForm(true); }}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(t)}
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * TemplateForm — create/edit a RecurringDutyTemplate.
 */
function TemplateForm({ template, allStaff, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'other',
    frequency: template?.frequency || 'weekly',
    day_of_week: template?.day_of_week || 1,
    day_of_month: template?.day_of_month || 1,
    priority: template?.priority || 'medium',
    assigned_staff_ids: template?.assigned_staff_ids || [],
    is_active: template?.is_active ?? true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (template?.id) {
        await base44.entities.RecurringDutyTemplate.update(template.id, form);
        toast({ title: 'Template updated' });
      } else {
        await base44.entities.RecurringDutyTemplate.create({
          ...form,
          next_due_date: new Date().toISOString().slice(0, 10),
          created_by_name: 'Manager',
        });
        toast({ title: 'Template created' });
      }
      onSaved();
    } catch (e) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleStaff = (id) => {
    setForm(f => ({
      ...f,
      assigned_staff_ids: f.assigned_staff_ids.includes(id)
        ? f.assigned_staff_ids.filter(x => x !== id)
        : [...f.assigned_staff_ids, id],
    }));
  };

  return (
    <div className="px-4 py-4 border-b border-slate-100 bg-slate-50/30">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily Vehicle Check"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Frequency</label>
            <select
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What does this duty involve?"
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
            >
              <option value="vehicle_check">Vehicle Check</option>
              <option value="equipment_check">Equipment Check</option>
              <option value="site_inspection">Site Inspection</option>
              <option value="paperwork">Paperwork</option>
              <option value="training">Training</option>
              <option value="depot">Depot</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {form.frequency === 'weekly' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Day of Week</label>
              <select
                value={form.day_of_week}
                onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={7}>Sunday</option>
              </select>
            </div>
          )}
          {form.frequency === 'monthly' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Day of Month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.day_of_month}
                onChange={e => setForm(f => ({ ...f, day_of_month: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm"
              />
            </div>
          )}
        </div>

        {/* Staff assignment */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Assigned Staff ({form.assigned_staff_ids.length} selected)</label>
          <div className="max-h-32 overflow-y-auto rounded-xl bg-white border border-slate-200 p-2 space-y-1">
            {allStaff.filter(s => s.is_active !== false).map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.assigned_staff_ids.includes(s.id)}
                  onChange={() => toggleStaff(s.id)}
                  className="w-4 h-4 rounded accent-[#2E5A1A]"
                />
                <span className="text-sm text-slate-700">{s.name}</span>
                <span className="text-xs text-slate-400">{s.job_title || ''}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving…' : (template?.id ? 'Update Template' : 'Create Template')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}