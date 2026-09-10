import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';

/**
 * RecurringFailuresPanel — highlights check questions that fail
 * repeatedly across audits. Fetches all SafetyReports, then for each
 * one fetches the full audit detail to extract individual check items,
 * and aggregates items that appear as 'fail' in multiple audits.
 *
 * Note: This uses the stored raw_payload (truncated) for item-level data.
 * Audits without stored payloads are skipped.
 */
export default function RecurringFailuresPanel() {
  const [expanded, setExpanded] = useState(null);
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-recurring'],
    queryFn: () => base44.entities.SafetyReport.filter({ pass_fail: 'fail' }, '-created_date', 100),
  });

  // For each failed audit, try to extract check item labels from the
  // stored raw_payload. We don't call getMittiAuditDetail for each one
  // (too many API calls) — instead we parse the truncated raw_payload
  // client-side for a best-effort label extraction.
  const recurringFailures = useMemo(() => {
    const labelCounts = {};
    for (const r of reports) {
      if (!r.auditor_staff_id) continue;
      if (!r.raw_payload) continue;
      try {
        const payload = JSON.parse(r.raw_payload);
        // Best-effort extraction of failed item labels
        const items = payload?.audit_data?.items || payload?.items || payload?.audit?.items || [];
        const bodyItems = payload?.audit_data?.body_items || payload?.body_items || [];
        const allItems = [...items, ...bodyItems];
        for (const item of allItems) {
          if (!item || typeof item !== 'object') continue;
          const children = item.items || item.children || item.sub_items;
          if (Array.isArray(children) && children.length > 0) {
            for (const child of children) {
              const label = child.label || child.title || child.name || child.question || '';
              const response = String(child.value || child.response || child.answer || '').toLowerCase();
              if (label && ['fail', 'unsafe', 'no', 'non-compliant', 'defective', 'broken', 'missing'].includes(response)) {
                const key = String(label).trim();
                if (!labelCounts[key]) labelCounts[key] = { label: key, count: 0, audits: [] };
                labelCounts[key].count++;
                labelCounts[key].audits.push({
                  auditTitle: r.audit_title || r.audit_template_name,
                  auditor: r.auditor_name,
                  date: r.conducted_at || r.created_date,
                  jobName: r.job_name,
                });
              }
            }
          }
        }
      } catch (e) { /* skip unparseable payloads */ }
    }
    return Object.values(labelCounts)
      .filter(f => f.count >= 2) // Only show items that failed 2+ times
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [reports]);

  return (
    <HubCard icon={RotateCcw} title="Recurring Failures" subtitle="Check items that fail repeatedly across audits" tone="rose">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : recurringFailures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No recurring failures detected</p>
          <p className="text-xs text-slate-400 mt-1">Either no audits have failed, or failures aren't repeating.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {recurringFailures.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center gap-2.5 p-3 hover:bg-slate-50/60 transition text-left"
              >
                {expanded === i ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800 flex-1 truncate">{f.label}</p>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  {f.count}× failed
                </span>
              </button>
              {expanded === i && (
                <div className="px-3 pb-3 pt-1 space-y-1">
                  {f.audits.map((a, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs text-slate-500 pl-11">
                      <span className="font-medium text-slate-700 truncate">{a.auditTitle || 'Untitled'}</span>
                      <span>· {a.auditor || '—'}</span>
                      {a.jobName && <span>· {a.jobName}</span>}
                      <span>· {a.date ? new Date(a.date).toLocaleDateString('en-GB') : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </HubCard>
  );
}