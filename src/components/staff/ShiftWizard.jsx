import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, MapPin, Car, Clock, CheckCircle2, AlertTriangle, ShieldCheck,
  PlayCircle, ClipboardCheck, ChevronRight, Briefcase, Coffee, Send,
  Ruler, FileText, Info, Timer, Loader2, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import JobBriefingModal from '@/components/staff/JobBriefingModal';
import EndOfShiftWizard from '@/components/staff/EndOfShiftWizard';
import WorkingStep from '@/components/staff/WorkingStep';
import DailyChecksStep from '@/components/staff/DailyChecksStep';
import DepotShiftWizard from '@/components/staff/DepotShiftWizard';
import WeatherCard from '@/components/staff/WeatherCard';
import JobContextCard from '@/components/staff/JobContextCard';
import ShiftStepRail from '@/components/staff/ShiftStepRail';
import MittiSafetyPrompt from '@/components/staff/MittiSafetyPrompt';
import MittiVerificationBadge from '@/components/staff/MittiVerificationBadge';
import SafetyFormsList from '@/components/staff/SafetyFormsList';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';
import { useMittiCheckStatus } from '@/hooks/useMittiCheckStatus';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useGeofenceDetection } from '@/hooks/useGeofenceDetection';
import useEffectiveSettings from '@/hooks/useEffectiveSettings';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

// ── Arrive Step ──────────────────────────────────────────────────────────
function ArriveStep({ job, jobLocation, inductionRequired, saving, staffId, vehicleId, assignment }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [departHome, setDepartHome] = useState('');
  const [arriveSite, setArriveSite] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [gpsPrefilled, setGpsPrefilled] = useState(false);
  const [geofencePrefilled, setGeofencePrefilled] = useState(false);
  const { powraUrl } = useMittiCheckLinks();
  const { isConnected: mittiConnected, powraVerified, powraAt } = useMittiCheckStatus({
    assignmentId: assignment?.id,
    staffId,
    jobDate: assignment?.assigned_date,
  });

  // Fetch Geotab auto-generated travel times for today to pre-fill the form
  const { data: geotabEntries = [] } = useQuery({
    queryKey: ['geotab-travel-today', staffId, today],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today, source: 'geotab_auto' }),
    enabled: !!staffId,
  });

  // Pre-fill from the first geotab_auto travel_to entry
  useEffect(() => {
    if (gpsPrefilled) return;
    const travelTo = geotabEntries.find(t => t.task_type === 'travel_to');
    if (travelTo && travelTo.travel_depart_home && travelTo.travel_arrive_site) {
      setDepartHome(travelTo.travel_depart_home);
      setArriveSite(travelTo.travel_arrive_site);
      setGpsPrefilled(true);
    }
  }, [geotabEntries, gpsPrefilled]);

  // Real-time geofence detection — combines phone GPS + vehicle Geotab data
  const { onSite: onSiteDetected, arrivalTime: geofenceArrival, source: detectionSource, phoneOnSite, vehicleOnSite } = useGeofenceDetection({
    job,
    vehicleId,
    staffId,
    enabled: !!job?.site_lat && !!job?.site_lng,
  });

  // Auto-fill arrival time from geofence detection
  useEffect(() => {
    if (geofencePrefilled) return;
    if (geofenceArrival && onSiteDetected) {
      setArriveSite(geofenceArrival);
      setGeofencePrefilled(true);
    }
  }, [geofenceArrival, onSiteDetected, geofencePrefilled]);

  const useMyLocation = () => {
    const now = new Date();
    setArriveSite(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const travelMins = departHome && arriveSite
    ? (() => {
        const [dh, dm] = departHome.split(':').map(Number);
        const [ah, am] = arriveSite.split(':').map(Number);
        const m = ah * 60 + am - (dh * 60 + dm);
        return m > 0 ? m : 0;
      })()
    : 0;
  const invalidTime = departHome && arriveSite && travelMins === 0;
  const canConfirm = departHome && arriveSite && !invalidTime && !saving;

  return (
    <div className="space-y-4 px-5 py-2">
      {jobLocation && (
        <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 break-words">{jobLocation}</p>
        </div>
      )}

      {/* GPS info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-3">
        <Car className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-900 leading-relaxed">
          {gpsPrefilled
            ? "Your travel times below come from your vehicle's live GPS (Geotab). If they're not right, you can change them — your manager will review any changes. You can still start work straight away."
            : "Log your travel time to site. If your vehicle GPS (Geotab) data arrives later, it will update automatically. You can change these times if needed — your manager will review any changes."}
        </p>
      </div>

      {/* On-site auto-detection — phone GPS or vehicle Geotab confirms the crew is at the job */}
      {onSiteDetected && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-semibold">
              You're on site — arrival time auto-filled.
            </p>
            <p className="text-[10px] text-primary/70 mt-0.5">
              Detected via {phoneOnSite && vehicleOnSite ? 'phone GPS + vehicle GPS' : phoneOnSite ? 'phone GPS' : 'vehicle GPS (Geotab)'}
            </p>
          </div>
          <button type="button" onClick={useMyLocation} className="text-[11px] font-bold text-primary underline flex-shrink-0">
            Re-sync now
          </button>
        </div>
      )}

      {/* Weather */}
      <WeatherCard
        lat={job?.site_lat}
        lng={job?.site_lng}
        locationName={job?.location}
        isDrillingJob={job?.drilling_method && job.drilling_method !== 'not_applicable'}
      />

      {/* Job context — site contact, notes, safety info */}
      <JobContextCard job={job} />

      {/* POWRA — verified live by Mitti when connected, otherwise a prompt. */}
      {mittiConnected ? (
        powraVerified ? (
          <MittiVerificationBadge type="powra" verified verifiedAt={powraAt} url={powraUrl} />
        ) : (
          <div className="space-y-2.5">
            <MittiSafetyPrompt type="powra" url={powraUrl} />
            <MittiVerificationBadge type="powra" verified={false} isConnected url={powraUrl} />
          </div>
        )
      ) : (
        <MittiSafetyPrompt type="powra" url={powraUrl} />
      )}

      {/* Admin-configured safety form buttons for this step (big tappable buttons) */}
      <SafetyFormsList step="arrive" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Left home</label>
          <input type="time" value={departHome} onChange={e => setDepartHome(e.target.value)} autoFocus
            className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived on site</label>
          <input type="time" value={arriveSite} onChange={e => setArriveSite(e.target.value)}
            className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
        </div>
      </div>
      {invalidTime && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">Arrival on site must be after leaving home.</p>
        </div>
      )}
      {travelMins > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
          <Car className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-primary font-medium">Travel time: {fmtDur(travelMins)}</p>
          <span className="text-[10px] text-primary ml-auto">First 1.5h unpaid</span>
        </div>
      )}
      {inductionRequired ? (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
          <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            After logging your travel, you'll do a quick site induction and daily briefing. The induction is only needed on your first day at this site.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary leading-relaxed">
            You've already done the site induction — you'll just do a quick daily briefing, then you're ready to work.
          </p>
        </div>
      )}
      <input type="hidden" id="arrive-can-confirm" value={canConfirm ? '1' : '0'} data-depart={departHome} data-arrive={arriveSite} data-gps-prefilled={gpsPrefilled ? '1' : '0'} />
    </div>
  );
}

