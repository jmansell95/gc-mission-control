import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Plus, Briefcase, Search, LayoutGrid, Download } from 'lucide-react';
import HubShell from '@/components/HubShell';
import HubEmptyState from '@/components/hubs/HubEmptyState';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import HubErrorState from '@/components/hubs/HubErrorState';
import JobStatusFilterBar from '@/components/jobs/JobStatusFilterBar';
import useJobPortfolioStats from '@/components/jobs/useJobPortfolioStats';
import { JOBS_HELP_TOPICS, JOBS_ONBOARDING, JOBS_QUICK_LINKS } from '@/components/jobs/jobsHubContent';
import JobDetail from '@/components/JobDetail';
import JobWizardModal from '@/components/JobWizardModal';
import ReGeocodeJobsButton from '@/components/jobs/ReGeocodeJobsButton';
import JobCreatedModal from '@/components/JobCreatedModal';
import { jsPDF } from 'jspdf';
import { addBrandHeader, addTable, addPageNumbers, formatDate } from '@/lib/pdfStyles';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import JobSummaryCard from '@/components/jobs/JobSummaryCard';
import WorkloadOwnershipPanel from '@/components/jobs/WorkloadOwnershipPanel';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; } catch { return d || '—'; }
};

const fmtDateShort = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM') : '—'; } catch { return d || '—'; }
};

const calcDuration = (start, end) => {
  if (!start || !end) return null;
  try {
    const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
    if (days <= 0) return 1;
    return days;
  } catch { return null; }
};

