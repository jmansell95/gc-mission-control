import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Car, ClipboardCheck, ShieldCheck, CheckCircle2, ChevronRight,
  ExternalLink, AlertTriangle, Loader2, MapPin,
} from 'lucide-react';
import MittiSafetyPrompt from '@/components/staff/MittiSafetyPrompt';
import MittiVerificationBadge from '@/components/staff/MittiVerificationBadge';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';
import { useMittiCheckStatus } from '@/hooks/useMittiCheckStatus';

/**
 * PreWorkSafetyChecklist — a full-screen, step-by-step pre-work safety
 * checklist modal that progressively gates crew through:
 *   Step 1: Vehicle Check  → gates departure to site
 *   Step 2: Plant Check   → drillers only, gates rig operation
 *   Step 3: POWRA         → gates starting work
 *
 * Each step shows a Mitti link with live verification. When Mitti is
 * connected, the step is auto-verified when the audit webhook lands.
 * When Mitti is not connected, the crew member can manually confirm
 * (stamps a flag on the RotaAssignment for manager review).
 *
 * On completion, onComplete is called so the parent can open the
 * existing ShiftWizard at the arrive step.
 */
const STEP_ICONS = { vehicle: Car, plant: ClipboardCheck, powra: ShieldCheck };
const STEP_LABELS = { vehicle: 'Vehicle Check', plant: 'Plant Check', powra: 'POWRA' };
const STEP_TIMING = {
  vehicle: 'Before you leave for site',
  plant: 'Before operating the rig',
  powra: 'On arrival at site',
};

export default function PreWorkSafetyChecklist({
  open,
  onClose,
  assignment,
  job,
  staff,
  isDriller = false,
  onComplete,
}) {
  const { vehicleCheckUrl, powraUrl, equipmentCheckUrl } = useMittiCheckLinks();
  const [manualConfirmed, setManualConfirmed] = useState({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const assignmentId = assignment?.id;
  const staffId = staff?.id;
  const jobDate = assignment?.assigned_date;

  const { isConnected, vehicleVerified, powraVerified, equipmentVerified, vehicleCheckAt, powraAt, equipmentCheckAt } =
    useMittiCheckStatus({ assignmentId, staffId, jobDate, enabled: open });

  // Build the list of applicable steps — Plant Check only for drillers
  const steps = useMemo(() => {
    const list = [
      { key: 'vehicle', url: vehicleCheckUrl, verified: vehicleVerified, verifiedAt: vehicleCheckAt },
    ];
    if (isDriller) {
      list.push({ key: 'plant', url: equipmentCheckUrl, verified: equipmentVerified, verifiedAt: equipmentCheckAt });
    }
    list.push({ key: 'powra', url: powraUrl, verified: powraVerified, verifiedAt: powraAt });
    return list;
  }, [isDriller, vehicleCheckUrl, equipmentCheckUrl, powraUrl, vehicleVerified, equipmentVerified, powraVerified, vehicleCheckAt, equipmentCheckAt, powraAt]);

  if (!open) return null;

  const currentStep = steps[currentStepIdx];
  const isLastStep = currentStepIdx === steps.length - 1;

  const isStepDone = (step) => {
    if (step.verified) return true;
    if (!isConnected && manualConfirmed[step.key]) return true;
    return false;
  };

  const currentDone = isStepDone(currentStep);
  const allDone = steps.every(isStepDone);

  const handleManualConfirm = () => {
    setManualConfirmed((prev) => ({ ...prev, [currentStep.key]: true }));
  };

  const handleNext = () => {
    if (!currentDone) return;
    if (isLastStep) {
      // All steps complete — call onComplete to open the ShiftWizard
      onComplete?.();
    } else {
      setCurrentStepIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIdx > 0) setCurrentStepIdx((i) => i - 1);
  };

  const handleSkipToWizard = () => {
    if (!allDone) return;
    onComplete?.();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 sm:flex sm:items-center sm:justify-center">
      <div
        className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-lg sm:rounded-3xl sm:shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100 px-5 pt-5 pb-3 sm:rounded-t-3xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Pre-Work Safety Checks</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {job?.name || 'Today\'s job'} · {STEP_TIMING[currentStep.key]}
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition touch-manipulation flex-shrink-0"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {steps.map((step, idx) => {
              const Icon = STEP_ICONS[step.key];
              const done = isStepDone(step);
              const isCurrent = idx === currentStepIdx;
              const isPast = idx < currentStepIdx;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                        done
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                          : isCurrent
                          ? 'bg-[#2E5A1A] text-white shadow-md shadow-[#2E5A1A]/30'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        done ? 'text-emerald-600' : isCurrent ? 'text-[#2E5A1A]' : 'text-slate-400'
                      }`}
                    >
                      {STEP_LABELS[step.key]}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 rounded-full transition ${
                        isPast || done ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 px-5 py-5 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Step title */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#2E5A1A] uppercase tracking-wide">
                    Step {currentStepIdx + 1} of {steps.length}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {STEP_LABELS[currentStep.key]}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{STEP_TIMING[currentStep.key]}</p>
              </div>

              {/* Mitti prompt + verification */}
              {currentStep.verified ? (
                <MittiVerificationBadge
                  type={currentStep.key === 'plant' ? 'equipment' : currentStep.key}
                  verified
                  verifiedAt={currentStep.verifiedAt}
                  url={currentStep.url}
                />
              ) : isConnected ? (
                <div className="space-y-2.5">
                  <MittiSafetyPrompt type={currentStep.key === 'plant' ? 'equipment' : currentStep.key} url={currentStep.url} />
                  <MittiVerificationBadge
                    type={currentStep.key === 'plant' ? 'equipment' : currentStep.key}
                    verified={false}
                    isConnected
                    url={currentStep.url}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <MittiSafetyPrompt type={currentStep.key === 'plant' ? 'equipment' : currentStep.key} url={currentStep.url} />
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-700">Mitti not connected</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Complete the check in Mitti, then confirm manually below. Your manager will see a flag.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleManualConfirm}
                      type="button"
                      disabled={!!manualConfirmed[currentStep.key]}
                      className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition touch-manipulation active:scale-95 ${
                        manualConfirmed[currentStep.key]
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      {manualConfirmed[currentStep.key] ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Confirmed manually
                        </>
                      ) : (
                        <>I've completed this check</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Info note */}
              {currentStep.key === 'vehicle' && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                  <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Complete this before you leave for site. You won't be able to proceed to the next step until verified.
                  </p>
                </div>
              )}
              {currentStep.key === 'powra' && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                  <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Assess site hazards, weather conditions, and safe access before starting any work.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer — gated Continue button */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-5 py-4 safe-area-bottom">
          {allDone ? (
            <button
              onClick={handleSkipToWizard}
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] text-white text-sm font-bold shadow-lg shadow-[#2E5A1A]/25 active:scale-95 transition touch-manipulation glow-brand"
            >
              <CheckCircle2 className="w-5 h-5" /> All checks complete — Start Shift
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleNext}
                type="button"
                disabled={!currentDone}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold transition touch-manipulation active:scale-95 ${
                  currentDone
                    ? 'bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] text-white shadow-lg shadow-[#2E5A1A]/25 glow-brand'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLastStep ? 'Finish' : 'Continue'}
                {!isLastStep && currentDone && <ChevronRight className="w-4 h-4" />}
              </button>
              {currentStepIdx > 0 && (
                <button
                  onClick={handleBack}
                  type="button"
                  className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 py-1 transition"
                >
                  ← Back
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}