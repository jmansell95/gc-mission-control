import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  X, Plus, Trash2, Save, Loader2, CalendarRange, PalmtreeIcon, Plane
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const REASON_OPTIONS = [
  { value: 'holiday', label: 'Annual leave / Holiday' },
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

const inputCls = "w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

/**
 * LeaveCaptureModal — auto-appears after a multi-day job assignment is saved.
 * Lets the manager input the crew member's annual-leave date ranges + reasons
 * that fall WITHIN the assignment span, so the rota renders "ON LEAVE" banners
 * in between the job days. Skippable ("No leave — just save").
 *
 * Leave rows are stored as Absence records (status 'approved', source 'manual').
 */
export default function LeaveCaptureModal({ open, onClose, staffId, staffName, jobId, jobName, spanStart, spanEnd }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rows, setRows] = useState([{ start_date: '', end_date: '', reason: 'holiday', notes: '' }]);
  const [saving, setSaving] = useState(false);

  // Existing approved absences for this staff member overlapping the span
  const { data: existingAbsences = [] } = useQuery({
    queryKey: ['absences'],
    queryFn: () => base44.entities.Absence.list(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setRows([{ start_date: '', end_date: '', reason: 'holiday', notes: '' }]);
    }
  }, [open, staffId]);

  if (!open) return null;

  const spanDays = (spanStart && spanEnd) ? differenceInCalendarDays(parseISO(spanEnd + 'T00:00:00'), parseISO(spanStart + 'T00:00:00')) + 1 : 0;

  // Existing leave rows within this span (for display / removal)
  const spanLeave = existingAbsences.filter(a =>
    a.staff_id === staffId &&
    a.status === 'approved' &&
    a.start_date && a.end_date &&
    a.start_date <= spanEnd && a.end_date >= spanStart
  );

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const addRow = () => setRows(prev => [...prev, { start_date: '', end_date: '', reason: 'holiday', notes: '' }]);
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  const validRows = rows.filter(r => r.start_date && r.end_date && r.end_date >= r.start_date);

  // Prevents duplicate leave records: a new row that overlaps an existing
  // approved absence for this staff member is skipped (the concurrent-leave bug).
  const overlapsExisting = (row) =>
    existingAbsences.some(a =>
      a.staff_id === staffId &&
      a.status === 'approved' &&
      a.start_date && a.end_date &&
      a.start_date <= row.end_date && a.end_date >= row.start_date
    );

  const handleSave = async () => {
    // Re-fetch absences fresh to avoid stale-cache race conditions when
    // multiple managers submit leave concurrently for the same staff member.
    let freshAbsences = [];
    try {
      freshAbsences = await base44.entities.Absence.filter({ staff_id: staffId, status: 'approved' });
    } catch (e) {
      // Fallback to cached data if the fresh fetch fails
      freshAbsences = existingAbsences;
    }
    const freshOverlap = (row) =>
      freshAbsences.some(a =>
        a.staff_id === staffId &&
        a.status === 'approved' &&
        a.start_date && a.end_date &&
        a.start_date <= row.end_date && a.end_date >= row.start_date
      );

    // Filter out rows that overlap existing approved absences, then
    // deduplicate intra-batch: sort by start_date and skip any row that
    // overlaps an already-kept row (prevents duplicate leave within one save).
    const sortedValid = [...validRows].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const kept = [];
    for (const row of sortedValid) {
      if (freshOverlap(row)) continue;
      const overlapsKept = kept.some(k =>
        k.start_date <= row.end_date && k.end_date >= row.start_date
      );
      if (!overlapsKept) kept.push(row);
    }
    const skipped = validRows.length - kept.length;

    if (kept.length === 0) {
      if (skipped > 0) {
        toast({ title: 'Leave already exists', description: `${skipped} row${skipped === 1 ? '' : 's'} already covered by existing leave — no duplicates created.` });
      }
      onClose();
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Absence.bulkCreate(
        kept.map(r => ({
          staff_id: staffId,
          start_date: r.start_date,
          end_date: r.end_date,
          reason: r.reason,
          notes: r.notes || (jobName ? `Captured during assignment to ${jobName}` : ''),
          status: 'approved',
          source: 'manual',
        }))
      );
      // Delete existing job/depot shifts on the leave dates in parallel
      // (replaceShiftsWithLeave is idempotent — safe to run concurrently).
      await Promise.all(
        kept.map(r =>
          base44.functions.invoke('replaceShiftsWithLeave', {
            staff_id: staffId,
            start_date: r.start_date,
            end_date: r.end_date,
          }).catch(e => console.error('Failed to replace shifts with leave:', e))
        )
      );
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast({ title: `${kept.length} leave range${kept.length === 1 ? '' : 's'} saved${skipped > 0 ? ` · ${skipped} skipped (already on leave)` : ''}`, description: `${staffName}'s rota will show ON LEAVE on those dates.` });
      onClose();
    } catch (e) {
      toast({ title: 'Failed to save leave', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExisting = async (absence) => {
    if (!confirm(`Remove the ${absence.reason} leave (${absence.start_date} → ${absence.end_date})?`)) return;
    try {
      await base44.entities.Absence.delete(absence.id);
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast({ title: 'Leave range removed' });
    } catch (e) {
      toast({ title: 'Failed to remove', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 pr-8">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <PalmtreeIcon className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p>Capture Annual Leave</p>
              <p className="text-xs font-normal text-slate-500 flex items-center gap-1">
                <CalendarRange className="w-3 h-3" /> {staffName} · {spanDays}-day assignment span
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add this crew member's leave date ranges that fall within the assignment span.
          </DialogDescription>
        </DialogHeader>

        {/* Span summary */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 flex items-center gap-2 text-xs">
          <Plane className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-emerald-900 truncate">{jobName || 'Assignment'}</p>
            <p className="text-emerald-700">
              {spanStart && spanEnd
                ? `${format(parseISO(spanStart + 'T00:00:00'), 'dd MMM')} → ${format(parseISO(spanEnd + 'T00:00:00'), 'dd MMM yyyy')} (${spanDays} days)`
                : 'Date range'}
            </p>
          </div>
        </div>

        {/* Existing leave within span */}
        {spanLeave.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Existing leave in this span</p>
            {spanLeave.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="flex-1 font-medium text-slate-700">{a.start_date} → {a.end_date}</span>
                <span className="text-slate-500 capitalize">{a.reason}</span>
                <button onClick={() => handleDeleteExisting(a)} className="p-1 text-slate-400 hover:text-red-500 rounded transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New leave rows */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Add leave ranges</p>
          {rows.map((row, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-2.5 space-y-2 bg-white">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">From</label>
                  <input type="date" value={row.start_date} min={spanStart} max={spanEnd}
                    onChange={(e) => updateRow(idx, 'start_date', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">To</label>
                  <input type="date" value={row.end_date} min={row.start_date || spanStart} max={spanEnd}
                    onChange={(e) => updateRow(idx, 'end_date', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={row.reason} onChange={(e) => updateRow(idx, 'reason', e.target.value)} className={inputCls + " flex-1"}>
                  {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input type="text" value={row.notes} placeholder="Notes (optional)" onChange={(e) => updateRow(idx, 'notes', e.target.value)} className={inputCls} />
            </div>
          ))}
          <button onClick={addRow} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-dashed border-emerald-300 rounded-lg hover:bg-emerald-100 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add leave range
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save leave
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
            No leave — just save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}