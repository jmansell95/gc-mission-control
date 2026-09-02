import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Users, HardHat, FileText, ShieldCheck, Truck, PoundSterling,
  Camera, ClipboardList, Calendar, MapPin, Building2, User,
  Layers, FlaskConical, Activity, FileCheck, Download, Printer, X,
  ChevronRight, Clock, Package, Loader2,
} from 'lucide-react';
import { generateJobPackPDF } from '@/components/audit/JobPackReport';

/**
 * The expandable "Job Pack" for a single job — an ISO-compliant audit trail
 * aggregating every traceable record: personnel, technical activity,
 * compliance sign-offs, equipment, commercial confirmations, documents,
 * and a merged chronological timeline.
 */
export default function JobPackView({ job, clientName, contractorName }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const { data: assignments = [] } = useQuery({
    queryKey: ['rota-audit', job.id],
    queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id }),
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-audit'],
    queryFn: () => base44.entities.Staff.list(),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['inv-logs-audit', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['job-assets-audit', job.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id }),
  });
  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items-audit', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }),
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['job-docs-audit', job.id],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: job.id }),
  });
  const { data: photos = [] } = useQuery({
    queryKey: ['site-photos-audit', job.id],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: job.id }),
  });
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones-audit', job.id],
    queryFn: () => base44.entities.JobMilestone.filter({ job_id: job.id }),
  });
  const { data: comments = [] } = useQuery({
    queryKey: ['comments-audit', job.id],
    queryFn: () => base44.entities.JobComment.filter({ job_id: job.id }),
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries-audit', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id }),
  });
  const { data: briefings = [] } = useQuery({
    queryKey: ['briefings-audit', job.id],
    queryFn: () => base44.entities.BriefingSignature.filter({ job_id: job.id }),
  });

  const staffMap = useMemo(() => Object.fromEntries(staffList.map(s => [s.id, s.name])), [staffList]);

  // Approved logs only for the formal audit view
  const approvedLogs = logs.filter(l => l.manager_review_status === 'approved');
  const queriedLogs = logs.filter(l => l.manager_review_status === 'queried');
  const pendingLogs = logs.filter(l => l.manager_review_status === 'pending');

  const confirmedQuotes = costItems.filter(c => c.price_confirmed && c.negotiated_unit_cost != null);

  // Build a merged chronological timeline
  const timeline = useMemo(() => {
    const events = [];

    events.push({
      time: job.created_date,
      icon: Calendar,
      color: 'blue',
      title: 'Job created',
      detail: `Job "${job.name}" was created${job.job_reference ? ` (ref: ${job.job_reference})` : ''}.`,
    });
    if (job.status_changed_at) {
      events.push({
        time: job.status_changed_at,
        icon: Activity,
        color: 'emerald',
        title: `Status changed to "${(job.status || '').replace(/_/g, ' ')}"`,
        detail: job.status_reason ? `Reason: ${job.status_reason}` : null,
      });
    }

    assignments.forEach(a => {
      if (a.arrived_on_site_at) events.push({
        time: a.arrived_on_site_at, icon: MapPin, color: 'emerald',
        title: `${staffMap[a.staff_id] || 'Staff'} arrived on site`,
        detail: `Assignment for ${a.assigned_date}`,
      });
      if (a.briefing_signed_at) events.push({
        time: a.briefing_signed_at, icon: ShieldCheck, color: 'blue',
        title: `${staffMap[a.staff_id] || 'Staff'} signed briefing`,
        detail: `Briefing completed for ${a.assigned_date}`,
      });
      if (a.started_at) events.push({
        time: a.started_at, icon: Clock, color: 'emerald',
        title: `${staffMap[a.staff_id] || 'Staff'} started shift`,
        detail: a.start_time ? `Shift start: ${a.start_time}` : null,
      });
      if (a.completed_at) events.push({
        time: a.completed_at, icon: Clock, color: 'slate',
        title: `${staffMap[a.staff_id] || 'Staff'} completed shift`,
        detail: a.progress_notes ? `Notes: ${a.progress_notes}` : null,
      });
    });

    logs.forEach(l => {
      if (l.created_at) events.push({
        time: l.created_at, icon: FlaskConical, color: 'violet',
        title: `${l.log_type?.replace(/_/g, ' ') || 'Activity'} — ${l.borehole_ref || l.sample_id || 'site'}`,
        detail: l.description || (l.source === 'ags_import' ? 'Imported from KeyLogBook AGS' : null),
        tag: l.source === 'ags_import' ? 'AGS' : l.manager_review_status,
      });
    });

    briefings.forEach(b => {
      events.push({
        time: b.created_date || b.created_date, icon: ShieldCheck, color: 'blue',
        title: `Briefing signed by ${b.staff_name || b.signed_by_name || 'staff'}`,
        detail: b.job_briefing_summary || 'Site briefing & induction sign-off',
      });
    });

    documents.forEach(d => {
      events.push({
        time: d.created_date, icon: FileText, color: 'amber',
        title: `Document uploaded: ${d.document_name}`,
        detail: `Category: ${d.category?.replace(/_/g, ' ')}`,
      });
    });

    photos.forEach(p => {
      events.push({
        time: p.created_date, icon: Camera, color: 'cyan',
        title: `Site photo${p.caption ? `: ${p.caption}` : ''}`,
        detail: p.uploaded_by_name ? `By ${p.uploaded_by_name}` : null,
      });
    });

    deliveries.forEach(d => {
      events.push({
        time: d.created_date || d.completed_at, icon: Truck, color: 'amber',
        title: `Delivery${d.item_description ? `: ${d.item_description}` : ''}`,
        detail: d.status ? `Status: ${d.status}` : null,
      });
    });

    confirmedQuotes.forEach(c => {
      if (c.confirmed_at) events.push({
        time: c.confirmed_at, icon: FileCheck, color: 'emerald',
        title: `Price confirmed: ${c.description}`,
        detail: `£${Number(c.negotiated_unit_cost).toFixed(2)}/${c.unit_label} by ${c.confirmed_by_name || '—'}${c.quote_document_name ? ` · doc: ${c.quote_document_name}` : ''}`,
      });
    });

    milestones.forEach(m => {
      if (m.completed_date || m.target_date) events.push({
        time: m.completed_date || m.target_date, icon: ClipboardList, color: 'indigo',
        title: `Milestone${m.title ? `: ${m.title}` : ''}`,
        detail: m.completed_date ? 'Completed' : 'Target date',
      });
    });

    return events.filter(e => e.time).sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [job, assignments, logs, briefings, documents, photos, deliveries, confirmedQuotes, milestones, staffMap]);

  const sections = [
    { id: 'overview', label: 'Overview', icon: ClipboardList, count: null },
    { id: 'personnel', label: 'Personnel', icon: Users, count: assignments.length },
    { id: 'activity', label: 'Technical Activity', icon: FlaskConical, count: logs.length },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck, count: briefings.length },
    { id: 'equipment', label: 'Equipment', icon: Truck, count: assets.length + costItems.length },
    { id: 'commercial', label: 'Commercial', icon: PoundSterling, count: confirmedQuotes.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: documents.length + photos.length },
    { id: 'timeline', label: 'Timeline', icon: Activity, count: timeline.length },
  ];

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateJobPackPDF({
        job, clientName, contractorName,
        data: { assignments, staffMap, logs, briefings, assets, costItems, documents, photos, milestones, deliveries, timeline },
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="p-4 space-y-4 print:p-0">
      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5 print:hidden bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-slate-200">
        {sections.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          const tabColors = {
            overview: 'from-emerald-500 to-teal-600',
            personnel: 'from-blue-500 to-indigo-600',
            activity: 'from-violet-500 to-purple-600',
            compliance: 'from-emerald-500 to-green-600',
            equipment: 'from-amber-500 to-orange-600',
            commercial: 'from-emerald-500 to-teal-600',
            documents: 'from-slate-500 to-slate-600',
            timeline: 'from-indigo-500 to-blue-600',
          };
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? `bg-gradient-to-br ${tabColors[s.id] || 'from-emerald-500 to-teal-600'} text-white shadow-md`
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
              {s.count != null && (
                <span className={`text-[10px] px-1.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-slate-100'}`}>{s.count}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={handleDownloadPDF}
          disabled={generatingPDF}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-60"
        >
          {generatingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {generatingPDF ? 'Generating…' : 'Download Audit PDF'}
        </button>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">{job.name} — Audit Job Pack</h1>
        <p className="text-sm text-slate-600">Reference: {job.job_reference || 'N/A'} · Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        <hr className="mt-3" />
      </div>

      {activeSection === 'overview' && <OverviewSection job={job} clientName={clientName} contractorName={contractorName} counts={{ personnel: assignments.length, logs: logs.length, approved: approvedLogs.length, queried: queriedLogs.length, briefings: briefings.length, assets: assets.length, costItems: costItems.length, confirmed: confirmedQuotes.length, documents: documents.length, photos: photos.length, milestones: milestones.length, comments: comments.length }} />}
      {activeSection === 'personnel' && <PersonnelSection assignments={assignments} staffMap={staffMap} />}
      {activeSection === 'activity' && <ActivitySection approvedLogs={approvedLogs} queriedLogs={queriedLogs} pendingLogs={pendingLogs} />}
      {activeSection === 'compliance' && <ComplianceSection briefings={briefings} logs={logs} />}
      {activeSection === 'equipment' && <EquipmentSection assets={assets} costItems={costItems} />}
      {activeSection === 'commercial' && <CommercialSection costItems={costItems} confirmedQuotes={confirmedQuotes} />}
      {activeSection === 'documents' && <DocumentsSection documents={documents} photos={photos} />}
      {activeSection === 'timeline' && <TimelineSection events={timeline} />}
    </div>
  );
}

// ============================================================
// Section: Overview
// ============================================================
function OverviewSection({ job, clientName, contractorName, counts }) {
  const fields = [
    { icon: Building2, label: 'Client', value: clientName || '—' },
    { icon: HardHat, label: 'Contractor', value: contractorName || '—' },
    { icon: MapPin, label: 'Location', value: job.location || '—' },
    { icon: User, label: 'Project Manager', value: job.project_manager || '—' },
    { icon: Calendar, label: 'Start Date', value: job.start_date || '—' },
    { icon: Calendar, label: 'End Date', value: job.end_date || '—' },
    { icon: Activity, label: 'Status', value: (job.status || '—').replace(/_/g, ' ') },
    { icon: FileText, label: 'Job Reference', value: job.job_reference || '—' },
  ];

  const summaryCards = [
    { icon: Users, label: 'Personnel Records', value: counts.personnel, color: 'blue' },
    { icon: FlaskConical, label: 'Activity Logs', value: counts.logs, sub: `${counts.approved} approved · ${counts.queried} queried`, color: 'violet' },
    { icon: ShieldCheck, label: 'Briefing Sign-offs', value: counts.briefings, color: 'emerald' },
    { icon: Truck, label: 'Equipment Items', value: counts.assets + counts.costItems, color: 'amber' },
    { icon: FileCheck, label: 'Confirmed Prices', value: counts.confirmed, color: 'emerald' },
    { icon: Camera, label: 'Photos', value: counts.photos, color: 'cyan' },
    { icon: FileText, label: 'Documents', value: counts.documents, color: 'slate' },
    { icon: ClipboardList, label: 'Milestones', value: counts.milestones, color: 'indigo' },
  ];

  const gradientMap = {
    blue: 'stat-gradient-blue',
    violet: 'stat-gradient-violet',
    emerald: 'stat-gradient-emerald',
    amber: 'stat-gradient-amber',
    cyan: 'stat-gradient-cyan',
    slate: 'stat-gradient-slate',
    indigo: 'stat-gradient-indigo',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm print:border-0 print:p-2">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-600" /> Job Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/60">
                <Icon className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{f.label}</p>
                  <p className="text-sm font-medium text-slate-800 truncate">{f.value}</p>
                </div>
              </div>
            );
          })}
        </div>
        {job.notes && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-600">{job.notes}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className={`rounded-xl p-3.5 text-white shadow-md ${gradientMap[c.color]} transition-transform hover:scale-[1.02]`}>
              <div className="flex items-center justify-between mb-1">
                <Icon className="w-5 h-5 opacity-80" />
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-95">{c.label}</p>
              {c.sub && <p className="text-[10px] opacity-75 mt-0.5">{c.sub}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Section: Personnel
// ============================================================
function PersonnelSection({ assignments, staffMap }) {
  if (!assignments.length) return <EmptySection icon={Users} message="No personnel assigned to this job." />;
  const sorted = [...assignments].sort((a, b) => (a.assigned_date || '').localeCompare(b.assigned_date || ''));
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden print:border-0">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            <th className="px-3 py-2">Staff Member</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Shift</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Briefing</th>
            <th className="px-3 py-2">Arrived</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map(a => (
            <tr key={a.id} className="hover:bg-slate-50/50">
              <td className="px-3 py-2 font-medium text-slate-800">{staffMap[a.staff_id] || 'Unknown'}</td>
              <td className="px-3 py-2 text-slate-600">{a.assigned_date || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{a.start_time || '—'} → {a.end_time || '—'}</td>
              <td className="px-3 py-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                  {(a.status || 'assigned').replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-3 py-2">
                {a.briefing_signed
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">Signed {a.briefing_signed_at ? format(new Date(a.briefing_signed_at), 'dd MMM HH:mm') : ''}</span>
                  : <span className="text-xs text-slate-400">Not signed</span>}
              </td>
              <td className="px-3 py-2 text-slate-600 text-xs">
                {a.arrived_on_site_at ? format(new Date(a.arrived_on_site_at), 'dd MMM HH:mm') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Section: Technical Activity
// ============================================================
function ActivitySection({ approvedLogs, queriedLogs, pendingLogs }) {
  const allLogs = [...approvedLogs, ...queriedLogs, ...pendingLogs]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (!allLogs.length) return <EmptySection icon={FlaskConical} message="No technical activity logs recorded for this job." />;
  return (
    <div className="space-y-3">
      {(pendingLogs.length > 0 || queriedLogs.length > 0) && (
        <div className="flex gap-2 text-xs">
          {pendingLogs.length > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">{pendingLogs.length} pending review</span>}
          {queriedLogs.length > 0 && <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">{queriedLogs.length} queried</span>}
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">{approvedLogs.length} approved</span>
        </div>
      )}
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 print:border-0">
        {allLogs.map(l => (
          <div key={l.id} className="px-3 py-2.5 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FlaskConical className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{(l.log_type || 'activity').replace(/_/g, ' ')}</p>
                {l.borehole_ref && <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{l.borehole_ref}</span>}
                {l.sample_id && <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{l.sample_id}</span>}
                {l.source === 'ags_import' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium">AGS Import</span>}
                <ReviewBadge status={l.manager_review_status} />
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{l.description || 'No description'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {l.date || '—'} · {l.staff_name || '—'}
                {l.depth_from != null && l.depth_to != null && ` · ${l.depth_from}m–${l.depth_to}m`}
                {l.spt_n_value != null && ` · SPT N=${l.spt_n_value}`}
                {l.coring_rqd != null && ` · RQD ${l.coring_rqd}%`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Section: Compliance
// ============================================================
function ComplianceSection({ briefings, logs }) {
  const approvedLogs = logs.filter(l => l.manager_review_status === 'approved');
  const queriedLogs = logs.filter(l => l.manager_review_status === 'queried');
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Briefing Sign-offs ({briefings.length})
        </h3>
        {briefings.length === 0 ? (
          <p className="text-xs text-slate-400">No briefing signatures recorded.</p>
        ) : (
          <div className="space-y-2">
            {briefings.map(b => (
              <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{b.staff_name || b.signed_by_name || 'Staff member'}</p>
                  <p className="text-xs text-slate-500">{b.created_date ? format(new Date(b.created_date), 'dd MMM yyyy HH:mm') : '—'}{b.job_briefing_summary ? ` · ${b.job_briefing_summary}` : ''}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Signed</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-600" /> Log Review Trail
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-emerald-50">
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{approvedLogs.length}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Approved</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50">
            <p className="text-xl font-bold text-amber-700 tabular-nums">{logs.filter(l => l.manager_review_status === 'pending').length}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Pending</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50">
            <p className="text-xl font-bold text-red-700 tabular-nums">{queriedLogs.length}</p>
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Queried</p>
          </div>
        </div>
        {queriedLogs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {queriedLogs.map(l => (
              <div key={l.id} className="text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                <span className="font-semibold text-red-800">{l.log_type?.replace(/_/g, ' ')} — {l.borehole_ref || 'site'}</span>
                {l.manager_review_note && <p className="text-red-700 mt-0.5">Review note: {l.manager_review_note}</p>}
                <p className="text-red-500 mt-0.5">Reviewed by {l.manager_reviewed_by || '—'} on {l.manager_reviewed_at ? format(new Date(l.manager_reviewed_at), 'dd MMM yyyy') : '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Section: Equipment
// ============================================================
function EquipmentSection({ assets, costItems }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-600" /> Assets on Site ({assets.length})
        </h3>
        {assets.length === 0 ? (
          <p className="text-xs text-slate-400">No assets assigned.</p>
        ) : (
          <div className="space-y-1.5">
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{a.asset_name || 'Asset'}</p>
                  <p className="text-xs text-slate-500">{a.role?.replace(/_/g, ' ')} · assigned {a.assigned_date || '—'}{a.returned_date ? ` · returned ${a.returned_date}` : ''}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{a.status || 'assigned'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <PoundSterling className="w-4 h-4 text-emerald-600" /> Cost Items ({costItems.length})
        </h3>
        {costItems.length === 0 ? (
          <p className="text-xs text-slate-400">No cost items recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {costItems.map(c => {
              const isPOA = c.is_poa && !c.price_confirmed;
              return (
                <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{c.description}</p>
                    <p className="text-xs text-slate-500">{c.quantity || 1} {c.unit_label}{(c.quantity || 1) > 1 ? 's' : ''} · {c.category?.replace(/_/g, ' ')}</p>
                  </div>
                  {isPOA
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">POA</span>
                    : c.price_confirmed
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">Confirmed £{Number(c.negotiated_unit_cost).toFixed(2)}</span>
                      : <span className="text-sm font-semibold text-slate-700">£{Number(c.unit_cost || 0).toFixed(2)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Section: Commercial
// ============================================================
function CommercialSection({ costItems, confirmedQuotes }) {
  const totalConfirmed = confirmedQuotes.reduce((s, c) => s + (Number(c.negotiated_unit_cost) || 0) * (Number(c.quantity) || 1), 0);
  const poaItems = costItems.filter(c => c.is_poa && !c.price_confirmed);
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-600" /> Confirmed Prices ({confirmedQuotes.length})
        </h3>
        {confirmedQuotes.length === 0 ? (
          <p className="text-xs text-slate-400">No confirmed prices recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {confirmedQuotes.map(c => (
              <div key={c.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{c.description}</p>
                  <p className="text-xs text-slate-600">£{Number(c.negotiated_unit_cost).toFixed(2)}/{c.unit_label} × {c.quantity || 1} = <span className="font-semibold">£{(Number(c.negotiated_unit_cost) * (Number(c.quantity) || 1)).toFixed(2)}</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Confirmed by {c.confirmed_by_name || '—'} on {c.confirmed_at ? format(new Date(c.confirmed_at), 'dd MMM yyyy HH:mm') : '—'}
                    {c.quote_document_name && ` · evidence: ${c.quote_document_name}`}
                  </p>
                </div>
                {c.quote_document_url && (
                  <a href={c.quote_document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1 flex-shrink-0">
                    <FileText className="w-3 h-3" /> View
                  </a>
                )}
              </div>
            ))}
            <div className="pt-2 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Total confirmed value:</span>
              <span className="text-lg font-bold text-emerald-700">£{totalConfirmed.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
      {poaItems.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 print:border-0">
          <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> Outstanding POA Items ({poaItems.length})
          </h3>
          <p className="text-xs text-amber-700 mb-2">These items have been added but their prices have not yet been confirmed — no commercial value is recorded for them.</p>
          <div className="space-y-1">
            {poaItems.map(c => (
              <div key={c.id} className="text-xs text-amber-800 flex items-center gap-2">
                <ChevronRight className="w-3 h-3" />
                <span>{c.description}</span>
                <span className="text-amber-500">· {c.quantity || 1} {c.unit_label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section: Documents
// ============================================================
function DocumentsSection({ documents, photos }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-600" /> Documents ({documents.length})
        </h3>
        {documents.length === 0 ? (
          <p className="text-xs text-slate-400">No documents uploaded.</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map(d => (
              <div key={d.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.document_name}</p>
                  <p className="text-xs text-slate-500">{d.category?.replace(/_/g, ' ')}{d.uploaded_by_name ? ` · by ${d.uploaded_by_name}` : ''}{d.created_date ? ` · ${format(new Date(d.created_date), 'dd MMM yyyy')}` : ''}</p>
                </div>
                <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">View</a>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-600" /> Site Photos ({photos.length})
        </h3>
        {photos.length === 0 ? (
          <p className="text-xs text-slate-400">No site photos recorded.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {photos.map(p => (
              <div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                {p.photo_url || p.url
                  ? <img src={p.photo_url || p.url} alt={p.caption || ''} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Camera className="w-5 h-5 text-slate-300" /></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Section: Timeline
// ============================================================
function TimelineSection({ events }) {
  if (!events.length) return <EmptySection icon={Activity} message="No timeline events recorded." />;
  const colorMap = {
    blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-violet-100 text-violet-700', amber: 'bg-amber-100 text-amber-700',
    cyan: 'bg-cyan-100 text-cyan-700', slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 print:border-0">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-slate-600" /> Chronological Audit Trail ({events.length} events)
      </h3>
      <div className="space-y-0">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
              {i < events.length - 1 && <div className="absolute left-3.5 top-7 bottom-0 w-px bg-slate-200" />}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${colorMap[e.color] || colorMap.slate}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-slate-800">{e.title}</p>
                {e.detail && <p className="text-xs text-slate-600 mt-0.5">{e.detail}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {e.time ? format(new Date(e.time), 'dd MMM yyyy · HH:mm') : '—'}
                  {e.tag && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{e.tag}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Shared
// ============================================================
function EmptySection({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
        <Icon className="w-5 h-5 text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

function ReviewBadge({ status }) {
  const styles = {
    approved: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    queried: 'bg-red-100 text-red-700',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[status] || styles.pending}`}>{(status || 'pending')}</span>;
}