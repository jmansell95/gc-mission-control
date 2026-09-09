import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown, Layers, TestTube, Gauge, Wrench, MessageSquare, List,
  Ruler, CheckCircle2, AlertTriangle, XCircle, Mountain, Drill, User, CalendarDays, Camera,
} from 'lucide-react';
import {
  strataConfig, reviewStatusConfig, logTypeConfig, getSptDensityLabel,
} from '@/components/investigation/shared';
import {
  BOREHOLE_STATUS_CONFIG, DRILLING_METHOD_CONFIG,
} from '@/components/investigation/boreholeStatusConfig';

/**
 * Borehole detail level — organized sections showing all geotechnical data
 * for one borehole: strata sequence, samples, SPT results, installations,
 * driller remarks, and a flat list of all logs. Each section is a collapsible
 * card; individual logs can be clicked to open the detail drawer. In bulk
 * mode, checkboxes appear next to each log row.
 */
export default function InvestigationBoreholeDetail({
  boreholeRef, logs, jobName, staffMap,
  bulkMode, bulkSelected, toggleBulkSelect, onSelectLog,
}) {
  const progressLog = logs.find(l => l.log_type === 'borehole_progress' && l.borehole_status);
  const boreholeStatus = progressLog?.borehole_status || null;
  const statusCfg = boreholeStatus ? BOREHOLE_STATUS_CONFIG[boreholeStatus] : null;
  const methodCfg = progressLog?.drilling_method ? DRILLING_METHOD_CONFIG[progressLog.drilling_method] : null;

  const maxDepth = logs.reduce((m, l) => l.depth_to != null ? Math.max(m, l.depth_to) : m, 0);
  const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queried = logs.filter(l => l.manager_review_status === 'queried').length;
  const approved = logs.filter(l => l.manager_review_status === 'approved').length;

  // Section data
  const strataLogs = logs.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other').sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
  const sampleLogs = logs.filter(l => l.sample_id).sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
  const sptLogs = logs.filter(l => (l.spt_blows && l.spt_blows.length > 0) || l.spt_n_value != null).sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
  const installLogs = logs.filter(l => l.log_type === 'installation').sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
  const remarkLogs = logs.filter(l => l.source === 'keylogbook_remarks').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const allLogs = [...logs].sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));

  const sections = [
    { key: 'strata', icon: Layers, title: 'Strata Sequence', count: strataLogs.length, logs: strataLogs, color: 'text-blue-700 bg-blue-100' },
    { key: 'samples', icon: TestTube, title: 'Samples', count: sampleLogs.length, logs: sampleLogs, color: 'text-purple-700 bg-purple-100' },
    { key: 'spt', icon: Gauge, title: 'SPT Results', count: sptLogs.length, logs: sptLogs, color: 'text-amber-700 bg-amber-100' },
    { key: 'installations', icon: Wrench, title: 'Installations', count: installLogs.length, logs: installLogs, color: 'text-emerald-700 bg-emerald-100' },
    { key: 'remarks', icon: MessageSquare, title: 'Driller Remarks', count: remarkLogs.length, logs: remarkLogs, color: 'text-slate-700 bg-slate-100' },
    { key: 'all', icon: List, title: 'All Logs', count: allLogs.length, logs: allLogs, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Mountain className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-mono font-bold text-slate-900 text-lg">{boreholeRef}</h3>
              {statusCfg && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border ${statusCfg.badge}`}>
                  {(() => { const SIcon = statusCfg.icon; return <SIcon className="w-3 h-3" />; })()}
                  {statusCfg.label}
                </span>
              )}
              {methodCfg && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${methodCfg.badge}`}>
                  <Drill className="w-3 h-3" /> {methodCfg.label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{jobName}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryStat icon={Ruler} label="Max Depth" value={maxDepth > 0 ? `${maxDepth.toFixed(1)}m` : '—'} />
          <SummaryStat icon={Layers} label="Total Logs" value={logs.length} />
          <SummaryStat icon={CalendarDays} label="Started" value={progressLog?.borehole_start_date ? format(new Date(progressLog.borehole_start_date), 'dd MMM yyyy') : '—'} />
          <SummaryStat icon={CalendarDays} label="Completed" value={progressLog?.borehole_end_date ? format(new Date(progressLog.borehole_end_date), 'dd MMM yyyy') : '—'} />
        </div>
        {progressLog?.device_name && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5"><Drill className="w-3.5 h-3.5" /> Rig: {progressLog.device_name}</p>
        )}
        {progressLog?.crew_names?.length > 0 && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Crew: {progressLog.crew_names.join(', ')}</p>
        )}
        {progressLog?.project_engineer && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Engineer: {progressLog.project_engineer}</p>
        )}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {pending > 0 && <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold"><AlertTriangle className="w-3 h-3" /> {pending} pending</span>}
          {queried > 0 && <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold"><XCircle className="w-3 h-3" /> {queried} queried</span>}
          {approved > 0 && <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold"><CheckCircle2 className="w-3 h-3" /> {approved} approved</span>}
        </div>
      </div>

      {/* Organized sections */}
      {sections.map((sec, idx) => (
        <SectionCard
          key={sec.key}
          icon={sec.icon}
          title={sec.title}
          count={sec.count}
          color={sec.color}
          defaultOpen={idx < 5}
        >
          {sec.logs.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No {sec.title.toLowerCase()} recorded for this borehole.</p>
          ) : sec.key === 'strata' ? (
            <StrataList logs={sec.logs} onSelectLog={onSelectLog} bulkMode={bulkMode} bulkSelected={bulkSelected} toggleBulkSelect={toggleBulkSelect} />
          ) : sec.key === 'remarks' ? (
            <RemarksList logs={sec.logs} onSelectLog={onSelectLog} bulkMode={bulkMode} bulkSelected={bulkSelected} toggleBulkSelect={toggleBulkSelect} />
          ) : (
            <LogList logs={sec.logs} onSelectLog={onSelectLog} bulkMode={bulkMode} bulkSelected={bulkSelected} toggleBulkSelect={toggleBulkSelect} showType={sec.key !== 'all'} />
          )}
        </SectionCard>
      ))}
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-bold text-slate-800 tabular-nums">{value}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, title, count, color, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-slate-50/60 transition">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{title}</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-2 sm:p-3">{children}</div>}
    </div>
  );
}

