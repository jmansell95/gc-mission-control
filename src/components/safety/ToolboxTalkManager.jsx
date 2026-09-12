import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HardHat, Plus, Trash2, CheckCircle2, Calendar, Users, Clock, X, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import HubCard from '@/components/hubs/HubCard';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import DeliverTalkModal from '@/components/safety/DeliverTalkModal';

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

const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

export default function ToolboxTalkManager() {
  const [showForm, setShowForm] = useState(false);
  const [deliverTalk, setDeliverTalk] = useState(null);
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

  const statTiles = [
    { icon: HardHat, label: 'Total Talks', value: stats.total, gradient: 'stat-gradient-amber' },
    { icon: CheckCircle2, label: 'Delivered', value: stats.delivered, gradient: 'stat-gradient-emerald' },
    { icon: Calendar, label: 'Scheduled', value: stats.scheduled, gradient: 'stat-gradient-blue' },
    { icon: Users, label: 'Attendees', value: stats.totalAttendees, gradient: 'stat-gradient-violet' },
  ];

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
    setDeliverTalk(talk);
  };

  const handleDelete = async (id) => {
    await base44.entities.ToolboxTalk.delete(id);
    queryClient.invalidateQueries({ queryKey: ['toolbox-talks'] });
  };

  const toggleStaff = (id) => {
    setSelectedStaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {statTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="hub-glass rounded-2xl p-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-lg ${tile.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-[10px] font-bold text-slate-500 uppercase">{tile.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{tile.value}</p>
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <div className="flex items-center justify-end">
        <button onClick={() => setShowForm(!showForm)} className="command-gradient inline-flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm">
          <Plus className="w-4 h-4" /> Schedule Talk
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <HubCard icon={Plus} title="New Toolbox Talk" subtitle="Schedule a safety briefing" tone="amber">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex items-center justify-between -mt-1">
              <span className="text-xs text-slate-400">Fill in the details below</span>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Title *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputCls} placeholder="e.g. Dust Suppression" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
                <select value={form.topic_category} onChange={e => setForm({ ...form, topic_category: e.target.value })} className={inputCls}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
                <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} required className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Job (optional)</label>
                <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} className={inputCls}>
                  <option value="">Yard / Depot</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Delivered By</label>
                <input value={form.delivered_by_name} onChange={e => setForm({ ...form, delivered_by_name: e.target.value })} className={inputCls} placeholder="Supervisor name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Duration (mins)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 15 })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} placeholder="Key points, hazards discussed, controls reinforced..." />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">Attendees ({selectedStaff.length} selected)</label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {activeStaff.map(s => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedStaff.includes(s.id)} onChange={() => toggleStaff(s.id)} className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700">{s.name}</span>
                    {s.job_title && <span className="text-xs text-slate-400">· {s.job_title}</span>}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="command-gradient w-full py-2.5 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm">Schedule Talk</button>
          </form>
        </HubCard>
      )}

      {/* List */}
      {talks.length === 0 ? (
        <HubEmptyState
          icon={HardHat}
          title="No toolbox talks recorded yet"
          description="Schedule your first one using the button above."
          action={{ label: 'Schedule Talk', onClick: () => setShowForm(true) }}
        />
      ) : (
        <HubCard icon={HardHat} title="Recent Toolbox Talks" subtitle={`${talks.length} talk${talks.length !== 1 ? 's' : ''}`} tone="amber" padded={false}>
          <div className="divide-y divide-slate-100">
            {talks.map(talk => (
              <div key={talk.id} className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/50 transition">
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
                      <button onClick={() => markDelivered(talk)} className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition" title="Confirm attendance & deliver">
                        <ClipboardCheck className="w-3.5 h-3.5" /> Deliver
                      </button>
                    )}
                    <button onClick={() => handleDelete(talk.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </HubCard>
      )}

      {deliverTalk && (
        <DeliverTalkModal
          talk={deliverTalk}
          onClose={() => setDeliverTalk(null)}
          onDelivered={() => {
            setDeliverTalk(null);
            queryClient.invalidateQueries({ queryKey: ['toolbox-talks'] });
          }}
        />
      )}
    </div>
  );
}