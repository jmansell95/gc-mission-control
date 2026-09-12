import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Boxes, PoundSterling, FolderOpen, FileText, Eye, Download, Activity, Mountain,
  LayoutGrid, CalendarDays, ShieldCheck, Users, Truck, Hotel,
  Camera, Clock, FlaskConical, Link2, AlertTriangle, FileBarChart, ArrowUpRight, StickyNote
} from 'lucide-react';
import { getSiteActivityDeepLink } from '@/utils/investigationDeepLink';
import HubDeepLink from '@/components/hubs/HubDeepLink';
import SubTabNav from '@/components/SubTabNav';
import JobLogisticsHub from '@/components/logistics/JobLogisticsHub';
import InvestigationLogManager from '@/components/InvestigationLogManager';
import BoreholeDrillDown from '@/components/BoreholeDrillDown';
import JobHotelBookings from '@/components/JobHotelBookings';
import JobPhotoGallery from '@/components/JobPhotoGallery';
import DocumentManager from '@/components/DocumentManager';
import JobPortalComments from '@/components/JobPortalComments';
import JobScheduleOverview from '@/components/JobScheduleOverview';
import PermanentCrewCard from '@/components/jobs/PermanentCrewCard';
import JobRotaManager from '@/components/jobs/JobRotaManager';
import EarlyLeaveApprovalCard from '@/components/jobs/EarlyLeaveApprovalCard';
import DelayLogManager from '@/components/DelayLogManager';
import JobHazardMap from '@/components/JobHazardMap';
import JobContextView from '@/components/JobContextView';
import GeotechDataTab from '@/components/geotech/GeotechDataTab';
import SiteActivitySummary from '@/components/jobs/SiteActivitySummary';
import TabStatRibbon from '@/components/TabStatRibbon';
import JobFinancialsTab from '@/components/afp/JobFinancialsTab';
import PortalLinkManager from '@/components/PortalLinkManager';
import CrewComplianceSummary from '@/components/jobs/CrewComplianceSummary';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * JobDetailTabs — consolidated, progressive-disclosure tab structure.
 *
 * Six top-level sections (down from eight), with related work grouped together:
 *   1. Overview        — context, crew, financials snapshot, activity, sites, weather
 *   2. Schedule & Crew — daily rota, permanent crew, delays, accommodation
 *   3. Site Activity  — investigation logs, hazard map, boreholes, geotech (drilling)
 *   4. Equipment      — rig & gear, hire items, deliveries
 *   5. Financials      — AFP, CVR, costs, billing
 *   6. Portals         — portal links (quick share + secure login), client comments, notes
 *   7. Documents       — photos, files
 *
 * Drilling-only sections (Boreholes, Geotech) live as sub-tabs under Site
 * Activity so non-drilling jobs get a cleaner, shorter tab bar.
 */
