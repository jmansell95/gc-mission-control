import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Briefcase, User, Calendar,
  ClipboardList, Loader2, MapPin, PenTool, FileText, ChevronDown,
  Clock, Siren, Save, MinusCircle, Image as ImageIcon, Download,
} from 'lucide-react';
import { getCategoryMeta, getStatusMeta, fmtDateTime, PRIORITY_TONE } from './auditConstants';
import PhotoGalleryLightbox from './PhotoGalleryLightbox';
import CreateIncidentFromAuditModal from './CreateIncidentFromAuditModal';
import AuditScoreGauge from './AuditScoreGauge';

// Section header with coloured left accent bar matching the section's pass/fail
function SectionHeader({ section, items, open, onToggle }) {
  const passed = items.filter(i => i.status === 'pass').length;
  const failed = items.filter(i => i.status === 'fail').length;
  const na = items.filter(i => i.status === 'n/a').length;
  const pending = items.filter(i => i.status === 'pending').length;

  const accent = failed > 0 ? 'bg-rose-500'
    : passed > 0 && pending === 0 && na === 0 ? 'bg-emerald-500'
    : 'bg-slate-300';

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50/80 transition text-left border-b border-slate-100"
    >
      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? '' : '-rotate-90'}`} />
      <div className={`w-1 h-7 rounded-full flex-shrink-0 ${accent}`} />
      <span className="text-sm font-bold text-slate-900 flex-1 truncate">{section}</span>
      <div className="flex items-center gap-1.5 text-[10px] font-bold flex-shrink-0">
        {passed > 0 && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{passed} pass</span>}
        {failed > 0 && <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">{failed} fail</span>}
        {na > 0 && <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{na} n/a</span>}
        {pending > 0 && <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{pending} pending</span>}
      </div>
    </button>
  );
}

// A single check item row — response, comments, photos inline
function CheckItemRow({ item, onCreateIncident }) {
  const statusMeta = getStatusMeta(item.status);
  const StatusIcon = statusMeta.icon;
  return (
    <div className="px-4 py-3 flex items-start gap-3 border-b border-slate-50 last:border-b-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${item.status === 'fail' ? 'bg-rose-100' : item.status === 'pass' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        <StatusIcon className={`w-4 h-4 ${item.status === 'fail' ? 'text-rose-600' : item.status === 'pass' ? 'text-emerald-600' : 'text-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 font-semibold leading-snug">{item.label}</p>
        {item.response && (
          <p className={`text-xs mt-1 font-semibold ${item.status === 'fail' ? 'text-rose-600' : item.status === 'pass' ? 'text-emerald-600' : 'text-slate-500'}`}>
            {item.response}
          </p>
        )}
        {item.comments && <p className="text-xs text-slate-400 mt-1 italic leading-snug">"{item.comments}"</p>}
        {item.photos.length > 0 && (
          <div className="mt-2">
            <PhotoGalleryLightbox photos={item.photos} label={`${item.label} photos`} />
          </div>
        )}
        {item.status === 'fail' && (
          <button
            onClick={() => onCreateIncident(item)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 transition"
          >
            <Siren className="w-3 h-3" /> Create incident from this failure
          </button>
        )}
      </div>
      {item.score != null && item.maxScore != null && (
        <span className="text-[10px] font-bold tabular-nums text-slate-400 flex-shrink-0 mt-1">{item.score}/{item.maxScore}</span>
      )}
    </div>
  );
}

// Collapsible section — the report flows down section by section
function ReportSection({ section, items, defaultOpen = true, onCreateIncident }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <SectionHeader section={section} items={items} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div>
          {items.map(item => (
            <CheckItemRow key={item.id} item={item} onCreateIncident={onCreateIncident} />
          ))}
        </div>
      )}
    </div>
  );
}

