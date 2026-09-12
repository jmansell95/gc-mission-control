import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, FileText, ExternalLink, ShieldCheck, Clock, PlayCircle, CheckCircle2, Loader2, ChevronRight, ChevronLeft, HeartPulse, Flame, AlertTriangle, Users, WifiOff, PenLine, Info, Car, Navigation, ClipboardCheck, Wrench } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import SignaturePad from '@/components/staff/SignaturePad';
import { saveOfflineBriefing } from '@/utils/offlineSync';
import SafetyFormsList from '@/components/staff/SafetyFormsList';

const POWRA_URL = 'https://app.safetyculture.com/inspection/audit_349a23db07de4cfba675bb2a0a9f7bd8?page=1&isNew=true&holisticOnboarding=false';
const VEHICLE_CHECK_URL = 'https://app.safetyculture.com/inspection/audit_a7b6591dc3064b2f8e4557c3ce1e432e?page=1&isNew=true&holisticOnboarding=false';
const EQUIP_CHECK_URL = 'https://app.safetyculture.com/inspection/audit_bc585d98c32640b4a333d34afad8b3b9?page=1&isNew=true&holisticOnboarding=false';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function JobBriefingModal({ assignment, job, client, staff, crewAssignments = [], onSigned, onClose, skipTravel = false }) {
  // Daily vehicle check — required once per staff member per day, before
  // anything else. Persisted in localStorage so re-opening the briefing for
  // another assignment the same day skips it automatically.
  const vehicleCheckStorageKey = staff?.id ? `gc_vehicle_check_${staff.id}_${todayKey()}` : null;
  const [vehicleCheckNeeded] = useState(() => {
    if (!vehicleCheckStorageKey) return false;
    try { return localStorage.getItem(vehicleCheckStorageKey) !== '1'; } catch { return true; }
  });

  // When skipTravel is true, arrival/travel-to-site was already logged before
  // opening the briefing, so we skip the intro and travel phases and start
  // straight at documents/induction.
  const initialPhase = vehicleCheckNeeded
    ? 'vehicle'
    : (skipTravel ? null : (assignment.briefing_start_at ? 'documents' : 'intro'));
  const [phase, setPhase] = useState(initialPhase);
  const [signing, setSigning] = useState(false);
  const [briefingStartAt, setBriefingStartAt] = useState(assignment.briefing_start_at || null);
  const [elapsedLabel, setElapsedLabel] = useState('');
  const [reviewedDocIds, setReviewedDocIds] = useState(new Set());
  const [inductionConfirmed, setInductionConfirmed] = useState(false);
  const [inductionCompletedBy, setInductionCompletedBy] = useState('');
  const [agendaPlan, setAgendaPlan] = useState('');
  const [agendaBlockers, setAgendaBlockers] = useState('');
  const [agendaLeft, setAgendaLeft] = useState('');
  const [powraConfirmed, setPowraConfirmed] = useState(false);
  const [equipCheckConfirmed, setEquipCheckConfirmed] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [travelDepartHome, setTravelDepartHome] = useState('');
  const [travelArriveSite, setTravelArriveSite] = useState('');
  const [editStartOpen, setEditStartOpen] = useState(false);
  const [pendingStartTime, setPendingStartTime] = useState(
    briefingStartAt ? format(new Date(briefingStartAt), 'HH:mm') : format(new Date(), 'HH:mm')
  );
  const [savingStart, setSavingStart] = useState(false);

  const { data: briefingDocs = [] } = useQuery({
    queryKey: ['briefing-docs', job?.id],
    queryFn: async () => {
      const all = await base44.entities.JobDocument.filter({ job_id: job.id });
      // Show work orders (scope_of_work) and site maps in the briefing so crew
      // review them before starting work. Also include any legacy
      // is_briefing_document-flagged docs for backward compatibility.
      return all.filter(d =>
        d.category === 'scope_of_work' ||
        d.category === 'site_map' ||
        d.is_briefing_document
      );
    },
    enabled: !!job?.id
  });

  const phaseInitRef = useRef(false);
  useEffect(() => {
    if (phase === 'vehicle') return; // wait for the daily vehicle check to be completed
    if (phaseInitRef.current) return; // already initialized — don't override user navigation
    phaseInitRef.current = true;
    if (skipTravel) {
      // Auto-record the briefing start time and jump straight to the first content step
      const ts = new Date().toISOString();
      setBriefingStartAt(ts);
      setPhase(briefingDocs.length > 0 ? 'documents' : 'induction');
      try { base44.functions.invoke('updateMyAssignment', { assignmentId: assignment.id, updates: { briefing_start_at: ts } }); } catch (e) {}
      return;
    }
    if (assignment.briefing_start_at) {
      setBriefingStartAt(assignment.briefing_start_at);
      setPhase('documents');
    }
  }, [assignment.id, assignment.briefing_start_at, skipTravel, briefingDocs.length]);

  // Build an ISO timestamp from today's date + a HH:mm string (local time)
  const buildTimestampFromTime = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  };

  const handleBeginBriefing = async () => {
    const ts = buildTimestampFromTime(pendingStartTime);
    setBriefingStartAt(ts);
    setSavingStart(true);
    try {
      await base44.functions.invoke('updateMyAssignment', { assignmentId: assignment.id, updates: { briefing_start_at: ts } });
    } catch (err) {
      console.error('Error recording briefing start:', err);
    }
    setSavingStart(false);
    setPhase('travel');
  };

  const handleVehicleCheckComplete = () => {
    try { if (vehicleCheckStorageKey) localStorage.setItem(vehicleCheckStorageKey, '1'); } catch (e) {}
    if (skipTravel) {
      const ts = new Date().toISOString();
      setBriefingStartAt(ts);
      setPhase(briefingDocs.length > 0 ? 'documents' : 'induction');
      try { base44.functions.invoke('updateMyAssignment', { assignmentId: assignment.id, updates: { briefing_start_at: ts } }); } catch (e) {}
    } else if (assignment.briefing_start_at) {
      setPhase('documents');
    } else {
      setPhase('intro');
    }
  };

  const handleSaveEditedStart = async () => {
    const ts = buildTimestampFromTime(pendingStartTime);
    setBriefingStartAt(ts);
    setSavingStart(true);
    try {
      await base44.functions.invoke('updateMyAssignment', { assignmentId: assignment.id, updates: { briefing_start_at: ts } });
    } catch (err) {
      console.error('Error updating briefing start:', err);
    }
    setSavingStart(false);
    setEditStartOpen(false);
  };

  useEffect(() => {
    if (!briefingStartAt) return;
    const update = () => setElapsedLabel(formatDistanceToNow(new Date(briefingStartAt), { addSuffix: false }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [briefingStartAt]);

  const crewSignedCount = crewAssignments.filter(a => a.briefing_signed).length;
  const crewTotal = crewAssignments.length;

  const toggleDocReviewed = (docId) => {
    setReviewedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const allDocsReviewed = briefingDocs.length === 0 || reviewedDocIds.size === briefingDocs.length;

  const goNext = () => {
    if (phase === 'intro') setPhase('travel');
    else if (phase === 'travel') setPhase(briefingDocs.length > 0 ? 'documents' : 'induction');
    else if (phase === 'documents') setPhase('induction');
    else if (phase === 'induction') setPhase('agenda');
    else if (phase === 'agenda') setPhase('risk');
    else if (phase === 'risk') setPhase('sign');
  };

  const goPrev = () => {
    if (phase === 'sign') setPhase('risk');
    else if (phase === 'risk') setPhase('agenda');
    else if (phase === 'agenda') setPhase('induction');
    else if (phase === 'induction') setPhase(briefingDocs.length > 0 ? 'documents' : 'travel');
    else if (phase === 'documents') setPhase('travel');
    else if (phase === 'travel') setPhase('intro');
  };

  // When travel is skipped, we never reach the travel/intro phases, so guard
  // the back button from the first content step.
  const goPrevSkipAware = () => {
    const firstPhase = briefingDocs.length > 0 ? 'documents' : 'induction';
    if (skipTravel && phase === firstPhase) return;
    goPrev();
  };

  const handleSign = async () => {
    if (!signatureDataUrl || signing) return;
    setSigning(true);
    const signedAt = new Date().toISOString();
    const durationMin = briefingStartAt ? Math.round((new Date(signedAt) - new Date(briefingStartAt)) / 60000) : 0;
    const docIds = Array.from(reviewedDocIds).join(',');
    const dailyAgendaNotes = [
      agendaPlan && `Plan: ${agendaPlan}`,
      agendaBlockers && `Blockers: ${agendaBlockers}`,
      agendaLeft && `Left to sort: ${agendaLeft}`,
    ].filter(Boolean).join('\n');

    try {
      if (!navigator.onLine) {
        saveOfflineBriefing({
          assignment_id: assignment.id,
          staff_id: staff.id,
          staff_name: staff.name,
          job_id: job.id,
          assigned_date: assignment.assigned_date,
          signature_data_url: signatureDataUrl,
          signed_at: signedAt,
          induction_completed: inductionConfirmed,
          induction_completed_at: inductionConfirmed ? signedAt : null,
          induction_completed_by: inductionCompletedBy || null,
          daily_agenda_notes: dailyAgendaNotes || null,
          document_ids_reviewed: docIds,
          briefing_duration_minutes: durationMin,
          briefing_start_at: briefingStartAt,
          travel_depart_home: travelDepartHome || null,
          travel_arrive_site: travelArriveSite || null
        });
        setOfflineSaved(true);
        return;
      }

      const blob = await (await fetch(signatureDataUrl)).blob();
      const file = new File([blob], `signature_${assignment.id}.png`, { type: 'image/png' });
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });

      await base44.entities.BriefingSignature.create({
        assignment_id: assignment.id,
        staff_id: staff.id,
        staff_name: staff.name,
        job_id: job.id,
        assigned_date: assignment.assigned_date,
        signature_url: uploadRes.file_url,
        signed_at: signedAt,
        induction_completed: inductionConfirmed,
        induction_completed_at: inductionConfirmed ? signedAt : null,
        induction_completed_by: inductionCompletedBy || null,
        daily_agenda_notes: dailyAgendaNotes || null,
        document_ids_reviewed: docIds,
        briefing_duration_minutes: durationMin,
        synced_from_offline: false
      });

      await base44.functions.invoke('updateMyAssignment', {
        assignmentId: assignment.id,
        updates: { briefing_signed: true, briefing_signed_at: signedAt },
      });

      // Log briefing (and optional travel) as the first daily task entries
      try {
        await base44.functions.invoke('logBriefingAsTask', {
          staff_id: staff.id,
          job_id: job.id,
          assigned_date: assignment.assigned_date,
          briefing_start_at: briefingStartAt,
          briefing_signed_at: signedAt,
          travel_depart_home: travelDepartHome || null,
          travel_arrive_site: travelArriveSite || null
        });
      } catch (err) {
        console.error('Error logging briefing as task:', err);
      }

      onSigned({ offline: false });
    } catch (err) {
      console.error('Error signing briefing:', err);
      setSigning(false);
    }
  };

  if (!job) return null;

  const stepLabels = [
    ...(vehicleCheckNeeded ? ['Vehicle'] : []),
    ...(skipTravel
      ? ['Induction', 'Agenda', 'Safety', 'Sign']
      : ['Briefing', 'Travel', briefingDocs.length > 0 ? 'Documents' : null, 'Induction', 'Agenda', 'Safety', 'Sign'].filter(Boolean)),
  ];
  const docOffset = briefingDocs.length > 0 ? 1 : 0;
  const vcOffset = vehicleCheckNeeded ? 1 : 0;
  const activeStep = phase === 'vehicle'
    ? 0
    : skipTravel
      ? vcOffset + (phase === 'induction' ? 0 : phase === 'agenda' ? 1 : phase === 'risk' ? 2 : 3)
      : vcOffset + (phase === 'intro' ? 0 : phase === 'travel' ? 1 : phase === 'documents' ? 2 : phase === 'induction' ? (2 + docOffset) : phase === 'agenda' ? (3 + docOffset) : phase === 'risk' ? (4 + docOffset) : (5 + docOffset));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md px-0 sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !signing) onClose(); }}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="hero-gradient px-5 py-4 flex items-center justify-between flex-shrink-0 relative">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight">Site Briefing</h2>
                <p className="text-emerald-100 text-xs flex items gap-1.5">
                  <Clock className="w-3 h-3" /> {elapsedLabel || 'just started'}
                  {briefingStartAt && (
                    <button onClick={() => { setPendingStartTime(format(new Date(briefingStartAt), 'HH:mm')); setEditStartOpen(o => !o); }}
                      className="ml-1 inline-flex items-center gap-1 text-emerald-50/80 hover:text-white underline-offset-2 hover:underline transition">
                      <PenLine className="w-3 h-3" /> edit
                    </button>
                  )}
                  {crewTotal > 1 && <><span className="mx-0.5">·</span><Users className="w-3 h-3" />{crewSignedCount}/{crewTotal} crew</>}
                </p>
                {editStartOpen && briefingStartAt && (
                  <div className="absolute right-4 top-16 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 flex flex-col gap-2 w-56">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Started at</label>
                    <input type="time" value={pendingStartTime} onChange={e => setPendingStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditStartOpen(false)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200">Cancel</button>
                      <button onClick={handleSaveEditedStart} disabled={savingStart}
                        className="flex-1 px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50">
                        {savingStart ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {!signing && (
              <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-shrink-0">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 ${i === activeStep ? 'text-emerald-700' : i < activeStep ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {i < activeStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className={`w-3.5 h-3.5 rounded-full ${i === activeStep ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                  <span className="text-xs font-medium">{label}</span>
                </div>
                {i < stepLabels.length - 1 && <div className={`h-px flex-1 ${i < activeStep ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 py-5 flex-1">
            {/* VEHICLE CHECK — daily, required before anything else */}
            {phase === 'vehicle' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Daily Vehicle Check</h3>
                  <p className="text-sm text-slate-500">Before starting work today, complete your daily vehicle inspection on Safety Culture. Tap the link below to open it.</p>
                </div>

                <a href={VEHICLE_CHECK_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 bg-amber-50 rounded-xl border-2 border-amber-200 hover:bg-amber-100 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-amber-900 text-sm">Open Daily Vehicle Check</p>
                      <p className="text-xs text-amber-600 flex items-center gap-1">Tap to start the inspection <ExternalLink className="w-3 h-3" /></p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-amber-600 flex-shrink-0" />
                </a>

                <button onClick={handleVehicleCheckComplete}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 active:scale-95 transition text-sm font-bold touch-manipulation">
                  <CheckCircle2 className="w-5 h-5" /> I've Completed the Vehicle Check
                </button>
                <p className="text-xs text-slate-400 text-center">You only need to do this once per day.</p>
              </div>
            )}

            {/* INTRO */}
            {phase === 'intro' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-emerald-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to site</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  Quick briefing before you start. Review any documents, confirm your site induction, note today's plan, and sign off.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Job Details</p>
                  <p className="font-bold text-slate-900 text-lg mb-1">{job.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="break-words">{job.location}</span>
                  </div>
                  {client && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span>{client.name}</span>
                    </div>
                  )}
                </div>
                {crewTotal > 1 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-4 text-left">
                    <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-800 font-medium">
                      {crewTotal} crew members assigned today. Each person can start work as soon as they've signed their own briefing — you don't need to wait for the rest of the crew.
                    </p>
                  </div>
                )}
                {/* Briefing start time picker */}
                <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-200 text-left">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Briefing Start Time</label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input type="time" value={pendingStartTime} onChange={e => setPendingStartTime(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Change this if you got on site earlier or had to wait before starting the briefing.</p>
                </div>
                <button onClick={handleBeginBriefing} disabled={savingStart}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation disabled:opacity-50">
                  {savingStart ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />} Begin Briefing
                </button>
              </div>
            )}

            {/* DOCUMENTS */}
            {phase === 'documents' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Mandatory Documents</h3>
                  <p className="text-sm text-slate-500">Review each document and tick the box to confirm you've read it.</p>
                </div>
                {briefingDocs.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-6 text-center">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No mandatory documents for this job.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {briefingDocs.map(doc => {
                      const reviewed = reviewedDocIds.has(doc.id);
                      const isWorkOrder = doc.category === 'scope_of_work';
                      const isSiteMap = doc.category === 'site_map';
                      const badge = isWorkOrder
                        ? { label: 'Work Order', cls: 'bg-amber-100 text-amber-700' }
                        : isSiteMap
                          ? { label: 'Site Map', cls: 'bg-emerald-100 text-emerald-700' }
                          : null;
                      return (
                        <div key={doc.id} className={`rounded-xl border-2 transition ${reviewed ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50/50 rounded-t-xl transition">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className={`w-5 h-5 flex-shrink-0 ${isWorkOrder ? 'text-amber-600' : 'text-emerald-600'}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-semibold text-slate-900 text-sm truncate">{doc.document_name}</p>
                                  {badge && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex-shrink-0 ${badge.cls}`}>
                                      {badge.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-emerald-600 flex items-center gap-1">Tap to open <ExternalLink className="w-3 h-3" /></p>
                              </div>
                            </div>
                          </a>
                          <button onClick={() => toggleDocReviewed(doc.id)}
                            className={`flex items-center gap-2 w-full px-3.5 py-2.5 border-t-2 ${reviewed ? 'border-emerald-200' : 'border-slate-100'} text-left transition`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${reviewed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                              {reviewed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${reviewed ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {reviewed ? 'Reviewed' : 'I have read this document'}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={goPrevSkipAware} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext} disabled={!allDocsReviewed}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {!allDocsReviewed && briefingDocs.length > 0 && (
                  <p className="text-xs text-amber-600 text-center">Please review all documents to continue.</p>
                )}
              </div>
            )}

            {/* INDUCTION — one-time, third-party */}
            {phase === 'induction' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Site Induction</h3>
                  <p className="text-sm text-slate-500">This is done once on your first day at this site by a third party (site manager, principal contractor). Just record who did it for our records.</p>
                </div>

                {/* Site safety reference */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Site Safety Info</p>
                  {job.fire_assembly_point && (
                    <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-3 border border-red-100">
                      <Flame className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">Fire Assembly Point</p>
                        <p className="text-sm text-slate-700 mt-0.5">{job.fire_assembly_point}</p>
                      </div>
                    </div>
                  )}
                  {job.first_aid_location && (
                    <div className="flex items-start gap-3 bg-rose-50/50 rounded-xl p-3 border border-rose-100">
                      <HeartPulse className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">First Aid</p>
                        <p className="text-sm text-slate-700 mt-0.5">{job.first_aid_location}</p>
                      </div>
                    </div>
                  )}
                  {job.emergency_procedures && (
                    <div className="flex items-start gap-3 bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Emergency Procedures</p>
                        <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{job.emergency_procedures}</p>
                      </div>
                    </div>
                  )}
                  {!job.fire_assembly_point && !job.first_aid_location && !job.emergency_procedures && (
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-500">No site-specific safety info recorded for this job.</p>
                    </div>
                  )}
                </div>

                {/* Who did the induction? */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Who completed your site induction?</label>
                  <input type="text" value={inductionCompletedBy} onChange={e => setInductionCompletedBy(e.target.value)}
                    placeholder="e.g. John Smith (Balfour Beatty site manager)"
                    className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                  <p className="text-[11px] text-slate-400 mt-1">Just for our records — enter the name of the person who inducted you.</p>
                </div>

                {/* Confirmation */}
                <button onClick={() => setInductionConfirmed(!inductionConfirmed)}
                  className={`flex items-start gap-2.5 w-full text-left rounded-xl border-2 p-3.5 transition ${inductionConfirmed ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${inductionConfirmed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                    {inductionConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${inductionConfirmed ? 'text-emerald-700' : 'text-slate-600'}`}>
                    I've completed the site induction.
                  </span>
                </button>

                <div className="flex gap-2 pt-1">
                  <button onClick={goPrevSkipAware} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext} disabled={!inductionConfirmed}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {!inductionConfirmed && (
                  <p className="text-xs text-amber-600 text-center">Please confirm the induction to continue.</p>
                )}
              </div>
            )}

            {/* DAILY AGENDA — each day's plan, blockers, what's left */}
            {phase === 'agenda' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Daily Agenda</h3>
                  <p className="text-sm text-slate-500">Quick run-through of today's plan. This is separate from the site induction — just a daily catch-up.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What's the plan today?</label>
                    <textarea value={agendaPlan} onChange={e => setAgendaPlan(e.target.value)} rows={2}
                      placeholder="e.g. Drill BH-03 and BH-04, then set up the standpipe"
                      className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Any blockers?</label>
                    <textarea value={agendaBlockers} onChange={e => setAgendaBlockers(e.target.value)} rows={2}
                      placeholder="e.g. Waiting on client to confirm borehole locations"
                      className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What's left to sort out?</label>
                    <textarea value={agendaLeft} onChange={e => setAgendaLeft(e.target.value)} rows={2}
                      placeholder="e.g. Need more casing, rig service due next week"
                      className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white resize-none" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={goPrevSkipAware} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* RISK / POWRA */}
            {phase === 'risk' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Point of Work Risk Assessment</h3>
                  <p className="text-sm text-slate-500">Complete your POWRA on Safety Culture before starting any work. Tap the link below.</p>
                </div>

                <a href={POWRA_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200 hover:bg-emerald-100 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-emerald-900 text-sm">Open POWRA on Safety Culture</p>
                      <p className="text-xs text-emerald-600 flex items-center gap-1">Tap to start the inspection <ExternalLink className="w-3 h-3" /></p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                </a>

                <button onClick={() => setPowraConfirmed(!powraConfirmed)}
                  className={`flex items-start gap-2.5 w-full text-left rounded-xl border-2 p-3.5 transition ${powraConfirmed ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${powraConfirmed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                    {powraConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${powraConfirmed ? 'text-emerald-700' : 'text-slate-600'}`}>
                    I have completed the Point of Work Risk Assessment on Safety Culture.
                  </span>
                </button>

                {/* EQUIPMENT & PLANT INSPECTION — all staff */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">Equipment &amp; Plant Inspection</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">Complete this on Safety Culture before you start work.</p>
                </div>

                <a href={EQUIP_CHECK_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 bg-blue-50 rounded-xl border-2 border-blue-200 hover:bg-blue-100 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-blue-900 text-sm">Open Equipment &amp; Plant Inspection</p>
                      <p className="text-xs text-blue-600 flex items-center gap-1">Tap to start the inspection <ExternalLink className="w-3 h-3" /></p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0" />
                </a>

                {/* Admin-configured safety form buttons for the briefing step */}
                <SafetyFormsList step="briefing" />

                <button onClick={() => setEquipCheckConfirmed(!equipCheckConfirmed)}
                  className={`flex items-start gap-2.5 w-full text-left rounded-xl border-2 p-3.5 transition ${equipCheckConfirmed ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${equipCheckConfirmed ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {equipCheckConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${equipCheckConfirmed ? 'text-blue-700' : 'text-slate-600'}`}>
                    I have completed the Equipment &amp; Plant Inspection on Safety Culture.
                  </span>
                </button>

                <div className="flex gap-2 pt-1">
                  <button onClick={goPrevSkipAware} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext} disabled={!powraConfirmed || !equipCheckConfirmed}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {(!powraConfirmed || !equipCheckConfirmed) && (
                  <p className="text-xs text-amber-600 text-center">Please confirm the POWRA and Equipment &amp; Plant Inspection are complete to continue.</p>
                )}
              </div>
            )}

            {/* TRAVEL */}
            {phase === 'travel' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Travel to Site</h3>
                  <p className="text-sm text-slate-500">Log your travel time — it becomes your first task entry for the day. Skip if you didn't travel (e.g. already on site).</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Left home</label>
                    <input type="time" value={travelDepartHome} onChange={e => setTravelDepartHome(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived on site</label>
                    <input type="time" value={travelArriveSite} onChange={e => setTravelArriveSite(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                  </div>
                </div>
                {travelDepartHome && travelArriveSite && (() => {
                  const [dh, dm] = travelDepartHome.split(':').map(Number);
                  const [ah, am] = travelArriveSite.split(':').map(Number);
                  const m = (ah * 60 + am) - (dh * 60 + dm);
                  if (m <= 0) return (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-800 font-medium">Arrival time must be after departure.</p>
                    </div>
                  );
                  return (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                      <Car className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-xs text-blue-800 font-medium">Travel time: {Math.floor(m / 60)}h {m % 60}m</p>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <button onClick={goPrevSkipAware} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* SIGN */}
            {phase === 'sign' && (
              <div className="space-y-4">
                {offlineSaved ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                      <WifiOff className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Saved offline</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Your briefing signature has been saved on this device. It will sync automatically when you reconnect to the internet.
                    </p>
                    <button onClick={() => onSigned({ offline: true })} className="mt-5 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold">
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">Sign the Briefing</h3>
                      <p className="text-sm text-slate-500">Draw your signature below to confirm and sign off.</p>
                    </div>

                    {/* Declaration */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Declaration</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        By signing below, I confirm I've reviewed the documents, completed the site induction, noted today's plan, and understand the site hazards. I'm fit to work.
                      </p>
                    </div>

                    {/* Signature pad */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signature</label>
                      <SignaturePad onChange={setSignatureDataUrl} />
                    </div>

                    {!navigator.onLine && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                        <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800 font-medium">You're offline — your signature will sync when you reconnect.</p>
                      </div>
                    )}

                    {crewTotal > 1 && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                        <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <p className="text-xs text-blue-800 font-medium">
                          {crewSignedCount + 1} of {crewTotal} crew signed off. Your shift starts as soon as you sign — others will join once they complete their briefing.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={goPrev} disabled={signing} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <button onClick={handleSign} disabled={!signatureDataUrl || signing}
                        className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                        {signing ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Signing…</>
                        ) : (
                          <><PenLine className="w-5 h-5" /> Sign Briefing</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}