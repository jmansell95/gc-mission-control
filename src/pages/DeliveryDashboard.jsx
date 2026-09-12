import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Package, ArrowRightLeft, Calendar, CheckCircle2, Clock, HardHat, ArrowRight, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isFuture, isToday } from 'date-fns';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import DeliveryCard from '@/components/delivery/DeliveryCard';
import DeliveryCompleteModal from '@/components/delivery/DeliveryCompleteModal';
import SiteCollectionScanner from '@/components/logistics/SiteCollectionScanner';
import MissionTimeline from '@/components/delivery/MissionTimeline';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import DriverLegChainView from '@/components/logistics/DriverLegChainView';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { isWithinSiteHours, isBeforeSiteOpen, SITE_OPEN_TIME, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { saveOfflineDelivery, hasOfflineDelivery } from '@/utils/offlineSync';

import FieldPageShell from '@/components/field/FieldPageShell';
import FieldContainer from '@/components/field/FieldContainer';
import StartMyRunHero from '@/components/staff/StartMyRunHero';
import StaffHeaderActions from '@/components/field/StaffHeaderActions';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import DivisionIdentityBar from '@/components/DivisionIdentityBar';
import SyncHUD from '@/components/staff/SyncHUD';
import StaffAlerts from '@/components/staff/StaffAlerts';
import StatCard from '@/components/dashboard/StatCard';

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function SectionHeader({ icon: Icon, title, count, tone = 'dark' }) {
  const textTone = tone === 'muted' ? 'text-slate-400' : 'text-slate-900';
  return (
    <div className="flex items-center gap-2.5 mb-3 md:mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone === 'muted' ? 'bg-slate-100' : 'stat-gradient-emerald'}`}>
        <Icon className={`w-4 h-4 ${tone === 'muted' ? 'text-slate-400' : 'text-white'}`} />
      </div>
      <h2 className={`text-lg md:text-xl font-bold ${textTone}`}>{title}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tone === 'muted' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>{count}</span>
    </div>
  );
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completeDelivery, setCompleteDelivery] = useState(null);
  const [scanDelivery, setScanDelivery] = useState(null);
  const [autoExpandId, setAutoExpandId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        // Platform admins can access the delivery dashboard even without a
        // linked crew profile — they see ALL deliveries instead of just their own.
        if (res.data && (res.data.is_admin || (res.data.id && !res.data.no_staff_profile))) {
          if (!res.data.is_admin && !res.data.delivery_dashboard_enabled) {
            navigate('/staff-schedule', { replace: true });
            return;
          }
          setStaff(res.data);
        } else if (isPlatformAdmin) {
          // Profile returned but wasn't usable — platform admin fallback.
          setStaff({ id: null, name: user?.full_name || user?.email || 'Admin', email: user?.email, is_admin: true, delivery_dashboard_enabled: true, no_staff_profile: true });
        }
      } catch (e) {
        console.error('Error loading staff:', e);
        // Profile fetch failed (401/500) — platform admins still get through.
        if (isPlatformAdmin) {
          setStaff({ id: null, name: user?.full_name || user?.email || 'Admin', email: user?.email, is_admin: true, delivery_dashboard_enabled: true, no_staff_profile: true });
        }
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
  }, [navigate, isPlatformAdmin, user]);

  // Real-time subscription
  useEffect(() => {
    if (!staff?.id) return;
    const unsub = base44.entities.DeliveryLog.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    });
    return () => { if (unsub) unsub(); };
  }, [staff?.id, queryClient]);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['my-deliveries', staff?.id, staff?.is_admin],
    queryFn: async () => {
      // Platform admin with no crew profile — show all deliveries
      if (!staff?.id && staff?.is_admin) {
        const list = await base44.entities.DeliveryLog.list('-scheduled_date', 200);
        return list.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
      }
      if (!staff?.id) return [];
      const list = await base44.entities.DeliveryLog.filter({ driver_staff_id: staff.id });
      return list.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
    },
    enabled: !!staff?.id || !!staff?.is_admin
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['delivery-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['delivery-vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['delivery-all-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });

  const canPerformActions = isWithinSiteHours() || isBeforeSiteOpen() || staff?.is_admin;

  // Auto-optimise the driver's route on first load if they have 2+ unoptimised
  // active stops for today — so their day is automatically organised (first,
  // second, third) by location without needing to click anything.
  const [autoOptimizeRan, setAutoOptimizeRan] = useState(false);
  useEffect(() => {
    if (autoOptimizeRan || !staff?.id || isLoading) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todaysActive = deliveries.filter(d =>
      d.scheduled_date === todayStr &&
      (d.status === 'pending' || d.status === 'in_progress')
    );
    const unoptimised = todaysActive.filter(d => !d.route_optimized_at);
    if (unoptimised.length >= 2) {
      setAutoOptimizeRan(true);
      base44.functions.invoke('optimizeDailyRoute', { driver_staff_id: staff.id, date: todayStr })
        .then(() => queryClient.invalidateQueries({ queryKey: ['my-deliveries'] }))
        .catch(() => {/* silent — driver can retry manually */});
    } else {
      setAutoOptimizeRan(true);
    }
  }, [autoOptimizeRan, staff?.id, deliveries, isLoading, queryClient]);

  const handleStart = async (deliveryId) => {
    try {
      await base44.entities.DeliveryLog.update(deliveryId, {
        status: 'in_progress',
        started_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    } catch (e) {
      console.error('Error starting delivery:', e);
      toast({ title: 'Error', description: 'Could not start delivery. Try again.' });
    }
  };

  const handleComplete = async (data) => {
    const deliveryId = data.delivery_id;

    try {
      let signatureUrl = '';
      if (data.signature_data_url) {
        const [meta, base64] = data.signature_data_url.split(',');
        const mime = meta.match(/:(.*?);/)[1];
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        const file = new File([blob], `delivery_sig_${deliveryId}.png`, { type: 'image/png' });
        const res = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = res.file_url;
      }

      let photoUrls = '';
      if (data.photo_data_urls) {
        const dataUrls = (data.photo_data_urls || '').split('||').filter(Boolean);
        const uploaded = [];
        for (let i = 0; i < dataUrls.length; i++) {
          const [meta, base64] = dataUrls[i].split(',');
          const mime = meta.match(/:(.*?);/)[1];
          const bytes = atob(base64);
          const arr = new Uint8Array(bytes.length);
          for (let j = 0; j < bytes.length; j++) arr[j] = bytes.charCodeAt(j);
          const blob = new Blob([arr], { type: mime });
          const file = new File([blob], `delivery_photo_${deliveryId}_${i}.png`, { type: 'image/png' });
          const res = await base44.integrations.Core.UploadFile({ file });
          uploaded.push(res.file_url);
        }
        photoUrls = uploaded.join(',');
      }

      const handoverColleague = data.handover_mode ? allStaff.find(s => s.id === data.handover_to_staff_id) : null;
      const updated = await base44.entities.DeliveryLog.update(deliveryId, {
        status: 'completed',
        completed_at: data.completed_at,
        signature_url: signatureUrl,
        signed_by_name: data.signed_by_name,
        photo_urls: photoUrls,
        gps_coordinates: data.gps_coordinates || '',
        notes: data.notes,
        condition_report: data.condition_report,
        synced_from_offline: false,
        ...(data.samples_accounted !== undefined ? { samples_accounted: data.samples_accounted } : {}),
        ...(data.handover_mode && handoverColleague ? {
          handover_to_staff_id: handoverColleague.id,
          handover_to_staff_name: handoverColleague.name,
        } : {})
      });

      // Auto-update linked sample statuses when a sample run is completed
      const linkedSampleIds = (updated.sample_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      if (linkedSampleIds.length > 0 && !data.handover_mode) {
        const now = new Date().toISOString().slice(0, 10);
        const newStatus = updated.delivery_type === 'sample_collection' ? 'dispatched' : 'received_at_lab';
        try {
          const sampleUpdates = linkedSampleIds.map(id => ({
            id,
            status: newStatus,
            status_changed_at: new Date().toISOString(),
            ...(newStatus === 'dispatched' ? { dispatch_date: now } : { lab_receipt_date: now }),
          }));
          await base44.entities.Sample.bulkUpdate(sampleUpdates);
        } catch (e) { console.error('Sample status sync error:', e); }
      }

      // Auto-update linked cost item locations based on delivery type
      const linkedIds = (updated.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const isHandover = data.handover_mode && data.handover_to_staff_id;
      if (linkedIds.length > 0 && !isHandover) {
        const newLocation = updated.delivery_type === 'supplier_collection' ? 'returned' : 'site';
        const updates = linkedIds.map(id => ({
          id,
          current_location: newLocation,
          location_updated_at: new Date().toISOString(),
          ...(newLocation === 'returned' ? {
            hire_status: 'off_hired',
            off_hire_date: new Date().toISOString().split('T')[0]
          } : {})
        }));
        try { await base44.entities.JobCostItem.bulkUpdate(updates); } catch (e) { console.error('Item location sync error:', e); }
      }

      // Handover-to-colleague: create a chained delivery task for the receiving
      // colleague so it appears on their delivery dashboard for them to deliver
      // to the final recipient and capture the recipient's signature.
      if (isHandover) {
        const colleague = allStaff.find(s => s.id === data.handover_to_staff_id);
        try {
          await base44.entities.DeliveryLog.create({
            job_id: updated.job_id,
            job_name: updated.job_name || '',
            driver_staff_id: data.handover_to_staff_id,
            driver_staff_name: colleague?.name || '',
            delivery_type: updated.delivery_type === 'supplier_collection' ? 'site_delivery' : updated.delivery_type,
            status: 'pending',
            items: updated.items || '',
            linked_cost_item_ids: updated.linked_cost_item_ids || '',
            pickup_address: updated.pickup_address || '',
            delivery_address: updated.delivery_address || '',
            contact_name: updated.contact_name || '',
            contact_phone: updated.contact_phone || '',
            po_number: updated.po_number || '',
            scheduled_date: format(new Date(), 'yyyy-MM-dd'),
            vehicle_id: '',
            notes: `Handed over by ${data.signed_by_name || staff?.name || 'previous driver'}${updated.notes ? ' — ' + updated.notes : ''}`,
            chargeable: updated.chargeable !== false,
            parent_delivery_id: deliveryId,
            handover_from_staff_name: data.signed_by_name || staff?.name || '',
          });
          toast({ title: 'Handover created', description: `${colleague?.name || 'Colleague'} now has a delivery task to complete.` });
        } catch (e) {
          console.error('Chained handover creation error:', e);
          toast({ title: 'Handover task could not be created', description: 'The delivery was signed off but the colleague task failed — create it manually.', variant: 'destructive' });
        }
      }

      // Auto-create a draft timesheet entry for the driver from the delivery's
      // actual start→complete duration, so driving time flows into the same
      // End of Shift review and weekly approval pipeline as yard work.
      try {
        await base44.functions.invoke('createDeliveryTimesheetEntry', { delivery_id: deliveryId });
      } catch (e) { console.error('Delivery timesheet creation error:', e); }

      // Stamp rig on-site state from the delivery sign-off (site delivery → on
      // site, collection → release to yard). Best-effort — never blocks the
      // sign-off itself.
      try {
        await base44.functions.invoke('stampRigOnSiteFromDelivery', { delivery_id: deliveryId });
      } catch (e) { console.error('Rig on-site stamp error:', e); }

      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });

      // Surface the next stop so the driver knows where to go next.
      const remaining = deliveries.filter(d => d.id !== deliveryId && d.status !== 'completed' && d.scheduled_date === format(new Date(), 'yyyy-MM-dd'));
      const next = [...remaining].sort((a, b) => (a.started_at ? 1 : 0) - (b.started_at ? 1 : 0))[0];
      const nextAddr = next ? (next.delivery_type === 'supplier_collection' ? next.pickup_address : next.delivery_address) : null;
      if (next) setAutoExpandId(next.id);
      if (next && nextAddr) {
        toast({
          title: `${remaining.length} ${remaining.length === 1 ? 'stop' : 'stops'} to go — next: ${next.job_name || 'delivery'}`,
          description: nextAddr,
        });
      } else {
        toast({ title: 'All done!', description: 'No more deliveries scheduled for today.' });
      }
      setCompleteDelivery(null);
      return true;
    } catch (e) {
      console.error('Error completing delivery:', e);
      // Network failed (or upload was rejected) — queue the sign-off offline so it syncs later.
      try {
        saveOfflineDelivery(data);
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
        toast({ title: 'Saved offline', description: 'Will sync automatically when you\u2019re back online.' });
        setCompleteDelivery(null);
        return true;
      } catch (saveErr) {
        console.error('Offline save error:', saveErr);
        toast({ title: 'Could not sign off', description: 'Check your connection and try again.' });
        return false;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen page-bg-vibrant">
        <div className="w-12 h-12 border-4 border-slate-200/80 border-t-[#2E5A1A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen page-bg-vibrant px-6">
        <div className="text-center max-w-sm hub-glass rounded-3xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-700 font-bold text-lg">No driver profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your supervisor to get set up.</p>
          <button onClick={() => navigate('/staff-schedule')} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition active:scale-95">
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  // Group deliveries
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todays = deliveries.filter(d => d.scheduled_date === todayStr && d.status !== 'completed');
  const todaysSorted = [...todays].sort((a, b) => (a.started_at ? 1 : 0) - (b.started_at ? 1 : 0));
  const upcoming = deliveries.filter(d => isFuture(new Date(d.scheduled_date + 'T00:00:00')) && d.scheduled_date !== todayStr && d.status !== 'completed');
  const completed = deliveries.filter(d => d.status === 'completed').sort((a, b) => new Date(b.completed_at || b.scheduled_date) - new Date(a.completed_at || a.scheduled_date)).slice(0, 10);

  const vehicleDateWeightMap = {};
  deliveries.forEach(d => {
    if (d.vehicle_id && d.scheduled_date) {
      const key = `${d.vehicle_id}_${d.scheduled_date}`;
      vehicleDateWeightMap[key] = (vehicleDateWeightMap[key] || 0) + (Number(d.weight_kg) || 0);
    }
  });

  const cardProps = (delivery) => ({
    delivery,
    job: jobs.find(j => j.id === delivery.job_id),
    vehicle: vehicles.find(v => v.id === delivery.vehicle_id),
    vehicleTotalWeight: vehicleDateWeightMap[`${delivery.vehicle_id}_${delivery.scheduled_date}`] || 0,
    onStart: handleStart,
    onComplete: (d) => setCompleteDelivery(d),
    onScanCollect: (d) => setScanDelivery(d),
    canPerformActions,
    isOfflinePending: hasOfflineDelivery(delivery.id)
  });

  return (
    <FieldPageShell
      title="Driver Hub"
      subtitle={`${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, ${staff?.name?.split(' ')[0] || 'Team'} · ${format(new Date(), 'EEE dd MMM')}`}
      meta={format(new Date(), 'HH:mm')}
      icon={Truck}
      actions={<StaffHeaderActions staff={staff} />}
      contentClassName="pb-20"
    >
      <DivisionIdentityBar />
      <RedAlertBanner />

      {/* Main Content */}
      <FieldContainer>
        <SyncHUD />
        <StaffAlerts isOnline={isOnline} staff={staff} />

        {/* Page title + quick stats */}
        <div className="mb-1 md:mb-2">
          <h1 className="text-xl md:text-2xl font-extrabold gradient-text-brand mb-3">Driver Hub</h1>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <StatCard icon={Clock} value={todays.length} label="Today" gradient="stat-gradient-amber" />
            <StatCard icon={Calendar} value={upcoming.length} label="Upcoming" gradient="stat-gradient-blue" />
            <StatCard icon={CheckCircle2} value={deliveries.filter(d => d.status === 'completed').length} label="Done" gradient="stat-gradient-emerald" />
          </div>
        </div>

        {/* Start My Run — pre-departure safety hero */}
        {todaysSorted.length > 0 && (
          <StartMyRunHero
            hasStops={todaysSorted.length > 0}
            onStart={() => {
              const firstCard = document.querySelector('[data-delivery-id]');
              if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        )}

        {/* My Delivery Chain — multi-leg gear movements */}
        <DriverLegChainView staffId={staff?.id} />

        {/* My Deliveries Today heading */}
        <div className="flex items-center gap-2.5 mb-3 md:mb-4">
          <div className="w-8 h-8 rounded-lg stat-gradient-amber flex items-center justify-center glow-amber">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900">My Deliveries Today</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="hub-glass rounded-2xl p-5">
                <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : todaysSorted.length === 0 ? (
          <div className="hub-glass rounded-2xl">
            <EmptyState icon={Clock} title="No deliveries scheduled yet" message="Check back later — your supervisor will assign delivery tasks to you." />
          </div>
        ) : (
          <div className="space-y-3">
            {todaysSorted.length >= 2 && staff?.id && (
              <RouteOptimizeBar driverStaffId={staff.id} date={todayStr} count={todaysSorted.length} />
            )}
            <MissionTimeline
              deliveries={todaysSorted}
              jobs={jobs}
              vehicles={vehicles}
              allStaff={allStaff}
              onStart={handleStart}
              onComplete={(d) => setCompleteDelivery(d)}
              onScanCollect={(d) => setScanDelivery(d)}
              canPerformActions={canPerformActions}
              autoExpandId={autoExpandId}
            />
          </div>
        )}

        {/* Upcoming */}
        {!isLoading && upcoming.length > 0 && (
          <div className="mt-6">
            <SectionHeader icon={Calendar} title="Upcoming" count={upcoming.length} tone="muted" />
            <div className="space-y-3">
              {upcoming.slice(0, 10).map(d => (
                <DeliveryCard key={d.id} {...cardProps(d)} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {!isLoading && completed.length > 0 && (
          <div className="mt-6">
            <SectionHeader icon={CheckCircle2} title="Recently Completed" count={completed.length} tone="muted" />
            <div className="space-y-3">
              {completed.map(d => (
                <DeliveryCard key={d.id} {...cardProps(d)} />
              ))}
            </div>
          </div>
        )}
      </FieldContainer>

      {/* Site collection scanner */}
      {scanDelivery && (
        <SiteCollectionScanner
          delivery={scanDelivery}
          onClose={() => setScanDelivery(null)}
        />
      )}

      {/* Complete modal */}
      <DeliveryCompleteModal
        delivery={completeDelivery}
        open={!!completeDelivery}
        onClose={() => setCompleteDelivery(null)}
        onComplete={handleComplete}
        staffList={allStaff}
        currentDriverName={staff?.name || ''}
      />
    </FieldPageShell>
  );
}