import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Calendar, AlertCircle, Repeat, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-700' },
];

/**
 * AssignTaskModal — popup form for creating an ad-hoc StaffTask
 * or assigning from a RecurringDutyTemplate.
 */
export default function AssignTaskModal({ staff, templates = [], onClose, onAssigned }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('ad_hoc'); // 'ad_hoc' or 'template'
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().slice(0, 10),
    due_time: '',
    priority: 'medium',
    category: 'ad_hoc',
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'template' && !selectedTemplateId) {
      toast({ title: 'Select a template', variant: 'destructive' });
      return;
    }
    if (mode === 'ad_hoc' && !form.title) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (mode === 'template') {
        const template = templates.find(t => t.id === selectedTemplateId);
        await base44.functions.invoke('assignStaffTask', {
          title: template.name,
          description: template.description || '',
          assigned_to_staff_id: staff.id,
          assigned_to_name: staff.name,
          due_date: form.due_date,
          due_time: template.due_time || '',
          priority: template.priority || 'medium',
          category: 'recurring',
          recurring_template_id: template.id,
          is_recurring: true,
          division_id: template.division_id || staff.division_id || '',
        });
      } else {
        await base44.functions.invoke('assignStaffTask', {
          ...form,
          assigned_to_staff_id: staff.id,
          assigned_to_name: staff.name,
          division_id: staff.division_id || '',
        });
      }
      toast({ title: 'Task assigned', description: `${staff.name} has been notified` });
      onAssigned();
    } catch (e) {
      toast({ title: 'Failed to assign', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold">
              {(staff.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Assign Task to {staff.name}</h3>
              <p className="text-xs text-slate-400">{staff.job_title || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('ad_hoc')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition ${mode === 'ad_hoc' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
            >
              <AlertCircle className="w-4 h-4" /> Ad-hoc Task
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition ${mode === 'template' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
            >
              <Repeat className="w-4 h-4" /> From Template
            </button>
          </div>

          {mode === 'template' ? (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Select Template</label>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Choose a template…</option>
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.frequency})</option>
                ))}
              </select>
              {selectedTemplateId && (() => {
                const t = templates.find(x => x.id === selectedTemplateId);
                return t?.description ? <p className="text-xs text-slate-500 mt-1.5 px-1">{t.description}</p> : null;
              })()}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Task Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Check rig compliance before mobilisation"
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Instructions for the task…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </>
          )}

          {/* Due date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Due Time (optional)</label>
              <input
                type="time"
                value={form.due_time}
                onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Priority */}
          {mode === 'ad_hoc' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Priority</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${form.priority === p.value ? `${p.color} ring-2 ring-offset-1 ring-slate-300` : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {saving ? 'Assigning…' : 'Assign & Notify'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}