function LogRow({ log, onSelectLog, bulkMode, bulkSelected, toggleBulkSelect, showType = true }) {
  const rc = reviewStatusConfig[log.manager_review_status || 'pending'];
  const typeConfig = logTypeConfig[log.log_type];
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
  return (
    <button
      onClick={() => bulkMode ? toggleBulkSelect(log.id) : onSelectLog(log.id)}
      className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition hover:bg-slate-50 ${bulkSelected ? 'bg-[#2E5A1A]/10' : ''}`}
    >
      {bulkMode && (
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${bulkSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white'}`}>
          {bulkSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </span>
      )}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rc.badge}`}>{rc.label}</span>
      {showType && typeConfig && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 hidden sm:inline ${typeConfig.badge}`}>{typeConfig.label}</span>}
      {log.depth_from != null && log.depth_to != null && (
        <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5 flex-shrink-0"><Ruler className="w-2.5 h-2.5" /> {log.depth_from}–{log.depth_to}m</span>
      )}
      {photos.length > 0 && <span className="text-[10px] text-slate-400 flex-shrink-0">📷 {photos.length}</span>}
      <span className="text-xs text-slate-600 truncate flex-1 min-w-0">{log.description || log.strata_description_detail || typeConfig?.label || '—'}</span>
      <span className="text-[10px] text-slate-400 flex-shrink-0">{log.date ? format(new Date(log.date), 'dd MMM') : '—'}</span>
    </button>
  );
}

function LogList({ logs, onSelectLog, bulkMode, bulkSelected, toggleBulkSelect, showType }) {
  return (
    <div className="space-y-0.5">
      {logs.map(log => (
        <LogRow key={log.id} log={log} onSelectLog={onSelectLog} bulkMode={bulkMode} bulkSelected={bulkSelected.has(log.id)} toggleBulkSelect={toggleBulkSelect} showType={showType} />
      ))}
    </div>
  );
}

function StrataList({ logs, onSelectLog, bulkMode, bulkSelected, toggleBulkSelect }) {
  return (
    <div className="space-y-1">
      {logs.map(log => {
        const strata = strataConfig[log.strata_descriptor];
        const rc = reviewStatusConfig[log.manager_review_status || 'pending'];
        return (
          <button
            key={log.id}
            onClick={() => bulkMode ? toggleBulkSelect(log.id) : onSelectLog(log.id)}
            className={`w-full text-left flex items-stretch gap-0 rounded-lg overflow-hidden border border-slate-100 hover:shadow-sm transition ${bulkSelected.has(log.id) ? 'bg-[#2E5A1A]/10' : ''}`}
          >
            <div className="w-2 flex-shrink-0" style={{ background: strata ? undefined : '#94a3b8' }} />
            <div className="flex-1 px-3 py-2 flex items-center gap-2.5">
              {bulkMode && (
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${bulkSelected.has(log.id) ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white'}`}>
                  {bulkSelected.has(log.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
              )}
              <span className="text-[10px] font-mono text-slate-500 tabular-nums flex-shrink-0 w-16">{log.depth_from}–{log.depth_to}m</span>
              {strata && <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${strata.color}`}>{strata.label}</span>}
              <span className="text-xs text-slate-600 truncate flex-1 min-w-0">{log.strata_description_detail || '—'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rc.badge}`}>{rc.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RemarksList({ logs, onSelectLog, bulkMode, bulkSelected, toggleBulkSelect }) {
  return (
    <div className="space-y-1.5">
      {logs.map(log => {
        const rc = reviewStatusConfig[log.manager_review_status || 'pending'];
        return (
          <div key={log.id} className={`rounded-lg border border-slate-100 p-3 ${bulkSelected.has(log.id) ? 'bg-[#2E5A1A]/10' : 'bg-slate-50/50'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              {bulkMode && (
                <button onClick={() => toggleBulkSelect(log.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${bulkSelected.has(log.id) ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white'}`}>
                  {bulkSelected.has(log.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
              )}
              <span className="text-xs font-semibold text-slate-700">{log.date ? format(new Date(log.date), 'EEEE, dd MMM yyyy') : '—'}</span>
              {log.start_time && log.end_time && <span className="text-[11px] text-slate-500">{log.start_time}–{log.end_time}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rc.badge}`}>{rc.label}</span>
              <button onClick={() => onSelectLog(log.id)} className="ml-auto text-[11px] text-[#2E5A1A] font-semibold hover:underline">View →</button>
            </div>
            <p className="text-sm text-slate-700">{log.description || '—'}</p>
            {log.raw_remarks && log.raw_remarks !== log.description && (
              <p className="text-xs text-slate-400 italic mt-1.5 pt-1.5 border-t border-slate-200 border-dashed">Original: "{log.raw_remarks}"</p>
            )}
          </div>
        );
      })}
    </div>
  );
}