// Stat pill for the hero
function StatPill({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${tones[tone]}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide opacity-60 leading-none">{label}</p>
        <p className="text-sm font-extrabold tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function AuditDetailDrawer({ audit, onClose }) {
  const queryClient = useQueryClient();
  const [showIncidentModal, setShowIncidentModal] = useState(null);
  const [actionDraft, setActionDraft] = useState({});
  const [savingActions, setSavingActions] = useState(false);

  const { data: detailResponse, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['mitti-audit-detail', audit?.safetyculture_audit_id],
    queryFn: () => base44.functions.invoke('getMittiAuditDetail', { audit_id: audit.safetyculture_audit_id }),
    enabled: !!audit?.safetyculture_audit_id,
    staleTime: 5 * 60 * 1000,
  });

  const detail = detailResponse?.data?.detail;
  const storedReport = detailResponse?.data?.stored_report;
  const fetchSource = detailResponse?.data?.source;
  const warning = detailResponse?.data?.warning;

  const category = storedReport?.audit_category || audit?.audit_category || 'general';
  const meta = getCategoryMeta(category);
  const CategoryIcon = meta.icon;

  const jobId = storedReport?.job_id || audit?.job_id;
  const jobName = storedReport?.job_name || audit?.job_name || detail?.siteName || audit?.site_name;
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

  // Count items by status for the hero badges
  const statusCounts = useMemo(() => {
    let pass = 0, fail = 0, na = 0, pending = 0;
    for (const item of checkItems) {
      if (item.status === 'pass') pass++;
      else if (item.status === 'fail') fail++;
      else if (item.status === 'n/a') na++;
      else pending++;
    }
    return { pass, fail, na, pending, total: checkItems.length };
  }, [checkItems]);

  if (!audit) return null;

  const failed = passFail === 'fail';
  const passed = passFail === 'pass';
  const statusMeta = getStatusMeta(passFail);
  const StatusIcon = statusMeta.icon;

  const handleSaveActions = async () => {
    setSavingActions(true);
    try {
      const updated = actionItems.map((a, i) => ({ ...a, ...(actionDraft[i] || {}) }));
      await base44.functions.invoke('updateAuditActionItems', {
        audit_id: audit.safetyculture_audit_id,
        action_items: updated,
      });
      queryClient.invalidateQueries({ queryKey: ['mitti-audit-detail', audit.safetyculture_audit_id] });
      queryClient.invalidateQueries({ queryKey: ['safety-reports-action-items'] });
      setActionDraft({});
    } catch (e) { /* best-effort */ }
    setSavingActions(false);
  };

  const updateActionField = (index, field, value) => {
    setActionDraft(prev => ({ ...prev, [index]: { ...(prev[index] || {}), [field]: value } }));
  };

  const openMittiReport = () => {
    // Use the report URL from the fetched detail data (points to app.mitti.com).
    // Fall back to constructing the Mitti URL from the audit ID.
    if (reportUrl) {
      window.open(reportUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const auditId = audit?.safetyculture_audit_id;
    if (!auditId) return;
    window.open(`https://app.mitti.com/report/audit/${auditId}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white w-full max-w-2xl max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-y-auto"
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

            {/* Action buttons row */}
            <div className="px-5 pb-3 flex items-center gap-2">
              <button onClick={openMittiReport} className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-[#244715] transition shadow-sm">
                <ExternalLink className="w-4 h-4" />
                View Mitti Report
              </button>
              {(failed || itemsFailed > 0) && (
                <button onClick={() => setShowIncidentModal('whole')} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition shadow-sm">
                  <Siren className="w-4 h-4" />
                  Incident
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Loading state */}
            {detailLoading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
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

            {/* Hero — score gauge + pass/fail badge + item counts */}
            {!detailLoading && (
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-5">
                <div className="flex items-center gap-5">
                  <AuditScoreGauge percentage={scorePct} passFail={passFail} size={120} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${failed ? 'bg-rose-100 text-rose-700' : passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {failed ? 'Failed' : passed ? 'Passed' : 'Pending'}
                      </span>
                      {fetchSource && (
                        <span className="text-[10px] text-slate-400 font-semibold">via {fetchSource === 'api' ? 'Mitti API' : 'stored payload'}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatPill icon={CheckCircle2} label="Passed" value={statusCounts.pass} tone="emerald" />
                      <StatPill icon={XCircle} label="Failed" value={statusCounts.fail} tone="rose" />
                      <StatPill icon={MinusCircle} label="N/A" value={statusCounts.na} tone="slate" />
                      <StatPill icon={Clock} label="Pending" value={statusCounts.pending} tone="amber" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata grid */}
            {!detailLoading && (
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
                      <a href={`/admin?job=${jobId}`} className="text-sm font-semibold text-primary hover:underline truncate block">{jobName || 'View job'}</a>
                    ) : (
                      <p className="text-sm font-semibold text-slate-700 truncate">{jobName || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                  <ClipboardList className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Items</p>
                    <p className="text-sm font-semibold text-slate-700">{statusCounts.total} total</p>
                  </div>
                </div>
              </div>
            )}

            {/* GPS + Signature */}
            {!detailLoading && (gps?.lat != null || signatureUrl) && (
              <div className="flex flex-wrap gap-2">
                {gps?.lat != null && gps?.lng != null && (
                  <a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition">
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
            {!detailLoading && headerFields.length > 0 && (
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

            {/* Check items summary — full report available in Mitti */}
            {!detailLoading && checkItems.length > 0 && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">{checkItems.length} check items across {itemsBySection.length} sections</p>
                <p className="text-xs text-slate-400 mt-1">For the full item-level report, open in Mitti or download the PDF above.</p>
              </div>
            )}

            {/* Action items — with inline management */}
            {!detailLoading && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-900">Action Items ({actionItems.length})</h4>
                  {Object.keys(actionDraft).length > 0 && (
                    <button onClick={handleSaveActions} disabled={savingActions} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50">
                      {savingActions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save Changes
                    </button>
                  )}
                </div>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No action items raised.</p>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map((a, i) => {
                      const draft = actionDraft[i] || {};
                      const currentStatus = draft.status || a.status || 'open';
                      const currentAssignee = draft.assignee !== undefined ? draft.assignee : (a.assignee || '');
                      const currentDue = draft.due_date !== undefined ? draft.due_date : (a.due_date || '');
                      return (
                        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                          <div className="flex items-start gap-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_TONE[a.priority] || PRIORITY_TONE.medium}`}>{(a.priority || 'medium').toUpperCase()}</span>
                            <p className="text-sm text-slate-800 flex-1">{a.description || 'Untitled action'}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="text" value={currentAssignee} onChange={(e) => updateActionField(i, 'assignee', e.target.value)} placeholder="Assignee" className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white" />
                            <input type="date" value={currentDue} onChange={(e) => updateActionField(i, 'due_date', e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white" />
                            <select value={currentStatus} onChange={(e) => updateActionField(i, 'status', e.target.value)} className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-primary bg-white">
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create incident modal */}
      {showIncidentModal && (
        <CreateIncidentFromAuditModal
          audit={audit}
          failedItem={showIncidentModal === 'whole' ? null : showIncidentModal}
          onClose={() => setShowIncidentModal(null)}
        />
      )}
    </>
  );
}