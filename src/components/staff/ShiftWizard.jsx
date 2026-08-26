import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, MapPin, Car, Clock, CheckCircle2, AlertTriangle, ShieldCheck,
  PlayCircle, ClipboardCheck, ChevronRight, Briefcase, Coffee, Send,
  Ruler, FileText, Info, Timer, Loader2,
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
import { useGeolocation } from '@/hooks/useGeolocation';
import { useGeofenceDetection } from '@/hooks/useGeofenceDetection';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

// ── Arrive Step ──────────────────────────────────────────────────────────
function ArriveStep({ job, jobLocation, inductionRequired, saving, staffId, vehicleId }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [departHome, setDepartHome] = useState('');
  const [arriveSite, setArriveSite] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [gpsPrefilled, setGpsPrefilled] = useState(false);
  const [geofencePrefilled, setGeofencePrefilled] = useState(false);

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
          <MapPin className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
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
          <MapPin className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#2E5A1A] font-semibold">
              You're on site — arrival time auto-filled.
            </p>
            <p className="text-[10px] text-[#2E5A1A]/70 mt-0.5">
              Detected via {phoneOnSite && vehicleOnSite ? 'phone GPS + vehicle GPS' : phoneOnSite ? 'phone GPS' : 'vehicle GPS (Geotab)'}
            </p>
          </div>
          <button type="button" onClick={useMyLocation} className="text-[11px] font-bold text-[#2E5A1A] underline flex-shrink-0">
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
          <Car className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
          <p className="text-xs text-[#2E5A1A] font-medium">Travel time: {fmtDur(travelMins)}</p>
          <span className="text-[10px] text-[#2E5A1A] ml-auto">First 1.5h unpaid</span>
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
          <ShieldCheck className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#2E5A1A] leading-relaxed">
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
  assignment,
  job,
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
}) {
  const [step, setStep] = useState(null);
  const [saving, setSaving] = useState(false);
  const [arriveData, setArriveData] = useState({ departHome: '', arriveSite: '' });

  const needsBriefing = assignment
    ? !assignment.briefing_signed &&
      !visibleAssignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id)
    : false;

  // Build the list of wizard steps based on assignment state
  const buildSteps = () => {
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
    if (onBriefingComplete) onBriefingComplete(result);
    if (onStartJob) onStartJob(assignment.id);
    setStep('working');
  };

  const handleEndOfShiftSubmit = (data) => {
    if (onEndOfShiftSubmit) onEndOfShiftSubmit(data);
    setStep(null);
  };

  // ── Render ──
  if (!open || !assignment) return null;

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
  if (step === 'briefing') {
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

  if (step === 'end_of_shift') {
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
          className="fixed inset-0 z-50 bg-white flex flex-col"
        >
          {/* Top bar — job title + close */}
          <div className="hero-gradient px-5 py-3.5 text-white flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                {step === 'arrive' ? <MapPin className="w-5 h-5 text-white" /> : step === 'checks' ? <ClipboardCheck className="w-5 h-5 text-white" /> : <Briefcase className="w-5 h-5 text-white" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">
                  {step === 'arrive' ? 'Arrived on Site' : step === 'checks' ? 'Daily Checks' : "Today's Tasks"}
                </h2>
                <p className="text-white/70 text-xs truncate">{job?.name || 'Shift'}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={saving}
              className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile progress dots — hidden on tablet (rail replaces them) */}
          <div className="md:hidden hero-gradient px-5 pb-3 text-white flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 ${i <= currentStepIndex ? 'text-white' : 'text-white/40'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < currentStepIndex ? 'bg-white text-[#2E5A1A]' : i === currentStepIndex ? 'bg-white/25 ring-1 ring-white/40' : 'bg-white/10'}`}>
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
            <div className="hidden md:block w-72 lg:w-80 border-r border-slate-100 flex-shrink-0 bg-slate-50/50">
              <ShiftStepRail steps={steps} currentStep={step} currentStepIndex={currentStepIndex} onJump={setStep} />
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
                    />
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
          <div className="border-t border-slate-100 p-4 flex gap-2.5 flex-shrink-0 safe-area-bottom">
            {step === 'checks' && (
              <>
                <button onClick={onClose} disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-base font-semibold touch-manipulation">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const el = document.getElementById('daily-checks-complete');
                    if (!el || el.value !== '1') return;
                    setSaving(true);
                    try {
                      await base44.entities.RotaAssignment.update(assignment.id, {
                        daily_checks_completed: true,
                        daily_checks_completed_at: new Date().toISOString(),
                      });
                      setSaving(false);
                      setStep('arrive');
                    } catch (e) {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-[#2E5A1A] text-white rounded-2xl hover:bg-[#1c4a12] active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {saving ? 'Saving...' : 'Confirm Checks Complete'}
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
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-[#2E5A1A] text-white rounded-2xl hover:bg-[#1c4a12] active:scale-95 transition text-base font-bold disabled:opacity-50 touch-manipulation">
                  {saving ? 'Saving…' : 'Confirm Arrival'} <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            {step === 'working' && (
              <button onClick={() => setStep('end_of_shift')}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-[#2E5A1A] text-white rounded-2xl hover:bg-[#1c4a12] active:scale-95 transition text-base font-bold touch-manipulation">
                Finish My Day <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}