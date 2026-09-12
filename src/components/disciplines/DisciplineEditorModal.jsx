import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Layers, Loader2, Save } from 'lucide-react';
import DisciplineBuilder from '@/components/disciplines/DisciplineBuilder';
import { getJobDisciplines } from '@/utils/jobDisciplines';

/**
 * DisciplineEditorModal — lets a manager edit the disciplines array on an
 * existing job (add / re-order / change status & method / remove) without
 * opening the full job wizard. Saves directly to the Job entity and mirrors
 * the primary discipline into the legacy job_type / drilling_method fields.
 */
export default function DisciplineEditorModal({ open, onClose, job }) {
  const [disciplines, setDisciplines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && job) {
      setDisciplines(getJobDisciplines(job));
      setError('');
    }
  }, [open, job]);

  if (!open || !job) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const clean = { disciplines };
      if (disciplines.length > 0) {
        clean.primary_discipline = disciplines[0].type;
        // Mirror primary discipline into legacy fields for backward compat
        clean.job_type = disciplines[0].type;
        if (disciplines[0].drilling_method && disciplines[0].drilling_method !== 'not_applicable') {
          clean.drilling_method = disciplines[0].drilling_method;
        }
      } else {
        // Clear legacy fields when all disciplines removed
        clean.job_type = '';
        clean.primary_discipline = '';
        clean.drilling_method = 'not_applicable';
      }
      await base44.entities.Job.update(job.id, clean);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      onClose();
    } catch (e) {
      setError(e?.message || 'Could not save disciplines.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#2E5A1A]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit Disciplines</h2>
              <p className="text-xs text-slate-400 truncate">{job.name}</p>
            </div>
          </div>
          <button onClick={onClose} type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
          )}
          <DisciplineBuilder
            disciplines={disciplines}
            onChange={setDisciplines}
          />
          {disciplines.length === 0 && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Removing all disciplines will clear the job type and drilling method. You can add new tracks anytime.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Disciplines</>}
          </button>
        </div>
      </div>
    </div>
  );
}