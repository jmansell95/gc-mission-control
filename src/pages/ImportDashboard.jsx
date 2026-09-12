import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  Users, Briefcase, CalendarDays, Trash2, HardHat, AlertCircle, RefreshCw,
  ChevronDown, ChevronRight, MapPin, Building2, UserX, Layers, Clock,
  Palmtree, Thermometer, GraduationCap, Building, Filter, Warehouse, X, History
} from 'lucide-react';
import ImportCompleteModal from '@/components/import/ImportCompleteModal';
import ImportProgressModal from '@/components/import/ImportProgressModal';
import PurgeCompletedJobsPanel from '@/components/import/PurgeCompletedJobsPanel';
import { Link } from 'react-router-dom';

export default function ImportDashboard() {
  const { toast } = useToast();
  const { activeDivisionId } = useDivision();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setFileUrl(null); setPreview(null); setError(null); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgressModal({
      steps: [{ label: 'Uploading spreadsheet' }, { label: 'Parsing tabs & date columns' }, { label: 'Matching staff, jobs & rigs' }, { label: 'Building preview' }],
      currentStep: 0,
      complete: false,
      title: '',
      message: '',
      error: null,
    });
    try {
      // Stagger the step indicator so the user sees progress while the single
      // backend call runs (the call itself is atomic — we can't get real-time
      // progress from it, so we advance the visual indicator on a timer).
      const stepTimer = setInterval(() => {
        setProgressModal(prev => prev && !prev.complete ? { ...prev, currentStep: Math.min(prev.currentStep + 1, prev.steps.length - 1) } : prev);
      }, 3000);
      await runAnalysis();
      clearInterval(stepTimer);
      setProgressModal(prev => ({
        ...prev,
        currentStep: prev.steps.length,
        complete: true,
        title: 'Analysis complete',
        message: 'Review the full breakdown below, then confirm to apply the import.',
        error: null,
      }));
    } catch (e) {
      setError(e.message || 'Analysis failed');
      setProgressModal(prev => ({ ...prev, complete: false, error: e.message || 'Analysis failed' }));
    } finally {
      setUploading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalysing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('importPlannerSpreadsheet', { file, dry_run: true, division_id: activeDivisionId, active_only: activeOnly });
      setPreview(res.data);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Analysis failed';
      setError(msg);
      throw e;
    } finally {
      setAnalysing(false);
    }
  };

  const [applyPhase, setApplyPhase] = useState('');
  const [progressModal, setProgressModal] = useState(null); // { steps, currentStep, complete, title, message, error }

  const handleApply = async () => {
    if (!file) return;
    setApplying(true);
    setError(null);
    const phases = [
        { label: 'Jobs & purge', params: { dry_run: false, skip_purge_and_jobs: false, write_phase: 'rotas' } },
        { label: 'Cost items', params: { dry_run: false, skip_purge_and_jobs: true, write_phase: 'cost_items' } },
        { label: 'Training & absences', params: { dry_run: false, skip_purge_and_jobs: true, write_phase: 'training_absences' } },
      ];
    setProgressModal({ steps: phases.map(p => ({ label: p.label })), currentStep: 0, complete: false, title: '', message: '', error: null });
    try {
      const phaseResults = [];
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        setApplyPhase(phase.label);
        setProgressModal(prev => ({ ...prev, currentStep: i }));
        const res = await base44.functions.invoke('importPlannerSpreadsheet', { file, ...phase.params, division_id: activeDivisionId, active_only: activeOnly });
        phaseResults.push(res.data);
      }
      // Merge the 3 phase summaries into one result for the completion modal
      const r1 = phaseResults[0]?.summary || {};
      const r2 = phaseResults[1]?.summary || {};
      const r3 = phaseResults[2]?.summary || {};
      const mergedResult = {
        ...phaseResults[phaseResults.length - 1],
        summary: {
          ...r1,
          ...r3,
          rotas: { created: r1.rotas?.created || 0, duplicates_collapsed: r1.rotas?.duplicates_collapsed || 0 },
          rig_assignments: { created: r2.rig_assignments?.created || 0, total: r2.rig_assignments?.total || 0 },
          crew_cost_items: { created: r2.crew_cost_items?.created || 0, total: r2.crew_cost_items?.total || 0 },
          training: { ...r3.training, bookings_created: r3.training?.bookings_created || 0 },
          absences: { ...r3.absences, created: r3.absences?.created || 0 },
          jobs: r1.jobs || {},
          purge: r1.purge || {},
        },
      };
      setApplyResult(mergedResult);
      // Clear the progress modal — the ImportCompleteModal takes over to
      // show the full results breakdown.
      setProgressModal(null);
      toast({
        title: 'Import complete',
        description: `Created ${r1.jobs?.new || 0} jobs, ${r1.rotas?.created || 0} rotas, ${r2.rig_assignments?.created || 0} rig assignments, ${r2.crew_cost_items?.created || 0} crew cost items, ${r3.training?.bookings_created || 0} training bookings, ${r3.absences?.created || 0} absences.`
      });
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Import failed';
      setError(msg);
      setProgressModal(prev => ({ ...prev, complete: false, error: msg }));
    } finally {
      setApplying(false);
      setApplyPhase('');
    }
  };

  const handleReset = () => {
    setApplyResult(null);
    setPreview(null);
    setFile(null);
    setFileUrl(null);
    setError(null);
    setProgressModal(null);
  };

  return (
    <div className="page-bg-vibrant min-h-screen p-4 md:p-6 space-y-6">
      {/* Prehistoric import link */}
      <Link to="/prehistoric-import" className="block">
        <div className="hub-glass rounded-2xl p-4 flex items-center gap-3 hover:shadow-lg transition group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center flex-shrink-0">
            <History className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Prehistoric Data Import →</p>
            <p className="text-xs text-slate-500">Import a full legacy archive with a preview pane and field matching. Self-isolated, with an automatic backup snapshot.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
        </div>
      </Link>

      {/* Purge completed jobs */}
      <PurgeCompletedJobsPanel />

      {/* Upload Card */}
      <div className="hub-glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Upload Spreadsheet</h2>
        <p className="text-sm text-slate-500 mb-4">
           Select your <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">.xlsx</code> planner file. Only two tabs are processed: <strong>"Team Planner 2026_GW+Depot"</strong> (groundworks &amp; depot staff) and <strong>"Drillers"</strong> (drilling crews &amp; rig assignments). All other tabs are ignored. Every import <strong>rebuilds jobs, rotas, and cost items</strong> from the spreadsheet — <strong>staff, teams, and crew member types are never touched</strong>; the import matches names only.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label className="flex-1 cursor-pointer">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl px-4 py-6 text-center hover:border-emerald-500 hover:bg-emerald-50/40 transition">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <UploadCloud className="w-6 h-6" />
                  <span className="text-sm">Click to choose a file</span>
                </div>
              )}
            </div>
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading || analysing}
            className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition hover:shadow-lg"
          >
            {uploading || analysing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? 'Uploading…' : 'Analysing…'}</>
            ) : (
              <><UploadCloud className="w-4 h-4" /> Upload &amp; Analyse</>
            )}
          </button>
        </div>

        {/* Clean-slate warning */}
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><strong>Import Guard:</strong> Staff, teams, and crew member types are <strong>never modified</strong> — the import matches names only and skips anyone not found in Staff Command. Add missing staff manually in Staff Command first, then re-import. The import rebuilds jobs, rotas, rig assignments, cost items, training bookings, and absences in 3 phases to avoid timeouts on large files.</span>
        </div>

        {/* Active-only filter toggle */}
        <div className="mt-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <Filter className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">Active jobs only</p>
            <p className="text-xs text-emerald-700">When on, only planning &amp; in-progress jobs are imported — completed jobs are excluded. Turn off to import everything.</p>
          </div>
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${activeOnly ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${activeOnly ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Review Breakdown — Popup Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Review Import Breakdown</h2>
                <p className="text-sm text-slate-500">
                  Date range: <span className="font-medium text-slate-700">{preview.summary.date_range.from}</span> →{' '}
                  <span className="font-medium text-slate-700">{preview.summary.date_range.to}</span>
                  <span className="ml-2 text-xs text-slate-400">(today: {preview.summary.today})</span>
                </p>
              </div>
              <button onClick={() => { setPreview(null); setFile(null); setFileUrl(null); }} disabled={applying} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Active-only status filter info */}
          <div className="hub-glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-800">Status Filter</h3>
              <span className="text-xs text-slate-400 ml-auto">
                {activeOnly ? 'Only active jobs (planning + in-progress) will be imported' : 'All statuses will be imported'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                activeOnly ? 'bg-emerald-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'
              }`}>
                <span>Active</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeOnly ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>
                  {(preview.summary.jobs?.planning || 0) + (preview.summary.jobs?.in_progress || 0)}
                </span>
              </span>
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                !activeOnly ? 'bg-slate-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'
              }`}>
                <span>Completed</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${!activeOnly ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>
                  {preview.summary.jobs?.completed || 0}
                </span>
              </span>
              {activeOnly && (preview.summary.skipped_by_active_filter || 0) > 0 && (
                <span className="text-xs text-amber-600 font-medium ml-1">
                  {preview.summary.skipped_by_active_filter} completed job(s) excluded by the active-only filter
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Change the filter with the toggle above the upload area, then click "Upload &amp; Analyse" again.
            </p>
          </div>

          {/* Summary tiles */}
          <div className="hub-glass rounded-2xl p-6">

            {/* Full wipe summary */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-800">Records That Will Be Replaced</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.jobs_deleted}</span> jobs</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.crews_deleted}</span> crews</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.rotas_deleted}</span> rotas</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.asset_assignments_deleted}</span> asset assignments</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.cost_items_deleted || 0}</span> cost items</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.training_bookings_deleted || 0}</span> training bookings</div>
                <div className="bg-white rounded-lg px-3 py-2"><span className="text-red-600 font-bold">{preview.summary.purge.absences_deleted || 0}</span> absences</div>
                <div className="bg-emerald-50 rounded-lg px-3 py-2 col-span-2"><span className="text-emerald-600 font-bold">✓</span> <span className="text-emerald-700">Staff, teams &amp; crew types never touched</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              <StatTile icon={Users} label="Staff" total={preview.summary.staff.total} sub={`${preview.summary.staff.found || 0} matched · ${preview.summary.staff.unmatched_skipped || 0} unmatched`} color="blue" />
              <StatTile icon={Briefcase} label="Jobs" total={preview.summary.jobs.total} sub={`${preview.summary.jobs.new} new`} color="emerald" />
              <StatTile icon={CalendarDays} label="Rotas" total={preview.summary.rotas.to_create} sub={`${preview.summary.rotas.carried_forward || 0} merged`} color="amber" />
              <StatTile icon={UserX} label="Unmatched" total={preview.summary.staff.unmatched_skipped || 0} sub="add in Staff Command" color="rose" />
              <StatTile icon={CheckCircle2} label="Completed Jobs" total={preview.summary.jobs.completed} sub="past dates" color="slate" />
              <StatTile icon={Clock} label="In Progress" total={preview.summary.jobs.in_progress} sub="today/future" color="teal" />
              <StatTile icon={Layers} label="Projects" total={(preview.summary.projects?.existing_matched || 0) + (preview.summary.projects?.new_created || 0)} sub={`${preview.summary.projects?.new_created || 0} new`} color="violet" />
              <StatTile icon={HardHat} label="Crew Cost Items" total={preview.summary.crew_cost_items?.total || 0} sub={`${preview.summary.crew_cost_items?.labour || 0} labour · ${preview.summary.crew_cost_items?.contractor_supplied || 0} subcon`} color="teal" />
              <StatTile icon={GraduationCap} label="Training" total={(preview.summary.training?.courses_new || 0) + (preview.summary.training?.courses_matched || 0)} sub={`${preview.summary.training?.bookings_created || 0} bookings`} color="indigo" />
              <StatTile icon={Palmtree} label="Absences" total={preview.summary.absences?.created || 0} sub={`${preview.summary.absences?.holiday || 0} hol · ${preview.summary.absences?.sick || 0} sick`} color="rose" />
              {preview.summary.jobs?.filtered_as_non_jobs > 0 && (
                <StatTile icon={Filter} label="Filtered" total={preview.summary.jobs.filtered_as_non_jobs} sub="not real jobs" color="amber" />
              )}
            </div>

            {/* Filtered non-job entries — cells that looked like jobs but were rejected by the second-layer filter */}
            {preview.summary.jobs?.filtered_labels?.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <Filter className="w-4 h-4" /> Filtered as Non-Jobs ({preview.summary.jobs.filtered_as_non_jobs} entries)
                </p>
                <p className="text-xs text-amber-700 mb-2">These cells in the planner were treated as overhead/non-job days instead of being created as Job entities (rig names, placeholders, generic terms).</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.summary.jobs.filtered_labels.map((label, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-1 font-medium">{label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Subcon / Agency / Direct split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <HardHat className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-900">Subcontractors: {preview.summary.staff.subcontractors}</p>
                  <p className="text-xs text-indigo-700">→ matched to existing staff (never modified)</p>
                </div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-900">Agency: {preview.summary.staff.agency}</p>
                  <p className="text-xs text-cyan-700">→ matched to existing staff (never modified)</p>
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Direct Employees: {preview.summary.staff.direct_employees}</p>
                  <p className="text-xs text-emerald-700">→ matched to existing staff (never modified)</p>
                </div>
              </div>
            </div>

            {/* Agency breakdown — workers grouped by supplying agency */}
            {preview.summary.agencies?.total > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> Agency Suppliers ({preview.summary.agencies.total})
                </p>
                <div className="space-y-2">
                  {Object.entries(preview.summary.agencies.breakdown).map(([agencyName, data], i) => (
                    <div key={i} className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <span className="text-sm font-medium text-cyan-900">{agencyName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-cyan-700">
                        <span><strong>{data.workers}</strong> workers</span>
                        <span><strong>{data.assignments}</strong> assignments</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Non-job days (Annual Leave / Sick / Training) */}
            {preview.summary.non_job_assignments && (preview.summary.non_job_assignments.annual_leave + preview.summary.non_job_assignments.sick + preview.summary.non_job_assignments.training + (preview.summary.non_job_assignments.yard_depot || 0)) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Palmtree className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-teal-900">Annual Leave: {preview.summary.non_job_assignments.annual_leave}</p>
                    <p className="text-xs text-teal-700">days off (Off, Holiday, Golf day, AL)</p>
                  </div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Thermometer className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rose-900">Sick: {preview.summary.non_job_assignments.sick}</p>
                    <p className="text-xs text-rose-700">sick days</p>
                  </div>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-violet-900">Training: {preview.summary.non_job_assignments.training}</p>
                    <p className="text-xs text-violet-700">training course days</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Warehouse className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Yard/Depot: {preview.summary.non_job_assignments.yard_depot || 0}</p>
                    <p className="text-xs text-amber-700">bench days (non-billable)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sections detected */}
            {preview.summary.sections_detected?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Sections Detected ({preview.summary.sections_detected.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {preview.summary.sections_detected.map((s, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy sheets (processed as historical data) */}
            {preview.summary.legacy?.sheet_count > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Legacy Tabs Also Processed ({preview.summary.legacy.sheet_count}) — Historical Data
                </p>
                <p className="text-xs text-amber-700 mb-2">{preview.summary.legacy.assignment_count} assignments from these tabs are matched to staff &amp; jobs and added as completed historical rotas.</p>
                <div className="flex flex-wrap gap-2">
                  {preview.summary.legacy.sheets.map((s, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-700 rounded-full px-3 py-1 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Sheets breakdown */}
            {preview.sheet_breakdown?.length > 0 && (
              <CollapsibleSection title={`Sheets Parsed (${preview.sheet_breakdown.length})`} icon={FileSpreadsheet}>
                <div className="space-y-2">
                  {preview.sheet_breakdown.map((s, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{s.sheet}</span>
                          {s.is_plant && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Plant</span>}
                          {s.is_legacy && <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">Legacy</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{s.assignments} assignments</span>
                          <span>{s.sections} sections</span>
                          {s.date_range ? (
                            <span className="text-emerald-600 font-medium">{s.date_range.from} → {s.date_range.to}</span>
                          ) : (
                            <span className="text-amber-600">no dates</span>
                          )}
                        </div>
                      </div>
                      {s.diag && s.diag.dateHeaderRowIdx >= 0 && (
                        <div className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                          <p className="font-medium text-slate-600">Date header at row {s.diag.dateHeaderRowIdx} · {s.diag.dateColumnCount} columns mapped</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(s.diag.allCols || s.diag.sampleCols || []).map((c, ci) => (
                              <span key={ci} className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 font-mono">{c.col}: {c.date}</span>
                            ))}
                          </div>
                          {s.diag.rawHeaderRow && s.diag.rawHeaderRow.length > 0 && (
                            <div className="mt-1.5">
                              <p className="text-slate-400">Raw header row (first 20 cols):</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {s.diag.rawHeaderRow.map((c, ci) => (
                                  <span key={ci} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-mono text-[10px]">{c.col}: {c.val === null ? '∅' : c.val}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.diag.rawFirstDataRow && s.diag.rawFirstDataRow.length > 0 && (
                            <div className="mt-1.5">
                              <p className="text-slate-400">Raw first data row (first 20 cols):</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {s.diag.rawFirstDataRow.map((c, ci) => (
                                  <span key={ci} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-mono text-[10px]">{c.col}: {c.val === null ? '∅' : c.val}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Warnings */}
            {preview.summary.warnings?.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">Warnings</p>
                </div>
                <ul className="space-y-1">
                  {preview.summary.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Leavers */}
          {preview.leavers?.length > 0 && (
            <div className="hub-glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <UserX className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  Staff Not in Spreadsheet ({preview.leavers.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                These staff have linked login accounts but don't appear in this spreadsheet. They are <strong>not modified</strong> — the import never touches staff records.
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {preview.leavers.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">{l.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{l.email}</span>
                    </div>
                    <span className="text-xs text-rose-600 font-medium">Will be deactivated</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff breakdown */}
          {preview.staff_breakdown?.length > 0 && (
            <CollapsibleSection title={`Staff Breakdown (${preview.staff_breakdown.length})`} icon={Users} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.staff_breakdown.map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{s.name}</span>
                        {s.status === 'new' && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                        <span className={`text-xs rounded-full px-2 py-0.5 ${s.worker_type === 'subcontractor' ? 'bg-indigo-100 text-indigo-700' : s.worker_type === 'agency' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.worker_type === 'subcontractor' ? 'Subcon' : s.worker_type === 'agency' ? 'Agency' : 'Direct'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{s.assignment_count} assignments</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📧 {s.email}</span>
                      <span>👥 {s.team}</span>
                      {s.agency_name && <span>🏢 {s.agency_name}</span>}
                      {s.job_title && <span>🔧 {s.job_title}</span>}
                      {s.date_range && <span>📅 {s.date_range.from} → {s.date_range.to}</span>}
                    </div>
                    {s.non_job_days?.length > 0 && (
                      <div className="text-xs mt-1 flex flex-wrap gap-1">
                        {s.non_job_days.map((d, i) => (
                          <span key={i} className={`rounded-full px-2 py-0.5 font-medium ${d.type === 'annual_leave' ? 'bg-teal-100 text-teal-700' : d.type === 'sick' ? 'bg-rose-100 text-rose-700' : d.type === 'yard_depot' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                            {d.date}: {d.type === 'annual_leave' ? 'AL' : d.type === 'sick' ? 'Sick' : d.type === 'yard_depot' ? 'Yard' : 'Training'}{d.label && d.label !== d.type ? ` (${d.label})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.jobs.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        Jobs: {s.jobs.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Projects breakdown — jobs grouped by project */}
          {preview.jobs_breakdown?.length > 0 && (() => {
            const projectGroups = {};
            preview.jobs_breakdown.forEach(j => {
              const pname = j.project_name || 'Standalone (no project)';
              if (!projectGroups[pname]) projectGroups[pname] = { jobs: [], is_new: j.project_is_new };
              projectGroups[pname].jobs.push(j);
            });
            const projectNames = Object.keys(projectGroups);
            if (projectNames.length === 0 || (projectNames.length === 1 && projectNames[0] === 'Standalone (no project)')) return null;
            return (
              <CollapsibleSection title={`Projects Breakdown (${projectNames.length} projects)`} icon={Layers} defaultOpen={false}>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {projectNames.map((pname, pi) => {
                    const group = projectGroups[pname];
                    return (
                      <div key={pi} className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Layers className="w-3.5 h-3.5 text-violet-600" />
                          <span className="text-sm font-semibold text-violet-900">{pname}</span>
                          {group.is_new && <span className="text-xs bg-violet-200 text-violet-800 rounded-full px-2 py-0.5 font-medium">NEW</span>}
                          <span className="text-xs text-violet-600 ml-auto">{group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1">
                          {group.jobs.map((j, ji) => (
                            <div key={ji} className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-violet-100">
                              <span className="font-medium text-slate-700 truncate flex-1">{j.name}</span>
                              {j.location && <span className="text-slate-400 inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{j.location}</span>}
                              <StatusBadge status={j.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Jobs breakdown */}
          {preview.jobs_breakdown?.length > 0 && (
            <CollapsibleSection title={`Jobs Breakdown (${preview.jobs_breakdown.length})`} icon={Briefcase} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.jobs_breakdown.map((j, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{j.name}</span>
                        {j.status_new === 'new' && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {j.reference && <span>🏷️ {j.reference}</span>}
                      {j.location && <span><MapPin className="w-3 h-3 inline" /> {j.location}</span>}
                      <span>📅 {j.start_date || '—'} → {j.end_date || '—'}</span>
                      <span>👷 {j.staff_count} staff</span>
                      <span>📋 {j.assignment_count} assignments</span>
                    </div>
                    <div className="text-xs mt-1 flex flex-wrap gap-1.5">
                      {j.project_name && (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium ${j.project_is_new ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          <Layers className="w-3 h-3" /> {j.project_name}{j.project_is_new ? ' (new)' : ''}
                        </span>
                      )}
                      {j.crew_sections.length > 0 && (
                        <span className="text-slate-400">Sections: {j.crew_sections.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* New teams */}
          {preview.new_teams?.length > 0 && (
            <CollapsibleSection title={`New Teams (${preview.new_teams.length})`} icon={Building2}>
              <div className="flex flex-wrap gap-2">
                {preview.new_teams.map((t, i) => (
                  <span key={i} className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 font-medium">{t}</span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* New projects */}
          {preview.summary.projects?.new_site_names?.length > 0 && (
            <CollapsibleSection title={`New Projects (${preview.summary.projects.new_site_names.length})`} icon={Layers} defaultOpen={false}>
              <div className="flex flex-wrap gap-2">
                {preview.summary.projects.new_site_names.map((p, i) => (
                  <span key={i} className="text-sm bg-violet-50 text-violet-700 rounded-lg px-3 py-1.5 font-medium">{p}</span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Training breakdown */}
          {preview.training_breakdown?.length > 0 && (
            <CollapsibleSection title={`Training Courses (${preview.training_breakdown.length})`} icon={GraduationCap} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.training_breakdown.map((t, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{t.title}</span>
                        {t.is_new && <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">NEW</span>}
                        <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === 'completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.status === 'completed' ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{t.staff_count} staff</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {t.start_date}{t.end_date !== t.start_date ? ` → ${t.end_date}` : ''}</span>
                      <span>🏷️ {t.category}</span>
                      <span>👥 {t.staff_names.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Absence breakdown */}
          {preview.absence_breakdown?.length > 0 && (
            <CollapsibleSection title={`Absences (${preview.absence_breakdown.length})`} icon={Palmtree} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.absence_breakdown.map((a, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{a.staff_name}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${a.reason === 'holiday' ? 'bg-teal-100 text-teal-700' : a.reason === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                          {a.reason === 'holiday' ? 'Holiday' : a.reason === 'sick' ? 'Sick' : 'Training'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{a.days} day{a.days !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 {a.start_date}{a.end_date !== a.start_date ? ` → ${a.end_date}` : ''}</span>
                      {a.notes && <span>📝 {a.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Rig & Equipment matching summary */}
          {preview.summary.rig_assignments && (
            <div className="hub-glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">Rig &amp; Equipment Matching</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                <div className="bg-amber-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-amber-600">{preview.summary.rig_assignments.total}</p>
                  <p className="text-xs text-amber-600">Total Assignments</p>
                </div>
                <div className="bg-emerald-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-emerald-600">{preview.summary.rig_assignments.rigs || 0}</p>
                  <p className="text-xs text-emerald-600">Rigs</p>
                </div>
                <div className="bg-indigo-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-indigo-600">{preview.summary.rig_assignments.linked_equipment || 0}</p>
                  <p className="text-xs text-indigo-600">Linked Gear</p>
                </div>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-blue-600">{preview.summary.rig_assignments.drilling_methods_enriched || 0}</p>
                  <p className="text-xs text-blue-600">Drill Methods Set</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-slate-600">{preview.summary.rig_assignments.match_breakdown?.exact || 0}</p>
                  <p className="text-xs text-slate-500">Exact Matches</p>
                </div>
                <div className="bg-violet-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xl font-bold text-violet-600">{(preview.summary.rig_assignments.match_breakdown?.serial || 0) + (preview.summary.rig_assignments.match_breakdown?.fuzzy || 0)}</p>
                  <p className="text-xs text-violet-600">Serial + Fuzzy</p>
                </div>
              </div>

              {/* Fuzzy matches */}
              {preview.summary.rig_assignments.fuzzy_matches?.length > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 mb-3">
                  <p className="text-sm font-semibold text-violet-800 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Fuzzy / Serial Matches ({preview.summary.rig_assignments.fuzzy_matches.length})
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {preview.summary.rig_assignments.fuzzy_matches.map((m, i) => (
                      <div key={i} className="text-xs text-violet-700 flex items-center gap-2">
                        <span className="bg-violet-100 rounded px-1.5 py-0.5 font-medium">{m.score}%</span>
                        <span className="line-through text-slate-400">{m.query}</span>
                        <span>→</span>
                        <span className="font-medium">{m.matched}</span>
                        <span className="text-violet-400">({m.method})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched asset names */}
              {preview.summary.rig_assignments.unmatched_asset_names?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Unmatched Plant ({preview.summary.rig_assignments.unmatched_asset_names.length}) — no SiteAsset found
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {preview.summary.rig_assignments.unmatched_asset_names.map((name, i) => (
                      <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New rig & equipment assignments */}
          {preview.new_rig_assignments?.length > 0 && (
            <CollapsibleSection title={`Rig & Gear Assignments (${preview.new_rig_assignments.length})`} icon={Layers} defaultOpen={false}>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {preview.new_rig_assignments.map((ra, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{ra.asset_name}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${ra.role === 'primary_rig' ? 'bg-amber-100 text-amber-700' : ra.role === 'trailer' ? 'bg-blue-100 text-blue-700' : ra.role === 'lifting' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {ra.role === 'primary_rig' ? 'Rig' : ra.role === 'trailer' ? 'Trailer' : ra.role === 'lifting' ? 'Lifting' : 'Machinery'}
                        </span>
                        {ra.rig_type && ra.rig_type !== 'n/a' && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 uppercase">{ra.rig_type}</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{ra.assigned_date || '—'}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span>→ {ra.job_name}</span>
                      {ra.on_site_days > 0 && (
                        <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">{ra.on_site_days} day{ra.on_site_days !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Rota Conflicts — Global Rota Registry */}
          {preview.conflicts?.length > 0 && (
            <div className="hub-glass rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  Rota Conflicts ({preview.conflicts.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                These staff are double-booked on the same date — assigned to multiple jobs or yard/depot simultaneously. Review and resolve in the Weekly Rota Builder after import.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {preview.conflicts.map((c, i) => (
                  <div key={i} className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-slate-700">{c.staff_name}</span>
                      <span className="text-xs text-rose-600 font-medium">{c.date}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${c.winner_type === 'yard_depot' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        ✓ {c.winner_type === 'yard_depot' ? `🏭 ${c.winner}` : `📍 ${c.winner}`}
                      </span>
                      <span className="text-xs text-slate-400">over</span>
                      <span className={`text-xs rounded-full px-2.5 py-1 font-medium line-through opacity-70 ${c.dropped_type === 'yard_depot' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.dropped_type === 'yard_depot' ? `🏭 ${c.dropped}` : `📍 ${c.dropped}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm bar */}
          <div className="hub-glass rounded-2xl p-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Confirming will <strong>delete all existing jobs, rotas, rig assignments, cost items, training bookings, and absences</strong>, then rebuild them from the two active tabs. <strong>Staff, teams, and crew member types are never touched</strong> — the import matches names only and skips anyone not in Staff Command. The import runs in 3 phases to avoid timeouts on large files.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={applying}
                className="command-gradient text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition hover:shadow-lg"
              >
                {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> {applyPhase ? `Applying: ${applyPhase}…` : 'Applying…'}</> : <><CheckCircle2 className="w-4 h-4" /> Confirm &amp; Apply Import</>}
              </button>
              <button
                onClick={() => { setPreview(null); setFile(null); setFileUrl(null); }}
                disabled={applying}
                className="px-5 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      {!preview && !analysing && (
        <div className="hub-glass rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">How it works</h2>
          <ol className="space-y-3 text-sm text-slate-600">
            <Step n={1} title="Upload your planner file">The Excel file is uploaded and parsed directly — no third-party AI involved.</Step>
            <Step n={2} title="Only two tabs are processed">The <strong>"Team Planner 2026_GW+Depot"</strong> tab rebuilds groundworks/depot staff, jobs, teams and rotas. The <strong>"Drillers"</strong> tab rebuilds drilling crews and links rigs to their jobs. Every other tab is completely ignored — no legacy import.</Step>
            <Step n={3} title="Date-aware job status">Jobs with all past dates are marked <strong>completed</strong>. Jobs with any today/future dates are marked <strong>in_progress</strong>. New jobs with no dates yet are <strong>planning</strong>.</Step>
            <Step n={4} title="Import Guard — match only, never overwrite">Staff, teams, and crew member types are managed manually in Staff Command and Team Manager. The import <strong>matches names only</strong> — it never creates, updates, or deletes staff records. Unmatched staff are skipped with a warning so you can add them manually before re-importing.</Step>
            <Step n={5} title="Absences &amp; training">Non-job days (holiday, sick, training) create Absence records in the Absence Manager — grouped by staff and week. Training courses create TrainingCourse + TrainingBooking records linked to staff.</Step>
            <Step n={6} title="Full breakdown review">See every staff member, every job, every section, every sheet, and every warning before you confirm — so you can drill down and verify everything is correct.</Step>
            <Step n={7} title="Phased rebuild">On confirm, the import runs in 3 phases to avoid timeouts on large files: (1) jobs &amp; rotas, (2) rig &amp; crew cost items, (3) training &amp; absences. Each phase does less work so it completes within the serverless timeout.</Step>
          </ol>
        </div>
      )}

      {/* Completion pop-up modal */}
      {applyResult && <ImportCompleteModal result={applyResult} onClose={handleReset} type="planner" />}

      {/* Progress modal — shown during analyze and apply */}
      {progressModal && (
        <ImportProgressModal
          open={!!progressModal}
          steps={progressModal.steps}
          currentStep={progressModal.currentStep}
          complete={progressModal.complete}
          completeTitle={progressModal.title}
          completeMessage={progressModal.message}
          error={progressModal.error}
          onClose={() => setProgressModal(null)}
        />
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, total, sub, color }) {
  const colors = {
    blue: 'stat-gradient-blue', emerald: 'stat-gradient-emerald',
    amber: 'stat-gradient-amber', rose: 'stat-gradient-rose',
    slate: 'stat-gradient-slate', teal: 'stat-gradient-teal',
    violet: 'stat-gradient-violet', indigo: 'stat-gradient-indigo',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-4 text-white`}>
      <Icon className="w-5 h-5 mb-2 opacity-80" />
      <p className="text-2xl font-bold tabular-nums">{total}</p>
      <p className="text-xs opacity-90">{label}</p>
      {sub && <p className="text-[11px] mt-1 bg-white/20 rounded-full px-2 py-0.5 inline-block">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Completed', cls: 'bg-slate-200 text-slate-700' },
    in_progress: { label: 'In Progress', cls: 'bg-teal-100 text-teal-700' },
    planning: { label: 'Planning', cls: 'bg-blue-100 text-blue-700' },
  };
  const cfg = map[status] || map.planning;
  return <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cfg.cls}`}>{cfg.label}</span>;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="hub-glass rounded-2xl p-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{n}</span>
      <div>
        <p className="font-medium text-slate-700" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="text-slate-500" dangerouslySetInnerHTML={{ __html: children }} />
      </div>
    </li>
  );
}