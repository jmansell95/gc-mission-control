import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import InvestigationLogEntry from './InvestigationLogEntry';

// Quick-log modal — opens from the "Log My Work" FAB. Lets crews log
// investigation data for any of today's jobs in a full-screen sheet,
// without going through the full shift wizard.
export default function QuickLogModal({ open, onClose, staff, jobs = [], defaultJobId }) {
  const [selectedJobId, setSelectedJobId] = useState(defaultJobId || '');

  useEffect(() => {
    if (open) setSelectedJobId(defaultJobId || jobs[0]?.id || '');
  }, [open, defaultJobId, jobs]);

  if (!open) return null;

  const selectedJob = jobs.find(j => j.id === selectedJobId) || jobs[0];
  const jobType = selectedJob?.job_type || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-base">Log My Work</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job selector */}
        {jobs.length > 1 && (
          <div className="px-5 py-3 border-b border-slate-50">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Job</label>
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:outline-none focus:border-primary"
            >
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Log form */}
        {selectedJob ? (
          <div className="p-4">
            <InvestigationLogEntry
              jobType={jobType}
              jobId={selectedJob.id}
              staffId={staff.id}
              staffName={staff.name}
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">No jobs assigned today. Ask your manager if you expected to be working.</p>
          </div>
        )}
      </div>
    </div>
  );
}