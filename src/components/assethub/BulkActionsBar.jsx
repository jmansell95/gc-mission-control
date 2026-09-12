import React, { useState } from 'react';
import { Lock, X, Briefcase, PowerOff, RefreshCw, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Sticky bulk action bar shown when selection mode is active in the AssetHub.
 * Supports: View Certs, Assign to Job (bulk), Mark Inactive (bulk),
 * Recert (bulk), Select All, Clear.
 */
export default function BulkActionsBar({ selectedAssets, totalAvailable, onSelectAll, onClear, onViewCerts, onRecert }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAssignJob, setShowAssignJob] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedCount = selectedAssets.length;
  if (selectedCount === 0) return null;

  const handleAssignToJob = async () => {
    if (!selectedJobId) {
      toast({ title: 'Select a job', description: 'Choose a job to assign these assets to.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      // Create JobAssetAssignment for each selected asset
      const payload = selectedAssets.map(a => ({
        job_id: selectedJobId,
        asset_id: a.id,
        asset_name: a.name,
        asset_type: a.asset_type,
        role: a.asset_type === 'rig' ? 'primary_rig' : 'machinery',
        status: 'assigned',
        assigned_date: new Date().toISOString().slice(0, 10),
      }));
      await base44.entities.JobAssetAssignment.bulkCreate(payload);
      toast({ title: 'Assets assigned', description: `${selectedCount} asset${selectedCount > 1 ? 's' : ''} assigned to the job.` });
      qc.invalidateQueries({ queryKey: ['site-assets'] });
      setShowAssignJob(false);
      onClear();
    } catch (err) {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkInactive = async () => {
    if (!window.confirm(`Mark ${selectedCount} asset${selectedCount > 1 ? 's' : ''} as inactive? This hides them from the active inventory.`)) return;
    setBusy(true);
    try {
      const updates = selectedAssets.map(a => ({ id: a.id, is_active: false }));
      await base44.entities.SiteAsset.bulkUpdate(updates);
      toast({ title: 'Marked inactive', description: `${selectedCount} asset${selectedCount > 1 ? 's' : ''} are now inactive.` });
      qc.invalidateQueries({ queryKey: ['site-assets'] });
      onClear();
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const openJobPicker = async () => {
    setShowAssignJob(true);
    if (jobs.length === 0) {
      setLoadingJobs(true);
      try {
        const res = await base44.entities.Job.filter({ status: 'in_progress' }, '-updated_date', 50);
        setJobs(res);
      } catch {
        // ignore
      } finally {
        setLoadingJobs(false);
      }
    }
  };

  return (
    <>
      <div className="sticky bottom-4 z-30 bg-primary text-white rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-semibold">{selectedCount} of {totalAvailable} selected</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onViewCerts} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition">
            <Lock className="w-3.5 h-3.5" /> View Certs
          </button>
          <button onClick={openJobPicker} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition">
            <Briefcase className="w-3.5 h-3.5" /> Assign to Job
          </button>
          <button onClick={handleMarkInactive} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition disabled:opacity-50">
            <PowerOff className="w-3.5 h-3.5" /> Mark Inactive
          </button>
          {onRecert && (
            <button onClick={onRecert} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold transition">
              <RefreshCw className="w-3.5 h-3.5" /> Recert
            </button>
          )}
          <button onClick={onSelectAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition">Select All</button>
          <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition"><X className="w-3.5 h-3.5" /> Clear</button>
        </div>
      </div>

      {/* Assign to Job modal */}
      {showAssignJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={() => !busy && setShowAssignJob(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Assign {selectedCount} asset{selectedCount > 1 ? 's' : ''} to Job</h3>
              <button onClick={() => setShowAssignJob(false)} disabled={busy} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" /></div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No active jobs found. Create or activate a job first.</p>
            ) : (
              <>
                <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary bg-white mb-4">
                  <option value="">Select a job...</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name} {j.job_reference ? `· ${j.job_reference}` : ''}</option>)}
                </select>
                <button onClick={handleAssignToJob} disabled={busy || !selectedJobId} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#244715] disabled:opacity-50 transition">
                  {busy ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  {busy ? 'Assigning...' : 'Assign Assets'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}