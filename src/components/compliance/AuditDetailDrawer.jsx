import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Briefcase, User, Calendar,
  ClipboardList, Loader2, MapPin, PenTool, FileText, Image as ImageIcon, ChevronDown,
  Building2, Clock,
} from 'lucide-react';
import { getCategoryMeta, getStatusMeta, fmtDateTime, fmtDate, PRIORITY_TONE } from './auditConstants';

// Collapsible section for grouping check items
function CheckSection({ section, items, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const passed = items.filter(i => i.status === 'pass').length;
  const failed = items.filter(i => i.status === 'fail').length;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50/80 hover:bg-slate-100 transition text-left"
      >
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
        <span className="text-sm font-bold text-slate-800 flex-1 truncate">{section}</span>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
          {passed > 0 && <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{passed} pass</span>}
          {failed > 0 && <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">{failed} fail</span>}
          <span className="text-slate-400">{items.length}</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {items.map(item => {
            const statusMeta = getStatusMeta(item.status);
            const StatusIcon = statusMeta.icon;
            return (
              <div key={item.id} className="px-3 py-2.5 flex items-start gap-2.5">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${item.status === 'fail' ? 'bg-rose-100' : item.status === 'pass' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <StatusIcon className={`w-3.5 h-3.5 ${item.status === 'fail' ? 'text-rose-600' : item.status === 'pass' ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium leading-snug">{item.label}</p>
                  {item.response && (
                    <p className={`text-xs mt-0.5 font-semibold ${item.status === 'fail' ? 'text-rose-600' : item.status === 'pass' ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {item.response}
                    </p>
                  )}
                  {item.comments && <p className="text-xs text-slate-400 mt-0.5 italic">"{item.comments}"</p>}
                  {item.photos.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {item.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                          <img src={url} alt={`Photo ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {item.score != null && item.maxScore != null && (
                  <span className="text-[10px] font-bold tabular-nums text-slate-400 flex-shrink-0">{item.score}/{item.maxScore}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AuditDetailDrawer({ audit, onClose }) {
  // Fetch full audit detail on demand from the Mitti API
  const { data: detailResponse, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['mitti-audit-detail', audit?.safetyculture_audit_id],
    queryFn: () => base44.functions.invoke('getMittiAuditDetail', { audit_id: audit.safetyculture_audit_id }),
    enabled: !!audit?.safetyculture_audit_id,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const detail = detailResponse?.data?.detail;
  const storedReport = detailResponse?.data?.stored_report;
  const fetchSource = detailResponse?.data?.source;
  const warning = detailResponse?.data?.warning;

  // Merge stored report fields with fetched detail
  const category = storedReport?.audit_category || audit?.audit_category || 'general';
  const meta = getCategoryMeta(category);
  const CategoryIcon = meta.icon;

  const jobId = storedReport?.job_id || audit?.job_id;
  const jobName = storedReport?.job_name || audit?.job_name || detail?.siteName || audit?.site_name;
  const auditorStaffId = storedReport?.auditor_staff_id || audit?.auditor_staff_id;
  const auditorName = detail?.auditorName || audit?.auditor_name || '—';
  const auditorEmail = detail?.auditorEmail || audit?.auditor_email;
  const templateName = detail?.templateName || audit?.audit_template_name || '—';
  const auditTitle = detail?.auditTitle || audit?.audit_title || templateName;
  const conductedAt = detail?.conductedAt || audit?.conducted_at;
  const completedAt = detail?.completedAt || audit?.completed_at;
  const reportUrl = detail?.reportUrl || audit?.audit_report_url;
  const passFail = detail?.passFail || audit?.pass_fail || 'pending';
  const scorePct = detail?.scorePercentage != null ? detail.scorePercentage : audit?.score_percentage;
  const itemsPassed = detail?.itemsPassed ?? audit?.items_passed ?? 0;
  const itemsFailed = detail?.itemsFailed ?? audit?.items_failed ?? 0;
  const actionItems = detail?.actionItems || audit?.action_items || [];
  const checkItems = detail?.items || [];
  const headerFields = detail?.headerFields || [];
  const gps = detail?.gps;
  const signatureUrl = detail?.signatureUrl;

  // Group check items by section
  const itemsBySection = useMemo(() => {
    const groups = {};
    for (const item of checkItems) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    }
    return Object.entries(groups);
  }, [checkItems]);

  const failed = passFail === 'fail';
  const passed = passFail === 'pass';
  const statusMeta = getStatusMeta(passFail);
  const StatusIcon = statusMeta.icon;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto animate-drawer-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 z-10">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${failed ? 'bg-rose-100' : passed ? 'bg-emerald-100' : 'bg-slate-100'}`}>
              {failed ? <XCircle className="w-5 h-5 text-rose-600" /> : passed ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ClipboardList className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">{auditTitle}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                  <CategoryIcon className="w-2.5 h-2.5" /> {meta.label}
                </span>
                <span className="text-xs text-slate-500 truncate">{templateName}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Prominent Open Full Mitti Report button */}
          {reportUrl && (
            <div className="px-5 pb-3">
              <a
                href={reportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open Full Mitti Report
              </a>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Loading state */}
          {detailLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">Fetching full audit from Mitti…</p>
              <p className="text-xs text-slate-400 mt-1">Loading individual check items and responses</p>
            </div>
          )}

          {/* Warning (no API token / fetch failed) */}
          {!detailLoading && warning && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">{warning}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Showing summary data only. Configure the Mitti API token in Settings → Integrations for full item-level detail.</p>
              </div>
            </div>
          )}

          {/* Summary grid */}
          {!detailLoading && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Auditor</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{auditorName}</p>
                    {auditorEmail && <p className="text-[10px] text-slate-400 truncate">{auditorEmail}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Conducted</p>
                    <p className="text-sm font-semibold text-slate-700">{fmtDateTime(conductedAt)}</p>
                    {completedAt && completedAt !== conductedAt && <p className="text-[10px] text-slate-400">Completed {fmtDateTime(completedAt)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                  <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Job / Site</p>
                    {jobId ? (
                      <a href={`/admin?job=${jobId}`} className="text-sm font-semibold text-[#2E5A1A] hover:underline truncate block">{jobName || 'View job'}</a>
                    ) : (
                      <p className="text-sm font-semibold text-slate-700 truncate">{jobName || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                  <ClipboardList className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Score</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {scorePct != null ? `${Math.round(scorePct)}%` : '—'}
                      {itemsFailed > 0 && <span className="text-rose-600 ml-1.5 text-xs">· {itemsFailed} failed</span>}
                      {itemsPassed > 0 && itemsFailed === 0 && <span className="text-emerald-600 ml-1.5 text-xs">· {itemsPassed} passed</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* GPS + Signature */}
              {(gps?.lat != null || signatureUrl) && (
                <div className="flex flex-wrap gap-2">
                  {gps?.lat != null && gps?.lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                    </a>
                  )}
                  {signatureUrl && (
                    <a href={signatureUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition">
                      <PenTool className="w-3.5 h-3.5" /> View Signature
                    </a>
                  )}
                </div>
              )}

              {/* Header fields (site-specific metadata from the audit) */}
              {headerFields.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Header Fields</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {headerFields.map((f, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">{f.label}</p>
                        <p className="text-sm text-slate-700 font-medium truncate">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Check items — the full drill-down */}
              {checkItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#2E5A1A]" />
                    <h4 className="text-sm font-bold text-slate-900">Check Items ({checkItems.length})</h4>
                    <span className="text-[10px] text-slate-400 ml-auto">Source: {fetchSource === 'api' ? 'Mitti API' : fetchSource === 'stored_payload' ? 'Stored payload' : '—'}</span>
                  </div>
                  <div className="space-y-2">
                    {itemsBySection.map(([section, items]) => (
                      <CheckSection key={section} section={section} items={items} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action items */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-900">Action Items ({actionItems.length})</h4>
                </div>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No action items raised.</p>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map((a, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_TONE[a.priority] || PRIORITY_TONE.medium}`}>{(a.priority || 'medium').toUpperCase()}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{a.description || 'Untitled action'}</p>
                          <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-500">
                            {a.assignee && <span>👤 {a.assignee}</span>}
                            {a.due_date && <span>📅 {fmtDate(a.due_date)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}