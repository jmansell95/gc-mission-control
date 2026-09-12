import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Trash2, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet,
  Briefcase, Receipt, CalendarDays, Layers, ChevronDown, ChevronRight,
} from 'lucide-react';

/**
 * PurgeCompletedJobsPanel — Admin tool to hard-delete all completed jobs and
 * their related child records. Shows a preview of counts before confirming.
 */
export default function PurgeCompletedJobsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showJobs, setShowJobs] = useState(false);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('purgeCompletedJobs', { dry_run: true });
      setPreview(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!preview || preview.summary.completed_jobs === 0) return;
    if (!window.confirm(`This will PERMANENTLY DELETE ${preview.summary.completed_jobs} completed jobs and ${preview.summary.total_child_records} related records. This cannot be undone. Continue?`)) return;
    setPurging(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('purgeCompletedJobs', { dry_run: false });
      setResult(res.data);
      setPreview(null);
      toast({
        title: 'Purge complete',
        description: `Deleted ${res.data.summary.jobs_deleted} completed jobs and ${res.data.summary.total_child_records} related records.`,
      });
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  };

  const childLabels = {
    Invoice: 'Invoices', JobCostItem: 'Cost Items', RotaAssignment: 'Rota Assignments',
    Timesheet: 'Timesheets', InvestigationLog: 'Investigation Logs', DeliveryLog: 'Delivery Logs',
    JobAssetAssignment: 'Asset Assignments', SubcontractorLog: 'Subcontractor Logs',
    JobComment: 'Job Comments', SitePhoto: 'Site Photos', JobDocument: 'Job Documents',
    JobMilestone: 'Milestones', HotelBooking: 'Hotel Bookings', JobDelayLog: 'Delay Logs',
    JobBillingContract: 'Billing Contracts', JobBillOfQuantities: 'BOQs',
    BriefingSignature: 'Briefing Signatures', AssetReturnLog: 'Asset Returns',
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="hub-glass rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Purge Completed Jobs</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Permanently deletes every job with status <strong>completed</strong> and all related records (invoices, rotas, timesheets, cost items, logs, photos, documents). This is irreversible.
            </p>
          </div>
        </div>
        <button
          onClick={runPreview}
          disabled={loading}
          className="command-gradient text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition hover:shadow-lg"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</> : <><FileSpreadsheet className="w-4 h-4" /> Scan for Completed Jobs</>}
        </button>
        {error && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="hub-glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-800">Purge Preview</h3>
          </div>

          {preview.summary.completed_jobs === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-emerald-800">No completed jobs found — nothing to purge.</p>
            </div>
          ) : (
            <>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="stat-gradient-rose rounded-xl p-4 text-white">
                  <Briefcase className="w-5 h-5 mb-2 opacity-80" />
                  <p className="text-2xl font-bold tabular-nums">{preview.summary.completed_jobs}</p>
                  <p className="text-xs opacity-90">Completed Jobs</p>
                </div>
                <div className="stat-gradient-slate rounded-xl p-4 text-white">
                  <Layers className="w-5 h-5 mb-2 opacity-80" />
                  <p className="text-2xl font-bold tabular-nums">{preview.summary.total_child_records}</p>
                  <p className="text-xs opacity-90">Related Records</p>
                </div>
                <div className="stat-gradient-amber rounded-xl p-4 text-white">
                  <Receipt className="w-5 h-5 mb-2 opacity-80" />
                  <p className="text-2xl font-bold tabular-nums">{preview.summary.child_records.Invoice || 0}</p>
                  <p className="text-xs opacity-90">Invoices</p>
                </div>
                <div className="stat-gradient-teal rounded-xl p-4 text-white">
                  <CalendarDays className="w-5 h-5 mb-2 opacity-80" />
                  <p className="text-2xl font-bold tabular-nums">{preview.summary.child_records.RotaAssignment || 0}</p>
                  <p className="text-xs opacity-90">Rota Assignments</p>
                </div>
              </div>

              {/* Child record breakdown */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2.5">Related records that will be deleted:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(preview.summary.child_records).map(([entity, count]) => {
                    const n = Number(count) || 0;
                    return (
                      <div key={entity} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                        <span className="text-xs text-slate-600">{childLabels[entity] || entity}</span>
                        <span className={`text-sm font-bold tabular-nums ${n > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Job list */}
              <div>
                <button onClick={() => setShowJobs(!showJobs)} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
                  {showJobs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  View job list ({preview.summary.completed_jobs})
                </button>
                {showJobs && (
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-1 bg-slate-50 rounded-lg p-2">
                    {preview.summary.job_names.map((j, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded px-3 py-1.5 text-sm border border-slate-100">
                        <span className="font-medium text-slate-700 truncate">{j.name}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{j.end_date || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warning + confirm */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Confirming will <strong>permanently delete</strong> {preview.summary.completed_jobs} jobs and {preview.summary.total_child_records} related records. This cannot be undone.</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handlePurge}
                  disabled={purging}
                  className="bg-rose-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {purging ? <><Loader2 className="w-4 h-4 animate-spin" /> Purging…</> : <><Trash2 className="w-4 h-4" /> Confirm Purge</>}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  disabled={purging}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="hub-glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">Purge Complete</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-rose-600 tabular-nums">{result.summary.jobs_deleted}</p>
              <p className="text-xs text-rose-700">Jobs Deleted</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-600 tabular-nums">{result.summary.total_child_records}</p>
              <p className="text-xs text-slate-600">Related Records</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Deleted by entity:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {Object.entries(result.summary.child_records_deleted).map(([entity, count]) => {
                const n = Number(count) || 0;
                if (n === 0) return null;
                return (
                  <div key={entity} className="flex items-center justify-between bg-white rounded px-2.5 py-1.5 text-xs">
                    <span className="text-slate-600">{childLabels[entity] || entity}</span>
                    <span className="font-bold text-slate-700">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={() => setResult(null)} className="text-sm text-slate-500 hover:text-slate-700">Dismiss</button>
        </div>
      )}
    </div>
  );
}