const jobTypeBadge = {
  drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  groundworks: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  // Legacy types — kept for backward-compatible display of old records
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const jobTypeBar = {
  drilling: 'bg-gradient-to-r from-amber-400 to-orange-500',
  groundworks: 'bg-gradient-to-r from-[#8DC63F] to-[#2E5A1A]',
  // Legacy types — kept for backward-compatible display of old records
  cp_drilling: 'bg-gradient-to-r from-amber-400 to-orange-500',
  rotary_drilling: 'bg-gradient-to-r from-blue-400 to-indigo-500',
  enabling_works: 'bg-gradient-to-r from-purple-400 to-fuchsia-500',
  depot: 'bg-gradient-to-r from-slate-300 to-slate-500',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  in_progress: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  decommissioning: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  completed: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
  on_hold: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  cancelled: 'bg-red-100 text-red-700 ring-1 ring-red-200',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

const emptyForm = {
  name: '', job_reference: '', job_type: '', location: '', required_team_ids: [], status: 'planning',
  start_date: '', end_date: '', client_id: '', contractor_id: '',
  project_manager: '', site_contact_name: '', site_contact_phone: '',
  notes: '', requisition_list_url: '', requisition_list_name: '',
  budget_amount: '', actual_cost: '', meterage: '', client_charge: '', client_charge_description: '',
  equipment_items: []
};

export default function JobManager({ onNavigateRota }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [cloningId, setCloningId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createdJob, setCreatedJob] = useState(null);
  const [view, setView] = useState('jobs'); // 'jobs' | 'projects'

  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, isError, refetch } = useScopedEntity('Job', { queryKey: ['jobs'], limit: 500 });

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const { data: rotas = [] } = useScopedEntity('RotaAssignment', { queryKey: ['rotas-for-jobs'], sort: '-created_date', limit: 5000 });
  const { data: costItems = [] } = useScopedEntity('JobCostItem', { queryKey: ['cost-items-for-jobs'], sort: '-created_date', limit: 5000 });
  const { data: siteAssets = [] } = useQuery({ queryKey: ['site-assets-for-rig-count'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 5000) });

  // Compute crew count (unique staff) and rig count (internal_equipment) per job
  const crewCountByJob = React.useMemo(() => {
    const m = {};
    for (const r of rotas) {
      if (!r.job_id) continue;
      if (!m[r.job_id]) m[r.job_id] = new Set();
      if (r.staff_id) m[r.job_id].add(r.staff_id);
    }
    const out = {};
    for (const [k, s] of Object.entries(m)) out[k] = s.size;
    return out;
  }, [rotas]);
  const rigCountByJob = React.useMemo(() => {
    // Count UNIQUE rigs per job — cross-reference with SiteAsset to only
    // count actual rigs (is_rig / asset_type === 'rig'), NOT lifting gear
    // (shackles, slings, hooks) that are also category 'internal_equipment'.
    const rigAssetIds = new Set();
    for (const a of siteAssets) {
      if (a.is_rig || a.asset_type === 'rig') rigAssetIds.add(a.id);
    }
    const m = {};
    for (const ci of costItems) {
      if (ci.category !== 'internal_equipment') continue;
      if (!ci.site_asset_id) continue;
      if (!rigAssetIds.has(ci.site_asset_id)) continue;
      if (!m[ci.job_id]) m[ci.job_id] = new Set();
      m[ci.job_id].add(ci.site_asset_id);
    }
    const out = {};
    for (const [k, s] of Object.entries(m)) out[k] = s.size;
    return out;
  }, [costItems, siteAssets]);

  const stats = useJobPortfolioStats(jobs, crewCountByJob, rigCountByJob);

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowWizard(true);
  };

  const handleWizardCreated = (savedJob) => {
    setShowWizard(false);
    setEditingJob(null);
    if (savedJob && !editingJob?.id) setCreatedJob(savedJob);
  };

  const handleClone = async (job) => {
    const shiftStr = prompt(`Clone "${job.name}" — shift dates by how many days? (e.g. 7 = one week forward)`, '7');
    if (shiftStr === null) return;
    const shift = parseInt(shiftStr);
    if (isNaN(shift)) { alert('Please enter a valid number of days.'); return; }
    setCloningId(job.id);
    try {
      const res = await fetch('/api/functions/cloneJob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, date_shift_days: shift }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      alert(`Cloned "${job.name}" → "${data.new_job_name}"\n${data.cost_items_copied} cost items, ${data.logistics_copied} logistics, ${data.milestones_copied} milestones copied.`);
    } catch (e) {
      alert('Could not clone job: ' + e.message);
    }
    setCloningId(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure?')) {
      try {
        await base44.entities.Job.delete(id);
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
      } catch (error) {
        console.error('Error deleting job:', error);
      }
    }
  };

  const downloadJobsPDF = () => {
    const doc = new jsPDF();
    addBrandHeader(doc, 'Projects Report', `${jobs.length} projects · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    const rows = jobs.map(j => {
      const jt = getJobPrimaryType(j, teams) || '';
      return [j.name || '', j.location || '', getJobTypeLabel(jt, jobTypes), statusLabels[j.status] || 'Planning', formatDate(j.start_date), formatDate(j.end_date)];
    });
    addTable(doc, ['Project', 'Location', 'Type', 'Status', 'Start', 'End'], rows, 50);
    addPageNumbers(doc);
    doc.save(`projects-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery ||
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.job_reference || '').toLowerCase().includes(searchQuery.toLowerCase());
    const jobStatus = job.status || 'planning';
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && (jobStatus === 'planning' || jobStatus === 'in_progress')) ||
      jobStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedJob) {
    return <JobDetail job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  const openWizard = () => { setEditingJob(null); setShowWizard(true); };

  return (
    <HubShell
      hubKey="jobs"
      icon={Briefcase}
      eyebrow="Projects Hub"
      title="Manage Projects"
      subtitle={`${jobs.length} project${jobs.length === 1 ? '' : 's'} in total`}
      breadcrumbs={[{ label: 'Projects Hub' }]}
      stats={stats}
      help={{ title: 'Projects Hub — how it works', topics: JOBS_HELP_TOPICS }}
      onboarding={JOBS_ONBOARDING}
      quickLinks={JOBS_QUICK_LINKS}
      actions={
        <>
          <button
            type="button"
            onClick={downloadJobsPDF}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition text-ui-caption font-semibold shadow-sm"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Projects PDF</span>
          </button>
          <ReGeocodeJobsButton />
          <button
            type="button"
            onClick={openWizard}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#2E5A1A] text-white rounded-xl hover:bg-[#244715] active:scale-[0.97] transition text-ui-caption font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </>
      }
    >
      {showWizard && (
        <JobWizardModal
          open={showWizard}
          onClose={() => { setShowWizard(false); setEditingJob(null); }}
          onCreated={handleWizardCreated}
          editingJob={editingJob}
        />
      )}

      {/* Workload Ownership — Direct vs Partner split */}
      {jobs.length > 0 && (
        <WorkloadOwnershipPanel />
      )}

      {/* Status buttons + search */}
      {jobs.length > 0 && (
        <JobStatusFilterBar
          jobs={jobs}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Jobs Grid */}
      {view === 'jobs' && (
        <>
          {isLoading ? (
            <HubLoadingState variant="cards" count={6} />
          ) : isError ? (
            <HubErrorState title="Couldn't load projects" onRetry={refetch} />
          ) : jobs.length === 0 ? (
            <HubEmptyState icon={Briefcase} title="No projects yet" description="Add your first project to start scheduling crews and shifts." action={{ label: 'Add Project', onClick: openWizard }} />
          ) : filteredJobs.length === 0 ? (
            <HubEmptyState icon={Search} title="No projects match your search" description="Try a different name, location, or status filter." compact secondaryAction={{ label: 'Clear filters', onClick: () => { setSearchQuery(''); setStatusFilter('all'); } }} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredJobs.map((job) => {
                const client = clients.find(c => c.id === job.client_id);
                const parentClient = client?.parent_client_id ? clients.find(c => c.id === client.parent_client_id) : null;
                return (
                  <JobSummaryCard
                    key={job.id}
                    job={job}
                    client={client}
                    parentClient={parentClient}
                    crewCount={crewCountByJob[job.id] || 0}
                    rigCount={rigCountByJob[job.id] || 0}
                    jobTypes={jobTypes}
                    teams={teams}
                    cloningId={cloningId}
                    onView={(j) => setSelectedJob(j)}
                    onEdit={(j) => handleEdit(j)}
                    onClone={(j) => handleClone(j)}
                    onDelete={(id) => handleDelete(id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {createdJob && (
        <JobCreatedModal
          job={createdJob}
          onView={() => { setSelectedJob(createdJob); setCreatedJob(null); }}
          onBuildRota={onNavigateRota ? () => { onNavigateRota(); setCreatedJob(null); } : undefined}
          onLater={() => setCreatedJob(null)}
          onClose={() => setCreatedJob(null)}
        />
      )}
    </HubShell>
  );
}