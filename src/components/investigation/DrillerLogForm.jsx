import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowDownToLine, TestTube, Wrench, Ruler, Send, Trash2, Plus, X, Droplets, Calculator, Layers, Gauge, Ban, AlertTriangle, Radar, Boxes, Beaker, Info, Tablet, UserCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calculateSptN } from './shared';
import CompletedBySelector from './CompletedBySelector';
import BoreholeProgressSummary from './BoreholeProgressSummary';
import BoreholeCompletionModal from './BoreholeCompletionModal';
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { useConfigLists } from '@/hooks/useConfigLists';
import { useDrillingRole } from '@/hooks/useDrillingRole';
import { saveOrQueue } from '@/utils/offlineSync';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

const drillingLogTypes = [
  { value: 'borehole_progress', label: 'Borehole', icon: ArrowDownToLine },
  { value: 'sample_collection', label: 'Sample', icon: TestTube },
  { value: 'window_sampling', label: 'Win Samp', icon: Layers },
  { value: 'standpipe_reading', label: 'Standpipe', icon: Gauge },
  { value: 'geophysical_probing', label: 'Geophys', icon: Radar },
  { value: 'core_inspection', label: 'Core', icon: Boxes },
  { value: 'borehole_decommissioning', label: 'Decomm', icon: Ban },
  { value: 'site_setup', label: 'Setup', icon: Wrench },
];

