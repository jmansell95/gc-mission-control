import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FlaskConical, Layers, Ruler, TestTube, Wrench, MapPin, Package, ClipboardList, ArrowDownToLine,
  Droplets, Calculator, Gauge, Waves, Undo2, ShieldAlert, Camera, CheckCircle2, AlertTriangle, XCircle, Ban, Beaker, Radar, Boxes,   ShieldCheck, Tablet, Mountain, Eye, EyeOff, ChevronDown, User, PoundSterling, ExternalLink
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { titleCase } from '@/utils/format';
import DrillingSiteLogs from '@/components/investigation/DrillingSiteLogs';
import AutoBillingButton from '@/components/investigation/AutoBillingButton';
import AGSUploadButton from '@/components/investigation/AGSUploadButton';
import { navigateToInvestigationHub } from '@/utils/investigationDeepLink';
import {
  strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig,
  fluidLossConfig, obstructionConfig, logTypeConfig,
  getMissingFields, getAnomalyFlags
} from '@/components/investigation/shared';

export default function InvestigationLogManager({ job, isDrillingJob, assignedStaff, allStaff, canSeeCosts, onViewBoreholes, selectedLogId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });
  const [showAgsData, setShowAgsData] = useState(false);

  // For drilling jobs, show a reconciled view: driller activity remarks
  // (review/approve) plus an index of AGS-imported borehole records — so the
  // count on this tab matches the Overview "Log Review" card.
  if (isDrillingJob) {
    return <DrillingSiteLogs job={job} assignedStaff={assignedStaff} onViewBoreholes={onViewBoreholes} />;
  }

  // Separate AGS-imported borehole data from field crew activity.
  // Borehole technical data (strata, core, SPT, samples, installations) comes
  // exclusively from KeyLogBook AGS imports and is shown in the Borehole Data
  // Explorer. This activity log shows field crew activity only.
  const agsLogs = logs.filter(l => l.source === 'ags_import');
  const displayLogs = showAgsData ? logs : logs.filter(l => l.source !== 'ags_import');

  const byDate = {};
  displayLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort();

  const totalDepth = displayLogs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);
  const totalSamples = displayLogs.filter(l => l.sample_type && l.sample_type !== 'none').length;
  const totalPits = displayLogs.filter(l => l.log_type === 'pit_excavation').length;
  const totalInspectionPits = displayLogs.filter(l => l.log_type === 'inspection_pit').length;
  const totalInstallations = displayLogs.filter(l => l.log_type === 'installation').reduce((sum, l) => sum + (l.units_completed || 0), 0);
  const totalGroutLitres = displayLogs.filter(l => l.log_type === 'grouting_works').reduce((sum, l) => sum + (l.grout_volume || 0), 0);
  const totalProbeRuns = displayLogs.filter(l => l.log_type === 'geophysical_probing').length;
  const totalDecommissioning = displayLogs.filter(l => l.log_type === 'borehole_decommissioning').length;
  const uniqueBoreholes = [...new Set(displayLogs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];
  const pendingReview = displayLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queried = displayLogs.filter(l => l.manager_review_status === 'queried').length;
  const standpipeReadings = displayLogs.filter(l => l.log_type === 'standpipe_reading' || l.standpipe_ref);
  const standpipesByRef = {};
  standpipeReadings.forEach(l => {
    const ref = l.standpipe_ref || l.borehole_ref || '—';
    if (!standpipesByRef[ref]) standpipesByRef[ref] = [];
    standpipesByRef[ref].push(l);
  });
  const standpipeRefs = Object.keys(standpipesByRef).sort();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <FlaskConical className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Activity Log</h3>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{displayLogs.length} entries</span>
        {pendingReview > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {pendingReview} pending
          </span>
        )}
        {queried > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> {queried} queried
          </span>
        )}
        <AGSUploadButton jobId={job.id} />
      </div>

      {/* KeyLogBook AGS data summary banner */}
      {agsLogs.length > 0 && (
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Tablet className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-indigo-900">{agsLogs.length} borehole records from KeyLogBook</span>
            <span className="text-indigo-500 text-xs">· shown in Borehole Data Explorer</span>
          </div>
          <button
            onClick={() => setShowAgsData(v => !v)}
            className="ml-auto text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition"
          >
            {showAgsData ? <><EyeOff className="w-3 h-3" /> Hide KeyLogBook data</> : <><Eye className="w-3 h-3" /> Show KeyLogBook data</>}
          </button>
        </div>
      )}

      {displayLogs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          {isDrillingJob ? (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Total Depth</p>
                <p className="text-lg font-bold text-blue-700">{totalDepth.toFixed(1)}m</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Boreholes</p>
                <p className="text-lg font-bold text-slate-800">{uniqueBoreholes.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Samples</p>
                <p className="text-lg font-bold text-purple-700">{totalSamples}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Entries</p>
                <p className="text-lg font-bold text-slate-800">{displayLogs.length}</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Trial Pits</p>
                <p className="text-lg font-bold text-amber-700">{totalPits}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Inspection Pits</p>
                <p className="text-lg font-bold text-orange-700">{totalInspectionPits}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Grout (L)</p>
                <p className="text-lg font-bold text-rose-700">{totalGroutLitres}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Installations</p>
                <p className="text-lg font-bold text-emerald-700">{totalInstallations}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-5">
        {standpipeRefs.length > 0 && (
          <div className="mb-5 p-4 bg-cyan-50 rounded-xl border border-cyan-100">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-cyan-700" />
              <h3 className="text-sm font-bold text-cyan-900">Water Level Monitoring</h3>
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">{standpipeRefs.length} standpipe{standpipeRefs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {standpipeRefs.map(ref => {
                const readings = standpipesByRef[ref].sort((a, b) => new Date(a.date) - new Date(b.date));
                const latest = readings[readings.length - 1];
                return (
                  <div key={ref} className="flex items-center gap-3 text-xs">
                    <span className="font-mono font-bold text-cyan-800 w-28 truncate">{ref}</span>
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                      {readings.map(r => (
                        <span key={r.id} className={`px-1.5 py-0.5 rounded-full font-medium ${r.id === latest.id ? 'bg-cyan-200 text-cyan-900' : 'bg-white text-cyan-700 border border-cyan-100'}`}>
                          {format(new Date(r.date), 'dd MMM')}: {r.standpipe_reading_m != null ? `${r.standpipe_reading_m}m` : '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : displayLogs.length === 0 ? (
          <EmptyState icon={FlaskConical} title="No field activity yet" message={isDrillingJob ? "Borehole data is imported from KeyLogBook. Field crew activity (site setup, grouting, decommissioning) will appear here." : "Groundworks crews will log trial pits, installations and site setup here during shifts."} />
        ) : (
          <div className="space-y-3">
            {sortedDates.map(date => (
              <DayGroup key={date} date={date} logs={byDate[date]} isDrillingJob={isDrillingJob} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DayGroup({ date, logs, isDrillingJob }) {
  const [open, setOpen] = useState(false);
  const dayLogs = [...logs].sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date));
  const d = new Date(date + 'T00:00:00');
  const dayDepth = dayLogs.reduce((sum, l) => (l.depth_from != null && l.depth_to != null) ? sum + (l.depth_to - l.depth_from) : sum, 0);
  const daySamples = dayLogs.filter(l => l.sample_type && l.sample_type !== 'none').length;
  const dayPits = dayLogs.filter(l => l.log_type === 'pit_excavation' || l.log_type === 'inspection_pit').length;
  const dayBoreholes = [...new Set(dayLogs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];
  const pending = dayLogs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queried = dayLogs.filter(l => l.manager_review_status === 'queried').length;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? '' : '-rotate-90'}`} />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-bold text-slate-700">{format(d, 'EEEE, dd MMM yyyy')}</span>
          <span className="text-xs text-slate-400">{dayLogs.length} {dayLogs.length === 1 ? 'Entry' : 'Entries'}</span>
          {(() => { const names = [...new Set(dayLogs.map(l => l.staff_name || l.completed_by_name).filter(Boolean))]; return names.length > 0 ? <span className="text-xs text-slate-400 inline-flex items-center gap-1"><User className="w-3 h-3" /> {names.join(', ')}</span> : null; })()}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isDrillingJob && dayDepth > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{dayDepth.toFixed(1)}m</span>}
          {dayBoreholes.length > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{dayBoreholes.length} BH</span>}
          {daySamples > 0 && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{daySamples} Samples</span>}
          {dayPits > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{dayPits} Pits</span>}
          {pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pending} Pending</span>}
          {queried > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{queried} Queried</span>}
        </div>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {dayLogs.map(log => (
            <LogEntryCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogEntryCard({ log }) {
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
  const missing = getMissingFields(log);
  const anomalies = getAnomalyFlags(log);
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const strata = log.strata_descriptor && strataConfig[log.strata_descriptor];
  const svc = log.service_encounter_type && serviceEncounterConfig[log.service_encounter_type];
  const stability = log.pit_stability_rating && pitStabilityConfig[log.pit_stability_rating];

  return (
    <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
      <div className={`w-1.5 h-full min-h-[2rem] rounded-full flex-shrink-0 ${reviewStatus === 'approved' ? 'bg-emerald-500' : reviewStatus === 'queried' ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
          {log.source === 'ags_import' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Tablet className="w-2.5 h-2.5" /> KeyLogBook
            </span>
          )}
          {logTypeConfig[log.log_type] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${logTypeConfig[log.log_type].badge}`}>{logTypeConfig[log.log_type].label}</span>
          )}
          {log.billing_status === 'no_charge' ? (
            <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> No Charge
            </span>
          ) : log.billing_status === 'custom_fee' && log.custom_fee > 0 ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> £{Number(log.custom_fee).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
          ) : log.chargeable && log.charge_amount > 0 ? (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> £{Number(log.charge_amount).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </span>
          ) : log.chargeable ? (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> Chargeable
            </span>
          ) : null}
          {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
          {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
          <span className="text-xs text-slate-400 ml-auto inline-flex items-center gap-1">
            <User className="w-3 h-3" />
            {log.completed_by_type && log.completed_by_type !== 'internal_staff' ? (
              <>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">{log.completed_by_type === 'client' ? 'Client' : 'Contractor'}</span>
                {log.completed_by_name || 'Unknown'}{log.created_at ? ` · ${format(new Date(log.created_at), 'HH:mm')}` : ''}
              </>
            ) : (
              <>{log.staff_name || 'Staff member'}{log.created_at ? ` · ${format(new Date(log.created_at), 'HH:mm')}` : ''}</>
            )}
          </span>
        </div>

        {/* Geotechnical data badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {log.depth_from != null && log.depth_to != null && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Ruler className="w-2.5 h-2.5" /> {log.depth_from}→{log.depth_to}m
            </span>
          )}
          {strata && strata.label && log.strata_descriptor !== 'other' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${strata.color}`}>{strata.label}</span>
          )}
          {log.groundwater_strike_depth != null && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Droplets className="w-2.5 h-2.5" /> {log.groundwater_strike_depth}m
            </span>
          )}
          {log.standpipe_ref && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> {log.standpipe_ref}{log.standpipe_reading_m != null ? ` · ${log.standpipe_reading_m}m` : ''}
            </span>
          )}
          {stability && log.pit_stability_rating !== 'not_assessed' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stability.badge} inline-flex items-center gap-0.5`}>
              <ShieldAlert className="w-2.5 h-2.5" /> {stability.label}
            </span>
          )}
          {svc && log.service_encounter_type !== 'none' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${svc.color}`}>
              <Waves className="w-2.5 h-2.5" /> {svc.label}
            </span>
          )}
          {log.service_encounter_type && log.service_encounter_type !== 'none' && log.service_check_by_type && log.service_check_by_type !== 'internal_staff' && (
            <span className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Check: {log.service_check_by_type === 'client' ? 'Client' : 'Contractor'}{log.service_check_by_name ? ` · ${log.service_check_by_name}` : ''}{log.service_check_at ? ` @ ${format(new Date(log.service_check_at), 'HH:mm')}` : ''}
            </span>
          )}
          {log.cbr_value != null && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> CBR {log.cbr_value}%
            </span>
          )}
          {log.vane_strength != null && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Vane {log.vane_strength}kPa</span>
          )}
          {log.reinstatement_type && log.reinstatement_type !== 'none' && (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Undo2 className="w-2.5 h-2.5" /> {titleCase(log.reinstatement_type)}
            </span>
          )}
          {log.mixer_type && log.mixer_type !== 'none' && (
            <span className="text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Beaker className="w-2.5 h-2.5" /> {log.mixer_type === 'machine_mixer' ? 'Machine' : log.mixer_type === 'hand_mix' ? 'Hand' : 'Premix'}
              {log.grout_volume != null ? ` · ${log.grout_volume}L` : ''}
            </span>
          )}
          {log.sensor_type && (
            <span className="text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Radar className="w-2.5 h-2.5" /> {log.sensor_type}{log.probe_depth != null ? ` · ${log.probe_depth}m` : ''}
            </span>
          )}
          {log.seal_depth != null && (
            <span className="text-xs bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Ban className="w-2.5 h-2.5" /> Seal {log.seal_depth}m
            </span>
          )}
          {photos.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Camera className="w-2.5 h-2.5" /> {photos.length}
            </span>
          )}
        </div>

        {/* Text descriptions */}
        {log.strata_description_detail && <p className="text-sm text-slate-700 mt-1">{log.strata_description_detail}</p>}
        {log.description && <p className="text-sm text-slate-600 mt-0.5">{log.description}</p>}
        {log.backfill_material && <p className="text-xs text-slate-500 mt-0.5">Backfill: {log.backfill_material}</p>}
        {log.units_completed != null && log.units_completed > 0 && (
          <p className="text-sm text-slate-700 mt-0.5">{log.units_completed} {log.units_label || 'units'}</p>
        )}
        {log.dimensions && <p className="text-xs text-slate-500 mt-0.5">{log.dimensions}</p>}

        {/* Warnings */}
        {(missing.length > 0 || anomalies.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {missing.map((m, i) => (
              <span key={`m${i}`} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {m}
              </span>
            ))}
            {anomalies.map((a, i) => (
              <span key={`a${i}`} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {a}
              </span>
            ))}
          </div>
        )}

        {/* Manager review note */}
        {log.manager_review_note && (
          <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500">
              <span className="font-medium">Manager note ({log.manager_reviewed_by || ''}):</span> {log.manager_review_note}
            </p>
          </div>
        )}

        {/* Auto-detect billing from remarks */}
        <div className="mt-1.5 flex items-center gap-2">
          <AutoBillingButton logId={log.id} />
          <button
            onClick={() => navigateToInvestigationHub(log.job_id, log.id)}
            className="text-[11px] text-slate-400 hover:text-[#2E5A1A] flex items-center gap-1 font-medium transition"
          >
            <ExternalLink className="w-3 h-3" /> View in Investigation Hub
          </button>
        </div>
      </div>
    </div>
  );
}