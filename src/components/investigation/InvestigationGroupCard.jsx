import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown, Layers, TestTube, Gauge, Ruler, User, Briefcase, CalendarDays,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { strataConfig, reviewStatusConfig, logTypeConfig } from '@/components/investigation/shared';
import { BOREHOLE_STATUS_CONFIG } from '@/components/investigation/boreholeStatusConfig';

/**
 * Collapsible group card for the Investigation Hub master board.
 * Renders a summary header (tailored to the group-by dimension) and an
 * expandable list of log rows. Each row opens the log detail drawer.
 *
 * Props:
 *  - groupKey: the grouping value (borehole_ref, staff_id, job_id, or date)
 *  - groupLabel: display label for the group
 *  - logs: logs in this group (already filtered + sorted)
 *  - groupBy: current grouping dimension ('borehole' | 'staff' | 'job' | 'date')
 *  - staffMap, jobMap: lookup maps for names
 *  - selectedLogId, onSelectLog
 *  - bulkMode, bulkSelected, toggleBulkSelect
 *  - defaultOpen: whether to start expanded
 */
export default function InvestigationGroupCard({
  groupLabel, logs, groupBy, staffMap, jobMap,
  selectedLogId, onSelectLog, bulkMode, bulkSelected, toggleBulkSelect,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queried = logs.filter(l => l.manager_review_status === 'queried').length;
  const approved = logs.filter(l => l.manager_review_status === 'approved').length;

  // Borehole-specific summary
  const boreholeRefs = [...new Set(logs.map(l => l.borehole_ref).filter(Boolean))];
  const maxDepth = logs.reduce((m, l) => l.depth_to != null ? Math.max(m, l.depth_to) : m, 0);
  const sampleCount = logs.filter(l => l.sample_id).length;
  const strataCount = logs.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other').length;

  // Borehole completion status — from the borehole_progress log
  const progressLog = logs.find(l => l.log_type === 'borehole_progress' && l.borehole_status);
  const boreholeStatus = progressLog?.borehole_status || null;
  const statusConfig = boreholeStatus ? BOREHOLE_STATUS_CONFIG[boreholeStatus] : null;

  // Missing data count — for in-progress / unchecked boreholes
  const hasRemarks = logs.some(l => l.source === 'keylogbook_remarks');
  const missingDataCount = [
    logs.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other').length === 0 && 'strata',
    logs.filter(l => l.sample_id).length === 0 && 'samples',
    logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0)).length === 0 && 'spt',
    logs.filter(l => l.log_type === 'installation').length === 0 && 'installations',
    !hasRemarks && 'remarks',
    (logs.reduce((m, l) => l.depth_to != null ? Math.max(m, l.depth_to) : m, 0) === 0) && 'finalDepth',
  ].filter(Boolean).length;

  const latestDate = logs
    .map(l => l.date)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  const renderSummary = () => {
    if (groupBy === 'borehole') {
      return (
        <>
          <Stat icon={Layers} label="Logs" value={logs.length} />
          <Stat icon={TestTube} label="Samples" value={sampleCount} />
          <Stat icon={Ruler} label="Max depth" value={maxDepth > 0 ? `${maxDepth.toFixed(1)}m` : '—'} />
          <Stat icon={Layers} label="Strata" value={strataCount} />
          {boreholeStatus && boreholeStatus !== 'complete' && missingDataCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {missingDataCount} data gap{missingDataCount !== 1 ? 's' : ''}
            </span>
          )}
        </>
      );
    }
    if (groupBy === 'staff') {
      return (
        <>
          <Stat icon={Briefcase} label="Logs" value={logs.length} />
          <Stat icon={Layers} label="Boreholes" value={boreholeRefs.length} />
          <Stat icon={CalendarDays} label="Latest" value={latestDate ? format(new Date(latestDate), 'dd MMM') : '—'} />
        </>
      );
    }
    if (groupBy === 'job') {
      return (
        <>
          <Stat icon={Briefcase} label="Logs" value={logs.length} />
          <Stat icon={Layers} label="Boreholes" value={boreholeRefs.length} />
          <Stat icon={User} label="Staff" value={[...new Set(logs.map(l => l.staff_id).filter(Boolean))].length} />
          <Stat icon={CalendarDays} label="Latest" value={latestDate ? format(new Date(latestDate), 'dd MMM') : '—'} />
        </>
      );
    }
    // date
    return (
      <>
        <Stat icon={Briefcase} label="Logs" value={logs.length} />
        <Stat icon={Layers} label="Boreholes" value={boreholeRefs.length} />
        <Stat icon={User} label="Staff" value={[...new Set(logs.map(l => l.staff_id).filter(Boolean))].length} />
      </>
    );
  };

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-slate-50/60 transition"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          groupBy === 'borehole' ? 'bg-blue-100' :
          groupBy === 'staff' ? 'bg-emerald-100' :
          groupBy === 'job' ? 'bg-amber-100' : 'bg-violet-100'
        }`}>
          {groupBy === 'borehole' && <Layers className="w-5 h-5 text-blue-700" />}
          {groupBy === 'staff' && <User className="w-5 h-5 text-emerald-700" />}
          {groupBy === 'job' && <Briefcase className="w-5 h-5 text-amber-700" />}
          {groupBy === 'date' && <CalendarDays className="w-5 h-5 text-violet-700" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
              {groupLabel}
            </p>
            {statusConfig && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ${statusConfig.badge}`}>
                {(() => { const SIcon = statusConfig.icon; return <SIcon className="w-2.5 h-2.5" />; })()}
                {statusConfig.short}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
            {renderSummary()}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pending > 0 && <Pill color="amber" icon={AlertTriangle} label={pending} />}
          {queried > 0 && <Pill color="red" icon={XCircle} label={queried} />}
          {approved > 0 && <Pill color="emerald" icon={CheckCircle2} label={approved} />}
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded log list */}
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {logs.map(log => (
            <LogRow
              key={log.id}
              log={log}
              jobName={jobMap[log.job_id]?.name || '—'}
              staffName={staffMap[log.staff_id]?.name || log.staff_name || (log.source === 'ags_import' ? 'No name' : '—')}
              isSelected={log.id === selectedLogId}
              onClick={() => bulkMode ? toggleBulkSelect(log.id) : onSelectLog(log.id)}
              bulkMode={bulkMode}
              bulkSelected={bulkSelected.has(log.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <Icon className="w-3 h-3 opacity-70" />
      <span className="font-semibold text-slate-700 tabular-nums">{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function Pill({ color, icon: Icon, label }) {
  const cls = color === 'amber' ? 'bg-amber-100 text-amber-700'
    : color === 'red' ? 'bg-red-100 text-red-700'
    : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function LogRow({ log, jobName, staffName, isSelected, onClick, bulkMode, bulkSelected }) {
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const typeConfig = logTypeConfig[log.log_type];
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 px-3 sm:px-4 py-2.5 transition hover:bg-slate-50 ${
        bulkSelected ? 'bg-[#2E5A1A]/10' : isSelected ? 'bg-[#2E5A1A]/5' : ''
      }`}
    >
      {bulkMode && (
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${bulkSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white'}`}>
          {bulkSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </span>
      )}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rc.badge}`}>{rc.label}</span>
      {typeConfig && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 hidden sm:inline ${typeConfig.badge}`}>{typeConfig.label}</span>
      )}
      {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700 flex-shrink-0">{log.borehole_ref}</span>}
      {log.depth_from != null && log.depth_to != null && (
        <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5 flex-shrink-0">
          <Ruler className="w-2.5 h-2.5" /> {log.depth_from}–{log.depth_to}m
        </span>
      )}
      {photos.length > 0 && (
        <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5 flex-shrink-0">📷 {photos.length}</span>
      )}
      <span className="text-xs text-slate-600 truncate flex-1 min-w-0">{log.description || log.strata_description_detail || typeConfig?.label || '—'}</span>
      <span className="text-[10px] text-slate-400 truncate hidden md:inline max-w-[140px] flex-shrink-0">{staffName}</span>
      <span className="text-[10px] text-slate-400 hidden lg:inline max-w-[120px] truncate flex-shrink-0">{jobName}</span>
      <span className="text-[10px] text-slate-400 flex-shrink-0">{log.date ? format(new Date(log.date), 'dd MMM') : '—'}</span>
    </button>
  );
}