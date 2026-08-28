import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HardHat, Plus, Trash2, CheckCircle2, Calendar, Users, Clock, X, ShieldAlert, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const CATEGORY_LABELS = {
  general_safety: 'General Safety',
  drilling: 'Drilling',
  groundworks: 'Groundworks',
  manual_handling: 'Manual Handling',
  plant_equipment: 'Plant & Equipment',
  environmental: 'Environmental',
  health_welfare: 'Health & Welfare',
  other: 'Other',
};

const CATEGORY_COLORS = {
  general_safety: 'bg-blue-50 text-blue-700 ring-blue-200',
  drilling: 'bg-amber-50 text-amber-700 ring-amber-200',
  groundworks: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  manual_handling: 'bg-violet-50 text-violet-700 ring-violet-200',
  plant_equipment: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  environmental: 'bg-green-50 text-green-700 ring-green-200',
  health_welfare: 'bg-rose-50 text-rose-700 ring-rose-200',
  other: 'bg-slate-50 text-slate-700 ring-slate-200',
};

export default function ToolboxTalkManager() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', topic_category: 'general_safety', description: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), job_id: '', delivered_by_name: '', duration_minutes: 15 });
  const [selectedStaff, setSelectedStaff] = useState([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: talks = [] } = useQuery({ queryKey: ['toolbox-talks'], queryFn: () => base44.entities.ToolboxTalk.list('-scheduled_date', 50) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const activeStaff = staff.filter(s => s.is_active !== false);

  const stats = {
    total: talks.length,
    delivered: talks.filter(t => t.status === 'delivered').length,
    scheduled: talks.filter(t => t.status === 'scheduled').length,
    totalAttendees: talks.filter(t => t.status === 'delivered').reduce((sum, t) => sum + (t.attendee_ids?.length || 0), 0),
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_date) return;
    const job = jobs.find(j => j.id === form.job_id);
    await base44.entities.ToolboxTalk.create({
      ...form,
      job_name: job?.name || '',
      attendee_ids: selectedStaff,
      attendee_names: selectedStaff.map(id => activeStaff.find(s => s.id === id)?.name).filter(Boolean),
      status: 'scheduled',
    });
    setForm({ title: '', topic_category: 'general_safety', description: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), job_id: '', delivered_by_name: '', duration_minutes: 15 });
    setSelectedStaff([]);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['toolbox-talks'] });
    toast({ title: 'Toolbox talk scheduled' });
  };

  const markDelivered = async (talk) => {
    await base44.entities.ToolboxTalk.update(talk.id, {
      status: 'delivered',
      attendee_ids: talk.attendee_ids || [],
      attendee_names: talk.attendee_names || [],
    });
    queryClient.invalidateQueries({ queryKey: ['toolbox-talks'] });
    toast({ title: 'Marked as delivered' });
  };

  const handleDelete = async (id) => {
    await base44.entities.ToolboxTalk.delete(id);
    queryClient.invalidateQueries({ queryKey: ['toolbox-talks'] });
  };

  const toggleStaff = (id) => {
    setSelectedStaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      {/* SafetyCulture not connected note */}
      <div className="insight-card rounded-2xl p-3.5 flex items-center gap-3 bg-amber-50/60 border-amber-200">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
        </div>
        <p className="text-xs text-slate-600 flex-1 min-w-0">
          <strong className="text-slate-800">SafetyCulture not connected.</strong> Toolbox talks are managed in-app below —
          SafetyCulture template sync will be available once the integration is configured.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="insight-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><HardHat className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-500 font-medium">Total Talks</span></div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</p>
        </div>
        <div className="insight-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-slate-500 font-medium">Delivered</span></div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.delivered}</p>
        </div>
        <div className="insight-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-blue-500" /><span className="text-xs text-slate-500 font-medium">Scheduled</span></div>
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{stats.scheduled}</p>
        </div>
        <div className="insight-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-violet-500" /><span className="text-xs text-slate-500 font-medium">Total Attendees</span></div>
          <p className="text-2xl font-bold text-violet-600 tabular-nums">{stats.totalAttendees}</p>
        </div>
      </div>

      {/* Add button */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-sm">Recent Toolbox Talks</h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white text-sm font-medium rounded-lg hover:bg-[#1c4a12] transition">
          <Plus className="w-4 h-4" /> Schedule Talk
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="insight-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800">New Toolbox Talk</h4>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A] focus:border-transparent" placeholder="e.g. Dust Suppression" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
              <select value={form.topic_category} onChange={e => setForm({ ...form, topic_category: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Job (optional)</label>
              <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]">
                <option value="">Yard / Depot</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Delivered By</label>
              <input value={form.delivered_by_name} onChange={e => setForm({ ...form, delivered_by_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]" placeholder="Supervisor name" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Duration (mins)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 15 })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#2E5A1A]" placeholder="Key points, hazards discussed, controls reinforced..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Attendees ({selectedStaff.length} selected)</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
              {activeStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selectedStaff.includes(s.id)} onChange={() => toggleStaff(s.id)} className="rounded border-slate-300" />
                  <span className="text-sm text-slate-700">{s.name}</span>
                  {s.job_title && <span className="text-xs text-slate-400">· {s.job_title}</span>}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-2.5 bg-[#2E5A1A] text-white text-sm font-semibold rounded-lg hover:bg-[#1c4a12] transition">Schedule Talk</button>
        </form>
      )}

      {/* List */}
      <div className="space-y-2">
        {talks.length === 0 ? (
          <div className="insight-card rounded-xl p-8 text-center">
            <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No toolbox talks recorded yet. Schedule your first one above.</p>
          </div>
        ) : talks.map(talk => (
          <div key={talk.id} className="insight-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-semibold text-slate-900 text-sm">{talk.title}</h4>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${CATEGORY_COLORS[talk.topic_category] || CATEGORY_COLORS.other}`}>
                    {CATEGORY_LABELS[talk.topic_category] || 'Other'}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${talk.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : talk.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {talk.status}
                  </span>
                </div>
                {talk.job_name && <p className="text-xs text-slate-500 mb-1">📍 {talk.job_name}</p>}
                {talk.description && <p className="text-xs text-slate-600 mb-2 leading-relaxed">{talk.description}</p>}
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{talk.scheduled_date ? format(new Date(talk.scheduled_date), 'dd MMM yyyy') : '—'}</span>
                  {talk.delivered_by_name && <span className="flex items-center gap-1"><HardHat className="w-3 h-3" />{talk.delivered_by_name}</span>}
                  {talk.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{talk.duration_minutes} min</span>}
                  {(talk.attendee_names?.length || 0) > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{talk.attendee_names.length} attendees</span>}
                </div>
                {(talk.attendee_names?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {talk.attendee_names.map((n, i) => <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{n}</span>)}
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {talk.status === 'scheduled' && (
                  <button onClick={() => markDelivered(talk)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Mark delivered"><CheckCircle2 className="w-4 h-4" /></button>
                )}
                <button onClick={() => handleDelete(talk.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}