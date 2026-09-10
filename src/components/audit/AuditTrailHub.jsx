import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Search, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import JobPackView from '@/components/audit/JobPackView';
import GeneratePackButton from '@/components/audit/GeneratePackButton';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

/**
 * ISO-compliant Audit Trail hub.
 * Auditors request "Job Packs" — a complete start-to-finish traceability
 * record for each job. This page lets them search for a job and expand a
 * full audit pack: who was on it, what they did, compliance sign-offs,
 * equipment, commercial confirmations, and a chronological timeline.
 */
export default function AuditTrailHub() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedJob, setExpandedJob] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-audit'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-audit'],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-audit'],
    queryFn: () => base44.entities.Contractor.list(),
  });

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);
  const contractorMap = useMemo(() => Object.fromEntries(contractors.map(c => [c.id, c.name])), [contractors]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return jobs.filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (j.name || '').toLowerCase().includes(q) ||
        (j.job_reference || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q) ||
        (j.project_manager || '').toLowerCase().includes(q)
      );
    });
  }, [jobs, query, statusFilter]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={History} title="Audit Trail & Job Packs" description="ISO-compliant audit trail — search for a job and expand its full Job Pack" />
      {/* Context banner — distinguishes this from the System Audit Log */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Job Pack audit trail</span> — ISO-compliant per-job traceability. For system-level entity mutations, use the <span className="font-semibold">System Log</span> tab.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Jobs" value={jobs.length} />
        <StatTile label="In Progress" value={jobs.filter(j => j.status === 'in_progress').length} />
        <StatTile label="Completed" value={jobs.filter(j => j.status === 'completed').length} />
        <StatTile label="Planning" value={jobs.filter(j => j.status === 'planning').length} />
      </div>

      {/* Search & filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by job name, reference, location or project manager..."
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 bg-white transition"
          >
            <option value="all">All statuses</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="decommissioning">Decommissioning</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of {jobs.length} jobs. Click a job to expand its full audit pack.
        </p>
      </div>

      {/* Job list */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-[#2E5A1A]/20 border-t-[#2E5A1A] rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400 mt-3">Loading audit jobs…</p>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No jobs match your search.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or status filter.</p>
          </div>
        )}
        {filtered.map(job => {
          const isExpanded = expandedJob === job.id;
          const borderColors = {
            planning: 'border-l-blue-400',
            in_progress: 'border-l-[#2E5A1A]',
            decommissioning: 'border-l-amber-400',
            completed: 'border-l-slate-400',
            on_hold: 'border-l-orange-400',
            cancelled: 'border-l-red-400',
          };
          const borderCls = borderColors[job.status] || 'border-l-slate-300';
          return (
            <div key={job.id} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderCls} shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isExpanded ? 'shadow-md' : ''}`}>
              <button
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-slate-50/70 transition text-left"
              >
                {isExpanded
                  ? <ChevronDown className="w-5 h-5 text-[#2E5A1A] flex-shrink-0" />
                  : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                    {job.job_reference && (
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {job.job_reference}
                      </span>
                    )}
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {job.location || 'No location'}
                    {clientMap[job.client_id] && ` · ${clientMap[job.client_id]}`}
                    {contractorMap[job.contractor_id] && ` · Contractor: ${contractorMap[job.contractor_id]}`}
                    {job.start_date && ` · ${job.start_date}`}
                    {job.end_date && ` → ${job.end_date}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <GeneratePackButton job={job} clientName={clientMap[job.client_id]} />
                </div>
                <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/70 to-slate-50/30">
                  <JobPackView job={job} clientName={clientMap[job.client_id]} contractorName={contractorMap[job.contractor_id]} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] uppercase text-slate-400 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    planning: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-[#2E5A1A]/15 text-[#2E5A1A] border-[#2E5A1A]/20',
    decommissioning: 'bg-amber-100 text-amber-700 border-amber-200',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    on_hold: 'bg-orange-100 text-orange-700 border-orange-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
  };
  const dotColors = {
    planning: 'bg-blue-500',
    in_progress: 'bg-[#2E5A1A]',
    decommissioning: 'bg-amber-500',
    completed: 'bg-slate-400',
    on_hold: 'bg-orange-500',
    cancelled: 'bg-red-500',
  };
  const cls = styles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] || 'bg-slate-400'}`} />
      {(status || 'unknown').replace('_', ' ')}
    </span>
  );
}