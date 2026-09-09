import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Search, FileText, Download, Loader2, Package, X, ChevronRight,
  Calendar, MapPin, Building2, FileCheck, Archive, Zap,
} from 'lucide-react';
import { findGeotechnicalDivision } from '@/utils/staffCompliance';
import JobPackView from '@/components/audit/JobPackView';
import JobPackCoverageBadge from '@/components/compliance/JobPackCoverageBadge';

/**
 * Job Packs Tab — lets managers select a Geotechnical job and download the
 * full cradle-to-grave auditor pack (personnel, technical activity, compliance,
 * equipment, commercial, documents, timeline). Also shows previously generated
 * JobPack records.
 */
export default function JobPacksTab() {
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: geoDivision, isLoading: isLoadingDiv } = useQuery({
    queryKey: ['geotechnical-division'],
    queryFn: () => findGeotechnicalDivision(base44),
    staleTime: 60000,
  });

  const divisionId = geoDivision?.id;

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['geo-jobs-packs', divisionId],
    queryFn: () => base44.entities.Job.filter({ division_id: divisionId }, '-created_date', 500),
    enabled: !!divisionId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-packs'],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-for-packs'],
    queryFn: () => base44.entities.Contractor.list(),
  });

  // Previously generated packs
  const { data: existingPacks = [] } = useQuery({
    queryKey: ['job-packs-geo', divisionId],
    queryFn: () => base44.entities.JobPack.filter({ pack_type: 'full_auditor_pack' }, '-generated_at', 50),
    enabled: !!divisionId,
  });

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);
  const contractorMap = useMemo(() => Object.fromEntries(contractors.map(c => [c.id, c.name])), [contractors]);

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(j =>
        j.name?.toLowerCase().includes(q) ||
        j.job_reference?.toLowerCase().includes(q) ||
        j.location?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, search]);

  if (isLoadingDiv) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!geoDivision) {
    return (
      <div className="insight-card rounded-2xl p-6 text-center">
        <Package className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No Geotechnical division found</p>
      </div>
    );
  }

  // If a job is selected, show the full JobPackView
  if (selectedJob) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedJob(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to job list
          </button>
          <div className="text-xs text-slate-400">
            Auditor Pack · {selectedJob.name}
          </div>
        </div>
        <div className="insight-card rounded-2xl overflow-hidden">
          <JobPackView
            job={selectedJob}
            clientName={clientMap[selectedJob.client_id]}
            contractorName={contractorMap[selectedJob.contractor_id]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Intro callout */}
      <div className="hub-glass rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Auditor Job Packs — Cradle to Grave</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a project to view the full audit trail — personnel, technical activity, compliance sign-offs,
            equipment, commercial confirmations, documents, photos, and a merged chronological timeline.
            Download as a PDF for auditors.
          </p>
        </div>
      </div>

      {/* Previously generated packs */}
      {existingPacks.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" /> Previously Generated Packs
          </p>
          <div className="space-y-2">
            {existingPacks.slice(0, 5).map(p => (
              <div key={p.id} className="hub-glass rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.job_name}</p>
                  <p className="text-xs text-slate-500">
                    v{p.version} · {p.document_reference} · {p.generated_at ? format(new Date(p.generated_at), 'dd MMM yyyy') : '—'}
                    {p.generated_by_name && ` · by ${p.generated_by_name}`}
                  </p>
                </div>
                {p.file_url && (
                  <a href={p.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search projects by name, reference, or location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Job list */}
      {isLoadingJobs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No projects found</p>
          <p className="text-xs text-slate-400 mt-1">
            {search ? 'Try a different search.' : 'No Geotechnical projects exist yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              clientName={clientMap[job.client_id]}
              onClick={() => setSelectedJob(job)}
            />
          ))}
          {filteredJobs.length > 0 && (
            <p className="text-[10px] text-slate-400 text-center pt-2">
              {filteredJobs.length} Geotechnical project{filteredJobs.length !== 1 ? 's' : ''} · Click any project to view the full auditor pack
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Job row
// ============================================================
function JobRow({ job, clientName, onClick }) {
  const statusColors = {
    planning: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-emerald-100 text-emerald-700',
    decommissioning: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
  };

  return (
    <button
      onClick={onClick}
      className="w-full hub-glass rounded-2xl p-3.5 flex items-center gap-3 text-left hover:shadow-md transition-all active:scale-[0.99] group"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[job.status] || statusColors.planning}`}>
            {(job.status || 'planning').replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
          {job.job_reference && <span className="font-mono">{job.job_reference}</span>}
          {clientName && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {clientName}</span>}
          {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <JobPackCoverageBadge jobId={job.id} compact />
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
          <Download className="w-3.5 h-3.5" /> Pack
        </span>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
      </div>
    </button>
  );
}