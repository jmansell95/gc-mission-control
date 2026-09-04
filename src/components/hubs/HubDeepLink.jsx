import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

/**
 * HubDeepLink — a compact "Open in [Hub]" button placed at the top-right
 * of Job Detail tab content. Navigates to the target hub with ?jobId= so
 * the hub pre-filters to this job and shows a "Back to job" breadcrumb.
 *
 * Bidirectional: the hub reads the same jobId param to show the breadcrumb
 * back here.
 *
 * Props:
 *   to     — hub route path (e.g. '/billing', '/fleet', '/staff')
 *   jobId  — the job ID to filter by
 *   label  — button label (e.g. 'Open in Billing Hub')
 *   icon   — optional lucide icon
 */
export default function HubDeepLink({ to, jobId, label, icon: Icon }) {
  if (!jobId) return null;
  const sep = to.includes('?') ? '&' : '?';
  const url = `${to}${sep}jobId=${jobId}&from=job`;

  return (
    <Link
      to={url}
      className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/5 rounded-lg text-xs font-semibold text-slate-600 hover:text-[#2E5A1A] transition-all duration-200 shadow-sm"
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
      <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}