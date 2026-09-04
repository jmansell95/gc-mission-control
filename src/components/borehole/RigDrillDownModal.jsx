import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Cog, Mountain, ArrowDownToLine, PoundSterling, Clock, Calendar,
  Activity, Layers, TestTube, Boxes, Package, Gauge, User, Users,
  HardHat, ExternalLink, ChevronRight, AlertCircle,
} from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import { getSorDepthBands } from '@/utils/geotechBilling';
import { computeBoreholeEarnings, collectLoggers, resolveLoggerStaff } from '@/utils/rigEarnings';

const fmtGBP = (v) => '£' + (Math.round((v || 0))).toLocaleString('en-GB');

const LOG_TYPE_ICON = {
  borehole_progress: Mountain,
  sample_collection: TestTube,
  core_inspection: Boxes,
  installation: Package,
  standpipe_reading: Gauge,
  other: Activity,
};
const LOG_TYPE_LABEL = {
  borehole_progress: 'Borehole',
  sample_collection: 'Sample',
  core_inspection: 'Core',
  installation: 'Installation',
  standpipe_reading: 'Reading',
  other: 'Activity',
};

/**
 * RigDrillDownModal — full per-rig breakdown opened from the Rig Earnings strip.
 *
 * Three sections:
 *  1. Boreholes — every borehole this rig drilled, with metres + earnings per hole
 *  2. Timeline — every log for this rig, chronological, with time, type, charge, logger
 *  3. Logger — the KeyLogBook user(s) who logged the entries, linked to Staff when matched
 */
export default function RigDrillDownModal({ rigName, isDrillerFallback, logs = [], sorItems = [], job = null, staffList = [], boreholeCount, totalMetres, earnings, onClose }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('boreholes');

  const sorDepthBands = useMemo(() => getSorDepthBands(sorItems), [sorItems]);
  const boreholes = useMemo(() => computeBoreholeEarnings(logs, job, sorDepthBands), [logs, job, sorDepthBands]);
  const loggerNames = useMemo(() => collectLoggers(logs), [logs]);

  // Chronological timeline of every log for this rig
  const timeline = useMemo(() => {
    return [...logs].sort((a, b) => {
      const dd = (a.date || '').localeCompare(b.date || '');
      if (dd !== 0) return dd;
      const at = (a.start_time || '');
      const bt = (b.start_time || '');
      return at.localeCompare(bt);
    });
  }, [logs]);

  const meterageRate = Number(job?.meterage_rate) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="hero-gradient rounded-t-2xl px-5 py-4 text-white flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Cog className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold truncate">{rigName}</h2>
            <p className="text-[11px] text-white/70 flex items-center gap-1.5 flex-wrap">
              {isDrillerFallback && (
                <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-100 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                  <AlertCircle className="w-2.5 h-2.5" /> Rig not tagged — grouped by driller
                </span>
              )}
              <span>{boreholeCount} borehole{boreholeCount !== 1 ? 's' : ''}</span>
              <span>· {Math.round(totalMetres)}m drilled</span>
              <span>· {fmtGBP(earnings)} earned</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-3 flex-shrink-0">
          <Kpi icon={Mountain} label="Boreholes" value={boreholeCount} />
          <Kpi icon={ArrowDownToLine} label="Metres" value={`${Math.round(totalMetres)}m`} />
          <Kpi icon={PoundSterling} label="Earned" value={fmtGBP(earnings)} accent />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0">
          {[
            { id: 'boreholes', label: 'Boreholes', icon: Mountain },
            { id: 'timeline', label: 'Timeline', icon: Activity },
            { id: 'logger', label: 'Logger', icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                tab === t.id ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {tab === 'boreholes' && (
            <div className="space-y-2">
              {boreholes.length === 0 && <Empty msg="No borehole records for this rig." />}
              {boreholes.map((b) => (
                <div key={b.ref} className="insight-card rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Mountain className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-bold text-slate-900 text-sm truncate">{b.ref}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap mt-0.5">
                      <span className="inline-flex items-center gap-0.5 font-medium text-slate-700">
                        <ArrowDownToLine className="w-3 h-3 text-blue-500" /> {b.maxDepth}m
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Layers className="w-3 h-3" /> {b.logCount} records
                      </span>
                      {b.firstDate && (
                        <span className="inline-flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" /> {b.firstDate === b.lastDate ? b.firstDate : `${b.firstDate}–${b.lastDate}`}
                        </span>
                      )}
                    </div>
                    {b.loggers.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <User className="w-2.5 h-2.5 text-slate-400" />
                        {b.loggers.map((n) => (
                          <span key={n} className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {b.hasRate ? (
                      <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmtGBP(b.earnings)}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-medium">No rate</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-1.5">
              {timeline.length === 0 && <Empty msg="No activity logs for this rig." />}
              {timeline.map((l, i) => {
                const Icon = LOG_TYPE_ICON[l.log_type] || Activity;
                const label = LOG_TYPE_LABEL[l.log_type] || l.log_type || 'Log';
                return (
                  <div key={l.id || i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
                        {l.borehole_ref && <span className="font-mono text-[11px] font-semibold text-slate-700">{l.borehole_ref}</span>}
                        {l.date && <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{l.date}</span>}
                        {(l.start_time || l.end_time) && (
                          <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{l.start_time || '—'}{l.end_time ? `–${l.end_time}` : ''}</span>
                        )}
                        {l.duration_minutes > 0 && <span className="text-[10px] text-blue-600 font-medium">{Math.round(l.duration_minutes)}m</span>}
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5 line-clamp-2">{l.description || l.strata_description_detail || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {l.staff_name && !l.staff_name.startsWith('AGS Import') && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                            <User className="w-2.5 h-2.5" /> {l.staff_name}
                          </span>
                        )}
                        {l.source === 'keylogbook_remarks' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">KeyLogBook</span>
                        )}
                        {l.source === 'ags_import' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">AGS</span>
                        )}
                      </div>
                    </div>
                    {l.chargeable && l.charge_amount != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmtGBP(l.charge_amount)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'logger' && (
            <div className="space-y-3">
              {loggerNames.length === 0 && <Empty msg="No logger attributed on these logs." />}
              {loggerNames.map((name) => {
                const staff = resolveLoggerStaff(name, staffList);
                return (
                  <div key={name} className="insight-card rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold inline-flex items-center gap-0.5">
                          <HardHat className="w-2.5 h-2.5" /> KeyLogBook logger
                        </span>
                        {staff && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                            Matched staff
                          </span>
                        )}
                      </div>
                      {staff?.job_title && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{staff.job_title}</p>}
                    </div>
                    {staff ? (
                      <button
                        onClick={() => navigate('/staff')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-xs font-semibold transition flex-shrink-0"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">No staff match</span>
                    )}
                  </div>
                );
              })}
              {meterageRate === 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    No meterage rate is set on this job, so earnings show £0. Set the job's meterage rate (or add priced SOR depth-band items) to see live earnings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 text-center ${accent ? 'bg-emerald-50' : 'bg-slate-50'}`}>
      <Icon className={`w-4 h-4 mx-auto mb-1 ${accent ? 'text-emerald-600' : 'text-slate-500'}`} />
      <p className={`text-lg font-bold tabular-nums leading-none ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-10 text-slate-400 text-sm">{msg}</div>
  );
}