// ── Working Step ─────────────────────────────────────────────────────────
// Now lives in its own component (src/components/staff/WorkingStep.jsx) with
// smart KeyLogBook detection — imported above.

// ── Main ShiftWizard ──────────────────────────────────────────────────────
export default function ShiftWizard({
  open,
  onClose,
  assignment: assignmentProp,
  job: jobProp,
  client,
  staff,
  staffId,
  crewAssignments = [],
  visibleAssignments = [],
  canPerformActions = true,
  onArrivedConfirm,
  onBriefingComplete,
  onStartJob,
  onEndOfShiftSubmit,
  isLastJob,
  isDriller,
  forceStep = null,
  previewMode = false,
}) {
  // Preview mode — mock assignment/job so super admins can walk through the
  // full shift flow without being assigned to a real job.
  const PREVIEW_ASSIGNMENT = {
    id: 'preview',
    assignment_type: 'job',
    status: 'assigned',
    daily_checks_completed: false,
    arrived_on_site_at: null,
    briefing_signed: false,
    assigned_date: format(new Date(), 'yyyy-MM-dd'),
    vehicle_id: null,
    staff_id: 'preview',
    week_start: format(new Date(), 'yyyy-MM-dd'),
  };
  const PREVIEW_JOB = {
    id: 'preview',
    name: 'Preview Job — Cambridge North SI',
    location: 'Cambridge Business Park, CB21 1AA',
    site_lat: 52.2053,
    site_lng: 0.1218,
    drilling_method: 'cp',
  };

  const assignment = previewMode ? PREVIEW_ASSIGNMENT : assignmentProp;
  const job = previewMode ? PREVIEW_JOB : jobProp;

  const [step, setStep] = useState(null);
  const [saving, setSaving] = useState(false);
  const [arriveData, setArriveData] = useState({ departHome: '', arriveSite: '' });

  const { get: getEffectiveSetting } = useEffectiveSettings();
  const briefingRequired = getEffectiveSetting('require_briefing_signature') ?? true;
  const needsBriefing = briefingRequired && assignment
    ? !assignment.briefing_signed &&
      !visibleAssignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id)
    : false;

  // Build the list of wizard steps based on assignment state
  const buildSteps = () => {
    if (previewMode) return ['checks', 'arrive', 'briefing', 'working', 'end_of_shift'];
    const steps = [];
    if (!assignment) return steps;
    // Daily checks come first — block everything until completed
    if (!assignment.daily_checks_completed) steps.push('checks');
    if (!assignment.arrived_on_site_at) steps.push('arrive');
    if (needsBriefing) steps.push('briefing');
    if ((assignment.status || 'assigned') !== 'completed') steps.push('working');
    steps.push('end_of_shift');
    return steps;
  };

  const steps = buildSteps();

  useEffect(() => {
    if (open && assignment) {
      // If a specific step is forced (e.g. early leave → end_of_shift), use it
      if (forceStep) setStep(forceStep);
      else if (!assignment.daily_checks_completed) setStep('checks');
      else if (!assignment.arrived_on_site_at) setStep('arrive');
      else if (needsBriefing) setStep('briefing');
      else if ((assignment.status || 'assigned') !== 'completed') setStep('working');
      else setStep(null);
      setSaving(false);
    } else {
      setStep(null);
    }
  }, [open, assignment?.id, forceStep]);

  // ── Step transitions ──
  const advanceFromArrive = async () => {
    if (previewMode) {
      setStep(needsBriefing ? 'briefing' : 'working');
      return;
    }
    const el = document.getElementById('arrive-can-confirm');
    if (!el || el.value !== '1') return;
    const departHome = el.dataset.depart;
    const arriveSite = el.dataset.arrive;
    const gpsPrefilled = el.dataset.gpsPrefilled === '1';
    setSaving(true);
    try {
      await onArrivedConfirm({ assignmentId: assignment.id, departHome, arriveSite, gpsPrefilled });
      setSaving(false);
      if (needsBriefing) {
        setStep('briefing');
      } else {
        // Already briefed — start the job and go to working
        if (onStartJob) await onStartJob(assignment.id);
        setStep('working');
      }
    } catch (e) {
      setSaving(false);
    }
  };

  const handleBriefingSigned = (result) => {
    if (previewMode) { setStep('working'); return; }
    if (onBriefingComplete) onBriefingComplete(result);
    if (onStartJob) onStartJob(assignment.id);
    setStep('working');
  };

  const handleEndOfShiftSubmit = (data) => {
    if (previewMode) { setStep(null); return; }
    if (onEndOfShiftSubmit) onEndOfShiftSubmit(data);
    setStep(null);
  };

  // ── Render ──
  if (!open || !assignment) return null;

  const PreviewBanner = previewMode ? (
    <div className="bg-amber-500/95 backdrop-blur-sm px-5 py-2 flex items-center gap-2 flex-shrink-0">
      <Eye className="w-4 h-4 text-white flex-shrink-0" />
      <p className="text-xs font-bold text-white">Preview Mode — No data will be saved</p>
    </div>
  ) : null;

  // Depot / Yard duty assignments use a lighter wizard (checks + clock in/out)
  if (assignment.assignment_type === 'yard_depot') {
    return (
      <DepotShiftWizard
        open={open}
        onClose={onClose}
        assignment={assignment}
        staff={staff}
        staffId={staffId}
      />
    );
  }

  const stepLabels = {
    checks: 'Checks',
    arrive: 'Arrive',
    briefing: 'Briefing',
    working: 'Tasks',
    end_of_shift: 'Finish',
  };
  const stepIcons = {
    checks: ClipboardCheck,
    arrive: MapPin,
    briefing: ShieldCheck,
    working: Briefcase,
    end_of_shift: CheckCircle2,
  };

  const currentStepIndex = steps.indexOf(step);

  // ── Delegate to full-screen components for briefing and end_of_shift ──
  if (step === 'briefing' && !previewMode) {
    return (
      <JobBriefingModal
        assignment={assignment}
        job={job}
        client={client}
        staff={staff}
        crewAssignments={crewAssignments}
        onSigned={handleBriefingSigned}
        onClose={onClose}
        skipTravel
      />
    );
  }

  if (step === 'end_of_shift' && !previewMode) {
    return (
      <EndOfShiftWizard
        open={true}
        assignment={assignment}
        job={job}
        staffId={staffId}
        isDriller={isDriller}
        isLastJob={isLastJob}
        onSubmit={handleEndOfShiftSubmit}
        onClose={onClose}
      />
    );
  }

  // ── Full-screen wizard frame for arrive and working steps ──
  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 page-bg-vibrant flex flex-col"
        >
          {/* Top bar — job title + close */}
          <div className="hero-gradient px-5 py-3.5 text-white flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                {step === 'arrive' ? <MapPin className="w-5 h-5 text-white" /> : step === 'checks' ? <ClipboardCheck className="w-5 h-5 text-white" /> : step === 'briefing' ? <ShieldCheck className="w-5 h-5 text-white" /> : step === 'end_of_shift' ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Briefcase className="w-5 h-5 text-white" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">
                  {step === 'arrive' ? 'Arrived on Site' : step === 'checks' ? 'Daily Checks' : step === 'briefing' ? 'Site Briefing' : step === 'end_of_shift' ? 'End of Shift' : "Today's Tasks"}
                </h2>
                <p className="text-white/70 text-xs truncate">{job?.name || 'Shift'}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={saving}
              className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {PreviewBanner}

          {/* Mobile progress dots — hidden on tablet (rail replaces them) */}
          <div className="md:hidden hero-gradient px-5 pb-3 text-white flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 ${i <= currentStepIndex ? 'text-white' : 'text-white/40'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < currentStepIndex ? 'bg-white text-primary' : i === currentStepIndex ? 'bg-white/25 ring-1 ring-white/40' : 'bg-white/10'}`}>
                      {i < currentStepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="text-[11px] font-medium">{stepLabels[s]}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 rounded-full ${i < currentStepIndex ? 'bg-white' : 'bg-white/20'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-[11px] text-white/70 mt-2">
              Step {currentStepIndex + 1} of {steps.length} — {stepLabels[step]}
            </p>
          </div>

          {/* Body — two-pane on tablet, single on mobile */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left rail — tablet only */}
            <div className="hidden md:block w-72 lg:w-80 border-r border-slate-200/60 flex-shrink-0 bg-white/40">
              <ShiftStepRail steps={steps} currentStep={step} currentStepIndex={currentStepIndex} onJump={setStep} previewMode={previewMode} />
            </div>
            {/* Right content */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === 'checks' && (
                    <DailyChecksStep
                      assignment={assignment}
                      job={job}
                      staff={staff}
                      saving={saving}
                    />
                  )}
                  {step === 'arrive' && (
                    <ArriveStep
                      job={job}
                      jobLocation={job?.location}
                      inductionRequired={needsBriefing}
                      saving={saving}
                      staffId={staffId}
                      vehicleId={assignment?.vehicle_id}
                      assignment={assignment}
                    />
                  )}
                  {step === 'briefing' && previewMode && (
                    <div className="px-5 py-8 space-y-4">
                      <div className="hub-glass rounded-2xl p-5 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                          <ShieldCheck className="w-7 h-7 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Site Briefing & Induction</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                          In live mode, the crew member reviews site hazards, emergency procedures, and job-specific risks, then signs the daily briefing document.
                        </p>
                      </div>
                    </div>
                  )}
                  {step === 'end_of_shift' && previewMode && (
                    <div className="px-5 py-8 space-y-4">
                      <div className="hub-glass rounded-2xl p-5 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">End of Shift</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                          In live mode, the crew member reviews their daily tasks, logs meterage (drillers), records travel home, signs the end-of-day declaration, and submits their timesheet for manager approval.
                        </p>
                      </div>
                    </div>
                  )}
                  {step === 'working' && (
                    <WorkingStep
                      staffId={staffId}
                      job={job}
                      assignment={assignment}
                      onGoToEndOfShift={() => setStep('end_of_shift')}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="hub-glass p-4 flex gap-2.5 flex-shrink-0 safe-area-bottom">
            {step === 'checks' && (
              <>
                <button onClick={onClose} disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-base font-semibold touch-manipulation">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (previewMode) { setStep('arrive'); return; }
                    const el = document.getElementById('daily-checks-complete');
                    if (!el || el.value !== '1') return;
                    setSaving(true);
                    try {
                      const res = await base44.functions.invoke('updateMyAssignment', {
                        assignmentId: assignment.id,
                        updates: {
                          daily_checks_completed: true,
                          daily_checks_completed_at: new Date().toISOString(),
                        },
                      });
                      if (res.data?.error) throw new Error(res.data.error);
                      setSaving(false);
                      setStep('arrive');
                    } catch (e) {
                      setSaving(false);
                      // Show error toast — previously this silently failed
                      import('@/components/ui/use-toast').then(({ toast }) => {
                        toast({ title: 'Could not save checks', description: e.message || 'Please try again.', variant: 'destructive' });
                      });
                    }
                  }}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {saving ? 'Saving…' : 'Confirm Checks Complete'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {step === 'arrive' && (
              <>
                <button onClick={onClose} disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-base font-semibold touch-manipulation">
                  Cancel
                </button>
                <button onClick={advanceFromArrive} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation">
                  {saving ? 'Saving…' : 'Confirm Arrival'} <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {step === 'briefing' && previewMode && (
              <button onClick={() => setStep('working')}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold touch-manipulation">
                Continue to Tasks <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === 'end_of_shift' && previewMode && (
              <button onClick={() => setStep(null)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold touch-manipulation">
                Finish Preview <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === 'working' && (
              <button onClick={() => setStep('end_of_shift')}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition text-base font-bold touch-manipulation">
                Finish My Day <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}