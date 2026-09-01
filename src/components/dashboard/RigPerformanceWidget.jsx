import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, Ruler, Loader2, Wrench, ChevronRight,
  PoundSterling, HardHat, Briefcase, Clock, CheckCircle2, MapPin, Navigation, Satellite,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

// Haversine distance between two lat/lng points, in metres
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

const fmtGBPm = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return '£' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) + '/m';
};

function fmtDuration(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/**
 * RigPerformanceWidget — today's rigs with live progressive earnings.
 *
 * Each rig card shows one combined "Daily Cost" figure that accrues as the
 * shift progresses: crew day rate × progress fraction + meterage revenue.
 * Visual states: Scheduled (grey), On Site (green/pulse), Completed (solid
 * green), Assigned (muted — on a job but not deployed today).
 */
export default function RigPerformanceWidget({ divisionId, onJobBreakdown }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [now, setNow] = useState(Date.now());

  // Live tick — updates every 60s so progressive revenue stays current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['rig-perf-assignments', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });
  const { data: rigs = [], isLoading: rigsLoading } = useQuery({ queryKey: ['rigs-all'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });
  const { data: jobAssetAssignments = [] } = useQuery({ queryKey: ['job-asset-assignments-rig-perf'], queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: allVehicles = [] } = useQuery({ queryKey: ['vehicles-rig-perf'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams-rig-perf'], queryFn: () => base44.entities.Team.list() });
  const { data: rateCards = [] } = useQuery({
    queryKey: ['rate-card-items-rig-perf'],
    queryFn: () => base44.entities.RateCardItem.list(),
    staleTime: 60000,
  });

  // Live Geotab vehicle positions — reused from Fleet Hub live tracking
  const { data: liveData } = useQuery({
    queryKey: ['geotab-live-locations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const liveVehicles = liveData?.vehicles || [];

  // Crew day rate per rig from the Master Price List (rig + crew combined)
  const rigCrewDayRate = useMemo(() => {
    const map = {};
    rigs.forEach(rig => {
      const match = findRigRateCardItem(rig, rateCards);
      if (match) map[rig.id] = Number(match.price || match.unit_price || match.rate || 0) || 0;
    });
    return map;
  }, [rigs, rateCards]);

  const drillingTeamIds = useMemo(() => {
    const ids = new Set();
    teams.forEach(t => {
      if (t.job_type === 'cp_drilling' || t.job_type === 'rotary_drilling') ids.add(t.id);
    });
    return ids;
  }, [teams]);

  const rigStats = useMemo(() => {
    const byRig = {};

    // Source 1: JobAssetAssignments — rigs assigned to active jobs (may not be on site today)
    jobAssetAssignments.forEach(jaa => {
      const rig = rigs.find(r => r.id === jaa.asset_id || r.id === jaa.site_asset_id);
      if (!rig) return;
      if (jaa.status === 'returned') return;
      const job = jobs.find(j => j.id === jaa.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[rig.id]) byRig[rig.id] = { rotaAssignments: [], job, totalMeterage: 0, hasJAA: true };
      byRig[rig.id].hasJAA = true;
      if (!byRig[rig.id].job) byRig[rig.id].job = job;
    });

    // Source 2: today's RotaAssignments — rigs actually scheduled today
    assignments.forEach(a => {
      if (!a.rig_asset_id) return;
      const job = jobs.find(j => j.id === a.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[a.rig_asset_id]) byRig[a.rig_asset_id] = { rotaAssignments: [], job, totalMeterage: 0, hasJAA: false };
      byRig[a.rig_asset_id].rotaAssignments.push(a);
      if (!byRig[a.rig_asset_id].job) byRig[a.rig_asset_id].job = job;
    });

    // Calculate per-rig stats
    Object.entries(byRig).forEach(([rigId, data]) => {
      const job = data.job;
      const disciplines = Array.isArray(job?.disciplines) ? job.disciplines : [];
      const drillDisc = disciplines.find(d => d.type === 'drilling') || {};

      // Meterage from rota assignments
      const rigMeterage = data.rotaAssignments.reduce((s, a) => s + (Number(a.meterage) || 0), 0);

      // Revenue method and rates
      const meterageRate = drillDisc.meterage_rate || job?.meterage_rate || 0;
      const crewDayRate = drillDisc.unit_price || job?.unit_price || rigCrewDayRate[rigId] || 0;
      let revMethod = drillDisc.revenue_method || job?.revenue_method || 'day_rate';

      // Determine shift state — delivery sign-off (JAA on_site) is primary,
      // GPS geofence is the 'en route' indicator only (arriving, not yet signed
      // off), manual crew tap is the last-resort fallback when no delivery exists.
      const hasStarted = data.rotaAssignments.some(a => a.started_at || a.arrived_on_site_at);
      const isCompleted = data.rotaAssignments.some(a => a.status === 'completed' || a.completed_at);
      const hasRotaToday = data.rotaAssignments.length > 0;

      // Delivery sign-off: does this rig have an active on_site JobAssetAssignment at the job?
      const hasOnSiteJAA = jobAssetAssignments.some(jaa =>
        jaa.asset_id === rigId && jaa.job_id === job?.id && jaa.status === 'on_site'
      );

      // Resolve rig → vehicle from today's rota assignments
      const vehicleId = data.rotaAssignments.find(a => a.vehicle_id)?.vehicle_id;
      const vehicleEntity = vehicleId ? allVehicles.find(v => v.id === vehicleId) : null;
      // Match live Geotab data by entity ID, Geotab device ID, or registration number
      const liveVehicle = vehicleId ? liveVehicles.find(v =>
        v.vehicle_id === vehicleId || v.id === vehicleId ||
        (vehicleEntity?.geotab_device_id && v.vehicle_id === vehicleEntity.geotab_device_id) ||
        (vehicleEntity?.registration_number && v.registration_number === vehicleEntity.registration_number)
      ) : null;
      const hasGps = !!liveVehicle && liveVehicle.lat != null && liveVehicle.lng != null;

      // GPS geofence detection — is the rig's vehicle inside the job geofence?
      let gpsState = null;
      if (hasGps && job && job.site_lat != null && job.site_lng != null) {
        const distance = haversineMeters(liveVehicle.lat, liveVehicle.lng, job.site_lat, job.site_lng);
        const radius = job.geofence_radius_override || 200; // 200m default site geofence
        if (distance <= radius) {
          gpsState = 'on_site';
        } else if (liveVehicle.ignition_on && (liveVehicle.speed_kph || 0) > 5) {
          gpsState = 'en_route';
        }
        data.gpsDistance = Math.round(distance);
      }

      let state = 'assigned';
      let onSiteSource = null;
      if (hasRotaToday) {
        if (isCompleted) state = 'completed';
        else if (hasOnSiteJAA) { state = 'on_site'; onSiteSource = 'delivered'; } // delivery sign-off — primary, locked
        else if (gpsState === 'on_site') state = 'en_route'; // GPS near site — arriving (not yet signed off)
        else if (gpsState === 'en_route') state = 'en_route';
        else if (hasStarted) { state = 'on_site'; onSiteSource = 'manual'; } // manual crew tap fallback
        else state = 'scheduled';
      }
      data.onSiteSource = onSiteSource;

      data.hasGps = hasGps;
      data.gpsState = gpsState;
      data.liveVehicle = liveVehicle;

      // Planned shift hours from first rota assignment's start/end time
      let plannedShiftHours = 8;
      const firstA = data.rotaAssignments[0];
      if (firstA?.start_time && firstA?.end_time) {
        const [sh, sm] = firstA.start_time.split(':').map(Number);
        const [eh, em] = firstA.end_time.split(':').map(Number);
        plannedShiftHours = ((eh + em / 60) - (sh + sm / 60));
        if (plannedShiftHours <= 0) plannedShiftHours += 24;
        if (plannedShiftHours <= 0 || plannedShiftHours > 24) plannedShiftHours = 8;
      }

      // Progress fraction
      let progressFraction = 0;
      let hoursWorkedSoFar = 0;
      let shiftStart = null;

      if (hasStarted) {
        const startTimes = data.rotaAssignments
          .map(a => a.started_at || a.arrived_on_site_at)
          .filter(Boolean)
          .sort();
        shiftStart = startTimes[0] ? new Date(startTimes[0]).getTime() : null;

        if (isCompleted) {
          progressFraction = 1;
          hoursWorkedSoFar = plannedShiftHours;
        } else if (shiftStart) {
          hoursWorkedSoFar = (now - shiftStart) / (3600 * 1000);
          progressFraction = Math.min(hoursWorkedSoFar / plannedShiftHours, 1);
        }
      }

      // Revenue calculation — only when on site or completed
      let dayRateRevenue = 0;
      let meterageRevenue = 0;
      let totalRevenue = 0;

      if (state === 'on_site' || state === 'completed') {
        if (revMethod === 'meterage_rate' && meterageRate) {
          meterageRevenue = rigMeterage * meterageRate;
          dayRateRevenue = crewDayRate * progressFraction;
        } else if (revMethod === 'day_rate') {
          dayRateRevenue = crewDayRate * progressFraction;
        } else if (revMethod === 'flat_fee' && job?.client_charge) {
          dayRateRevenue = Number(job.client_charge) * progressFraction;
        } else if (meterageRate && rigMeterage) {
          meterageRevenue = rigMeterage * meterageRate;
          dayRateRevenue = crewDayRate * progressFraction;
          revMethod = 'meterage_rate';
        } else {
          dayRateRevenue = crewDayRate * progressFraction;
          revMethod = 'day_rate';
        }
        totalRevenue = dayRateRevenue + meterageRevenue;
      }

      data.state = state;
      data.totalRevenue = totalRevenue;
      data.dayRateRevenue = dayRateRevenue;
      data.meterageRevenue = meterageRevenue;
      data.totalMeterage = rigMeterage;
      data.revMethod = revMethod;
      data.meterageRate = meterageRate;
      data.crewDayRate = crewDayRate;
      data.progressFraction = progressFraction;
      data.hoursWorkedSoFar = hoursWorkedSoFar;
      data.plannedShiftHours = plannedShiftHours;
      data.shiftStart = shiftStart;
      data.hasRotaToday = hasRotaToday;
    });

    return Object.entries(byRig).map(([rigId, data]) => {
      const rig = rigs.find(r => r.id === rigId);
      const crewSource = data.rotaAssignments;
      const crew = crewSource.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean);
      const lead = crewSource.find(a => a.crew_role === 'lead_driller');
      const second = crewSource.find(a => a.crew_role === 'second_man');
      const leadDriller = lead ? allStaff.find(s => s.id === lead.staff_id) : null;
      const secondMan = second ? allStaff.find(s => s.id === second.staff_id) : null;

      return {
        rigId,
        rig,
        crew,
        leadDriller,
        secondMan,
        job: data.job,
        state: data.state,
        meterage: data.totalMeterage,
        revenue: data.totalRevenue,
        dayRateRevenue: data.dayRateRevenue,
        meterageRevenue: data.meterageRevenue,
        revMethod: data.revMethod,
        meterageRate: data.meterageRate,
        crewDayRate: data.crewDayRate,
        progressFraction: data.progressFraction,
        hoursWorkedSoFar: data.hoursWorkedSoFar,
        plannedShiftHours: data.plannedShiftHours,
        shiftStart: data.shiftStart,
        hasRotaToday: data.hasRotaToday,
        hasGps: data.hasGps,
        gpsState: data.gpsState,
        liveVehicle: data.liveVehicle,
        gpsDistance: data.gpsDistance,
        onSiteSource: data.onSiteSource,
        firstAssignment: data.rotaAssignments[0],
      };
    }).sort((a, b) => {
      const stateOrder = { completed: 0, on_site: 1, en_route: 2, scheduled: 3, assigned: 4 };
      return (stateOrder[a.state] - stateOrder[b.state]) || (b.revenue - a.revenue);
    });
  }, [assignments, jobAssetAssignments, jobs, rigs, allStaff, allVehicles, rigCrewDayRate, now, liveVehicles]);

  const drillingCrewsOut = useMemo(() => {
    const jobsWithRigs = new Set(
      jobAssetAssignments.filter(jaa => jaa.status !== 'returned').map(jaa => jaa.job_id)
    );
    const crewOut = new Set();
    assignments.forEach(a => {
      const staffMember = allStaff.find(s => s.id === a.staff_id);
      if (!staffMember) return;
      if (drillingTeamIds.has(staffMember.team_id) || jobsWithRigs.has(a.job_id)) {
        crewOut.add(a.staff_id);
      }
    });
    return crewOut.size;
  }, [assignments, allStaff, drillingTeamIds, jobAssetAssignments]);

  // Header total — only on-site and completed rigs count
  const totalRevenue = rigStats.filter(r => r.state === 'on_site' || r.state === 'completed').reduce((sum, r) => sum + r.revenue, 0);
  const totalMeterage = rigStats.reduce((sum, r) => sum + r.meterage, 0);
  const activeRigCount = rigStats.length;
  const onSiteCount = rigStats.filter(r => r.state === 'on_site').length;
  const enRouteCount = rigStats.filter(r => r.state === 'en_route').length;
  const scheduledCount = rigStats.filter(r => r.state === 'scheduled').length;
  const gpsCount = rigStats.filter(r => r.hasGps).length;

  if (isLoading || rigsLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (activeRigCount === 0) {
    return (
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rigs on Site Today</h3>
              <p className="text-[11px] text-white/70">{format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
        </div>
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No rigs deployed today</p>
          {drillingCrewsOut > 0 ? (
            <p className="text-xs text-slate-500 mt-1">
              {drillingCrewsOut} drilling crew{drillingCrewsOut !== 1 ? 's' : ''} out — assign a rig via the Rota Builder to track earnings.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">No drilling crews are out today.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rigs on Site Today</h3>
              <p className="text-[11px] text-white/70 flex items-center gap-1.5">
                {format(new Date(), 'EEE dd MMM')} · {onSiteCount} on site{enRouteCount > 0 ? ` · ${enRouteCount} en route` : ''}{scheduledCount > 0 ? ` · ${scheduledCount} scheduled` : ''}
                {gpsCount > 0 && <span className="inline-flex items-center gap-0.5"><Satellite className="w-2.5 h-2.5" />GPS</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60 uppercase font-semibold tracking-wide">Earned today</p>
            <p className="text-lg font-bold tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
            {totalMeterage > 0 && <p className="text-[10px] text-white/70 mt-0.5">{totalMeterage.toFixed(1)}m drilled</p>}
          </div>
        </div>
      </div>

      {/* Rig cards — 2-column grid */}
      <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {rigStats.map((stat, i) => {
          const isScheduled = stat.state === 'scheduled';
          const isOnSite = stat.state === 'on_site';
          const isEnRoute = stat.state === 'en_route';
          const isCompleted = stat.state === 'completed';
          const isAssigned = stat.state === 'assigned';

          // Visual state classes
          const cardBorder = isOnSite
            ? 'border-emerald-300 ring-1 ring-emerald-200'
            : isEnRoute
            ? 'border-amber-300 ring-1 ring-amber-200'
            : isCompleted
            ? 'border-emerald-400'
            : isScheduled
            ? 'border-slate-200'
            : 'border-slate-200 border-dashed';
          const headerBg = isOnSite
            ? 'bg-gradient-to-br from-emerald-50 to-green-50'
            : isEnRoute
            ? 'bg-gradient-to-br from-amber-50 to-orange-50'
            : isCompleted
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100'
            : isScheduled
            ? 'bg-gradient-to-br from-slate-50 to-slate-100'
            : 'bg-slate-50';
          const revenueColor = isOnSite
            ? 'text-emerald-700'
            : isCompleted
            ? 'text-emerald-700'
            : 'text-slate-400';

          // Subtitle text
          let subtitle = null;
          if (isScheduled && stat.firstAssignment?.start_time) {
            subtitle = `Starts at ${stat.firstAssignment.start_time}`;
          } else if (isOnSite && stat.shiftStart) {
            subtitle = `On site · ${fmtDuration(now - stat.shiftStart)}`;
          } else if (isOnSite) {
            subtitle = 'On site';
          } else if (isEnRoute) {
            subtitle = stat.gpsDistance != null ? `En route · ${stat.gpsDistance}m from site` : 'En route to site';
          } else if (isCompleted) {
            subtitle = 'Shift complete';
          } else if (isAssigned) {
            subtitle = 'Assigned · not on site';
          }

          return (
            <motion.div
              key={stat.rigId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border ${cardBorder} bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow`}
            >
              {/* Card header — rig name + state indicator */}
              <div className={`px-3 py-2 ${headerBg} border-b border-slate-100`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isOnSite ? 'bg-emerald-500' : isEnRoute ? 'bg-amber-500' : isCompleted ? 'bg-emerald-600' : isScheduled ? 'bg-slate-300' : 'bg-slate-200'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    ) : isOnSite ? (
                      <Drill className="w-3.5 h-3.5 text-white" />
                    ) : isEnRoute ? (
                      <Navigation className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900 truncate flex-1">{stat.rig?.name || 'Unknown Rig'}</p>
                  {stat.rig?.rig_type && stat.rig.rig_type !== 'n/a' && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-200 text-slate-600 uppercase flex-shrink-0">{stat.rig.rig_type}</span>
                  )}
                  {stat.onSiteSource === 'delivered' && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase flex-shrink-0 inline-flex items-center gap-0.5"><CheckCircle2 className="w-2 h-2" />Delivered</span>
                  )}
                  {!stat.hasGps && stat.hasRotaToday && (
                    <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-400 uppercase flex-shrink-0" title="No GPS vehicle linked">No GPS</span>
                  )}
                  {isOnSite && (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  {isEnRoute && (
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className={`text-[9px] mt-1 flex items-center gap-1 ${
                    isOnSite ? 'text-emerald-600 font-semibold' : isEnRoute ? 'text-amber-600 font-semibold' : isCompleted ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                  }`}>
                    {isOnSite && <MapPin className="w-2.5 h-2.5" />}
                    {isEnRoute && <Navigation className="w-2.5 h-2.5" />}
                    {isScheduled && <Clock className="w-2.5 h-2.5" />}
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Crew */}
              <div className="px-3 py-2 space-y-1 border-b border-slate-50">
                <div className="flex items-center gap-1.5">
                  <HardHat className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  <p className="text-[10px] text-slate-500 truncate">
                    <span className="font-bold text-slate-700">Lead:</span> {stat.leadDriller?.name || <span className="text-slate-400">—</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardHat className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <p className="text-[10px] text-slate-500 truncate">
                    <span className="font-bold text-slate-700">Second:</span> {stat.secondMan?.name || <span className="text-slate-400">—</span>}
                  </p>
                </div>
                {!stat.leadDriller && !stat.secondMan && stat.crew.length === 0 && (
                  <p className="text-[9px] text-amber-600 font-medium pl-4">No crew assigned</p>
                )}
              </div>

              {/* Earnings breakdown */}
              <div className="px-3 py-2 bg-slate-50/40 flex-1">
                <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">
                  {isCompleted ? 'Day total' : isOnSite ? 'Earned so far' : 'Daily cost'}
                </p>
                <div className="flex items-center gap-1">
                  <PoundSterling className={`w-3.5 h-3.5 ${isOnSite || isCompleted ? 'text-emerald-600' : 'text-slate-300'}`} />
                  <p className={`text-base font-bold tabular-nums leading-tight ${revenueColor}`}>{fmtGBP(stat.revenue)}</p>
                  {(isOnSite || isCompleted) && stat.crewDayRate > 0 && (
                    <span className="text-[8px] text-slate-400 font-medium">/ {fmtGBP(stat.crewDayRate)} day</span>
                  )}
                </div>

                {/* Progress bar — on site or completed */}
                {(isOnSite || isCompleted) && stat.crewDayRate > 0 && (
                  <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.round(stat.progressFraction * 100)}%` }}
                    />
                  </div>
                )}

                {/* Breakdown details */}
                <div className="mt-1.5 space-y-0.5">
                  {stat.revMethod === 'meterage_rate' && stat.meterage > 0 && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Ruler className="w-2.5 h-2.5 text-amber-500" />
                      <span className="tabular-nums">{stat.meterage.toFixed(1)}m × {fmtGBPm(stat.meterageRate)}</span>
                    </div>
                  )}
                  {stat.revMethod === 'day_rate' && stat.crewDayRate > 0 && (isOnSite || isCompleted) && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
                      <span>Crew rate: {fmtGBP(stat.crewDayRate)}/day</span>
                    </div>
                  )}
                  {stat.revMethod === 'flat_fee' && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
                      <span>Flat fee</span>
                    </div>
                  )}
                  {stat.meterage > 0 && stat.revMethod !== 'meterage_rate' && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Ruler className="w-2.5 h-2.5 text-amber-500" />
                      <span className="tabular-nums">{stat.meterage.toFixed(1)}m drilled</span>
                    </div>
                  )}
                  {isOnSite && stat.hoursWorkedSoFar > 0 && (
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <Clock className="w-2.5 h-2.5 text-blue-500" />
                      <span className="tabular-nums">{stat.hoursWorkedSoFar.toFixed(1)}h / {stat.plannedShiftHours.toFixed(0)}h shift</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Job Breakdown button */}
              <div className="p-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onJobBreakdown?.(stat.job)}
                  disabled={!stat.job}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-[10px] font-bold hover:bg-[#1c4a12] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Briefcase className="w-3 h-3" />
                  Job Breakdown
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}