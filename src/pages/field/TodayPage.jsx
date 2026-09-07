import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Calendar, CalendarDays, CalendarClock, Clock, HardHat, ShieldCheck, AlertTriangle, ScanLine, Package, Play, Car } from 'lucide-react';
import { format } from 'date-fns';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import AssignmentCard from '@/components/staff/AssignmentCard';
import DepotAssignmentCard from '@/components/staff/DepotAssignmentCard';
import EndOfDayCard from '@/components/staff/EndOfDayCard';
import { useToast } from '@/components/ui/use-toast';
import { saveOrQueue } from '@/utils/offlineSync';
import { isWithinSiteHours, isBeforeSiteOpen, SITE_OPEN_TIME, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { complianceDaysUntil } from '@/utils/complianceDate';
import OutsideSiteHours from '@/components/staff/OutsideSiteHours';
import ShiftWizard from '@/components/staff/ShiftWizard';
import EarlyLeaveModal from '@/components/staff/EarlyLeaveModal';
import TravelTimeModal from '@/components/staff/TravelTimeModal';
import ScheduleSplash from '@/components/staff/ScheduleSplash';
import NextJobPrompt from '@/components/staff/NextJobPrompt';
import AdHocVisitModal from '@/components/staff/AdHocVisitModal';
import TodayPrepStrip from '@/components/staff/TodayPrepStrip';
import SyncHUD from '@/components/staff/SyncHUD';
import FieldPageShell from '@/components/field/FieldPageShell';
import StaffHeaderActions from '@/components/field/StaffHeaderActions';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import StaffAlerts from '@/components/staff/StaffAlerts';
import ActiveJobCard from '@/components/staff/ActiveJobCard';
import IncentiveQuickLook from '@/components/staff/IncentiveQuickLook';
import DrillingWeatherWidget from '@/components/DrillingWeatherWidget';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import RigSignInScanner from '@/components/staff/RigSignInScanner';
import OfflineBanner from '@/components/field/OfflineBanner';
import KeyLogBookPromptBanner from '@/components/staff/KeyLogBookPromptBanner';
import PreWorkSafetyChecklist from '@/components/staff/PreWorkSafetyChecklist';
import StartMyDayHero from '@/components/staff/StartMyDayHero';
import DutiesSummaryCard from '@/components/staff/DutiesSummaryCard';
import ArrivalPromptBanner from '@/components/staff/ArrivalPromptBanner';
import TrackingConsentModal from '@/components/staff/TrackingConsentModal';
import TrackingConsentCard from '@/components/staff/TrackingConsentCard';
import DeliveryHeroToday from '@/components/staff/DeliveryHeroToday';
import DepotDutyCollapsible from '@/components/staff/DepotDutyCollapsible';
import TrackingIndicator from '@/components/staff/TrackingIndicator';
import { useFieldData } from '@/components/field/FieldDataProvider';

export default function TodayPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ctx = useFieldData();
  const {
    staff, loading, isPlatformAdmin, activeDivision,
    assignments, assignmentsLoading, visibleAssignments, todaysAssignments, upcomingAssignments,
    jobs, vehicles, clients, allStaff, allAssignments, mgrTimesheets, rotaWeeks, bizConfig, myCompliance,
    jobAssets, siteAssetsStaff, equipmentCompliance, myHotelBookings, rigs, myDeliveries,
    gpsTracking, gpsHasFix, gpsPointsQueued, gpsErrorType,
    queryClient,
  } = ctx;

  const [shiftWizard, setShiftWizard] = useState(null);
  const [earlyLeaveAssignment, setEarlyLeaveAssignment] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [showScheduleSummary, setShowScheduleSummary] = useState(false);
  const [showNextJobPrompt, setShowNextJobPrompt] = useState(false);
  const [showAdHocVisit, setShowAdHocVisit] = useState(false);
  const [showComplianceAlert, setShowComplianceAlert] = useState(false);
  const [showRigScanner, setShowRigScanner] = useState(false);
  const [showSafetyChecklist, setShowSafetyChecklist] = useState(false);
  const [safetyChecklistAssignment, setSafetyChecklistAssignment] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [travelAssignment, setTravelAssignment] = useState(null);
  const [travelDayType, setTravelDayType] = useState('monday');

  // ── Handlers (preserved exactly from StaffDashboard) ──
  const handleStartJob = async (assignmentId) => {
    try {
      const res = await base44.functions.invoke('updateMyAssignment', {
        assignmentId, updates: { status: 'started', started_at: new Date().toISOString() },
      });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      toast({ title: 'Could not start job', description: error.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleOpenShiftWizard = (assignmentId, opts = {}) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const hasMoreJobs = assignments.some(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed' && a.id !== assignmentId);
    setShiftWizard({ assignmentId, isLastJob: !hasMoreJobs, forceStep: opts.forceStep || null });
  };

  const handleArrivedConfirm = async ({ assignmentId, departHome, arriveSite, gpsPrefilled }) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const arrivedAt = new Date().toISOString();
    try {
      if (departHome && arriveSite) {
        const [dh, dm] = departHome.split(':').map(Number);
        const [ah, am] = arriveSite.split(':').map(Number);
        const travelMins = (ah * 60 + am) - (dh * 60 + dm);
        if (travelMins > 0) {
          const overrideNote = gpsPrefilled ? 'Manually adjusted from GPS time — manager review required' : '';
          await base44.entities.Timesheet.create({
            staff_id: staff.id, date: todayStr, job_id: assignment.job_id || '',
            task_description: 'Travel to site', task_type: 'travel_to',
            start_time: departHome, end_time: arriveSite,
            task_duration_minutes: travelMins,
            total_hours: Math.round((travelMins / 60) * 100) / 100,
            status: 'draft', travel_depart_home: departHome, travel_arrive_site: arriveSite,
            notes: overrideNote,
          });
        }
      }
      const res = await base44.functions.invoke('updateMyAssignment', {
        assignmentId: assignment.id, updates: { arrived_on_site_at: arrivedAt },
      });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not confirm arrival. Please try again.', variant: 'destructive' });
    }
  };

  const handleLeaveSite = (assignmentId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    setEarlyLeaveAssignment(assignment);
  };

  const handleEarlyLeaveConfirm = async ({ reason, note, leave_time, travel_minutes }) => {
    const assignment = earlyLeaveAssignment;
    if (!assignment) return;
    setEarlyLeaveAssignment(null);
    try {
      // Build the left_site_at timestamp from the leave_time if provided (HH:MM today)
      let leftAt = new Date();
      if (leave_time) {
        const [h, m] = leave_time.split(':').map(Number);
        leftAt.setHours(h, m, 0, 0);
      }
      // Reasons that require manager approval with signature
      const needsApproval = reason && (
        reason.toLowerCase().includes('travel') || reason.toLowerCase().includes('client-approved')
      );
      const updates = {
        early_leave_reason: reason,
        early_leave_note: note,
        left_site_at: leftAt.toISOString(),
      };
      if (needsApproval) updates.early_leave_status = 'pending';
      if (travel_minutes && reason?.toLowerCase().includes('friday')) {
        updates.friday_travel_home_minutes = travel_minutes;
      }
      const res = await base44.functions.invoke('updateMyAssignment', {
        assignmentId: assignment.id,
        updates,
      });
      if (res.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      if (reason && /weather/i.test(reason)) {
        try {
          const job = jobs.find(j => j.id === assignment.job_id);
          await base44.entities.JobDelayLog.create({
            job_id: assignment.job_id, job_name: job?.name || '',
            staff_id: assignment.staff_id || '', staff_name: staff?.name || '',
            reported_by_role: 'staff', reported_at: new Date().toISOString(),
            delay_type: 'weather', impacted_days: 0, impacted_hours: 0,
            description: `Weather-related early departure: ${reason}${note ? ' — ' + note : ''}`,
            manager_review_status: 'pending',
          });
          queryClient.invalidateQueries({ queryKey: ['delay-logs'] });
        } catch (dlErr) { console.error('Delay log creation failed:', dlErr); }
      }
      toast({ title: 'Left site recorded', description: `Enter your travel home & submit your timesheet within ${Number(bizConfig?.post_leave_site_window_hours) || 5} hours.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Could not record leave site. Please try again.', variant: 'destructive' });
    }
  };

  const handleStartEndOfShift = (assignmentId) => {
    handleOpenShiftWizard(assignmentId, { forceStep: 'end_of_shift' });
  };

  const handleEndOfShiftSubmit = async (data) => {
    const { assignmentId, isLastJob } = shiftWizard;
    setShiftWizard(null);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      if (isLastJob && data.travelHome?.departSite && data.travelHome?.arriveHome) {
        const [dh, dm] = data.travelHome.departSite.split(':').map(Number);
        const [ah, am] = data.travelHome.arriveHome.split(':').map(Number);
        const travelMins = (ah * 60 + am) - (dh * 60 + dm);
        if (travelMins > 0) {
          const assignment = assignments.find(a => a.id === assignmentId);
          await saveOrQueue('Timesheet', 'create', {
            staff_id: staff.id, date: todayStr, job_id: assignment?.job_id || '',
            task_description: 'Travel from site', task_type: 'travel_from',
            start_time: data.travelHome.departSite, end_time: data.travelHome.arriveHome,
            task_duration_minutes: travelMins,
            total_hours: Math.round((travelMins / 60) * 100) / 100, status: 'draft',
          });
        }
      }
      let submitResult = null;
      if (navigator.onLine) {
        try {
          submitResult = await base44.functions.invoke('submitDailyTimesheet', { staff_id: staff.id, date: todayStr });
        } catch (e) {
          const msg = e?.message || '';
          if (msg.includes('under 9 hours') || msg.includes('UNDER_9H_NO_EARLY_LEAVE')) {
            toast({ title: 'Cannot submit timesheet', description: 'Your on-site work is under 9 hours and no early-leave reason was recorded. Use the Leave Site Early button to record why you left early, or add the missing tasks.', variant: 'destructive' });
            queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
            return;
          }
        }
      }
      const updateData = { status: 'completed', completed_at: new Date().toISOString() };
      if (data.progressNotes) updateData.progress_notes = data.progressNotes;
      if (data.meterage !== undefined && data.meterage !== '' && !isNaN(data.meterage)) {
        updateData.meterage = Number(data.meterage);
      }
      if (data.assetReturn && (data.assetReturn.scannedAssetIds?.length > 0 || data.assetReturn.scannedManifestIds?.length > 0)) {
        try {
          const assignment = assignments.find(a => a.id === assignmentId);
          const job = jobs.find(j => j.id === assignment?.job_id);
          await base44.functions.invoke('processAssetReturn', {
            job_id: assignment?.job_id || '', staff_id: staff.id, staff_name: staff.name || '',
            job_name: job?.name || '', scanned_asset_ids: data.assetReturn.scannedAssetIds || [],
            scanned_manifest_ids: data.assetReturn.scannedManifestIds || [], notes: data.assetReturn.notes || '',
          });
          queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['site-assets-for-return'] });
          toast({ title: 'Gear return logged', description: `${data.assetReturn.scannedAssetIds.length + data.assetReturn.scannedManifestIds.length} scan(s) sent to yard & Asset Panda.` });
        } catch (assetErr) {
          toast({ title: 'Gear return failed', description: 'Your timesheet was submitted but the asset return could not be processed. Please tell the yard manager.', variant: 'destructive' });
        }
      }
      await saveOrQueue('RotaAssignment', 'update', updateData, assignmentId);
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      const remaining = assignments.filter(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed' && a.id !== assignmentId);
      if (remaining.length > 0) {
        setShowNextJobPrompt(true);
      } else {
        toast({ title: 'Shift completed', description: navigator.onLine ? 'Your timesheet has been submitted for approval.' : 'Saved offline — your timesheet will be submitted when you reconnect.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not complete shift. Please try again.', variant: 'destructive' });
    }
  };

  const handleAdHocVisit = async ({ jobId, customSite, description, durationMinutes }) => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const visitJob = jobs.find(j => j.id === jobId);
      await base44.entities.Timesheet.create({
        staff_id: staff.id, date: todayStr, job_id: jobId || '',
        task_description: description || (customSite ? `Nearby visit: ${customSite}` : 'Nearby site visit'),
        task_type: 'on_site', task_duration_minutes: Number(durationMinutes) || 0,
        total_hours: Math.round(((Number(durationMinutes) || 0) / 60) * 100) / 100,
        status: 'draft', notes: customSite ? `Site: ${customSite}` : '',
      });
      try { await base44.functions.invoke('submitDailyTimesheet', { staff_id: staff.id, date: todayStr }); } catch (e) { console.error('Timesheet submit error:', e); }
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      toast({ title: 'Visit logged', description: `${durationMinutes} min recorded${visitJob ? ` at ${visitJob.name}` : customSite ? ` at ${customSite}` : ''}.` });
      setShowAdHocVisit(false);
      const remaining = assignments.filter(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed');
      if (remaining.length > 0) setShowNextJobPrompt(true);
    } catch (error) { console.error('Error logging ad-hoc visit:', error); }
  };

  const handleBriefingSign = async (assignmentId) => {
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        briefing_signed: true, briefing_signed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) { console.error('Error signing briefing:', error); }
  };

  const handleAcknowledgeSchedule = async (weekStart) => {
    try {
      const res = await base44.functions.invoke('acknowledgeSchedule', { week_start: weekStart });
      const ackAt = res?.data?.acknowledged_at || new Date().toISOString();
      queryClient.setQueryData(['my-staff-profile'], prev => prev ? { ...prev, last_acknowledged_week: weekStart, schedule_acknowledged_at: ackAt } : prev);
    } catch (error) { console.error('Error acknowledging schedule:', error); }
    finally { setSplashDismissed(true); }
  };

  const handleStartAttempt = (assignmentId) => handleOpenShiftWizard(assignmentId);
  const handleRigSignIn = (assignmentId) => handleOpenShiftWizard(assignmentId);

  const handleBriefingComplete = ({ offline } = {}) => {
    queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    if (offline) toast({ title: 'Briefing saved offline', description: 'Your signature will sync when you reconnect.' });
    else toast({ title: 'Briefing signed', description: "You're briefed and ready to work." });
  };

  // ── Gates ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-12 h-12 border-4 border-slate-200/80 border-t-[#2E5A1A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-6">
        <div className="text-center max-w-sm field-card p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-700 font-bold text-lg">No crew profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your manager to get set up.</p>
        </div>
      </div>
    );
  }

  const publishedWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const latestPublishedWeek = publishedWeekStarts.length > 0 ? [...publishedWeekStarts].sort().reverse()[0] : null;
  const needsSplash = !splashDismissed && staff && latestPublishedWeek && latestPublishedWeek !== (staff.last_acknowledged_week || null);

  if (needsSplash) {
    const splashAssignments = assignments.filter(a => publishedWeekStarts.includes(a.week_start));
    return (
      <ScheduleSplash
        assignments={splashAssignments} jobs={jobs} vehicles={vehicles} clients={clients}
        teams={ctx.teams} staff={staff} weekStart={latestPublishedWeek} loading={assignmentsLoading}
        onAcknowledge={() => handleAcknowledgeSchedule(latestPublishedWeek)}
      />
    );
  }

  if (!isWithinSiteHours() && !isBeforeSiteOpen() && !staff?.is_admin && !isPlatformAdmin) {
    return <OutsideSiteHours openTime={SITE_OPEN_TIME} closeTime={SITE_CLOSE_TIME} />;
  }
  const canPerformActions = isWithinSiteHours() || staff?.is_admin || isPlatformAdmin;

  // ── Derived ──
  const visibleWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const hasAnyRotaWeeks = rotaWeeks.length > 0;
  const isAdminUser = staff?.is_admin || isPlatformAdmin;
  const scheduleLocked = !isAdminUser && hasAnyRotaWeeks && visibleWeekStarts.length === 0;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysSorted = [...todaysAssignments].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
  const todayActiveDeliveries = myDeliveries.filter(d => d.scheduled_date === todayStr && d.status !== 'completed');
  const hasDepotDutyToday = todaysAssignments.some(a => a.assignment_type === 'yard_depot');
  const deliveryInFront = todayActiveDeliveries.length > 0 && hasDepotDutyToday;
  const nextTodayAssignment = todaysSorted.find(a => (a.status || 'assigned') !== 'completed');
  const todaysAllDone = todaysSorted.length > 0 && !nextTodayAssignment;
  const activeStarted = nextTodayAssignment?.status === 'started';

  const cardProps = (assignment) => {
    const _crewSeen = new Set();
    const crew = allAssignments.filter(a => {
      if (a.job_id !== assignment.job_id || a.assigned_date !== assignment.assigned_date) return false;
      if (!a.staff_id || _crewSeen.has(a.staff_id)) return false;
      _crewSeen.add(a.staff_id);
      return true;
    });
    const crewSignedCount = crew.filter(a => a.briefing_signed).length;
    const crewTotal = crew.length;
    return {
      assignment,
      job: jobs.find(j => j.id === assignment.job_id),
      vehicle: vehicles.find(v => v.id === assignment.vehicle_id),
      client: clients.find(c => c.id === jobs.find(j => j.id === assignment.job_id)?.client_id),
      staff,
      onOpenShiftWizard: (id, opts) => handleOpenShiftWizard(id, opts),
      onLeaveSite: handleLeaveSite,
      canPerformActions,
      tasksSubmitted: mgrTimesheets.some(t => t.job_id === assignment.job_id && t.date === todayStr && (t.status === 'submitted' || t.status === 'approved')),
      arrivedOnSite: !!assignment.arrived_on_site_at,
      needsBriefing: !assignment.briefing_signed && !visibleAssignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id),
      crewSignedCount, crewTotal,
      allCrewSigned: crewTotal > 0 && crewSignedCount === crewTotal,
      previousProgress: visibleAssignments
        .filter(a => a.job_id === assignment.job_id && a.progress_notes && a.assigned_date < assignment.assigned_date)
        .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date))
        .map(a => ({ date: a.assigned_date, notes: a.progress_notes, staffName: allStaff.find(s => s.id === a.staff_id)?.name || staff.name })),
      hotelBooking: myHotelBookings.find(h => h.job_id === assignment.job_id) || null,
      onAdHocVisit: () => setShowAdHocVisit(true),
      jobAssets: jobAssets.filter(a => a.job_id === assignment.job_id),
      assetMap: Object.fromEntries((siteAssetsStaff || []).map(a => [a.id, a])),
      complianceItems: equipmentCompliance,
    };
  };

  return (
    <FieldPageShell
      title="My Schedule"
      subtitle={`${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${staff?.name?.split(' ')[0] || 'Team'} · ${format(new Date(), 'EEE dd MMM')}`}
      meta={format(new Date(), 'HH:mm')}
      icon={Calendar}
      transparent
      actions={(
        <div className="flex items-center gap-2">
          <TrackingIndicator isTracking={gpsTracking} hasFix={gpsHasFix} pointsQueued={gpsPointsQueued} errorType={gpsErrorType} onRetry={() => window.location.reload()} />
          <StaffHeaderActions staff={staff} />
        </div>
      )}
      contentClassName="pb-24"
      accentColor={activeDivision?.color}
    >
      <DivisionIdentityBar />
      <RedAlertBanner />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 md:pt-4 space-y-3">
        <OfflineBanner />
        <SyncHUD />
        <TrackingConsentCard staff={staff} onSignNow={() => setShowConsentModal(true)} />
        <KeyLogBookPromptBanner staff={staff} />

        {nextTodayAssignment && !staff?.is_admin && nextTodayAssignment.assignment_type !== 'yard_depot' && (nextTodayAssignment.status || 'assigned') !== 'completed' && (
          <ArrivalPromptBanner
            assignment={nextTodayAssignment}
            job={jobs.find(j => j.id === nextTodayAssignment?.job_id)}
            staffId={staff?.id}
            homeLat={staff?.home_lat}
            homeLng={staff?.home_lng}
            shiftStartTime={nextTodayAssignment?.start_time}
            allJobs={jobs}
            trackingEnabled={staff?.tracking_enabled !== false}
          />
        )}

        {staff?.id && !staff?.is_admin && nextTodayAssignment && nextTodayAssignment.assignment_type !== 'yard_depot' && (nextTodayAssignment.status || 'assigned') !== 'completed' && (
          <StartMyDayHero
            isDriller={/driller/i.test(staff?.job_title || '')}
            onStart={() => { setSafetyChecklistAssignment(nextTodayAssignment); setShowSafetyChecklist(true); }}
          />
        )}

        <StaffAlerts isOnline={ctx.isOnline} staff={staff} />

        {staff?.id && !staff?.is_admin && (
          <DutiesSummaryCard staffId={staff.id} enabled={!!nextTodayAssignment} />
        )}

        {(() => {
          const myItems = myCompliance.filter(i => i.reference_id === staff?.id || i.reference_name === staff?.name);
          const expired = myItems.filter(i => {
            if (!i.expiry_date || i.status_override !== 'auto') return false;
            const days = complianceDaysUntil(i.expiry_date);
            return days !== null && days < 0;
          });
          const expiring = myItems.filter(i => {
            if (!i.expiry_date || i.status_override !== 'auto') return false;
            const days = complianceDaysUntil(i.expiry_date);
            return days !== null && days >= 0 && days <= 30;
          });
          const hasCSCS = myItems.some(i => i.qualification_type === 'cscs_card' || /cscs/i.test(i.title));
          if (expired.length === 0 && expiring.length === 0 && hasCSCS) return null;
          const isUrgent = expired.length > 0 || !hasCSCS;
          const summaryLabel = expired.length > 0 ? `${expired.length} compliance item${expired.length > 1 ? 's' : ''} expired` : expiring.length > 0 ? `${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring soon` : 'CSCS card not on file';
          return (
            <div className={`rounded-2xl border overflow-hidden ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <button onClick={() => setShowComplianceAlert(v => !v)} type="button"
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{summaryLabel}</p>
                  <p className="text-xs opacity-80 mt-0.5">{showComplianceAlert ? 'Tap to collapse' : 'Tap to expand details'}</p>
                </div>
                <ShieldCheck className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
              </button>
              {showComplianceAlert && (
                <button onClick={() => navigate('/staff-profile')} type="button"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-t transition ${isUrgent ? 'text-red-700 bg-red-100/50 hover:bg-red-100 border-red-200' : 'text-amber-700 bg-amber-100/50 hover:bg-amber-100 border-amber-200'}`}>
                  View in profile
                </button>
              )}
            </div>
          );
        })()}

        {staff?.id && !staff?.is_admin && (
          <IncentiveQuickLook staffId={staff.id} teamId={staff.team_id} />
        )}

        {isPlatformAdmin && (
          <button onClick={() => setShiftWizard({ assignmentId: 'preview', previewMode: true })} type="button"
            className="w-full flex items-center gap-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl px-4 py-4 text-white active:scale-95 transition touch-manipulation shadow-lg shadow-amber-500/25">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Play className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-bold leading-tight">Preview Shift Flow</p>
              <p className="text-[11px] text-white/75 truncate font-medium">Walk through the crew experience</p>
            </div>
          </button>
        )}

        {staff?.id && !staff?.is_admin && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowRigScanner(true)} type="button"
              className="flex items-center gap-3 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] rounded-2xl px-4 py-4 text-white active:scale-95 transition touch-manipulation shadow-lg shadow-[#2E5A1A]/25 glow-brand">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <ScanLine className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold leading-tight">Scan Rig QR</p>
                <p className="text-[11px] text-white/75 truncate font-medium">Sign into your rig</p>
              </div>
            </button>
            <button onClick={() => navigate('/scanner')} type="button"
              className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl px-4 py-4 active:scale-95 transition touch-manipulation hover:border-[#2E5A1A]/30 shadow-sm shadow-slate-900/[0.04]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-[#2E5A1A]" strokeWidth={2.5} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold leading-tight text-slate-900">Sign Out Gear</p>
                <p className="text-[11px] text-slate-400 truncate font-medium">Scan to your job</p>
              </div>
            </button>
          </div>
        )}

        {assignmentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="field-card p-5">
                <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : scheduleLocked ? (
          <div className="field-card">
            <EmptyState icon={CalendarClock} title="New schedule on the way" message="Your manager is preparing your new rota. You'll get it by email once it's ready." />
          </div>
        ) : visibleAssignments.length === 0 ? (
          <div className="field-card">
            <EmptyState icon={CalendarDays} title="No shifts scheduled" message="Check back later — your manager will assign you to upcoming jobs." />
          </div>
        ) : todaysSorted.length === 0 ? (() => {
          if (upcomingAssignments.length === 0) {
            return (
              <div className="field-card">
                <EmptyState icon={CalendarDays} title="No jobs today" message="Check back later — your manager will assign you to upcoming jobs." />
              </div>
            );
          }
          const next = [...upcomingAssignments].sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date))[0];
          const nextJob = jobs.find(j => j.id === next.job_id);
          const nextDate = new Date(next.assigned_date + 'T00:00:00');
          const daysUntil = Math.ceil((nextDate - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24));
          const label = daysUntil === 0 ? 'Later today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;
          return (
            <div className="field-card p-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center mx-auto mb-3">
                <CalendarClock className="w-7 h-7 text-[#2E5A1A]" strokeWidth={2.5} />
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">No jobs today</p>
              <p className="text-xs text-slate-500 mb-3">Your next shift is <span className="font-semibold text-[#2E5A1A]">{label}</span></p>
              <div className="bg-slate-50/80 rounded-xl border border-slate-200/70 px-4 py-3 text-left">
                <p className="text-sm font-bold text-slate-900 truncate">{nextJob?.name || 'Shift'}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-[#2E5A1A]/60" /> {format(nextDate, 'EEEE dd MMM')}
                  {next.start_time && <><span>·</span><Clock className="w-3.5 h-3.5 text-[#2E5A1A]/60" /> {next.start_time}</>}
                </div>
              </div>
              <button onClick={() => navigate('/upcoming')} type="button"
                className="mt-3 text-xs font-semibold text-[#2E5A1A] hover:underline">View all upcoming →</button>
            </div>
          );
        })() : todaysAllDone ? (
          <EndOfDayCard />
        ) : (
          <div className="space-y-3">
            <TodayPrepStrip
              todaysSorted={todaysSorted} jobs={jobs} myCompliance={myCompliance}
              myHotelBookings={myHotelBookings} staffId={staff.id}
            />
            {deliveryInFront && (
              <>
                <DeliveryHeroToday deliveries={todayActiveDeliveries} jobs={jobs} />
                {todaysSorted
                  .filter(a => a.assignment_type === 'yard_depot' && (a.status || 'assigned') !== 'completed')
                  .map(a => (
                    <DepotDutyCollapsible key={a.id} assignment={a} staff={staff}
                      onOpenShiftWizard={(id, opts) => handleOpenShiftWizard(id, opts)} canPerformActions={canPerformActions} />
                  ))}
                {todaysSorted
                  .filter(a => a.assignment_type !== 'yard_depot' && a.id !== nextTodayAssignment?.id)
                  .map(a => <AssignmentCard key={a.id} {...cardProps(a)} />)}
              </>
            )}
            {nextTodayAssignment && !deliveryInFront && (
              nextTodayAssignment.assignment_type === 'yard_depot' ? (
                <DepotAssignmentCard
                  assignment={nextTodayAssignment} staff={staff}
                  onOpenShiftWizard={(id, opts) => handleOpenShiftWizard(id, opts)}
                  canPerformActions={canPerformActions} defaultExpanded
                />
              ) : (
                <div>
                  {!activeStarted && todaysSorted.length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 text-xs font-bold uppercase tracking-wide ring-1 ring-amber-200/50">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Up Next
                      </span>
                    </div>
                  )}
                  <ActiveJobCard {...cardProps(nextTodayAssignment)} />
                  {(() => {
                    const activeJob = jobs.find(j => j.id === nextTodayAssignment?.job_id);
                    if (!activeJob?.site_lat || !activeJob?.site_lng) return null;
                    return (
                      <DrillingWeatherWidget lat={activeJob.site_lat} lng={activeJob.site_lng}
                        locationName={activeJob.location} compact={false} />
                    );
                  })()}
                </div>
              )
            )}
            {!deliveryInFront && todaysSorted.filter(a => a.id !== nextTodayAssignment?.id).map(a => (
              a.assignment_type === 'yard_depot'
                ? <DepotAssignmentCard key={a.id} assignment={a} staff={staff} onOpenShiftWizard={(id, opts) => handleOpenShiftWizard(id, opts)} canPerformActions={canPerformActions} defaultExpanded />
                : <AssignmentCard key={a.id} {...cardProps(a)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {shiftWizard && (
        <ShiftWizard
          open={!!shiftWizard}
          previewMode={!!shiftWizard?.previewMode}
          assignment={assignments.find(a => a.id === shiftWizard.assignmentId)}
          job={jobs.find(j => j.id === assignments.find(a => a.id === shiftWizard.assignmentId)?.job_id)}
          client={clients.find(c => c.id === jobs.find(j => j.id === assignments.find(a => a.id === shiftWizard.assignmentId)?.job_id)?.client_id)}
          staff={staff} staffId={staff.id}
          crewAssignments={allAssignments.filter(a => a.job_id === assignments.find(a2 => a2.id === shiftWizard.assignmentId)?.job_id && a.assigned_date === assignments.find(a2 => a2.id === shiftWizard.assignmentId)?.assigned_date)}
          visibleAssignments={visibleAssignments}
          isDriller={/driller/i.test(staff?.job_title || '')}
          isLastJob={shiftWizard.isLastJob}
          forceStep={shiftWizard.forceStep}
          onArrivedConfirm={handleArrivedConfirm}
          onBriefingComplete={handleBriefingComplete}
          onStartJob={handleStartJob}
          onEndOfShiftSubmit={handleEndOfShiftSubmit}
          onClose={() => setShiftWizard(null)}
        />
      )}

      {earlyLeaveAssignment && (
        <EarlyLeaveModal
          open={!!earlyLeaveAssignment}
          jobName={jobs.find(j => j.id === earlyLeaveAssignment.job_id)?.name}
          onConfirm={handleEarlyLeaveConfirm}
          onClose={() => setEarlyLeaveAssignment(null)}
        />
      )}

      <NextJobPrompt
        open={showNextJobPrompt}
        onClose={() => setShowNextJobPrompt(false)}
        remainingJobs={todaysSorted.filter(a => (a.status || 'assigned') !== 'completed')}
        jobs={jobs}
        onCheckIn={(assignmentId) => { setShowNextJobPrompt(false); handleStartAttempt(assignmentId); }}
        onAdHocVisit={() => { setShowNextJobPrompt(false); setShowAdHocVisit(true); }}
      />

      <AdHocVisitModal open={showAdHocVisit} onClose={() => setShowAdHocVisit(false)} onSubmit={handleAdHocVisit} jobs={jobs} />

      {showRigScanner && (
        <RigSignInScanner
          open={showRigScanner} onClose={() => setShowRigScanner(false)}
          staffId={staff?.id} assignments={visibleAssignments} jobs={jobs} rigs={rigs} allStaff={allStaff}
          onSignIn={handleRigSignIn}
        />
      )}

      {showSafetyChecklist && safetyChecklistAssignment && (
        <PreWorkSafetyChecklist
          open={showSafetyChecklist}
          onClose={() => { setShowSafetyChecklist(false); setSafetyChecklistAssignment(null); }}
          assignment={safetyChecklistAssignment}
          job={jobs.find(j => j.id === safetyChecklistAssignment?.job_id)}
          staff={staff}
          isDriller={/driller/i.test(staff?.job_title || '')}
          onComplete={() => {
            setShowSafetyChecklist(false);
            setSafetyChecklistAssignment(null);
            handleOpenShiftWizard(safetyChecklistAssignment.id);
          }}
        />
      )}

      {showConsentModal && (
        <TrackingConsentModal
          open={showConsentModal} onClose={() => setShowConsentModal(false)}
          onDecline={() => setShowConsentModal(false)} staff={staff}
        />
      )}

      {showScheduleSummary && (
        <ScheduleSplash
          assignments={visibleAssignments} jobs={jobs} vehicles={vehicles} clients={clients}
          teams={ctx.teams} staff={staff}
          weekStart={latestPublishedWeek || (visibleAssignments[0]?.week_start) || format(new Date(), 'yyyy-MM-dd')}
          loading={assignmentsLoading} reviewMode
          acknowledgedAt={staff.schedule_acknowledged_at}
          onClose={() => setShowScheduleSummary(false)}
        />
      )}
    </FieldPageShell>
  );
}