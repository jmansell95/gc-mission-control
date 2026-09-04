import React from 'react';
import { Clock, MapPin, PoundSterling, User, ExternalLink, Eye, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { detectActivityType, TAG_COLORS } from '@/utils/siteLogUtils';
import { reviewStatusConfig } from '@/components/investigation/shared';
import { navigateToInvestigationHub, navigateToJobSiteActivity } from '@/utils/investigationDeepLink';

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
}

// Format the system submission timestamp (created_date) as HH:MM in Europe/London
function loggedAtTime(createdDate) {
  if (!createdDate) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(createdDate));
  } catch { return null; }
}

// Synced-by chip config per log source
const SOURCE_CHIP = {
  keylogbook_remarks: { label: 'KeyLogBook', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  ags_import: { label: 'KeyLogBook AGS', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  staff: { label: null, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/**
 * KeyLogActivityCard — the single shared activity-card used by BOTH the
 * Job Site Activity timeline and the Investigation Hub live feed so the
 * look is identical across surfaces.
 *
 * Props:
 *  - log: the InvestigationLog record (source='keylogbook_remarks')
 *  - jobName: display name of the log's job (for the Hub live feed)
 *  - showJobName: whether to render the job name (Hub context)
 *  - selected: highlight as selected
 *  - onSelect: click handler (selects the log in its parent list)
 *  - linkDirection: 'to_hub' (Site Activity → Hub) | 'to_job' (Hub → Site Activity)
 *      Controls which deep-link button is rendered. When the parent passes a
 *      job object, the Hub→Job link can navigate directly.
 *  - job: optional full job object (needed for Hub→Site Activity navigation)
 *  - compact: render a denser row variant (used inside the live feed list)
 */
export default function KeyLogActivityCard({
  log, jobName, showJobName = false, selected = false, onSelect,
  linkDirection = 'to_hub', job = null, compact = false,
}) {
  if (!log) return null;
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const tag = detectActivityType(log.description);
  const c = TAG_COLORS[tag.color] || TAG_COLORS.slate;
  const hasTimes = !!(log.start_time || log.end_time);
  const isPending = reviewStatus !== 'approved';
  const src = log.source || 'staff';
  const chip = SOURCE_CHIP[src] || SOURCE_CHIP.staff;
  const chipLabel = src === 'staff' ? (log.staff_name || 'Manual') : chip.label;
  const loggedAt = loggedAtTime(log.created_date || log.created_at);

  const handleDeepLink = (e) => {
    e.stopPropagation();
    if (linkDirection === 'to_hub') {
      navigateToInvestigationHub(log.job_id, log.id);
    } else if (job) {
      navigateToJobSiteActivity(job, log.id);
    }
  };

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(log.id)}
        className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition cursor-pointer animate-slide-up ${
          selected ? 'border-[#2E5A1A]/40 bg-[#2E5A1A]/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
        }`}
      >
        <span className={`w-1 h-9 rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />
        <div className="flex-shrink-0 w-16 text-right">
          <p className="text-xs font-mono font-bold text-slate-700 leading-tight">{log.start_time || '—'}</p>
          <p className="text-xs font-mono font-bold text-slate-400 leading-tight">{log.end_time || '—'}</p>
          {loggedAt && <p className="text-[9px] text-slate-400 leading-tight mt-0.5" title={`Logged at ${loggedAt}`}>·{loggedAt}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] ${c.bg} ${c.text} px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> {tag.label}
            </span>
            {showJobName && jobName && (
              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">{jobName}</span>
            )}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${chip.cls}`}>{chipLabel}</span>
          </div>
          <p className="text-xs text-slate-700 leading-snug line-clamp-2">{log.description || '—'}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasTimes && (
            <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {fmtDur(log.duration_minutes)}
            </span>
          )}
          {log.chargeable && log.charge_amount > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> {Number(log.charge_amount).toFixed(0)}
            </span>
          )}
          <button
            onClick={handleDeepLink}
            title={linkDirection === 'to_hub' ? 'View in Investigation Hub' : 'Open on Job Site Activity'}
            className="p-1 text-slate-300 hover:text-[#2E5A1A] rounded-md hover:bg-[#2E5A1A]/5 transition opacity-0 group-hover:opacity-100"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full card variant — used in the Site Activity timeline detail and the Hub drawer footer
  return (
    <div
      onClick={() => onSelect?.(log.id)}
      className={`group relative flex gap-3 p-3.5 rounded-xl border transition cursor-pointer animate-slide-up ${
        selected ? 'border-[#2E5A1A]/40 bg-[#2E5A1A]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <span className={`w-1.5 rounded-full flex-shrink-0 ${isPending ? 'bg-amber-400' : 'bg-emerald-500'}`} />
      <div className="flex-shrink-0 w-20 sm:w-24 text-right">
        <p className="text-sm font-mono font-bold text-slate-700 leading-tight">{log.start_time || '—'}</p>
        <p className="text-sm font-mono font-bold text-slate-400 leading-tight">{log.end_time || '—'}</p>
        <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-0.5">
          <Clock className="w-2.5 h-2.5" /> {fmtDur(log.duration_minutes)}
        </p>
        {loggedAt && (
          <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-0.5" title={`Logged at ${loggedAt}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {loggedAt}
          </p>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
          <span className={`text-[10px] ${c.bg} ${c.text} px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> {tag.label}
          </span>
          {log.borehole_ref && (
            <span className="text-[10px] text-slate-500 inline-flex items-center gap-1 font-mono font-bold">
              <MapPin className="w-2.5 h-2.5" /> {log.borehole_ref}
            </span>
          )}
          {log.chargeable && log.charge_amount > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <PoundSterling className="w-2.5 h-2.5" /> {Number(log.charge_amount).toFixed(0)}
            </span>
          )}
          {log.pricing_review_status === 'pending_review' && (
            <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending pricing
            </span>
          )}
          {!hasTimes && (
            <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> No times
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{log.description || '—'}</p>
        {log.raw_remarks && log.raw_remarks !== log.description && (
          <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">Original: "{log.raw_remarks}"</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {log.staff_name ? (
            <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
              <User className="w-2.5 h-2.5" /> {log.staff_name}
            </span>
          ) : (
            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> No name entered
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${chip.cls}`}>{chipLabel}</span>
          {log.date && (
            <span className="text-[10px] text-slate-400">{format(new Date(log.date), 'dd MMM yyyy')}</span>
          )}
          <button
            onClick={handleDeepLink}
            className="ml-auto text-[11px] font-medium text-[#2E5A1A] hover:text-[#1c4a12] inline-flex items-center gap-1 transition"
          >
            <ExternalLink className="w-3 h-3" />
            {linkDirection === 'to_hub' ? 'View in Investigation Hub' : 'Open on Job Site Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}