export default function DrillerLogForm({ staffId, jobId, job, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [completingBorehole, setCompletingBorehole] = useState(null);
  const [adding, setAdding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { getOptions } = useConfigLists();
  const strataOptions = getOptions('strata_types');
  const sampleTypes = getOptions('sample_types');
  const fluidLossOptions = getOptions('fluid_loss_options');
  const fluidReturnOptions = getOptions('fluid_return_options');
  const obstructionOptions = getOptions('obstruction_types');
  const sensorTypeOptions = getOptions('sensor_types');

  const [form, setForm] = useState({
    log_type: 'borehole_progress',
    completed_by_type: 'internal_staff',
    completed_by_name: '',
    borehole_ref: '',
    depth_from: '',
    depth_to: '',
    strata_descriptor: 'other',
    strata_description_detail: '',
    spt_blows_1: '', spt_blows_2: '', spt_blows_3: '',
    groundwater_strike_depth: '',
    groundwater_static_level: '',
    core_run_number: '',
    coring_recovery: '',
    coring_rqd: '',
    core_box_number: '',
    sample_id: '',
    sample_type: 'none',
    drilling_fluid_loss: 'none',
    fluid_return_quality: 'full',
    refusal_encountered: false,
    obstruction_type: 'none',
    standpipe_ref: '',
    standpipe_reading_m: '',
    probe_depth: '',
    sensor_type: '',
    seal_depth: '',
    backfill_material: '',
    grout_volume: '',
    mixer_type: 'none',
    grout_mix_ratio: '',
    description: '',
    photo_urls: '',
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-today', jobId, staffId, todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, date: todayStr }),
  });

  // Check whether this job has borehole/sample data imported from KeyLogBook AGS.
  // When AGS data exists, borehole_progress and sample_collection are read-only
  // (managed in KeyLogBook) — staff are guided to make changes there.
  const { data: agsLogs = [] } = useQuery({
    queryKey: ['investigation-logs-ags', jobId],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, source: 'ags_import' }),
  });
  const hasAGSData = agsLogs.length > 0;

  // Determine if the current staff member is the lead driller or a second man
  const { isLeadDriller, leadDrillerName } = useDrillingRole(staffId);

  // Log types that AGS handles — hidden from staff when AGS data exists
  const AGS_MANAGED = useMemo(() => new Set(['borehole_progress', 'sample_collection']), []);
  const availableLogTypes = hasAGSData
    ? drillingLogTypes.filter(t => !AGS_MANAGED.has(t.value))
    : drillingLogTypes;

  // If the current log_type is AGS-managed and AGS data exists, switch to a
  // still-available type so the form never opens on a hidden section.
  useEffect(() => {
    if (hasAGSData && AGS_MANAGED.has(form.log_type)) {
      setForm(f => ({ ...f, log_type: availableLogTypes[0]?.value || 'other' }));
    }
  }, [hasAGSData, AGS_MANAGED, availableLogTypes, form.log_type]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const existing = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];
      existing.push(res.file_url);
      setForm({ ...form, photo_urls: existing.join(',') });
      toast({ title: 'Photo attached' });
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
    setUploadingPhoto(false);
  };

  const handleAdd = async () => {
    if (form.completed_by_type !== 'internal_staff' && !form.completed_by_name.trim()) {
      toast({ title: 'Name required', description: 'Enter the client/contractor representative name.', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'standpipe_reading') {
      if (!form.standpipe_ref) {
        toast({ title: 'Standpipe ref required', variant: 'destructive' });
        return;
      }
      if (!form.standpipe_reading_m && form.standpipe_reading_m !== 0) {
        toast({ title: 'Reading required', description: 'Enter the water level reading in metres.', variant: 'destructive' });
        return;
      }
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'geophysical_probing' && !form.sensor_type) {
      toast({ title: 'Sensor type required', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'borehole_decommissioning' && !form.backfill_material) {
      toast({ title: 'Backfill material required', description: 'Record the seal/backfill material used.', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'core_inspection' && !form.core_box_number) {
      toast({ title: 'Core box number required', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const blows = [form.spt_blows_1, form.spt_blows_2, form.spt_blows_3]
        .map(b => b ? parseInt(b) : null)
        .filter(b => b !== null);
      const sptN = blows.length >= 2 ? calculateSptN(blows) : null;

      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        source: 'staff',
        logged_by_role: 'driller',
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
        depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
        strata_descriptor: form.strata_descriptor || 'other',
        strata_description_detail: form.strata_description_detail || '',
        spt_blows: blows.length > 0 ? blows : [],
        spt_n_value: sptN,
        groundwater_strike_depth: form.groundwater_strike_depth ? parseFloat(form.groundwater_strike_depth) : null,
        groundwater_static_level: form.groundwater_static_level ? parseFloat(form.groundwater_static_level) : null,
        core_run_number: form.core_run_number || '',
        coring_recovery: form.coring_recovery ? parseFloat(form.coring_recovery) : null,
        coring_rqd: form.coring_rqd ? parseFloat(form.coring_rqd) : null,
        core_box_number: form.core_box_number || '',
        sample_id: form.sample_id || '',
        sample_type: form.sample_type || 'none',
        drilling_fluid_loss: form.drilling_fluid_loss || 'none',
        fluid_return_quality: form.fluid_return_quality || 'full',
        refusal_encountered: !!form.refusal_encountered,
        obstruction_type: form.obstruction_type || 'none',
        standpipe_ref: form.log_type === 'standpipe_reading' ? (form.standpipe_ref || form.borehole_ref) : (form.standpipe_ref || ''),
        standpipe_reading_m: form.standpipe_reading_m !== '' ? parseFloat(form.standpipe_reading_m) : null,
        probe_depth: form.probe_depth !== '' ? parseFloat(form.probe_depth) : null,
        sensor_type: form.sensor_type || '',
        seal_depth: form.seal_depth !== '' ? parseFloat(form.seal_depth) : null,
        backfill_material: form.backfill_material || '',
        grout_volume: form.grout_volume !== '' ? parseFloat(form.grout_volume) : null,
        mixer_type: form.mixer_type || 'none',
        grout_mix_ratio: form.grout_mix_ratio || '',
        description: form.description || '',
        photo_urls: form.photo_urls || '',
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
        completed_by_type: form.completed_by_type || 'internal_staff',
        completed_by_name: form.completed_by_type === 'internal_staff'
          ? (staffName || '')
          : (form.completed_by_name || ''),
        chargeable: form.completed_by_type !== 'client',
        billing_status: form.completed_by_type === 'client' ? 'no_charge' : 'auto',
      };
      const result = await saveOrQueue('InvestigationLog', 'create', payload);
      if (result?._offline) {
        toast({ title: 'Saved offline', description: 'Log entry queued — will sync when you reconnect.' });
      } else {
        toast({ title: 'Log entry added', description: sptN != null ? `SPT N = ${sptN}` : undefined });
      }
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      // Pre-fill borehole ref and carry depth_from forward
      setForm({
        ...form,
        depth_from: form.depth_to || '',
        depth_to: '',
        spt_blows_1: '', spt_blows_2: '', spt_blows_3: '',
        strata_description_detail: '',
        sample_id: '',
        sample_type: 'none',
        description: '',
        photo_urls: '',
        coring_recovery: '',
        coring_rqd: '',
        core_run_number: '',
        groundwater_strike_depth: '',
        groundwater_static_level: '',
        drilling_fluid_loss: 'none',
        fluid_return_quality: 'full',
        refusal_encountered: false,
        obstruction_type: 'none',
        standpipe_reading_m: '',
        core_box_number: '',
        probe_depth: '',
        sensor_type: '',
        seal_depth: '',
        backfill_material: '',
        grout_volume: '',
        mixer_type: 'none',
        grout_mix_ratio: '',
        completed_by_name: '',
      });
      setShowForm(false);
    } catch (e) {
      toast({ title: 'Error adding log', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this log entry?')) return;
    try {
      await base44.entities.InvestigationLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
    } catch (e) { console.error(e); }
  };

  const isBorehole = form.log_type === 'borehole_progress';
  const isSample = form.log_type === 'sample_collection';
  const isStandpipe = form.log_type === 'standpipe_reading';
  const isWindowSampling = form.log_type === 'window_sampling';
  const isGeophysical = form.log_type === 'geophysical_probing';
  const isDecommissioning = form.log_type === 'borehole_decommissioning';
  const isCoreInspection = form.log_type === 'core_inspection';
  const isExternalParty = form.completed_by_type !== 'internal_staff';
  const isCoring = job?.job_type === 'rotary_drilling' && isBorehole;
  const photos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];

  // "Continue borehole" — pre-fills the form with the borehole ref and
  // carries the latest depth forward as the new depth_from.
  const handleContinueBorehole = (ref, maxDepth) => {
    setForm({
      ...form,
      borehole_ref: ref,
      depth_from: maxDepth > 0 ? String(maxDepth) : '',
      depth_to: '',
      log_type: 'borehole_progress',
      spt_blows_1: '', spt_blows_2: '', spt_blows_3: '',
      strata_description_detail: '',
      description: '',
      photo_urls: '',
    });
    setShowForm(true);
  };

  // "End of Hole" — open the completion modal for validation + sealing
  const handleEndOfHole = (ref, logs) => {
    setCompletingBorehole({ ref, logs });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <ArrowDownToLine className="w-4 h-4 text-blue-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Borehole Log</h3>
          <p className="text-xs text-slate-400">Strata · SPT · Groundwater {isCoring ? '· Core recovery' : ''}</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      <BoreholeProgressSummary todayLogs={todayLogs} onContinue={handleContinueBorehole} onEndOfHole={handleEndOfHole} hasAGSData={hasAGSData} />

      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {todayLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0)).map(log => (
            <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref || '—'}</span>
                  {log.depth_from != null && log.depth_to != null && (
                    <span className="text-xs text-slate-600">{log.depth_from}→{log.depth_to}m</span>
                  )}
                  {log.spt_n_value != null && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">N={log.spt_n_value}</span>
                  )}
                  {log.sample_id && (
                    <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>
                  )}
                  {log.groundwater_strike_depth != null && (
                    <span className="text-xs bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Droplets className="w-2.5 h-2.5" /> {log.groundwater_strike_depth}m
                    </span>
                  )}
                  {log.log_type === 'standpipe_reading' && log.standpipe_ref && (
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Gauge className="w-2.5 h-2.5" /> {log.standpipe_ref}{log.standpipe_reading_m != null ? ` ${log.standpipe_reading_m}m` : ''}
                    </span>
                  )}
                  {log.log_type === 'window_sampling' && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Window Samp</span>
                  )}
                  {log.log_type === 'geophysical_probing' && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Radar className="w-2.5 h-2.5" /> {log.sensor_type || 'Probe'}{log.probe_depth != null ? ` ${log.probe_depth}m` : ''}
                    </span>
                  )}
                  {log.log_type === 'borehole_decommissioning' && (
                    <span className="text-xs bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Ban className="w-2.5 h-2.5" /> Decommissioned{log.seal_depth != null ? ` ${log.seal_depth}m` : ''}
                    </span>
                  )}
                  {log.log_type === 'core_inspection' && (
                    <span className="text-xs bg-fuchsia-100 text-fuchsia-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Boxes className="w-2.5 h-2.5" /> {log.core_box_number || 'Core'}
                    </span>
                  )}
                  {log.drilling_fluid_loss && log.drilling_fluid_loss !== 'none' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${log.drilling_fluid_loss === 'total' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {log.drilling_fluid_loss === 'total' ? 'Fluid loss' : 'Part. loss'}
                    </span>
                  )}
                  {log.refusal_encountered && (
                    <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                      <Ban className="w-2.5 h-2.5" /> Refusal
                    </span>
                  )}
                  {log.completed_by_type && log.completed_by_type !== 'internal_staff' && (
                    <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">
                      {log.completed_by_type === 'client' ? 'Client' : 'Contractor'}{log.completed_by_name ? ` · ${log.completed_by_name}` : ''}{log.created_at ? ` @ ${format(new Date(log.created_at), 'HH:mm')}` : ''}
                    </span>
                  )}
                </div>
                {log.strata_description_detail && <p className="text-xs text-slate-600 mt-0.5">{log.strata_description_detail}</p>}
                {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
              </div>
              {log.source !== 'ags_import' && (
                <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {log.source === 'ags_import' && (
                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 flex-shrink-0">
                  <Tablet className="w-2.5 h-2.5" /> AGS
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">{hasAGSData ? 'New Activity Entry' : 'New Borehole Entry'}</p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          {hasAGSData && (
            <div className={`p-3 rounded-lg border flex items-start gap-2.5 ${isLeadDriller ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              {isLeadDriller
                ? <Tablet className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                : <UserCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  {isLeadDriller ? 'Borehole data is managed in KeyLogBook' : 'Borehole data is managed by your lead driller'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {isLeadDriller
                    ? <>Strata, SPT, samples and borehole progress come from your AGS import. To add or correct this data, make the changes on your tablet in KeyLogBook and re-import the file here.</>
                    : <>Strata, SPT, samples and borehole progress come from the AGS import. Please speak with <span className="font-semibold">{leadDrillerName}</span> if something is missed or not right — they can update it in KeyLogBook and re-import.</>}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {availableLogTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex-shrink-0 min-w-[72px] flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold border transition whitespace-nowrap touch-manipulation ${form.log_type === t.value ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'}`}>
                  <Icon className="w-5 h-5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <CompletedBySelector
            value={form.completed_by_type}
            onChange={(v) => setForm({ ...form, completed_by_type: v })}
            nameValue={form.completed_by_name}
            onNameChange={(v) => setForm({ ...form, completed_by_name: v })}
            accent="blue"
          />

          {isStandpipe && !isExternalParty && (
            <div className="p-2.5 bg-cyan-50 rounded-lg border border-cyan-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Gauge className="w-3.5 h-3.5 text-cyan-600" />
                <p className="text-xs font-semibold text-cyan-700">Standpipe / Piezometer Reading</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Standpipe Ref *</label>
                  <input type="text" value={form.standpipe_ref} onChange={e => setForm({ ...form, standpipe_ref: e.target.value })}
                    placeholder="e.g. SP-01, BH-02/SP1" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Water Level (mBGL) *</label>
                  <input type="number" step="0.01" min="0" value={form.standpipe_reading_m} onChange={e => setForm({ ...form, standpipe_reading_m: e.target.value })}
                    placeholder="e.g. 2.40" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {(isBorehole || isSample || isWindowSampling) && !isExternalParty && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{isWindowSampling ? 'Sample Ref' : 'Borehole Ref'}</label>
                  <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                    placeholder={isWindowSampling ? "WS-01" : "BH-01"} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isSample ? 'Sample ID' : isWindowSampling ? 'Sample Type' : 'Core Run'}</label>
                  {isWindowSampling ? (
                    <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })} className={inputCls}>
                      {sampleTypes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={isSample ? form.sample_id : form.core_run_number}
                      onChange={e => isSample ? setForm({ ...form, sample_id: e.target.value }) : setForm({ ...form, core_run_number: e.target.value })}
                      placeholder={isSample ? 'S-01' : 'C1'} className={inputCls} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Depth From (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                    placeholder="0.0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Depth To (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                    placeholder="1.5" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {isGeophysical && !isExternalParty && (
            <div className="p-2.5 bg-violet-50 rounded-lg border border-violet-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Radar className="w-3.5 h-3.5 text-violet-600" />
                <p className="text-xs font-semibold text-violet-700">Geophysical Probing</p>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Location Ref</label>
                  <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                    placeholder="e.g. GP-01" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sensor / Probe Type *</label>
                  <select value={form.sensor_type} onChange={e => setForm({ ...form, sensor_type: e.target.value })} className={inputCls}>
                    <option value="">Select…</option>
                    {sensorTypeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Probe Depth (m)</label>
                  <input type="number" step="0.1" min="0" value={form.probe_depth} onChange={e => setForm({ ...form, probe_depth: e.target.value })}
                    placeholder="e.g. 3.0" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {isDecommissioning && !isExternalParty && (
            <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center gap-1.5 mb-2">
                <Ban className="w-3.5 h-3.5 text-stone-600" />
                <p className="text-xs font-semibold text-stone-700">Borehole Decommissioning</p>
              </div>
              <div className="space-y-2">
                <div>
                  <label className={labelCls}>Borehole Ref</label>
                  <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                    placeholder="BH-01" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Depth From (m)</label>
                    <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                      placeholder="0.0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Seal Depth (m) *</label>
                    <input type="number" step="0.1" min="0" value={form.seal_depth} onChange={e => setForm({ ...form, seal_depth: e.target.value })}
                      placeholder="e.g. 5.0" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Backfill / Seal Material *</label>
                  <input type="text" value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })}
                    placeholder="e.g. bentonite pellets, cement-bentonite grout" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {isCoreInspection && !isExternalParty && (
            <div className="p-2.5 bg-fuchsia-50 rounded-lg border border-fuchsia-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Boxes className="w-3.5 h-3.5 text-fuchsia-600" />
                <p className="text-xs font-semibold text-fuchsia-700">Core Inspection</p>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Borehole Ref</label>
                    <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                      placeholder="BH-01" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Core Box No. *</label>
                    <input type="text" value={form.core_box_number} onChange={e => setForm({ ...form, core_box_number: e.target.value })}
                      placeholder="e.g. CB-03" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Recovery %</label>
                    <input type="number" step="1" min="0" max="100" value={form.coring_recovery} onChange={e => setForm({ ...form, coring_recovery: e.target.value })}
                      className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>RQD %</label>
                    <input type="number" step="1" min="0" max="100" value={form.coring_rqd} onChange={e => setForm({ ...form, coring_rqd: e.target.value })}
                      className={inputCls} placeholder="—" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {(isBorehole || isWindowSampling) && !isExternalParty && (
            <>
              {/* Strata classification */}
              <div>
                <label className={labelCls}>Strata Classification</label>
                <select value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })} className={inputCls}>
                  {strataOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Strata Description Detail</label>
                <textarea value={form.strata_description_detail} onChange={e => setForm({ ...form, strata_description_detail: e.target.value })} rows={2}
                  placeholder="e.g. firm grey slightly sandy CLAY with gravel pockets"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* SPT blows */}
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700">SPT Blow Counts (per 75mm)</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>1st</label>
                    <input type="number" min="0" value={form.spt_blows_1} onChange={e => setForm({ ...form, spt_blows_1: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>2nd</label>
                    <input type="number" min="0" value={form.spt_blows_2} onChange={e => setForm({ ...form, spt_blows_2: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>3rd</label>
                    <input type="number" min="0" value={form.spt_blows_3} onChange={e => setForm({ ...form, spt_blows_3: e.target.value })} className={inputCls} placeholder="—" />
                  </div>
                </div>
                {form.spt_blows_2 && form.spt_blows_3 && (
                  <p className="text-xs text-blue-700 mt-1.5 font-medium">N = {parseInt(form.spt_blows_2) + parseInt(form.spt_blows_3)}</p>
                )}
              </div>

              {/* Groundwater */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}><Droplets className="w-3 h-3 inline" /> Water Strike (m)</label>
                  <input type="number" step="0.1" min="0" value={form.groundwater_strike_depth} onChange={e => setForm({ ...form, groundwater_strike_depth: e.target.value })}
                    className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className={labelCls}>Static Level (m)</label>
                  <input type="number" step="0.1" min="0" value={form.groundwater_static_level} onChange={e => setForm({ ...form, groundwater_static_level: e.target.value })}
                    className={inputCls} placeholder="—" />
                </div>
              </div>

              {/* Coring (rotary only) */}
              {isCoring && (
                <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    <p className="text-xs font-semibold text-purple-700">Core Recovery</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Recovery %</label>
                      <input type="number" step="1" min="0" max="100" value={form.coring_recovery} onChange={e => setForm({ ...form, coring_recovery: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                    <div>
                      <label className={labelCls}>RQD %</label>
                      <input type="number" step="1" min="0" max="100" value={form.coring_rqd} onChange={e => setForm({ ...form, coring_rqd: e.target.value })}
                        className={inputCls} placeholder="—" />
                    </div>
                  </div>
                </div>
              )}

              {/* Drilling fluid / return */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Fluid Loss</label>
                  <select value={form.drilling_fluid_loss} onChange={e => setForm({ ...form, drilling_fluid_loss: e.target.value })} className={inputCls}>
                    {fluidLossOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fluid Return</label>
                  <select value={form.fluid_return_quality} onChange={e => setForm({ ...form, fluid_return_quality: e.target.value })} className={inputCls}>
                    {fluidReturnOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Refusal / obstruction */}
              <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.refusal_encountered} onChange={e => setForm({ ...form, refusal_encountered: e.target.checked })}
                    className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-400" />
                  <span className="text-xs font-semibold text-red-700 inline-flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" /> Refusal encountered (could not advance)
                  </span>
                </label>
                {form.refusal_encountered && (
                  <div className="mt-2">
                    <label className={labelCls}>Obstruction Type</label>
                    <select value={form.obstruction_type} onChange={e => setForm({ ...form, obstruction_type: e.target.value })} className={inputCls}>
                      {obstructionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {isSample && !isExternalParty && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Sample Type</label>
                <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })} className={inputCls}>
                  {sampleTypes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Description / Observations</label>
              <VoiceToTextButton onTranscript={(text) => setForm({ ...form, description: (form.description || '') + text })} />
            </div>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Ground conditions, obstructions, water ingress... (tap Voice to dictate)"
              className={`${inputCls} resize-none`} />
          </div>

          {/* Photo upload */}
          <div>
            <label className={labelCls}>Evidence Photos</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition">
                {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Photo</>}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
            </div>
            {photos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{photos.length} photo(s) attached</p>}
          </div>

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 active:scale-95 transition text-sm font-semibold border border-blue-200 touch-manipulation">
          <Plus className="w-4 h-4" /> {hasAGSData ? 'Log Activity' : 'Log Borehole / Sample'}
        </button>
      )}

      {completingBorehole && (
        <BoreholeCompletionModal
          boreholeRef={completingBorehole.ref}
          boreholeLogs={completingBorehole.logs}
          jobId={jobId}
          staffId={staffId}
          staffName={staffName}
          onClose={() => setCompletingBorehole(null)}
          onComplete={() => setCompletingBorehole(null)} />
      )}
    </div>
  );
}