import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Briefcase, Truck, FileText, ExternalLink, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Ruler, ChevronDown, Camera, ShieldCheck, MessageSquare, XCircle, PauseCircle, AlertTriangle, Phone, Hotel, Navigation, DoorOpen, Send } from 'lucide-react';
import { format } from 'date-fns';
import SitePhotoUpload from '@/components/SitePhotoUpload';
import EquipmentComplianceSection from '@/components/staff/EquipmentComplianceSection';
import JobDocumentViewer from '@/components/staff/JobDocumentViewer';

import { formatJobType } from '@/utils/format';
import { isWithinSiteHours, isBeforeSiteOpen } from '@/utils/siteHours';

const jobTypeDot = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};
const jobTypeAccent = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};
const jobTypeBadgeColors = {
  groundworks: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
};
const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  started: { label: 'In Progress', icon: PlayCircle, badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Completed', icon: CheckCircle2, badge: 'bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20' }
};

export default function AssignmentCard({ assignment, job, vehicle, client, staff, defaultExpanded = false, onOpenShiftWizard, onEarlyLeave, onLeaveSite, tasksSubmitted = false, needsBriefing = false, arrivedOnSite = false, crewSignedCount = 0, crewTotal = 0, allCrewSigned = false, previousProgress = [], onConfirmShift, onDeclineShift, canPerformActions = true, hotelBooking = null, onAdHocVisit, jobAssets = [], assetMap = {}, complianceItems = [] }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
  const StatusIcon = status.icon;
  const isDriller = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
  const accent = jobTypeAccent[job?.job_type] || jobTypeAccent.depot;
  const scheduledStart = new Date(assignment.assigned_date + 'T' + (assignment.start_time || '00:00:00'));
  const canStart = new Date() >= scheduledStart;
  const leftSiteAt = assignment.left_site_at ? new Date(assignment.left_site_at) : null;
  const hasLeftSite = assignment.status === 'started' && !!leftSiteAt;
  if (!job) return null;

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="field-card overflow-hidden">
      <div className={`h-1.5 ${accent}`} />

      {job.status === 'on_hold' && (
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2.5">
          <PauseCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-ui-caption font-semibold text-amber-800">This job is on hold</p>
            <p className="text-ui-micro text-amber-700 mt-0.5">Do not start work until management confirms it has resumed. {job.status_reason ? `Reason: ${job.status_reason}` : ''}</p>
          </div>
        </div>
      )}

      {/* Compact header — always visible */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 md:p-5 flex items-start gap-3 hover:bg-slate-50/40 transition">
        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-offset-2 ring-offset-white ${assignment.status === 'completed' ? 'bg-[#2E5A1A] ring-[#2E5A1A]/20' : assignment.status === 'started' ? 'bg-blue-500 ring-blue-500/20' : 'bg-slate-300 ring-slate-300/20'}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-ui-heading font-bold text-slate-900 leading-tight truncate tracking-tight">{job.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded text-ui-caption font-semibold ${jobTypeBadgeColors[job.job_type]}`}>{formatJobType(job.job_type)}</span>
            {assignment.is_overtime && (
              <span className="inline-block px-2 py-0.5 rounded text-ui-caption font-bold bg-amber-100 text-amber-700">
                OT{assignment.rate_multiplier ? ` ${Number(assignment.rate_multiplier)}x` : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-ui-body text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{format(new Date(assignment.assigned_date), 'EEE dd MMM')}</span>
            </span>
            {assignment.start_time && (
              <span className="inline-flex items-center gap-1 text-ui-body text-slate-500">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{assignment.start_time}{assignment.end_time ? `–${assignment.end_time}` : ''}</span>
              </span>
            )}
            {vehicle && (
              <span className="inline-flex items-center gap-1 text-ui-body text-slate-500">
                <Truck className="w-4 h-4 text-slate-400" />
                <span className="font-mono font-medium">{vehicle.registration_number}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-ui-body font-semibold ${status.badge}`}>
            <StatusIcon className="w-4 h-4" /> <span className="hidden sm:inline">{status.label}</span>
          </span>

          {assignment.status === 'started' && assignment.started_at && (
            <span className="text-ui-caption text-slate-400 hidden md:inline">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
          )}
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {/* Quick actions row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(assignment.status || 'assigned') === 'assigned' && !canPerformActions && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-ui-caption font-semibold">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" /> {isBeforeSiteOpen() ? 'Early access — work actions unlock at 8:00 AM' : 'Outside working hours (8am–5pm) — come back tomorrow'}
              </div>
            )}
            {(assignment.status || 'assigned') === 'assigned' && canPerformActions && (
              <div className="flex flex-col gap-2 w-full">
                {canStart ? (
                  <button onClick={() => onOpenShiftWizard(assignment.id)}
                    className="flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl hover:shadow-lg active:scale-95 transition text-base font-bold touch-manipulation shadow-md shadow-[#2E5A1A]/25 glow-brand">
                    <PlayCircle className="w-6 h-6" strokeWidth={2.5} /> Start Shift
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold">
                    <Clock className="w-5 h-5" /> Starts {format(new Date(assignment.assigned_date + 'T00:00:00'), 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
                  </span>
                )}
              </div>
            )}
            {assignment.status === 'started' && !canPerformActions && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-ui-caption font-semibold">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" /> {isBeforeSiteOpen() ? 'Early access — shift actions unlock at 8:00 AM' : 'Outside working hours — actions resume at 8:00 AM'}
              </div>
            )}
            {assignment.status === 'started' && canPerformActions && (
              <div className="flex flex-col gap-2 w-full">
                {hasLeftSite && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    Left site at {format(leftSiteAt, 'HH:mm')} — submit your travel home & timesheet.
                  </div>
                )}
                <div className="flex flex-wrap gap-2.5 w-full">
                  {hasLeftSite ? (
                    <button onClick={() => onOpenShiftWizard(assignment.id, { forceStep: 'end_of_shift' })}
                      className="flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl hover:shadow-lg active:scale-95 transition text-base font-bold touch-manipulation flex-1 min-w-[160px] shadow-md shadow-[#2E5A1A]/25 glow-brand">
                      <Send className="w-6 h-6" strokeWidth={2.5} /> Finish & Submit Timesheet
                    </button>
                  ) : (
                    <>
                      <button onClick={() => onOpenShiftWizard(assignment.id)}
                        className="flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl hover:shadow-lg active:scale-95 transition text-base font-bold touch-manipulation flex-1 min-w-[160px] shadow-md shadow-[#2E5A1A]/25 glow-brand">
                        <PlayCircle className="w-6 h-6" strokeWidth={2.5} /> Continue Shift
                      </button>
                      <button onClick={() => onLeaveSite?.(assignment.id)}
                        className="flex items-center gap-2 px-4 py-4 bg-[#2E5A1A]/10 text-[#2E5A1A] rounded-2xl hover:bg-[#2E5A1A]/15 active:scale-95 transition text-ui-body font-semibold">
                        <DoorOpen className="w-5 h-5" /> Leave Site
                      </button>
                      <button onClick={() => onEarlyLeave(assignment.id)}
                        className="flex items-center gap-2 px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-ui-body font-semibold">
                        <PauseCircle className="w-5 h-5" /> Early Leave
                      </button>
                      {onAdHocVisit && (
                        <button onClick={onAdHocVisit}
                          className="flex items-center gap-2 px-4 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 active:scale-95 transition text-ui-body font-semibold">
                          <Navigation className="w-5 h-5" /> Ad-hoc Visit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Previous shift progress */}
          {previousProgress.length > 0 && (
            <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-3.5">
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

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" />
                <span className="break-words">{job.location}</span>
              </div>
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
                    <span>Site Contact: </span>
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
            <div className="space-y-2">
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
              {job.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Hotel booking details */}
          {hotelBooking && (
            <div className="mb-4 bg-blue-50/60 rounded-xl border border-blue-100 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Hotel className="w-4 h-4 text-blue-700" />
                <p className="text-xs font-bold text-blue-900 tracking-wide">Hotel Booking</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{hotelBooking.hotel_name}</p>
              {hotelBooking.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(hotelBooking.address + ' ' + (hotelBooking.hotel_name || ''))}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs text-slate-600 mt-1 hover:text-blue-700 transition">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{hotelBooking.address} <Navigation className="w-3 h-3 inline text-blue-500" /></span>
                </a>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 flex-wrap">
                {hotelBooking.check_in_date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {format(new Date(hotelBooking.check_in_date + 'T00:00:00'), 'dd MMM')}{hotelBooking.check_out_date ? ` – ${format(new Date(hotelBooking.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}</span>
                )}
                {hotelBooking.room_type && <span>· {hotelBooking.room_type}</span>}
                {hotelBooking.booking_reference && <span className="flex items-center gap-1">· <FileText className="w-3 h-3" /> {hotelBooking.booking_reference}</span>}
              </div>
              {hotelBooking.contact_phone && (
                <a href={`tel:${hotelBooking.contact_phone}`} className="inline-flex items-center gap-1 text-xs text-blue-700 font-semibold hover:underline mt-2">
                  <Phone className="w-3 h-3" /> {hotelBooking.contact_phone}
                </a>
              )}
              {hotelBooking.notes && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{hotelBooking.notes}</p>}
            </div>
          )}

          {/* Equipment & Certificates */}
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

          {/* Job documents — site maps, scope of work, RAMS etc. */}
          <JobDocumentViewer jobId={job.id} />

          {/* Briefing status + photos */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {assignment.briefing_signed ? (
              <div className="bg-[#2E5A1A]/5 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-[#2E5A1A]">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">You've signed the briefing</span>
                  {assignment.briefing_signed_at && (
                    <span className="text-xs text-slate-400 ml-auto">{format(new Date(assignment.briefing_signed_at), 'dd MMM yyyy, HH:mm')}</span>
                  )}
                </div>
                {assignment.briefing_start_at && assignment.briefing_signed_at && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 pl-6">
                    <span>Start: {format(new Date(assignment.briefing_start_at), 'HH:mm')}</span>
                    <span>End: {format(new Date(assignment.briefing_signed_at), 'HH:mm')}</span>
                    <span className="font-medium text-slate-600">Duration: {Math.round((new Date(assignment.briefing_signed_at) - new Date(assignment.briefing_start_at)) / 60000)}m</span>
                  </div>
                )}
                {!allCrewSigned && crewTotal > 1 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2E5A1A]/15 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{crewSignedCount} of {crewTotal} crew signed off — you can start work; others will join once briefed.</span>
                  </div>
                )}
                {allCrewSigned && crewTotal > 1 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#2E5A1A]/15 text-xs text-[#2E5A1A]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-medium">All crew briefed.</span>
                  </div>
                )}
              </div>
            ) : needsBriefing ? (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{arrivedOnSite ? 'Tap "Start Briefing / Induction" to continue.' : 'Tap "Arrived on Site" to log your travel and start the briefing.'}</span>
                {crewTotal > 1 && (
                  <span className="text-xs text-amber-600 ml-auto">{crewSignedCount}/{crewTotal} crew briefed</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span>Briefing completed on a previous shift.</span>
              </div>
            )}
            {assignment.progress_notes && assignment.status === 'completed' && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                <p className="text-xs font-semibold text-slate-400 mb-1">Shift Progress Notes</p>
                <p className="text-slate-600 text-xs leading-relaxed">{assignment.progress_notes}</p>
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
      )}
    </motion.div>
  );
}