export default function JobDetailTabs({
  job, primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates,
  client, contractor, suppliers, contractors, canSeeCosts, isDrillingJob, isGroundworksJob, totalCost,
  staffCosts, totalMeterage, hotelBookings, colors, statusBadge, statusLabels,
  startDate, endDate, jobTypes = [], initialTab
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [scheduleSub, setScheduleSub] = useState('daily');
  const [activitySub, setActivitySub] = useState('logs');
  const [docsSub, setDocsSub] = useState('photos');
  const [siteActivitySelectedLogId, setSiteActivitySelectedLogId] = useState(null);
  const { user: authUser } = useAuth();
  const isManager = authUser?.role === 'admin';

  // Fetch investigation logs and financials for the Site Activity summary
  const { data: invLogs = [] } = useQuery({
    queryKey: ['investigation-logs', job?.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job?.id }),
    enabled: !!job?.id,
  });
  const { data: fin } = useQuery({
    queryKey: ['auto-job-financials-tabs', job?.id],
    queryFn: async () => { const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job?.id }); return res.data; },
    enabled: !!job?.id && canSeeCosts,
    retry: 0,
  });

  // Bidirectional deep-link: when a manager clicks "Open on Job Site Activity"
  // from the Investigation Hub, the target log id is stashed in sessionStorage.
  // On mount, read + clear it, land on the Site Activity tab → Activity Logs
  // sub-tab, and pass the log id down so the timeline pre-selects/expands it.
  useEffect(() => {
    const link = getSiteActivityDeepLink();
    if (!link) return;
    if (link.jobId && job && link.jobId !== job.id) return; // safety: only for this job
    setActiveTab('activity');
    setActivitySub('logs');
    if (link.logId) setSiteActivitySelectedLogId(link.logId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedVehicleIds = [...new Set(rotas.map(r => r.vehicle_id).filter(Boolean))];
  const assignedVehicles = assignedVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);

  // Shared tab trigger class — clean, compact, brand-accented
  const triggerClass =
    'text-ui-caption sm:text-ui-body inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl flex-shrink-0 whitespace-nowrap data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2E5A1A] data-[state=active]:to-[#5A8C1E] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition';

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* Consolidated tab bar — 6 sections, horizontally scrollable on mobile with edge fade */}
      <div className="relative bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5 mb-4 sticky top-14 z-30">
        <TabsList className="flex w-full flex-nowrap overflow-x-auto no-scrollbar h-auto p-0 gap-1 bg-transparent justify-start">
          <TabsTrigger value="overview" className={triggerClass}><LayoutGrid className="w-4 h-4 shrink-0" />Overview</TabsTrigger>
          <TabsTrigger value="schedule" className={triggerClass}><CalendarDays className="w-4 h-4 shrink-0" />Schedule &amp; Crew</TabsTrigger>
          <TabsTrigger value="activity" className={triggerClass}><Activity className="w-4 h-4 shrink-0" />Site Activity</TabsTrigger>
          <TabsTrigger value="equipment" className={triggerClass}><Boxes className="w-4 h-4 shrink-0" />Equipment</TabsTrigger>
          {canSeeCosts && <TabsTrigger value="financials" className={triggerClass}><PoundSterling className="w-4 h-4 shrink-0" />Financials</TabsTrigger>}
          <TabsTrigger value="links" className={triggerClass}><Link2 className="w-4 h-4 shrink-0" />Portals</TabsTrigger>
          <TabsTrigger value="documents" className={triggerClass}><FolderOpen className="w-4 h-4 shrink-0" />Documents</TabsTrigger>
        </TabsList>
        {/* Edge fade — visual cue that more tabs scroll into view */}
        <div className="pointer-events-none absolute right-1 top-1 bottom-1 w-8 bg-gradient-to-l from-white/90 to-transparent rounded-r-2xl" />
      </div>

      {/* ── Overview ── */}
      <TabsContent value="overview" className="mt-0 space-y-4">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <HubDeepLink to="/staff" jobId={job.id} label="People Hub" icon={Users} />
          <HubDeepLink to="/fleet" jobId={job.id} label="Tracking Hub" icon={Truck} />
          <HubDeepLink to="/assets" jobId={job.id} label="Assets Hub" icon={Boxes} />
        </div>
        <JobContextView
          job={job}
          primaryType={primaryType}
          assignedStaff={assignedStaff}
          rotas={rotas}
          allStaff={allStaff}
          client={client}
          contractor={contractor}
          suppliers={suppliers}
          vehicles={vehicles}
          hotelBookings={hotelBookings}
          canSeeCosts={canSeeCosts}
          isDrillingJob={isDrillingJob}
          colors={colors}
          statusBadge={statusBadge}
          statusLabels={statusLabels}
          startDate={startDate}
          endDate={endDate}
          jobTypes={jobTypes}
        />
        {job.notes && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-900 text-sm">Notes</h3>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}
      </TabsContent>

      {/* ── Schedule & Crew ── */}
      <TabsContent value="schedule" className="space-y-4 mt-0">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <HubDeepLink to="/staff" jobId={job.id} label="People Hub" icon={Users} />
          <HubDeepLink to="/scheduling" jobId={job.id} label="Rota Builder" icon={CalendarDays} />
          <HubDeepLink to="/fleet" jobId={job.id} label="Tracking Hub" icon={Truck} />
        </div>
        <SubTabNav
          tabs={[
            { id: 'daily', label: 'Daily Schedule', icon: CalendarDays },
            { id: 'accommodation', label: 'Accommodation', icon: Hotel },
          ]}
          activeTab={scheduleSub}
          onChange={setScheduleSub}
        />
        {scheduleSub === 'daily' ? (
          <>
            {isManager && <EarlyLeaveApprovalCard job={job} rotas={rotas} allStaff={allStaff} />}
            <TabStatRibbon
              icon={CalendarDays}
              title="Schedule Summary"
              stats={[
                { icon: Users, value: assignedStaff.length, label: assignedStaff.length === 1 ? 'Crew Member' : 'Crew Members', iconColor: 'text-emerald-600' },
                { icon: CalendarDays, value: sortedDates.length, label: sortedDates.length === 1 ? 'Work Day' : 'Work Days', iconColor: 'text-blue-600' },
                { icon: Truck, value: assignedVehicles.length, label: 'Vehicles', iconColor: 'text-violet-600' },
                { icon: Clock, value: rotas.length, label: rotas.length === 1 ? 'Shift' : 'Total Shifts', iconColor: 'text-amber-600' },
              ]}
            />
            <PermanentCrewCard job={job} />
            <CrewComplianceSummary assignedStaff={assignedStaff} rotas={rotas} canSeeCosts={canSeeCosts} />
            <JobScheduleOverview job={job} primaryType={primaryType} assignedStaff={assignedStaff} rotas={rotas} allStaff={allStaff} vehicles={vehicles} rotasByDate={rotasByDate} sortedDates={sortedDates} />
            {isManager && <JobRotaManager job={job} allStaff={allStaff} vehicles={vehicles} rotas={rotas} />}
          </>
        ) : (
          <JobHotelBookings job={job} assignedStaff={assignedStaff} allStaff={allStaff} />
        )}
      </TabsContent>

      {/* ── Site Activity ── */}
      <TabsContent value="activity" className="space-y-4 mt-0">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <HubDeepLink to="/compliance" jobId={job.id} label="Compliance Hub" icon={ShieldCheck} />
          <HubDeepLink to="/reports" jobId={job.id} label="Reports Hub" icon={FileBarChart} />
        </div>
        <SubTabNav
          tabs={[
            { id: 'logs', label: 'Activity Logs', icon: Activity },
            { id: 'delays', label: 'Delays', icon: AlertTriangle },
            { id: 'hazards', label: 'Hazard Map', icon: ShieldCheck },
            ...(isDrillingJob ? [{ id: 'boreholes', label: 'Boreholes', icon: Mountain }] : []),
            ...(isDrillingJob ? [{ id: 'geotech', label: 'Geotech', icon: FlaskConical }] : []),
          ]}
          activeTab={activitySub}
          onChange={setActivitySub}
        />
        {activitySub === 'logs' ? (
          <>
            <TabStatRibbon
              icon={Activity}
              title="Site Logs"
              stats={[
                { icon: Users, value: assignedStaff.length, label: 'Crew On Job', iconColor: 'text-emerald-600' },
                { icon: CalendarDays, value: rotas.filter(r => r.status === 'started' || r.status === 'completed').length, label: 'Active Shifts', iconColor: 'text-blue-600' },
                { icon: ShieldCheck, value: rotas.filter(r => r.briefing_signed).length, label: 'Briefings Signed', iconColor: 'text-amber-600' },
              ]}
            />
            <SiteActivitySummary job={job} invLogs={invLogs} canSeeCosts={canSeeCosts} fin={fin} />
            <InvestigationLogManager job={job} isDrillingJob={isDrillingJob} assignedStaff={assignedStaff} allStaff={allStaff} canSeeCosts={canSeeCosts} onViewBoreholes={() => setActivitySub('boreholes')} selectedLogId={siteActivitySelectedLogId} />
          </>
        ) : activitySub === 'delays' ? (
          <DelayLogManager job={job} />
        ) : activitySub === 'hazards' ? (
          <JobHazardMap job={job} />
        ) : activitySub === 'boreholes' && isDrillingJob ? (
          <BoreholeDrillDown job={job} jobType={primaryType} />
        ) : activitySub === 'geotech' && isDrillingJob ? (
          <GeotechDataTab job={job} allStaff={allStaff} suppliers={suppliers} assets={undefined} />
        ) : null}
      </TabsContent>

      {/* ── Equipment ── */}
      <TabsContent value="equipment" className="space-y-4 mt-0">
        <TabStatRibbon
          icon={Boxes}
          title="Equipment & Logistics"
          stats={[
            { icon: Truck, value: assignedVehicles.length, label: 'Vehicles', iconColor: 'text-violet-600' },
            { icon: Users, value: assignedStaff.length, label: 'Crew', iconColor: 'text-emerald-600' },
          ]}
        />
        <JobLogisticsHub jobId={job.id} job={job} suppliers={suppliers} contractors={contractors} canSeeCosts={canSeeCosts} isDrillingJob={isDrillingJob} />
      </TabsContent>

      {/* ── Financials ── */}
      {canSeeCosts && (
        <TabsContent value="financials" className="space-y-4 mt-0">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <HubDeepLink to="/billing" jobId={job.id} label="Billing Hub" icon={PoundSterling} />
          </div>
          <JobFinancialsTab job={job} canSeeCosts={canSeeCosts} />
        </TabsContent>
      )}

      {/* ── Portals ── */}
      <TabsContent value="links" className="space-y-4 mt-0">
        <PortalLinkManager job={job} />
        <JobPortalComments job={job} />
      </TabsContent>

      {/* ── Documents ── */}
      <TabsContent value="documents" className="space-y-4 mt-0">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <HubDeepLink to="/reports" jobId={job.id} label="Reports Hub" icon={FileBarChart} />
        </div>
        <SubTabNav
          tabs={[
            { id: 'photos', label: 'Photos', icon: Camera },
            { id: 'files', label: 'Documents', icon: FolderOpen },
          ]}
          activeTab={docsSub}
          onChange={setDocsSub}
        />
        {docsSub === 'photos' && <JobPhotoGallery job={job} canUpload={isManager} />}
        {docsSub === 'files' && (
          <>
            <DocumentManager job={job} />
            {job.requisition_list_url && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /><h3 className="font-semibold text-slate-900 text-ui-body">Requisition List</h3></div>
                <div className="px-5 py-4 space-y-2">
                  <p className="text-ui-body text-slate-700 truncate">{job.requisition_list_name || 'Requisition List'}</p>
                  <div className="flex gap-2">
                    <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-primary hover:bg-emerald-100 rounded-lg text-ui-caption font-medium transition"><Eye className="w-3.5 h-3.5" /> View</a>
                    <a href={job.requisition_list_url} download={job.requisition_list_name || 'requisition'} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-ui-caption font-medium transition"><Download className="w-3.5 h-3.5" /> Download</a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}