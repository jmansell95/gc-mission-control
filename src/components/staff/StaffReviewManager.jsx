import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Star, Plus, X, Send, Loader2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Staff performance reviews & feedback — managers can create periodic reviews
// (probation, quarterly, annual), rate performance, set goals, and share with
// the staff member for acknowledgement.

const REVIEW_TYPES = [
  { value: 'probation', label: 'Probation' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'project_completion', label: 'Project Completion' },
  { value: 'feedback', label: 'Ad-hoc Feedback' },
];

export default function StaffReviewManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    staff_id: '',
    review_type: 'quarterly',
    review_date: new Date().toISOString().slice(0, 10),
    performance_rating: 3,
    strengths: '',
    areas_for_improvement: '',
    manager_feedback: '',
    goals: [],
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['active-staff-for-reviews'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['staff-reviews'],
    queryFn: () => base44.entities.StaffReview.list('-review_date', 50),
  });

  const resetForm = () => {
    setForm({
      staff_id: '',
      review_type: 'quarterly',
      review_date: new Date().toISOString().slice(0, 10),
      performance_rating: 3,
      strengths: '',
      areas_for_improvement: '',
      manager_feedback: '',
      goals: [],
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.staff_id) {
      toast({ title: 'Select a staff member', variant: 'destructive' });
      return;
    }
    const staffMember = staff.find(s => s.id === form.staff_id);
    const payload = {
      ...form,
      staff_name: staffMember?.name || '',
      status: 'shared',
    };
    try {
      if (editing) {
        await base44.entities.StaffReview.update(editing, payload);
        toast({ title: '✓ Review updated' });
      } else {
        await base44.entities.StaffReview.create(payload);
        toast({ title: '✓ Review created and shared' });
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['staff-reviews'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const addGoal = () => {
    setForm(prev => ({
      ...prev,
      goals: [...prev.goals, { description: '', target_date: '', status: 'on_track' }],
    }));
  };

  const updateGoal = (i, field, value) => {
    setForm(prev => ({
      ...prev,
      goals: prev.goals.map((g, j) => j === i ? { ...g, [field]: value } : g),
    }));
  };

  const removeGoal = (i) => {
    setForm(prev => ({ ...prev, goals: prev.goals.filter((_, j) => j !== i) }));
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Star}
        title="Performance Reviews"
        description="Create periodic reviews, rate performance, set goals, and share with staff."
        actions={
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            <Plus className="w-4 h-4 mr-1" /> New Review
          </Button>
        }
      />

      {showForm && (
        <div className="hub-glass rounded-2xl p-5 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">{editing ? 'Edit Review' : 'New Performance Review'}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Staff Member</label>
              <select
                value={form.staff_id}
                onChange={e => setForm({ ...form, staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Review Type</label>
              <select
                value={form.review_type}
                onChange={e => setForm({ ...form, review_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {REVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Review Date</label>
              <input
                type="date"
                value={form.review_date}
                onChange={e => setForm({ ...form, review_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Performance Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, performance_rating: n })}
                  className="p-1"
                >
                  <Star className={`w-7 h-7 ${n <= form.performance_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
              <span className="ml-2 text-sm text-slate-500">
                {['Below', 'Developing', 'Meeting', 'Exceeding', 'Outstanding'][form.performance_rating - 1]}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Strengths</label>
            <textarea
              value={form.strengths}
              onChange={e => setForm({ ...form, strengths: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="What are they doing well?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Areas for Improvement</label>
            <textarea
              value={form.areas_for_improvement}
              onChange={e => setForm({ ...form, areas_for_improvement: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Where can they grow?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Manager Feedback</label>
            <textarea
              value={form.manager_feedback}
              onChange={e => setForm({ ...form, manager_feedback: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Overall comments and feedback…"
            />
          </div>

          {/* Goals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Goals</label>
              <button onClick={addGoal} className="text-xs text-emerald-600 font-medium hover:underline">+ Add Goal</button>
            </div>
            {form.goals.map((goal, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={goal.description}
                  onChange={e => updateGoal(i, 'description', e.target.value)}
                  placeholder="Goal description"
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={goal.target_date}
                  onChange={e => updateGoal(i, 'target_date', e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
                <button onClick={() => removeGoal(i)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Send className="w-4 h-4 mr-1" /> {editing ? 'Update' : 'Create & Share'}
            </Button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-400">No reviews yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "New Review" to create the first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reviews.map(r => (
            <div key={r.id} className="hub-glass rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{r.staff_name || 'Unknown'}</p>
                  <p className="text-xs text-slate-400 capitalize">{r.review_type} · {r.review_date}</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`w-3.5 h-3.5 ${n <= (r.performance_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
              </div>
              {r.strengths && <p className="text-xs text-slate-600 mb-1"><strong className="text-emerald-600">Strengths:</strong> {r.strengths}</p>}
              {r.areas_for_improvement && <p className="text-xs text-slate-600 mb-1"><strong className="text-amber-600">Improve:</strong> {r.areas_for_improvement}</p>}
              {r.goals?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.goals.map((g, i) => (
                    <div key={i} className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {g.description} {g.target_date && `(${g.target_date})`}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  r.status === 'acknowledged' ? 'bg-emerald-100 text-emerald-700' :
                  r.status === 'shared' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {r.status}
                </span>
                <button
                  onClick={() => { setEditing(r.id); setForm({ ...r, goals: r.goals || [] }); setShowForm(true); }}
                  className="text-xs text-emerald-600 hover:underline ml-auto"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}