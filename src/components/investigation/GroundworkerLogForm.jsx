import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, Package, Wrench, Ruler, Send, Trash2, Plus, X, ShieldAlert, Gauge, Waves, MapPinned, Undo2, Droplet, Layers, Search, Beaker, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { serviceEncounterConfig } from './shared';
import CompletedBySelector from './CompletedBySelector';
import CollapsibleSection from './CollapsibleSection';
import ServiceCheckBySelector from './ServiceCheckBySelector';
import { useConfigLists } from '@/hooks/useConfigLists';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";

const groundworksLogTypes = [
  { value: 'pit_excavation', label: 'Trial Pit', icon: MapPin },
  { value: 'inspection_pit', label: 'Insp. Pit', icon: Search },
  { value: 'standpipe_reading', label: 'Piezometer', icon: Gauge },
  { value: 'installation', label: 'Install', icon: Package },
  { value: 'grouting_works', label: 'Grouting', icon: Beaker },
  { value: 'site_setup', label: 'Setup', icon: Wrench },
  { value: 'reinstatement', label: 'Reinstate', icon: Undo2 },
];

export default function GroundworkerLogForm({ staffId, jobId, job, staffName }) {
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { getOptions } = useConfigLists();
  const strataOptions = getOptions('strata_types');
  const pitStabilityOptions = getOptions('pit_stability_options');
  const serviceEncounterOptions = getOptions('service_encounter_types');
  const reinstatementOptions = getOptions('reinstatement_types');
  const mixerTypeOptions = getOptions('mixer_types');

  const [form, setForm] = useState({
    log_type: 'pit_excavation',
    completed_by_type: 'internal_staff',
    completed_by_name: '',
    borehole_ref: '',
    depth_from: '',
    depth_to: '',
    dimensions: '',
    strata_descriptor: 'other',
    strata_description_detail: '',
    pit_stability_rating: 'not_assessed',
    service_encounter_type: 'none',
    service_encounter_gps: '',
    cbr_value: '',
    vane_strength: '',
    units_completed: '',
    units_label: '',
    description: '',
    photo_urls: '',
    groundwater_strike_depth: '',
    groundwater_static_level: '',
    reinstatement_type: 'none',
    backfill_material: '',
    verification_photo_urls: '',
    grout_volume: '',
    mixer_type: 'none',
    grout_mix_ratio: '',
    standpipe_ref: '',
    standpipe_reading_m: '',
    standpipe_dip_depth_m: '',
    service_check_by_type: 'internal_staff',
    service_check_by_name: '',
    service_check_at: '',
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-today', jobId, staffId, todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId, date: todayStr }),
  });

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

  const captureGps = () => {
    setGettingGps(true);
    if (!navigator.geolocation) {
      toast({ title: 'GPS unavailable', description: 'Device does not support GPS', variant: 'destructive' });
      setGettingGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, service_encounter_gps: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}` });
        toast({ title: 'GPS captured', description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` });
        setGettingGps(false);
      },
      (err) => {
        toast({ title: 'GPS failed', description: err.message, variant: 'destructive' });
        setGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAdd = async () => {
    if (form.completed_by_type && form.completed_by_type !== 'internal_staff' && !form.completed_by_name.trim()) {
      toast({ title: 'Name required', description: 'Enter the client/contractor representative name.', variant: 'destructive' });
      return;
    }
    if (form.service_encounter_type && form.service_encounter_type !== 'none' && !form.service_encounter_gps) {
      toast({ title: 'GPS required', description: 'GPS coordinates required when a service is encountered.', variant: 'destructive' });
      return;
    }
    if (form.service_encounter_type && form.service_encounter_type !== 'none' && form.service_check_by_type && form.service_check_by_type !== 'internal_staff' && !form.service_check_by_name.trim()) {
      toast({ title: 'Checker name required', description: 'Enter the name of the person who performed the service check.', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && (form.log_type === 'pit_excavation' || form.log_type === 'inspection_pit') && (!form.pit_stability_rating || form.pit_stability_rating === 'not_assessed')) {
      toast({ title: 'Stability required', description: 'Please assess pit wall stability before saving.', variant: 'destructive' });
      return;
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'grouting_works') {
      if (!form.mixer_type || form.mixer_type === 'none') {
        toast({ title: 'Mixer type required', description: 'Select the mixing method used.', variant: 'destructive' });
        return;
      }
      if (!form.grout_volume) {
        toast({ title: 'Grout volume required', description: 'Enter the volume of grout mixed/placed.', variant: 'destructive' });
        return;
      }
    }
    if (form.completed_by_type === 'internal_staff' && form.log_type === 'standpipe_reading') {
      if (!form.standpipe_ref) {
        toast({ title: 'Piezometer ref required', description: 'Enter the piezometer / standpipe reference.', variant: 'destructive' });
        return;
      }
      if (!form.standpipe_reading_m && !form.standpipe_dip_depth_m) {
        toast({ title: 'Reading required', description: 'Enter a water level reading (mBGL or dip depth).', variant: 'destructive' });
        return;
      }
    }
    setAdding(true);
    try {
      const payload = {
        job_id: jobId,
        staff_id: staffId,
        staff_name: staffName || '',
        date: todayStr,
        source: 'staff',
        logged_by_role: 'groundworker',
        log_type: form.log_type,
        borehole_ref: form.borehole_ref || '',
        depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
        depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
        dimensions: form.dimensions || '',
        strata_descriptor: form.strata_descriptor || 'other',
        strata_description_detail: form.strata_description_detail || '',
        pit_stability_rating: form.pit_stability_rating || 'not_assessed',
        service_encounter_type: form.service_encounter_type || 'none',
        service_encounter_gps: form.service_encounter_gps || '',
        service_check_by_type: form.service_check_by_type || 'internal_staff',
        service_check_by_name: form.service_check_by_type === 'internal_staff' ? '' : (form.service_check_by_name || ''),
        service_check_at: (form.service_encounter_type && form.service_encounter_type !== 'none') ? new Date().toISOString() : '',
        cbr_value: form.cbr_value ? parseFloat(form.cbr_value) : null,
        vane_strength: form.vane_strength ? parseFloat(form.vane_strength) : null,
        units_completed: form.units_completed ? parseFloat(form.units_completed) : null,
        units_label: form.units_label || '',
        description: form.description || '',
        photo_urls: form.photo_urls || '',
        groundwater_strike_depth: form.groundwater_strike_depth ? parseFloat(form.groundwater_strike_depth) : null,
        groundwater_static_level: form.groundwater_static_level ? parseFloat(form.groundwater_static_level) : null,
        reinstatement_type: form.reinstatement_type || 'none',
        backfill_material: form.backfill_material || '',
        verification_photo_urls: form.verification_photo_urls || '',
        grout_volume: form.grout_volume !== '' ? parseFloat(form.grout_volume) : null,
        mixer_type: form.mixer_type || 'none',
        grout_mix_ratio: form.grout_mix_ratio || '',
        standpipe_ref: form.standpipe_ref || '',
        standpipe_reading_m: form.standpipe_reading_m ? parseFloat(form.standpipe_reading_m) : null,
        standpipe_dip_depth_m: form.standpipe_dip_depth_m ? parseFloat(form.standpipe_dip_depth_m) : null,
        created_at: new Date().toISOString(),
        manager_review_status: 'pending',
        completed_by_type: form.completed_by_type || 'internal_staff',
        completed_by_name: form.completed_by_type === 'internal_staff'
          ? (staffName || '')
          : (form.completed_by_name || ''),
        chargeable: form.completed_by_type !== 'client',
        billing_status: form.completed_by_type === 'client' ? 'no_charge' : 'auto',
      };
      await base44.entities.InvestigationLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['investigation-logs-today', jobId, staffId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      toast({ title: 'Log entry added' });
      setForm({
        ...form,
        depth_from: '', depth_to: '', dimensions: '',
        strata_description_detail: '', pit_stability_rating: 'not_assessed',
        service_encounter_type: 'none', service_encounter_gps: '',
        cbr_value: '', vane_strength: '',
        units_completed: '', units_label: '',
        description: '', photo_urls: '',
        groundwater_strike_depth: '', groundwater_static_level: '',
        reinstatement_type: 'none', backfill_material: '', verification_photo_urls: '',
        grout_volume: '', mixer_type: 'none', grout_mix_ratio: '',
        standpipe_ref: '', standpipe_reading_m: '', standpipe_dip_depth_m: '',
        service_check_by_type: 'internal_staff', service_check_by_name: '',
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

  const isPit = form.log_type === 'pit_excavation';
  const isInspectionPit = form.log_type === 'inspection_pit';
  const isPiezometer = form.log_type === 'standpipe_reading';
  const isInstallation = form.log_type === 'installation';
  const isReinstatement = form.log_type === 'reinstatement';
  const isGrouting = form.log_type === 'grouting_works';
  const isServiceFound = form.service_encounter_type && form.service_encounter_type !== 'none';
  const isExternalParty = form.completed_by_type !== 'internal_staff';
  const photos = form.photo_urls ? form.photo_urls.split(',').filter(Boolean) : [];
  const verificationPhotos = form.verification_photo_urls ? form.verification_photo_urls.split(',').filter(Boolean) : [];

  const handleVerificationPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const existing = form.verification_photo_urls ? form.verification_photo_urls.split(',').filter(Boolean) : [];
      existing.push(res.file_url);
      setForm({ ...form, verification_photo_urls: existing.join(',') });
      toast({ title: 'Verification photo attached' });
    } catch (err) { toast({ title: 'Upload failed', variant: 'destructive' }); }
    setUploadingPhoto(false);
  };

  const refLabel = isPit ? 'Pit Reference' : isInspectionPit ? 'Inspection Pit Ref' : isPiezometer ? 'Piezometer Ref' : isGrouting ? 'Location / Hole Ref' : isReinstatement ? 'Pit / Location Ref' : 'Location Ref';
  const refPlaceholder = isPit ? "TP-01" : isInspectionPit ? "IP-01" : isPiezometer ? "PZ-01 / BH-02/SP1" : isGrouting ? "e.g. BH-03 / Area B" : isReinstatement ? "TP-01" : "e.g. Area A";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Groundworks &amp; Investigation Log</h3>
          <p className="text-xs text-slate-400">Trial pits · Inspection pits · Piezometers · Grouting · Installs</p>
        </div>
        {todayLogs.length > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{todayLogs.length} today</span>
        )}
      </div>

      {todayLogs.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {todayLogs.map(log => {
            const svcCfg = serviceEncounterConfig[log.service_encounter_type] || serviceEncounterConfig.none;
            return (
              <div key={log.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-700">{log.borehole_ref || '—'}</span>
                    {log.log_type === 'inspection_pit' && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Insp. Pit</span>
                    )}
                    {log.log_type === 'standpipe_reading' && (
                      <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                        <Gauge className="w-2.5 h-2.5" /> PZ{log.standpipe_reading_m != null ? ` ${log.standpipe_reading_m}m` : ''}
                      </span>
                    )}
                    {log.log_type === 'grouting_works' && (
                      <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                        <Beaker className="w-2.5 h-2.5" /> Grout{log.grout_volume != null ? ` ${log.grout_volume}L` : ''}
                      </span>
                    )}
                    {log.dimensions && <span className="text-xs text-slate-600">{log.dimensions}</span>}
                    {log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${log.pit_stability_rating === 'stable' ? 'bg-emerald-100 text-emerald-700' : log.pit_stability_rating === 'minor_slumping' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {log.pit_stability_rating.replace(/_/g, ' ')}
                      </span>
                    )}
                    {log.service_encounter_type && log.service_encounter_type !== 'none' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${svcCfg.color}`}>{svcCfg.label}</span>
                    )}
                    {log.service_encounter_type && log.service_encounter_type !== 'none' && log.service_check_by_type && log.service_check_by_type !== 'internal_staff' && (
                      <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" /> {log.service_check_by_type === 'client' ? 'Client' : 'Contractor'}{log.service_check_by_name ? ` · ${log.service_check_by_name}` : ''}
                      </span>
                    )}
                    {log.cbr_value != null && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">CBR {log.cbr_value}%</span>}
                    {log.vane_strength != null && <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Vane {log.vane_strength}kPa</span>}
                    {log.groundwater_strike_depth != null && <span className="text-xs bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium">💧 GW {log.groundwater_strike_depth}m</span>}
                    {log.reinstatement_type && log.reinstatement_type !== 'none' && <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{reinstatementOptions.find(r => r.value === log.reinstatement_type)?.label || log.reinstatement_type}</span>}
                    {log.completed_by_type && log.completed_by_type !== 'internal_staff' && (
                      <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">
                        {log.completed_by_type === 'client' ? 'Client' : 'Contractor'}{log.completed_by_name ? ` · ${log.completed_by_name}` : ''}{log.created_at ? ` @ ${format(new Date(log.created_at), 'HH:mm')}` : ''}
                      </span>
                    )}
                  </div>
                  {log.strata_description_detail && <p className="text-xs text-slate-600 mt-0.5">{log.strata_description_detail}</p>}
                  {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
                </div>
                <button onClick={() => handleDelete(log.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              {isReinstatement ? 'New Reinstatement' : isPiezometer ? 'New Piezometer Reading' : 'New Entry'}
            </p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          {/* Activity type selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {groundworksLogTypes.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, log_type: t.value })}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium border transition ${form.log_type === t.value ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <Icon className="w-4 h-4" />
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
            accent="amber"
          />

          {/* Reference */}
          {(isPit || isInspectionPit || isPiezometer || isInstallation || isReinstatement || isGrouting) && (
            <div>
              <label className={labelCls}>{refLabel}</label>
              <input type="text" value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                placeholder={refPlaceholder} className={inputCls} />
            </div>
          )}

          {/* ── Piezometer reading ── */}
          {isPiezometer && !isExternalParty && (
            <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Gauge className="w-3.5 h-3.5 text-cyan-700" />
                <p className="text-xs font-semibold text-cyan-700">Water Level Reading</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Reading mBGL</label>
                  <input type="number" step="0.01" min="0" value={form.standpipe_reading_m} onChange={e => setForm({ ...form, standpipe_reading_m: e.target.value })}
                    className={inputCls} placeholder="e.g. 1.85" />
                </div>
                <div>
                  <label className={labelCls}>Dip Depth (from TOC)</label>
                  <input type="number" step="0.01" min="0" value={form.standpipe_dip_depth_m} onChange={e => setForm({ ...form, standpipe_dip_depth_m: e.target.value })}
                    className={inputCls} placeholder="e.g. 2.10" />
                </div>
              </div>
            </div>
          )}

          {/* ── Dimensions & depth (pit / grouting only) ── */}
          {(isPit || isInspectionPit || isGrouting) && !isExternalParty && (
            <>
              <div>
                <label className={labelCls}>{isGrouting ? 'Hole / Void Dimensions' : 'Dimensions'}</label>
                <input type="text" value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })}
                  placeholder={isGrouting ? "e.g. 150mm dia x 3m deep" : "1.2m x 0.8m x 1.5m deep"} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}><Ruler className="w-3 h-3 inline" /> Depth From (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                    className={inputCls} placeholder="0.0" />
                </div>
                <div>
                  <label className={labelCls}>Depth To (m)</label>
                  <input type="number" step="0.1" min="0" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                    className={inputCls} placeholder="1.5" />
                </div>
              </div>
            </>
          )}

          {/* ── Trial Pit: strata + stability (core) ── */}
          {isPit && !isExternalParty && (
            <>
              <div>
                <label className={labelCls}>Strata Classification</label>
                <select value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })} className={inputCls}>
                  {strataOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Strata Description</label>
                <textarea value={form.strata_description_detail} onChange={e => setForm({ ...form, strata_description_detail: e.target.value })} rows={2}
                  placeholder="e.g. brown sandy topsoil with rootlets"
                  className={`${inputCls} resize-none`} />
              </div>
            </>
          )}

          {/* ── Pit stability (mandatory for both pit types) ── */}
          {(isPit || isInspectionPit) && !isExternalParty && (
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-700">Wall Stability (Required)</p>
              </div>
              <select value={form.pit_stability_rating} onChange={e => setForm({ ...form, pit_stability_rating: e.target.value })} className={inputCls}>
                {pitStabilityOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          {/* ── Trial Pit optional sections (collapsible, clean) ── */}
          {isPit && !isExternalParty && (
            <div className="space-y-2">
              <CollapsibleSection icon={Waves} title="Service Encounter" hint="Tap if services found" accent="red" defaultOpen={isServiceFound}>
                <select value={form.service_encounter_type} onChange={e => setForm({ ...form, service_encounter_type: e.target.value, service_encounter_gps: e.target.value === 'none' ? '' : form.service_encounter_gps })} className={inputCls}>
                  {serviceEncounterOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {isServiceFound && (
                  <>
                    <div>
                      <label className={labelCls}><MapPinned className="w-3 h-3 inline" /> GPS Coordinates (Required)</label>
                      <div className="flex gap-2">
                        <input type="text" value={form.service_encounter_gps} readOnly placeholder="Capture GPS…"
                          className={`${inputCls} flex-1 bg-slate-50 text-slate-500`} />
                        <button type="button" onClick={captureGps} disabled={gettingGps}
                          className="px-3 py-2 bg-red-700 text-white rounded-xl text-xs font-semibold hover:bg-red-800 transition disabled:opacity-50 whitespace-nowrap">
                          {gettingGps ? '…' : 'Capture'}
                        </button>
                      </div>
                    </div>
                    <ServiceCheckBySelector
                      value={form.service_check_by_type}
                      onChange={(v) => setForm({ ...form, service_check_by_type: v, service_check_by_name: v === 'internal_staff' ? '' : form.service_check_by_name })}
                      nameValue={form.service_check_by_name}
                      onNameChange={(v) => setForm({ ...form, service_check_by_name: v })}
                      staffName={staffName}
                    />
                  </>
                )}
              </CollapsibleSection>

              <CollapsibleSection icon={Gauge} title="In-situ Testing (CBR / Vane)" hint="Optional" accent="slate">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>CBR (%)</label>
                    <input type="number" step="0.1" min="0" value={form.cbr_value} onChange={e => setForm({ ...form, cbr_value: e.target.value })}
                      className={inputCls} placeholder="—" />
                  </div>
                  <div>
                    <label className={labelCls}>Hand Vane (kPa)</label>
                    <input type="number" step="1" min="0" value={form.vane_strength} onChange={e => setForm({ ...form, vane_strength: e.target.value })}
                      className={inputCls} placeholder="—" />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={Droplet} title="Groundwater" hint="Optional" accent="blue">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Strike Depth (m)</label>
                    <input type="number" step="0.05" min="0" value={form.groundwater_strike_depth} onChange={e => setForm({ ...form, groundwater_strike_depth: e.target.value })}
                      className={inputCls} placeholder="e.g. 1.2" />
                  </div>
                  <div>
                    <label className={labelCls}>Static Level (m)</label>
                    <input type="number" step="0.05" min="0" value={form.groundwater_static_level} onChange={e => setForm({ ...form, groundwater_static_level: e.target.value })}
                      className={inputCls} placeholder="after 24h" />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={Undo2} title="Reinstatement (if backfilled)" hint="Optional" accent="amber">
                <select value={form.reinstatement_type} onChange={e => setForm({ ...form, reinstatement_type: e.target.value })} className={inputCls}>
                  {reinstatementOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {form.reinstatement_type && form.reinstatement_type !== 'none' && form.reinstatement_type !== 'left_open' && (
                  <input type="text" value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })}
                    placeholder="Backfill material e.g. Type 1 granular, site-won clay" className={inputCls} />
                )}
              </CollapsibleSection>
            </div>
          )}

          {/* ── Inspection Pit: services only (kept simple) ── */}
          {isInspectionPit && !isExternalParty && (
            <CollapsibleSection icon={Waves} title="Service Encounter" hint="Tap if services found" accent="red" defaultOpen={isServiceFound}>
              <select value={form.service_encounter_type} onChange={e => setForm({ ...form, service_encounter_type: e.target.value, service_encounter_gps: e.target.value === 'none' ? '' : form.service_encounter_gps })} className={inputCls}>
                {serviceEncounterOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {isServiceFound && (
                <>
                  <div>
                    <label className={labelCls}><MapPinned className="w-3 h-3 inline" /> GPS Coordinates (Required)</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.service_encounter_gps} readOnly placeholder="Capture GPS…"
                        className={`${inputCls} flex-1 bg-slate-50 text-slate-500`} />
                      <button type="button" onClick={captureGps} disabled={gettingGps}
                        className="px-3 py-2 bg-red-700 text-white rounded-xl text-xs font-semibold hover:bg-red-800 transition disabled:opacity-50 whitespace-nowrap">
                        {gettingGps ? '…' : 'Capture'}
                      </button>
                    </div>
                  </div>
                  <ServiceCheckBySelector
                    value={form.service_check_by_type}
                    onChange={(v) => setForm({ ...form, service_check_by_type: v, service_check_by_name: v === 'internal_staff' ? '' : form.service_check_by_name })}
                    nameValue={form.service_check_by_name}
                    onNameChange={(v) => setForm({ ...form, service_check_by_name: v })}
                    staffName={staffName}
                  />
                </>
              )}
            </CollapsibleSection>
          )}

          {/* ── Reinstatement (dedicated) ── */}
          {isReinstatement && !isExternalParty && (
            <>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Undo2 className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">Reinstatement Details</p>
                </div>
                <div className="space-y-2">
                  <select value={form.reinstatement_type} onChange={e => setForm({ ...form, reinstatement_type: e.target.value })} className={inputCls}>
                    {reinstatementOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {form.reinstatement_type && form.reinstatement_type !== 'none' && form.reinstatement_type !== 'left_open' && (
                    <input type="text" value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })}
                      placeholder="Backfill material e.g. Type 1 granular, site-won clay" className={inputCls} />
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}><Layers className="w-3 h-3 inline" /> Verification Photos (pre & post)</label>
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer transition">
                  {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Verification Photo</>}
                  <input type="file" accept="image/*" capture="environment" onChange={handleVerificationPhotoUpload} className="hidden" disabled={uploadingPhoto} />
                </label>
                {verificationPhotos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{verificationPhotos.length} verification photo(s)</p>}
              </div>
            </>
          )}

          {/* ── Installation ── */}
          {isInstallation && !isExternalParty && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Units Completed</label>
                <input type="number" min="0" step="1" value={form.units_completed} onChange={e => setForm({ ...form, units_completed: e.target.value })}
                  placeholder="e.g. 2" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Unit Label</label>
                <input type="text" value={form.units_label} onChange={e => setForm({ ...form, units_label: e.target.value })}
                  placeholder="e.g. EV chargers" className={inputCls} />
              </div>
            </div>
          )}

          {/* ── Grouting ── */}
          {isGrouting && !isExternalParty && (
            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Beaker className="w-3.5 h-3.5 text-rose-600" />
                <p className="text-xs font-semibold text-rose-700">Grouting (Machine Mixer)</p>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Mixer Type *</label>
                    <select value={form.mixer_type} onChange={e => setForm({ ...form, mixer_type: e.target.value })} className={inputCls}>
                      {mixerTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Grout Volume (L) *</label>
                    <input type="number" step="0.5" min="0" value={form.grout_volume} onChange={e => setForm({ ...form, grout_volume: e.target.value })}
                      placeholder="e.g. 25" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Mix Ratio / Spec</label>
                  <input type="text" value={form.grout_mix_ratio} onChange={e => setForm({ ...form, grout_mix_ratio: e.target.value })}
                    placeholder="e.g. 1:1 cement:bentonite, Cement 25kg + 12L water" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Backfill / Seal Material</label>
                  <input type="text" value={form.backfill_material} onChange={e => setForm({ ...form, backfill_material: e.target.value })}
                    placeholder="e.g. cement-bentonite grout, bentonite pellets" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Description (all except site_setup which only needs this) */}
          <div>
            <label className={labelCls}>Description / Observations</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
              placeholder="Ground conditions, observations, obstructions..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Photo upload (not for piezometer which is just a reading) */}
          {!isPiezometer && (
            <div>
              <label className={labelCls}>Evidence Photos</label>
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-amber-400 hover:text-amber-600 cursor-pointer transition">
                {uploadingPhoto ? 'Uploading…' : <><Plus className="w-3.5 h-3.5" /> Attach Photo</>}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
              {photos.length > 0 && <p className="text-xs text-emerald-700 mt-1">{photos.length} photo(s) attached</p>}
            </div>
          )}

          <button onClick={handleAdd} disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-700 text-white rounded-xl hover:bg-amber-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 touch-manipulation">
            {adding ? 'Adding…' : <><Send className="w-4 h-4" /> Add Log Entry</>}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 active:scale-95 transition text-sm font-semibold border border-amber-200 touch-manipulation">
          <Plus className="w-4 h-4" /> Log Activity
        </button>
      )}
    </div>
  );
}