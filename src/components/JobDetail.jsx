import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, AlertCircle, FileBarChart, Sparkles, PackageCheck, AlertTriangle, MoreHorizontal, Satellite,
} from 'lucide-react';
import FinishJobModal from '@/components/decommissioning/FinishJobModal';
import { format } from 'date-fns';
import PrintReportButton from '@/components/PrintReportButton';
import JobWizardModal from '@/components/JobWizardModal';
import JobDetailHero from '@/components/JobDetailHero';
import { getJobPrimaryType, isDrillingJob as isDrillingJobByTeams, isGroundworksJob as isGroundworksJobByTeams, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import { getCrewLabel } from '@/utils/terminology';
import { canViewCostings } from '@/utils/access';
import { getTotalMetres } from '@/utils/geotechBilling';
import { useAuth } from '@/lib/AuthContext';
import JobStatusModal from '@/components/JobStatusModal';
import JobDetailTabs from '@/components/JobDetailTabs';
import JobWarningsBanner from '@/components/JobWarningsBanner';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

export default function JobDetail({ job: initialJob, onBack, initialTab }) {
  const [job, setJob] = useState(initialJob);
  const queryClient = useQueryClient();

  // Null guard — if job is undefined (e.g. opened from dashboard before data
  // resolved), show a loading state instead of crashing on job.id access.
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500">Loading project details…</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-sm text-[#2E5A1A] font-semibold hover:underline">
            Go back
          </button>
        )}
      </div>
    );
  }
  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e) => { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const primaryType = getJobPrimaryType(job, teams);
  const colors = getJobTypeColor(primaryType, jobTypes);

  const { user: authUser } = useAuth();
  const isPlatformAdmin = authUser?.role === 'admin';
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });
  // Default to true whenever the profile is unavailable (still loading OR the
  // query errored on the published site). Without this, a failed profile fetch
  // permanently hides cost-gated UI (Add Billable Item, Add Rig & Gear, the
  // Financials tab, budget chip, Add Delivery). Once the profile resolves,
  // canViewCostings enforces the real role-based gate. Same pattern as
  // canAccessSection which returns true while the profile is unresolved.
  // isPlatformAdmin (from AuthContext, always available) is passed so a
  // platform admin always sees costs even if the staff profile fails to load.
  const canSeeCosts = !profile || canViewCostings(profile, isPlatformAdmin);

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers-job-detail'], queryFn: () => base44.entities.Supplier.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-for-job', job.id], queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id }) });
  const { data: hotelBookings = [] } = useQuery({ queryKey: ['hotel-bookings-for-job', job.id], queryFn: () => base44.entities.HotelBooking.filter({ job_id: job.id }) });

  const assignedStaffIds = [...new Set(rotas.map(r => r.staff_id))];
  const assignedStaff = assignedStaffIds.map(id => allStaff.find(s => s.id === id)).filter(Boolean);
  const client = clients.find(c => c.id === job.client_id);
  const contractor = contractors.find(c => c.id === job.contractor_id);

  // Live Geotab drivers — vehicles assigned to this job's rotas that have a driver detected by Geotab
  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const liveDrivers = assignedVehicleIds
    .map(vid => vehicles.find(v => v.id === vid))
    .filter(v => v && v.geotab_driver_name)
    .map(v => ({ name: v.geotab_driver_name, vehicle: v.name || v.registration_number }));

  const rotasByDate = {};
  rotas.forEach(r => { if (!rotasByDate[r.assigned_date]) rotasByDate[r.assigned_date] = []; rotasByDate[r.assigned_date].push(r); });
  const sortedDates = Object.keys(rotasByDate).sort();

  const isDrillingJob = isDrillingJobByTeams(job, teams, jobTypes);
  const isGroundworksJob = isGroundworksJobByTeams(job, teams, jobTypes);
  const { data: invLogs = [] } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });
  // Use the centralized getTotalMetres() — same function used by the
  // Boreholes tab and Billing Summary — so the metreage shown in the hero
  // always matches every other view.
  const reconciledMetres = getTotalMetres(invLogs);
  const jobMeterage = isDrillingJob && job.meterage != null && job.meterage !== '' ? Number(job.meterage) : 0;
  const useJobMeterage = jobMeterage > 0;
  const staffCosts = assignedStaff.map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const memberMeterage = memberRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    return { name: member.name, role: roleLabels[member.job_role] || member.job_role, shifts: memberRotas.length, overtimeShifts: memberRotas.filter(r => r.is_overtime).length, meterage: useJobMeterage ? jobMeterage : memberMeterage, cost: 0 };
  });
  const totalCost = 0;
  const totalMeterage = useJobMeterage ? jobMeterage : reconciledMetres;

  const startDate = job.start_date ? new Date(job.start_date + 'T00:00:00') : null;
  const endDate = job.end_date ? new Date(job.end_date + 'T00:00:00') : null;

  const handleFullReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await base44.functions.invoke('generateJobReport', { jobId: job.id });
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err) { console.error('Report generation error:', err); }
    setGeneratingReport(false);
  };

  const handleStatusSave = async (data) => {
    await base44.entities.Job.update(job.id, data);
    setJob(prev => ({ ...prev, ...data }));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleEdit = () => setShowEditWizard(true);

  const handleEditSaved = (savedJob) => {
    setShowEditWizard(false);
    setJob(prev => ({ ...prev, ...savedJob }));
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleDecomStarted = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
    queryClient.invalidateQueries({ queryKey: ['rotas-for-job', job.id] });
    setJob(prev => ({ ...prev, status: 'decommissioning' }));
  };

  const buildJobPrintHtml = () => {
    const staffRows = assignedStaff.map(s => {
      const shifts = rotas.filter(r => r.staff_id === s.id).length;
      return `<tr><td>${s.name}</td><td>${roleLabels[s.job_role] || s.job_role}</td><td>${s.worker_type?.replace(/_/g,' ')}</td><td>${shifts}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><title>Project Report – ${job.name}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:18px;margin-bottom:2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px}table{width:100%;border-collapse:collapse}th{background:#1a5c3a;color:white;padding:5px 8px;text-align:left;font-size:11px}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}@media print{body{margin:10mm}}</style></head><body>
    <h1>${job.name}</h1><div style="color:#555;font-size:11px;margin-bottom:14px">${getJobTypeLabel(primaryType, jobTypes)} · ${job.location} · ${job.start_date} → ${job.end_date || 'TBC'}</div>
    ${assignedStaff.length > 0 ? `<h2>Assigned Staff (${assignedStaff.length})</h2><table><thead><tr><th>Name</th><th>Role</th><th>Type</th><th>Shifts</th></tr></thead><tbody>${staffRows}</tbody></table>` : ''}
    ${job.notes ? `<h2>Notes</h2><p>${job.notes}</p>` : ''}</body></html>`;
  };

  if (showEditWizard) {
    return (
      <JobWizardModal
        open={showEditWizard}
        onClose={() => setShowEditWizard(false)}
        onCreated={handleEditSaved}
        editingJob={job}
      />
    );
  }

  return (
    <div>
      {/* Top bar — compact floating action bar */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#2E5A1A] font-medium transition group flex-shrink-0">
          <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#2E5A1A]/30 group-hover:bg-[#2E5A1A]/5 transition">
            <ArrowLeft className="w-4 h-4" />
          </span>
          <span className="hidden sm:inline">Back to Projects</span>
        </button>
        <div className="flex items-center gap-1.5">
          {job.status === 'in_progress' && (
            <button onClick={() => setShowFinishModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-semibold shadow-sm hover:shadow-md">
              <AlertTriangle className="w-4 h-4" /> <span className="hidden sm:inline">Finish Project</span>
            </button>
          )}
          {job.status === 'decommissioning' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-semibold border border-amber-200">
              <PackageCheck className="w-4 h-4" /> Decommissioning
            </span>
          )}
          <button onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-medium shadow-sm hover:shadow-md">
            <Edit2 className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
          </button>
          {/* Desktop: inline secondary actions */}
          <button onClick={() => setShowStatusModal(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition text-sm font-medium shadow-sm">
            <AlertCircle className="w-4 h-4" /> Status
          </button>
          <div className="hidden sm:block">
            <PrintReportButton buildHtml={buildJobPrintHtml} label="Print" className="px-3 py-2" />
          </div>
          <button onClick={handleFullReport} disabled={generatingReport}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {generatingReport ? '...' : 'Report'}
          </button>
          {/* Mobile: More dropdown for secondary actions */}
          <div className="relative sm:hidden" ref={moreMenuRef}>
            <button onClick={() => setMoreMenuOpen(o => !o)}
              className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium shadow-sm">
              <MoreHorizontal className="w-4 h-4" /> More
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 animate-pop-in">
                <button onClick={() => { setShowStatusModal(true); setMoreMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left">
                  <AlertCircle className="w-4 h-4" /> Status
                </button>
                <div className="px-1">
                  <PrintReportButton buildHtml={buildJobPrintHtml} label="Print" className="w-full justify-start px-2 py-2.5 text-sm text-slate-700 hover:bg-slate-50" />
                </div>
                <button onClick={() => { handleFullReport(); setMoreMenuOpen(false); }} disabled={generatingReport}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> {generatingReport ? 'Generating...' : 'Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFinishModal && (
        <FinishJobModal
          job={job}
          onClose={() => setShowFinishModal(false)}
          onStarted={handleDecomStarted}
        />
      )}

      {/* Modern gradient hero header */}
      <JobDetailHero
        job={job}
        colors={colors}
        statusBadge={statusBadge}
        statusLabels={statusLabels}
        getJobTypeLabel={getJobTypeLabel}
        primaryType={primaryType}
        jobTypes={jobTypes}
        startDate={startDate}
        endDate={endDate}
        assignedStaff={assignedStaff}
        rotas={rotas}
        isDrillingJob={isDrillingJob}
        totalMeterage={totalMeterage}
        canSeeCosts={canSeeCosts}
        onStatusClick={() => setShowStatusModal(true)}
      />

      {/* Intelligent warnings — only shows when there are issues */}
      <div className="mb-4">
        <JobWarningsBanner job={job} assignedStaffCount={assignedStaff.length} />
      </div>

      {/* Live Geotab driver indicator — shows who is driving vehicles assigned to this job */}
      {liveDrivers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-50 border border-cyan-200">
          <Satellite className="w-4 h-4 text-cyan-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-cyan-800">Live Driver:</span>
          {liveDrivers.map((d, i) => (
            <span key={i} className="text-sm text-cyan-700">
              {d.name} <span className="text-cyan-500 text-xs">({d.vehicle})</span>
              {i < liveDrivers.length - 1 && <span className="text-cyan-400 mx-1">·</span>}
            </span>
          ))}
        </div>
      )}

      {/* Unified tabbed command center — no more long scroll */}
      <JobDetailTabs
        job={job}
        initialTab={initialTab}
        primaryType={primaryType}
        assignedStaff={assignedStaff}
        rotas={rotas}
        allStaff={allStaff}
        vehicles={vehicles}
        rotasByDate={rotasByDate}
        sortedDates={sortedDates}
        client={client}
        contractor={contractor}
        suppliers={suppliers}
        contractors={contractors}
        canSeeCosts={canSeeCosts}
        isDrillingJob={isDrillingJob}
        isGroundworksJob={isGroundworksJob}
        totalCost={totalCost}
        staffCosts={staffCosts}
        totalMeterage={totalMeterage}
        hotelBookings={hotelBookings}
        colors={colors}
        statusBadge={statusBadge}
        statusLabels={statusLabels}
        startDate={startDate}
        endDate={endDate}
        jobTypes={jobTypes}
      />

      {showStatusModal && (
        <JobStatusModal job={job} onClose={() => setShowStatusModal(false)} onSave={handleStatusSave} />
      )}
    </div>
  );
}