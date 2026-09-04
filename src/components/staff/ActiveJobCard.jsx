import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Truck, PlayCircle, Navigation,
  ChevronDown, ShieldCheck, Briefcase, Phone, Hotel, FileText, ExternalLink,
  Ruler, CheckCircle2, AlertTriangle, MessageSquare, Camera, DoorOpen, Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatJobType } from '@/utils/format';
import { isBeforeSiteOpen } from '@/utils/siteHours';
import SitePhotoUpload from '@/components/SitePhotoUpload';
import EquipmentComplianceSection from '@/components/staff/EquipmentComplianceSection';
import JobDocumentViewer from '@/components/staff/JobDocumentViewer';
import PredictiveHazardAlerts from '@/components/jobs/PredictiveHazardAlerts';
import WeatherLeaveSiteAlert from '@/components/weather/WeatherLeaveSiteAlert';
import WeatherToggleButton from '@/components/weather/WeatherToggleButton';

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, color: 'text-slate-600', bg: 'bg-gradient-to-r from-slate-50 to-slate-100/50' },
  started: { label: 'In Progress', icon: PlayCircle, color: 'text-blue-700', bg: 'bg-gradient-to-r from-blue-50 to-blue-100/40' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-[#2E5A1A]', bg: 'bg-gradient-to-r from-[#2E5A1A]/8 to-[#8DC63F]/8' },
};

// The hero card for the active/next job today — big, focused, one primary action.
// Details are collapsible so the button is always visible without scrolling.
export default function ActiveJobCard({
  assignment, job, vehicle, client, staff,
  onOpenShiftWizard, onLeaveSite,
  canPerformActions = true, tasksSubmitted = false, needsBriefing = false,
  arrivedOnSite = false, crewSignedCount = 0, crewTotal = 0, allCrewSigned = false,
  previousProgress = [], hotelBooking = null, onAdHocVisit,
  jobAssets = [], assetMap = {}, complianceItems = [],
}) {
  const [showDetails, setShowDetails] = useState(false);
  const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
  const StatusIcon = status.icon;
  // Allow starting up to 2 hours before the scheduled start time — crews often
  // arrive early and shouldn't be blocked from checking in.
  const scheduledStart = new Date(assignment.assigned_date + 'T' + (assignment.start_time || '00:00:00'));
  const EARLY_START_GRACE_MS = 2 * 60 * 60 * 1000;
  const canStart = new Date() >= new Date(scheduledStart.getTime() - EARLY_START_GRACE_MS);
  const isEarlyStart = canStart && new Date() < scheduledStart;

  if (!job) return null;

  const isCompleted = assignment.status === 'completed';
  const isStarted = assignment.status === 'started';
  const isAssigned = (assignment.status || 'assigned') === 'assigned';

  // "Leave Site" grace window — after staff record that they've left site the
  // job stays open (still 'started') for up to 5 hours so they can enter their
  // travel-home time and review/submit their timesheet when they get home.
  const LEFT_SITE_WINDOW_MS = 5 * 60 * 60 * 1000;
  const leftSiteAt = assignment.left_site_at ? new Date(assignment.left_site_at) : null;
  const hasLeftSite = isStarted && !!leftSiteAt;
  const windowMsLeft = hasLeftSite ? (leftSiteAt.getTime() + LEFT_SITE_WINDOW_MS) - Date.now() : 0;
  const windowExpired = hasLeftSite && windowMsLeft <= 0;
  const fmtRemaining = (ms) => {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Determine the single primary action button
  let primaryButton = null;
  if (isAssigned && canPerformActions && canStart) {
    primaryButton = (
      <button onClick={() => onOpenShiftWizard(assignment.id)} type="button"
        className="w-full flex items-center justify-center gap-2.5 px-5 py-5 command-gradient text-white rounded-2xl text-lg font-bold shadow-xl shadow-[#2E5A1A]/35 active:scale-95 transition touch-manipulation glow-brand">
        <PlayCircle className="w-7 h-7" strokeWidth={2.5} /> {isEarlyStart ? 'Start Early' : 'Start Shift'}
      </button>
    );
  } else if (isStarted && canPerformActions && hasLeftSite) {
    primaryButton = (
      <button onClick={() => onOpenShiftWizard(assignment.id, { forceStep: 'end_of_shift' })} type="button"
        className="w-full flex items-center justify-center gap-2.5 px-5 py-5 command-gradient text-white rounded-2xl text-lg font-bold shadow-xl shadow-[#2E5A1A]/35 active:scale-95 transition touch-manipulation glow-brand">
        <Send className="w-7 h-7" strokeWidth={2.5} /> Finish & Submit Timesheet
      </button>
    );
  } else if (isStarted && canPerformActions) {
    primaryButton = (
      <button onClick={() => onOpenShiftWizard(assignment.id)} type="button"
        className="w-full flex items-center justify-center gap-2.5 px-5 py-5 command-gradient text-white rounded-2xl text-lg font-bold shadow-xl shadow-[#2E5A1A]/35 active:scale-95 transition touch-manipulation glow-brand">
        <PlayCircle className="w-7 h-7" strokeWidth={2.5} /> Continue Shift
      </button>
    );
  } else if (isCompleted) {
    primaryButton = (
      <div className="w-full flex items-center justify-center gap-2.5 px-5 py-5 bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 text-[#2E5A1A] rounded-2xl text-lg font-bold ring-1 ring-[#2E5A1A]/15">
        <CheckCircle2 className="w-7 h-7" strokeWidth={2.5} /> Shift Completed
      </div>
    );
  } else if (isAssigned && !canStart) {
    primaryButton = (
      <div className="w-full flex items-center justify-center gap-2.5 px-5 py-4 bg-slate-100/80 text-slate-500 rounded-2xl text-base font-semibold">
        <Clock className="w-6 h-6" /> Starts {format(scheduledStart, 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
      </div>
    );
  } else if (isAssigned && !canPerformActions) {
    primaryButton = (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-100/80 text-slate-600 rounded-2xl text-sm font-semibold">
        <Clock className="w-5 h-5" /> {isBeforeSiteOpen() ? 'Unlocks at 8:00 AM' : 'Outside working hours'}
      </div>
    );
  }

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="insight-card rounded-3xl overflow-hidden"
    >
      {/* Status strip — gradient with subtle depth */}
      <div className={`px-4 py-3 flex items-center justify-between ${status.bg} border-b border-slate-100/50`}>
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${status.color}`}>
          <StatusIcon className="w-4 h-4" strokeWidth={2.5} /> {status.label}
        </span>
        <div className="flex items-center gap-2">
          {isStarted && assignment.started_at && (
            <span className="text-xs text-slate-500">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
          )}
          {assignment.is_overtime && (
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              OT{assignment.rate_multiplier ? ` ${Number(assignment.rate_multiplier)}x` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 md:p-5">
        <h2 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">{job.name}</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <MapPin className="w-5 h-5 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
            <span className="break-words">{job.location}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#2E5A1A]/60" /> {format(new Date(assignment.assigned_date), 'EEE dd MMM')}
            </span>
            {assignment.start_time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#2E5A1A]/60" /> {assignment.start_time}{assignment.end_time ? `–${assignment.end_time}` : ''}
              </span>
            )}
            {vehicle && (
              <span className="inline-flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#2E5A1A]/60" /> <span className="font-mono font-medium">{vehicle.registration_number}</span>
              </span>
            )}
          </div>
        </div>

        {/* Primary action — always visible */}
        <div className="mt-4">{primaryButton}</div>

        {/* Severe weather auto-prompt — shown when conditions are unsafe */}
        {isStarted && canPerformActions && !hasLeftSite && job.site_lat != null && job.site_lng != null && (
          <WeatherLeaveSiteAlert
            lat={job.site_lat}
            lng={job.site_lng}
            isDrillingJob={job.drilling_method && job.drilling_method !== 'not_applicable'}
            onLeaveSite={() => onLeaveSite?.(assignment.id)}
          />
        )}

        {/* Early start notice */}
        {isAssigned && isEarlyStart && canPerformActions && (
          <div className="mt-2.5 flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            You're starting before your scheduled time ({assignment.start_time}). Your shift is ready when you are.
          </div>
        )}

        {/* Secondary actions for started jobs */}
        {isStarted && canPerformActions && !hasLeftSite && (
          <div className="flex gap-2.5 mt-3">
            <button onClick={() => onLeaveSite?.(assignment.id)} type="button"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-[#2E5A1A]/10 text-[#2E5A1A] rounded-2xl hover:bg-[#2E5A1A]/15 active:scale-95 transition text-sm font-semibold touch-manipulation">
              <DoorOpen className="w-5 h-5" /> Leave Site
            </button>
            {onAdHocVisit && (
              <button onClick={onAdHocVisit} type="button"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold touch-manipulation">
                <Navigation className="w-5 h-5" /> Ad-hoc Visit
              </button>
            )}
          </div>
        )}
        {isStarted && canPerformActions && hasLeftSite && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${windowExpired ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>
            <Clock className="w-4 h-4 flex-shrink-0" />
            {windowExpired
              ? <>5-hour window has passed — please submit your timesheet now.</>
              : <>Left site at {format(leftSiteAt, 'HH:mm')} · {fmtRemaining(windowMsLeft)} left to submit your timesheet.</>}
          </div>
        )}

        {/* Details toggle */}
        <button onClick={() => setShowDetails(s => !s)} type="button"
          className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition">
          {showDetails ? 'Hide' : 'Show'} Details
          <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="p-4 space-y-4">
              {/* Live weather — on-demand popup button (replaces always-on weather card) */}
              <WeatherToggleButton
                lat={job.site_lat}
                lng={job.site_lng}
                locationName={job.location}
                isDrillingJob={job.drilling_method && job.drilling_method !== 'not_applicable'}
              />

              {/* Predictive hazard alerts — shown first so crews see risks before working */}
              <PredictiveHazardAlerts job={job} compact />

              {/* Contacts & info */}
              <div className="space-y-2">
                {client && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Briefcase className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
                    <span>Client: <span className="font-medium text-slate-700">{client.name}</span></span>
                  </div>
                )}
                {(job.site_contact_name || job.site_contact_phone) && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
                    <div>
                      {job.site_contact_name && <span className="font-medium text-slate-700">{job.site_contact_name}</span>}
                      {job.site_contact_phone && (
                        <a href={`tel:${job.site_contact_phone}`} className="ml-1.5 inline-flex items-center gap-1 text-[#2E5A1A] font-semibold hover:underline">
                          {job.site_contact_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {assignment.meterage != null && assignment.meterage > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <Ruler className="w-4 h-4" /> {assignment.meterage}m recorded
                  </div>
                )}
              </div>

              {/* Requisition list */}
              {job.requisition_list_url && (
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-3 bg-[#2E5A1A]/10 rounded-xl border border-[#2E5A1A]/15 hover:bg-[#2E5A1A]/15 transition group">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
                    <span className="font-semibold text-[#2E5A1A] text-sm truncate">{job.requisition_list_name || 'Requisition List'}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 group-hover:translate-x-0.5 transition" />
                </a>
              )}

              {/* Job notes */}
              {job.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                </div>
              )}

              {/* Previous progress */}
              {previousProgress.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 tracking-wide">Previous Shifts</p>
                  </div>
                  <div className="space-y-2">
                    {previousProgress.map((p, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-slate-500">{format(new Date(p.date + 'T00:00:00'), 'dd MMM')}</span>
                          <span className="text-xs text-slate-400">· {p.staffName}</span>
                        </div>
                        <p className="text-slate-600 text-xs leading-relaxed">{p.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hotel booking */}
              {hotelBooking && (
                <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Hotel className="w-4 h-4 text-blue-700" />
                    <p className="text-xs font-bold text-blue-900 tracking-wide">Hotel Booking</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{hotelBooking.hotel_name}</p>
                  {hotelBooking.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(hotelBooking.address + ' ' + (hotelBooking.hotel_name || ''))}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-xs text-slate-600 mt-1 hover:text-blue-700 transition">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{hotelBooking.address}</span>
                    </a>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 flex-wrap">
                    {hotelBooking.check_in_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> {format(new Date(hotelBooking.check_in_date + 'T00:00:00'), 'dd MMM')}{hotelBooking.check_out_date ? ` – ${format(new Date(hotelBooking.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}
                      </span>
                    )}
                    {hotelBooking.room_type && <span>· {hotelBooking.room_type}</span>}
                  </div>
                  {hotelBooking.contact_phone && (
                    <a href={`tel:${hotelBooking.contact_phone}`} className="inline-flex items-center gap-1 text-xs text-blue-700 font-semibold hover:underline mt-2">
                      <Phone className="w-3 h-3" /> {hotelBooking.contact_phone}
                    </a>
                  )}
                </div>
              )}

              {/* Equipment & certificates */}
              {jobAssets.length > 0 && (() => {
                // Deduplicate by asset_id so the same rig doesn't appear twice
                // when multiple JobAssetAssignment rows point to one SiteAsset.
                const seen = new Set();
                const assets = jobAssets.map(a => assetMap[a.asset_id] || a)
                  .filter(Boolean)
                  .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
                return (
                  <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 tracking-wide">Equipment & Certificates</p>
                    </div>
                    <EquipmentComplianceSection assets={assets} complianceItems={complianceItems} />
                  </div>
                );
              })()}

              {/* Job documents */}
              <JobDocumentViewer jobId={job.id} />

              {/* Briefing status */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                {assignment.briefing_signed ? (
                  <div className="bg-[#2E5A1A]/5 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-[#2E5A1A]">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium">Briefing signed</span>
                      {assignment.briefing_signed_at && (
                        <span className="text-xs text-slate-400 ml-auto">{format(new Date(assignment.briefing_signed_at), 'dd MMM, HH:mm')}</span>
                      )}
                    </div>
                    {!allCrewSigned && crewTotal > 1 && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2E5A1A]/15 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{crewSignedCount} of {crewTotal} crew signed off.</span>
                      </div>
                    )}
                  </div>
                ) : needsBriefing ? (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{arrivedOnSite ? 'Tap "Start Shift" to begin briefing.' : 'Tap "Start Shift" to log travel & start briefing.'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0 text-slate-400" />
                    <span>Briefing completed on a previous shift.</span>
                  </div>
                )}
                {tasksSubmitted ? (
                  <SitePhotoUpload jobId={job.id} staffName={staff.name} />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">
                    <Camera className="w-4 h-4 flex-shrink-0" />
                    <span>Site photos unlock after you submit your daily tasks.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}