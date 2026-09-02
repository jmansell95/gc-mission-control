import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Clock, CheckCircle2, ChevronDown, User, MapPin, Edit2, X, Save, Loader2, RotateCcw, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SiteLogTimelineBar from './SiteLogTimelineBar';
import { detectActivityType, TAG_COLORS } from '@/utils/siteLogUtils';
import { navigateToInvestigationHub } from '@/utils/investigationDeepLink';

function timeToMins(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function byClockOrder(a, b) {
  const av = timeToMins(a.start_time);
  const bv = timeToMins(b.start_time);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return av - bv;
}

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
}

function ActivityTag({ description }) {
  const tag = detectActivityType(description);
  const c = TAG_COLORS[tag.color];
  return (
    <span className={`text-[10px] ${c.bg} ${c.text} px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {tag.label}
    </span>
  );
}

/**
 * SiteLogDayCard — one day in the Site Logs timeline.
 *
 * Shows a visual timeline bar, the selected activity's details, and the full
 * activity list (grouped by borehole or chronological). Includes inline edit,
 * re-generate-timesheet, activity type tags, and bulk selection checkboxes.
 */
export default function SiteLogDayCard({ date, logs, job, isExpanded, onToggle, groupBy, selectedActivityId, onSelectActivity, selectMode, selectedIds, onToggleSelect }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [approving, setApproving] = useState(false);

  const dayLogs = [...logs].sort(byClockOrder);
  const dayPending = dayLogs.filter(l => (l.manager_review_status || 'pending') !== 'approved').length;
  const dayTotalMins = dayLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const d = new Date(date + 'T00:00:00');
  const namedLog = dayLogs.find(l => l.staff_name || l.completed_by_name);
  const drillerName = namedLog?.staff_name || namedLog?.completed_by_name || '';
  const allApproved = dayPending === 0;
  const selectedLog = dayLogs.find(l => l.id === selectedActivityId);

  // Group by borehole
  const groups = {};
  if (groupBy === 'borehole') {
    dayLogs.forEach(l => {
      const key = l.borehole_ref || 'Uncategorised';
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
  }

  const handleEdit = (log) => {
    setEditingId(log.id);
    setEditForm({ start_time: log.start_time || '', end_time: log.end_time || '', description: log.description || '' });
  };

  const handleSave = async (logId) => {
    setSavingId(logId);
    let durationMins = 0;
    if (editForm.start_time && editForm.end_time) {
      const [sh, sm] = editForm.start_time.split(':').map(Number);
      const [eh, em] = editForm.end_time.split(':').map(Number);
      let start = sh * 60 + sm;
      let end = eh * 60 + em;
      if (end <= start) end += 1440;
      durationMins = end - start;
    }
    try {
      await base44.entities.InvestigationLog.update(logId, {
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        duration_minutes: durationMins,
        description: editForm.description,
      });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      toast({ title: 'Log updated', description: 'Your edits have been saved.' });
      setEditingId(null);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save the edit.', variant: 'destructive' });
    }
    setSavingId(null);
  };

  const handleApproveDate = async () => {
    setApproving(true);
    try {
      const res = await base44.functions.invoke('approveKeyLogBookLogs', { job_id: job.id, date });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast({ title: 'Timesheet re-generated', description: res?.data?.message || `Timesheet re-generated for ${format(new Date(date + 'T00:00:00'), 'dd MMM')}.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not re-generate timesheet.', variant: 'destructive' });
    }
    setApproving(false);
  };

  const renderActivity = (log) => {
    const isPending = (log.manager_review_status || 'pending') !== 'approved';
    const isEditing = editingId === log.id;
    const isSelected = selectedActivityId === log.id;
    const isChecked = selectMode && selectedIds?.has(log.id);

    if (isEditing) {
      return (
        <div key={log.id} className="bg-amber-50/60 rounded-xl border border-amber-200 p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs font-bold text-amber-800">Editing activity</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Start time</label>
              <input type="time" value={editForm.start_time} onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">End time</label>
              <input type="time" value={editForm.end_time} onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white" />
            </div>
          </div>
          <div className="mb-2.5">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Description</label>
            <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave(log.id)} disabled={savingId === log.id}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold disabled:opacity-50">
              {savingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setEditingId(null)} disabled={savingId === log.id}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-semibold">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={log.id}
        onClick={() => selectMode ? onToggleSelect?.(log.id) : onSelectActivity?.(log.id)}
        className={`flex gap-3 p-3 rounded-xl border transition cursor-pointer ${isChecked ? 'border-emerald-400 bg-emerald-50' : isSelected ? 'border-slate-400 bg-slate-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'}`}>
        {/* Selection checkbox (select mode only) */}
        {selectMode && (
          <input
            type="checkbox"
            checked={!!isChecked}
            onChange={() => onToggleSelect?.(log.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0 cursor-pointer"
          />
        )}
        <div className={`w-1 rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />
        <div className="flex-shrink-0 w-20 sm:w-24 text-right">
          <p className="text-sm font-mono font-bold text-slate-700 leading-tight">{log.start_time || '—'}</p>
          <p className="text-sm font-mono font-bold text-slate-400 leading-tight">{log.end_time || '—'}</p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {fmtDur(log.duration_minutes)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <ActivityTag description={log.description} />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{log.description}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {log.borehole_ref && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {log.borehole_ref}
              </span>
            )}
            {log.chargeable && log.charge_amount && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                £{Number(log.charge_amount).toFixed(0)}
              </span>
            )}
            {log.pricing_review_status === 'pending_review' && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending pricing
              </span>
            )}
            {log.manager_review_status === 'queried' && (
              <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full font-medium">
                Date unconfirmed
              </span>
            )}
            {!selectMode && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); navigateToInvestigationHub(log.job_id, log.id); }}
                  title="View in Investigation Hub"
                  className="text-[11px] text-slate-400 hover:text-[#2E5A1A] flex items-center gap-1 font-medium transition">
                  <ExternalLink className="w-3 h-3" /> Hub
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleEdit(log); }}
                  className="text-[11px] text-slate-400 hover:text-emerald-700 flex items-center gap-1 font-medium transition">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Day header */}
      <button onClick={() => onToggle(date)}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/80 transition border-b border-slate-100">
        <div className={`w-1 h-10 rounded-full flex-shrink-0 ${allApproved ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? '' : '-rotate-90'}`} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{format(d, 'EEEE, dd MMM yyyy')}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-400">{dayLogs.length} {dayLogs.length === 1 ? 'activity' : 'activities'}</span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {fmtDur(dayTotalMins)}
              </span>
              {drillerName && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-slate-300">·</span>
                  <User className="w-3 h-3" /> {drillerName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {allApproved ? (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Approved
            </span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
              {dayPending} pending
            </span>
          )}
        </div>
      </button>

      {/* Timeline + activities */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Visual timeline */}
          <SiteLogTimelineBar activities={dayLogs} selectedId={selectedActivityId} onSelect={onSelectActivity} />

          {/* Selected activity details */}
          {selectedLog && !selectMode && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(selectedLog.manager_review_status || 'pending') !== 'approved' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {selectedLog.start_time}–{selectedLog.end_time}
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fmtDur(selectedLog.duration_minutes)}
                </span>
                {selectedLog.borehole_ref && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selectedLog.borehole_ref}
                  </span>
                )}
                {selectedLog.chargeable && selectedLog.charge_amount && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                    £{Number(selectedLog.charge_amount).toFixed(0)}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{selectedLog.description}</p>
            </div>
          )}

          {/* Activity list */}
          {groupBy === 'borehole' ? (
            <div className="space-y-3">
              {Object.entries(groups).map(([bhRef, bhLogs]) => (
                <div key={bhRef}>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {bhRef}
                  </p>
                  <div className="space-y-2">{bhLogs.map(renderActivity)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">{dayLogs.map(renderActivity)}</div>
          )}

          {/* Re-generate timesheet */}
          {!selectMode && (
            <div className="pt-2 border-t border-slate-100">
              <button onClick={handleApproveDate} disabled={approving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
                {approving ? <><Loader2 className="w-4 h-4 animate-spin" /> Re-generating…</> : <><RotateCcw className="w-4 h-4" /> Re-generate Timesheet</>}
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-1.5">Re-creates the daily summary timesheet from these activities.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}