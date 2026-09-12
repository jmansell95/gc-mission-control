import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, Search, Users, UserPlus, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

/**
 * DeliverTalkModal — confirms actual attendance at the point of
 * delivery. Shows scheduled attendees with tick boxes (pre-checked),
 * allows adding walk-ins, and marks the talk as delivered with the
 * final attendee list.
 */
export default function DeliverTalkModal({ talk, onClose, onDelivered }) {
  const [confirmedIds, setConfirmedIds] = useState(new Set(talk.attendee_ids || []));
  const [walkInNames, setWalkInNames] = useState([]);
  const [walkInInput, setWalkInInput] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const activeStaff = useMemo(() => staff.filter(s => s.is_active !== false), [staff]);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return activeStaff;
    const q = search.toLowerCase();
    return activeStaff.filter(s => s.name?.toLowerCase().includes(q) || s.job_title?.toLowerCase().includes(q));
  }, [activeStaff, search]);

  const toggleConfirm = (id) => {
    setConfirmedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addWalkIn = () => {
    const name = walkInInput.trim();
    if (name && !walkInNames.includes(name)) {
      setWalkInNames(prev => [...prev, name]);
      setWalkInInput('');
    }
  };

  const removeWalkIn = (name) => {
    setWalkInNames(prev => prev.filter(n => n !== name));
  };

  const handleDeliver = async () => {
    setSaving(true);
    try {
      const confirmedNames = activeStaff
        .filter(s => confirmedIds.has(s.id))
        .map(s => s.name);
      const allNames = [...confirmedNames, ...walkInNames];

      await base44.entities.ToolboxTalk.update(talk.id, {
        status: 'delivered',
        attendee_ids: Array.from(confirmedIds),
        attendee_names: allNames,
        delivered_at: new Date().toISOString(),
      });
      toast({ title: 'Talk marked as delivered', description: `${allNames.length} attendee${allNames.length !== 1 ? 's' : ''} recorded` });
      onDelivered();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const scheduledCount = (talk.attendee_ids || []).length;
  const confirmedCount = confirmedIds.size;
  const attendanceRate = scheduledCount > 0 ? Math.round((confirmedCount / scheduledCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-pop-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Confirm Attendance</h3>
            <p className="text-xs text-slate-500 mt-0.5">{talk.title} · {format(new Date(talk.scheduled_date), 'dd MMM yyyy')}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Scheduled</p>
              <p className="text-sm font-bold text-slate-900">{scheduledCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Confirmed</p>
              <p className="text-sm font-bold text-slate-900">{confirmedCount + walkInNames.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></span>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Rate</p>
              <p className="text-sm font-bold text-slate-900">{attendanceRate}%</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Staff list */}
          <div className="space-y-1 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2">
            {filteredStaff.map(s => {
              const wasScheduled = (talk.attendee_ids || []).includes(s.id);
              const isConfirmed = confirmedIds.has(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={() => toggleConfirm(s.id)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 flex-1">{s.name}</span>
                  {s.job_title && <span className="text-xs text-slate-400">{s.job_title}</span>}
                  {wasScheduled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Scheduled</span>}
                </label>
              );
            })}
            {filteredStaff.length === 0 && <p className="text-center text-xs text-slate-400 py-4">No staff found</p>}
          </div>

          {/* Walk-ins */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Walk-in Attendees (not in staff list)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={walkInInput}
                onChange={e => setWalkInInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWalkIn(); } }}
                placeholder="Type a name and press Enter…"
                className="flex-1 h-9 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={addWalkIn} className="px-3 h-9 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition">Add</button>
            </div>
            {walkInNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {walkInNames.map(n => (
                  <span key={n} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">
                    {n}
                    <button onClick={() => removeWalkIn(n)} className="text-emerald-400 hover:text-emerald-700"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{confirmedCount + walkInNames.length}</strong> total attendee{(confirmedCount + walkInNames.length) !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 h-9 text-slate-600 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
            <button
              onClick={handleDeliver}
              disabled={saving || (confirmedCount + walkInNames.length) === 0}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving…' : 'Mark Delivered'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}