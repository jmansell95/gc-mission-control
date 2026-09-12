import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Package, MapPin, Loader2, CheckCircle2, AlertTriangle,
  ShieldCheck, ChevronRight, Wrench, Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

/**
 * Equipment Sign-Out — field staff scan gear and sign it out directly
 * to their active job. Creates JobAssetAssignment records with status
 * 'on_site' so the yard knows where every item is.
 *
 * Props:
 *   open, onClose, assets (array of SiteAsset), staffId
 */
export default function EquipmentSignOutModal({ open, onClose, assets = [], staffId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's assignments for this staff — these are the jobs they can sign gear out to
  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-today-assignments', staffId, todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId, assigned_date: todayStr }),
    enabled: !!staffId && open,
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list(), enabled: open });

  // Jobs the staff member is working on today (not completed)
  const todaysJobs = useMemo(() => {
    const activeJobIds = myAssignments
      .filter(a => (a.status || 'assigned') !== 'completed' && a.job_id)
      .map(a => a.job_id);
    const uniqueIds = [...new Set(activeJobIds)];
    return uniqueIds.map(id => jobs.find(j => j.id === id)).filter(Boolean);
  }, [myAssignments, jobs]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Check compliance on the assets being signed out
  const nonCompliantAssets = assets.filter(a => a.compliance_status === 'expired');
  const canSubmit = selectedJobId && !saving && assets.length > 0;

  const handleSubmit = async () => {
    if (!selectedJobId) {
      toast({ title: 'Select a job', description: 'Choose which job to sign this gear out to.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Create a JobAssetAssignment for each scanned asset
      const records = assets.map(a => ({
        job_id: selectedJobId,
        job_name: selectedJob?.name || '',
        asset_id: a.id,
        asset_name: a.name,
        asset_type: a.asset_type,
        rig_type: a.rig_type || 'n/a',
        role: a.is_rig ? 'primary_rig' : a.asset_type === 'trailer' ? 'trailer' : a.asset_type === 'lifting' ? 'lifting' : 'machinery',
        compliance_status: a.compliance_status || 'unknown',
        status: 'on_site',
        assigned_date: todayStr,
        arrived_on_site_date: todayStr,
        notes: `Signed out via scanner by staff`,
      }));

      await base44.entities.JobAssetAssignment.bulkCreate(records);
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments-staff'] });

      // Push the sign-out to Asset Panda so the yard's Panda dashboard
      // shows the gear as 'Out on Job'. Non-blocking — local records are
      // already saved, so a Panda outage doesn't break the sign-out flow.
      const pandaIds = assets.map(a => a.panda_asset_id).filter(Boolean);
      if (pandaIds.length > 0) {
        try {
          await base44.functions.invoke('pushSignOutToPanda', {
            panda_ids: pandaIds,
            job_name: selectedJob?.name || '',
          });
        } catch (_) { /* non-fatal — local records are already saved */ }
      }

      setConfirmed(true);
      setTimeout(() => {
        onClose();
        setConfirmed(false);
        setSelectedJobId('');
      }, 1500);
    } catch (err) {
      console.error('Sign-out error:', err);
      toast({ title: 'Error', description: 'Could not sign out equipment. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-0 sm:p-4"
        onClick={() => !saving && onClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Sign Out to Job</h3>
                <p className="text-[11px] text-slate-400">{assets.length} item{assets.length !== 1 ? 's' : ''} scanned</p>
              </div>
            </div>
            <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {confirmed ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="font-bold text-slate-900 mb-1">Gear Signed Out!</p>
              <p className="text-sm text-slate-500">{assets.length} item{assets.length !== 1 ? 's' : ''} assigned to {selectedJob?.name}.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Scanned assets */}
              <div className="space-y-1.5">
                {assets.map(a => {
                  const Icon = a.asset_type === 'rig' ? Wrench : a.asset_type === 'trailer' ? Layers : Package;
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{a.serial_number || 'No serial'}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        a.compliance_status === 'compliant' ? 'bg-emerald-100 text-emerald-700' :
                        a.compliance_status === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {(a.compliance_status || 'unknown').toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Non-compliant warning */}
              {nonCompliantAssets.length > 0 && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800 font-medium leading-relaxed">
                    {nonCompliantAssets.length} item{nonCompliantAssets.length > 1 ? 's have' : ' has'} expired compliance. You can still sign {nonCompliantAssets.length > 1 ? 'them' : 'it'} out, but the yard manager will be notified.
                  </p>
                </div>
              )}

              {/* Job selection */}
              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  <MapPin className="w-3 h-3" /> Sign Out to Job *
                </label>
                {todaysJobs.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
                    <p className="text-xs text-amber-800 font-medium">No active jobs today. Ask your manager to assign you to a job first.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {todaysJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        type="button"
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left active:scale-[0.99] ${
                          selectedJobId === job.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          selectedJobId === job.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{job.name}</p>
                          <p className="text-xs text-slate-500 truncate">{job.location}</p>
                        </div>
                        {selectedJobId === job.id && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!confirmed && (
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2 safe-area-bottom">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing Out…</>
                  : <><ShieldCheck className="w-4 h-4" /> Sign Out {assets.length} Item{assets.length !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4" /></>
                }
              </button>
              <button onClick={() => !saving && onClose()} className="px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition active:scale-95">
                Cancel
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}