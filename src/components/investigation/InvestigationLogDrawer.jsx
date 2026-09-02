import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import {
  X, Ruler, Droplets, Gauge, Camera, CheckCircle2, AlertTriangle, XCircle, User,
  PoundSterling, Layers, TestTube, Wrench, MapPin, Beaker, Radar, Ban, Waves,
  ShieldAlert, ShieldCheck, Undo2, Tablet, ChevronRight, ExternalLink,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { titleCase } from '@/utils/format';
import { navigateToJobSiteActivity } from '@/utils/investigationDeepLink';
import {
  strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig,
  logTypeConfig, getMissingFields, getAnomalyFlags,
} from '@/components/investigation/shared';

/**
 * Log detail drawer — slides in from the right on desktop, full-screen sheet
 * on tablet/mobile. Shows the full geotechnical data grid, borehole context
 * (strata sequence, samples, installations, standpipe readings), photos,
 * billing, anomaly warnings, and Approve / Query actions.
 *
 * Props:
 *  - log: the selected InvestigationLog (or null)
 *  - jobName: display name of the log's job
 *  - allLogs: all logs (for borehole context — same borehole_ref)
 *  - onClose: close the drawer
 *  - onReviewed: callback after a review action (refreshes the board)
 */
export default function InvestigationLogDrawer({ log, jobName, allLogs = [], onClose, onReviewed }) {
  const { toast } = useToast();
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);

  // Fetch the full job object so the "Open on Job Site Activity" deep-link
  // can navigate directly to the job detail page.
  useEffect(() => {
    if (!log?.job_id) { setJob(null); return; }
    let active = true;
    base44.entities.Job.get(log.job_id).then(j => { if (active) setJob(j); }).catch(() => {});
    return () => { active = false; };
  }, [log?.job_id]);

  useEffect(() => { setReviewNote(log?.manager_review_note || ''); }, [log?.id]);

  // Borehole context — other logs for the same borehole_ref
  const boreholeContext = useMemo(() => {
    if (!log?.borehole_ref) return null;
    const ref = log.borehole_ref;
    const sameBorehole = allLogs
      .filter(l => l.borehole_ref === ref)
      .sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
    return {
      ref,
      strataSequence: sameBorehole.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other'),
      samples: sameBorehole.filter(l => l.sample_id),
      installations: sameBorehole.filter(l => l.log_type === 'installation'),
      standpipeReadings: sameBorehole.filter(l => l.log_type === 'standpipe_reading' || l.standpipe_ref),
    };
  }, [log, allLogs]);

  if (!log) return null;

  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
  const missing = getMissingFields(log);
  const anomalies = getAnomalyFlags(log);
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const strata = log.strata_descriptor && strataConfig[log.strata_descriptor];
  const svc = log.service_encounter_type && serviceEncounterConfig[log.service_encounter_type];
  const stability = log.pit_stability_rating && pitStabilityConfig[log.pit_stability_rating];
  const typeConfig = logTypeConfig[log.log_type];

  const handleReview = async (status) => {
    setSaving(true);
    try {
      await base44.entities.InvestigationLog.update(log.id, {
        manager_review_status: status,
        manager_review_note: reviewNote || '',
        manager_reviewed_at: new Date().toISOString(),
      });
      toast({ title: status === 'approved' ? 'Log approved' : 'Log queried', duration: 2000 });
      onReviewed?.();
      onClose();
    } catch (e) {
      toast({ title: 'Failed to update review', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel — right-side drawer on desktop, full-screen sheet on mobile/tablet */}
      <div className="fixed inset-y-0 right-0 z-50 w-full lg:max-w-xl bg-white shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-start gap-2 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
              {typeConfig && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConfig.badge}`}>{typeConfig.label}</span>}
              {log.source === 'ags_import' && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                  <Tablet className="w-3 h-3" /> Technical record (auto-approved)
                </span>
              )}
              {log.borehole_ref && <span className="text-sm font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-medium text-slate-700">{jobName}</span>
              <span>·</span>
              <span>{log.date ? format(new Date(log.date), 'EEEE, dd MMM yyyy') : '—'}</span>
              {log.created_at && <><span>·</span><span>{format(new Date(log.created_at), 'HH:mm')}</span></>}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 flex-wrap">
              <User className="w-3.5 h-3.5" />
              {log.completed_by_type && log.completed_by_type !== 'internal_staff' ? (
                <>{log.completed_by_name || 'Unknown'} <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">{log.completed_by_type === 'client' ? 'Client' : 'Contractor'}</span></>
              ) : log.staff_name ? (
                <span className="font-medium text-slate-700">{log.staff_name}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                  <AlertTriangle className="w-3 h-3" /> No name entered
                </span>
              )}
              {log.completed_by_name && log.completed_by_name.startsWith('Project Engineer:') && (
                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">{log.completed_by_name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => job && navigateToJobSiteActivity(job, log.id)}
              disabled={!job}
              title="Open on Job Site Activity"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#2E5A1A] bg-[#2E5A1A]/5 hover:bg-[#2E5A1A]/10 rounded-lg transition disabled:opacity-40"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Site Activity
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Geotechnical data grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {log.depth_from != null && log.depth_to != null && <DataTile icon={Ruler} label="Depth" value={`${log.depth_from}–${log.depth_to}m`} />}
            {strata && log.strata_descriptor !== 'other' && <DataTile icon={Layers} label="Strata" value={strata.label} color={strata.color} />}
            {log.sample_id && <DataTile icon={TestTube} label="Sample" value={log.sample_id} />}
            {log.sample_type && log.sample_type !== 'none' && <DataTile icon={TestTube} label="Sample Type" value={titleCase(log.sample_type)} />}
            {log.units_completed != null && log.units_completed > 0 && <DataTile icon={Wrench} label="Units" value={`${log.units_completed} ${log.units_label || ''}`} />}
            {log.groundwater_strike_depth != null && <DataTile icon={Droplets} label="GW Strike" value={`${log.groundwater_strike_depth}m`} color="bg-cyan-50 text-cyan-700" />}
            {log.standpipe_ref && <DataTile icon={Gauge} label="Standpipe" value={`${log.standpipe_ref}${log.standpipe_reading_m != null ? ` · ${log.standpipe_reading_m}m` : ''}`} color="bg-cyan-50 text-cyan-700" />}
            {log.cbr_value != null && <DataTile icon={Gauge} label="CBR" value={`${log.cbr_value}%`} color="bg-blue-50 text-blue-700" />}
            {log.vane_strength != null && <DataTile icon={Gauge} label="Vane" value={`${log.vane_strength}kPa`} color="bg-indigo-50 text-indigo-700" />}
            {log.spt_n_value != null && <DataTile icon={Gauge} label="SPT N" value={String(log.spt_n_value)} color="bg-amber-50 text-amber-700" />}
            {log.coring_rqd != null && <DataTile icon={Layers} label="RQD" value={`${log.coring_rqd}%`} />}
            {log.coring_recovery != null && <DataTile icon={Layers} label="Recovery" value={`${log.coring_recovery}%`} />}
            {log.grout_volume != null && <DataTile icon={Beaker} label="Grout" value={`${log.grout_volume}L`} color="bg-rose-50 text-rose-700" />}
            {log.probe_depth != null && <DataTile icon={Radar} label="Probe Depth" value={`${log.probe_depth}m`} color="bg-violet-50 text-violet-700" />}
            {log.seal_depth != null && <DataTile icon={Ban} label="Seal" value={`${log.seal_depth}m`} color="bg-stone-50 text-stone-700" />}
          </div>

          {/* SPT blows */}
          {log.spt_blows && log.spt_blows.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs font-semibold text-amber-900 mb-1">SPT Blow Counts</p>
              <div className="flex gap-1 flex-wrap">
                {log.spt_blows.map((b, i) => <span key={i} className="text-xs font-mono bg-white text-amber-700 px-1.5 py-0.5 rounded font-bold">{b}</span>)}
                {log.spt_n_value != null && <span className="text-xs font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">N={log.spt_n_value}</span>}
              </div>
            </div>
          )}

          {/* Descriptions */}
          {log.strata_description_detail && (
            <Section title="Strata Detail" text={log.strata_description_detail} />
          )}
          {log.description && (
            <Section title="Description" text={log.description} />
          )}
          {log.raw_remarks && log.raw_remarks !== log.description && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Original Driller Remarks</p>
              <p className="text-sm text-slate-600 italic">{log.raw_remarks}</p>
            </div>
          )}
          {log.dimensions && <Section title="Dimensions" text={log.dimensions} />}
          {log.backfill_material && <Section title="Backfill" text={log.backfill_material} />}

          {/* Stability / services / fluid */}
          {(stability && log.pit_stability_rating !== 'not_assessed') && (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-slate-700">Pit stability: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${stability.badge}`}>{stability.label}</span></span>
            </div>
          )}
          {svc && log.service_encounter_type !== 'none' && (
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-red-600" />
              <span className="text-sm text-slate-700">Service encounter: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${svc.color}`}>{svc.label}</span></span>
            </div>
          )}
          {log.refusal_encountered && (
            <div className="flex items-center gap-2 text-red-700"><ShieldAlert className="w-4 h-4" /><span className="text-sm font-medium">Refusal encountered</span></div>
          )}
          {log.drilling_fluid_loss && log.drilling_fluid_loss !== 'none' && (
            <div className="flex items-center gap-2 text-amber-700"><Droplets className="w-4 h-4" /><span className="text-sm">Fluid loss: {titleCase(log.drilling_fluid_loss)}</span></div>
          )}
          {log.reinstatement_type && log.reinstatement_type !== 'none' && (
            <div className="flex items-center gap-2"><Undo2 className="w-4 h-4 text-teal-600" /><span className="text-sm text-slate-700">Reinstatement: {titleCase(log.reinstatement_type)}</span></div>
          )}

          {/* Borehole context */}
          {boreholeContext && (
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> {boreholeContext.ref} · Borehole Context
              </p>
              <div className="space-y-2 text-xs">
                {boreholeContext.strataSequence.length > 0 && (
                  <ContextList icon={Layers} label="Strata Sequence" items={boreholeContext.strataSequence.map(l => ({
                    id: l.id, primary: strataConfig[l.strata_descriptor]?.label || l.strata_descriptor, secondary: `${l.depth_from}–${l.depth_to}m`,
                  }))} />
                )}
                {boreholeContext.samples.length > 0 && (
                  <ContextList icon={TestTube} label={`Samples (${boreholeContext.samples.length})`} items={boreholeContext.samples.map(s => ({
                    id: s.id, primary: s.sample_id || '—', secondary: `${s.depth_from}–${s.depth_to}m`,
                  }))} />
                )}
                {boreholeContext.installations.length > 0 && (
                  <ContextList icon={Wrench} label={`Installations (${boreholeContext.installations.length})`} items={boreholeContext.installations.map(i => ({
                    id: i.id, primary: `${i.units_completed} ${i.units_label || 'units'}`, secondary: i.standpipe_ref || '',
                  }))} />
                )}
                {boreholeContext.standpipeReadings.length > 0 && (
                  <ContextList icon={Gauge} label={`Standpipe Readings (${boreholeContext.standpipeReadings.length})`} items={boreholeContext.standpipeReadings.map(r => ({
                    id: r.id, primary: r.standpipe_reading_m != null ? `${r.standpipe_reading_m}m` : '—', secondary: r.date ? format(new Date(r.date), 'dd MMM') : '',
                  }))} />
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidence Photos ({photos.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-[#2E5A1A]/30 transition">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {(missing.length > 0 || anomalies.length > 0) && (
            <div className="space-y-1.5">
              {missing.map((m, i) => (
                <div key={`m${i}`} className="flex items-center gap-2 text-xs bg-orange-50 text-orange-700 px-2.5 py-1.5 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> {m}</div>
              ))}
              {anomalies.map((a, i) => (
                <div key={`a${i}`} className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> {a}</div>
              ))}
            </div>
          )}

          {/* Billing */}
          {log.chargeable && (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <PoundSterling className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-semibold text-emerald-900">Chargeable</span>
                {log.charge_amount > 0 && <span className="text-sm font-bold text-emerald-700 ml-auto">£{Number(log.charge_amount).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>}
              </div>
              {log.charge_breakdown && <p className="text-xs text-emerald-600 mt-1">{log.charge_breakdown}</p>}
            </div>
          )}

          {/* Manager review */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Manager Review</p>
            {log.manager_reviewed_by && (
              <p className="text-xs text-slate-500 mb-2">Last reviewed by {log.manager_reviewed_by} {log.manager_reviewed_at ? `on ${format(new Date(log.manager_reviewed_at), 'dd MMM yyyy')}` : ''}</p>
            )}
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="Add a review note (optional)..."
              rows={2}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30 outline-none transition resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleReview('approved')}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
              </button>
              <button
                onClick={() => handleReview('queried')}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Query
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DataTile({ icon: Icon, label, value, color = 'bg-slate-50 text-slate-700' }) {
  return (
    <div className={`p-2.5 rounded-lg ${color}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function Section({ title, text }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-sm text-slate-700">{text}</p>
    </div>
  );
}

function ContextList({ icon: Icon, label, items }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={it.id || i} className="flex items-center gap-2 text-[11px] text-slate-600 py-0.5">
            <span className="font-medium">{it.primary}</span>
            {it.secondary && <span className="text-slate-400">{it.secondary}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}