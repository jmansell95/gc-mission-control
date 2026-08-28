import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Truck, Wrench, Search, ExternalLink, PhoneCall,
} from 'lucide-react';
import FleetQuickStats from '@/components/vehicles/FleetQuickStats';
import FleetVehicleCard from '@/components/vehicles/FleetVehicleCard';
import FleetInsightsPanel from '@/components/vehicles/FleetInsightsPanel';
import MaintenanceBookingModal from '@/components/vehicles/MaintenanceBookingModal';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import VehicleDetailDrawer from '@/components/vehicles/VehicleDetailDrawer';
import GeotabReportModal from '@/components/vehicles/GeotabReportModal';
import FleetSyncButtons from '@/components/vehicles/FleetSyncButtons';
import { Skeleton } from '@/components/StateViews';
import { differenceInDays } from 'date-fns';

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  const holmanSynced = v.holman_sync_status === 'synced';
  const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null' && v.mot_expiry !== 'None') ? v.mot_expiry : null;
  if (motExpiry) {
    const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days: d });
    }
  }
  if (v.service_due_date && v.service_due_date !== 'null' && v.service_due_date !== 'None') {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'Service Due', severity: 'warning', days: d });
    }
  }
  const hasComplianceData = holmanSynced && (motExpiry || v.service_due_date);
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : (hasComplianceData ? 'compliant' : 'unknown');
  return { issues, level };
}

/**
 * Fleet tab — the vehicle card grid for the Fleet Hub.
 * (Live Tracking and Maintenance are now separate hub-level tabs.)
 */
export default function Vehicles() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintModalVehicleId, setMaintModalVehicleId] = useState(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['vehicles-maintenance-bookings'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 500),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const { data: liveData } = useQuery({
    queryKey: ['geotab-live-locations-fleet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const liveLocations = liveData?.vehicles || [];

  const latestByVehicle = useMemo(() => {
    const map = {};
    liveLocations.forEach(loc => {
      if (!loc.vehicle_id) return;
      if (!map[loc.vehicle_id] || new Date(loc.timestamp) > new Date(map[loc.vehicle_id].timestamp)) {
        map[loc.vehicle_id] = loc;
      }
    });
    return map;
  }, [liveLocations]);

  const nextBookingByVehicle = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = {};
    bookings.forEach(b => {
      if (!['requested', 'booked', 'in_progress'].includes(b.status)) return;
      if (!b.vehicle_id) return;
      if (b.booking_date && b.booking_date < today) return;
      if (!map[b.vehicle_id] || (b.booking_date || '9999') < (map[b.vehicle_id].booking_date || '9999')) {
        map[b.vehicle_id] = b;
      }
    });
    return map;
  }, [bookings]);

  const activeBookingCount = useMemo(
    () => bookings.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status)).length,
    [bookings]
  );

  const stats = useMemo(() => {
    let compliant = 0, warning = 0, expired = 0, holmanSynced = 0, geotabSynced = 0;
    vehicles.forEach(v => {
      if (v.holman_sync_status === 'synced') holmanSynced++;
      if (v.geotab_sync_status === 'synced') geotabSynced++;
      const { level } = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else if (level === 'compliant') compliant++;
    });
    return { total: vehicles.length, compliant, warning, expired, holmanSynced, geotabSynced, activeBookings: activeBookingCount };
  }, [vehicles, activeBookingCount]);

  const q = search.toLowerCase().trim();
  const staffByVehicle = useMemo(() => {
    const map = {};
    staff.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [staff]);

  const filtered = vehicles.filter(v => {
    const hasGeotab = v.geotab_sync_status === 'synced' || !!v.geotab_device_id;
    const hasHolman = v.holman_sync_status === 'synced' || !!v.holman_vehicle_id;
    if (sourceFilter === 'geotab' && !hasGeotab) return false;
    if (sourceFilter === 'holman' && !hasHolman) return false;
    if (sourceFilter === 'both' && !(hasGeotab && hasHolman)) return false;
    if (statusFilter !== 'all') {
      const { level } = getVehicleStatus(v);
      if (statusFilter !== level) return false;
    }
    if (!q) return true;
    const driver = staffByVehicle[v.assigned_staff_id]?.name || '';
    return (
      (v.name || '').toLowerCase().includes(q) ||
      (v.registration_number || '').toLowerCase().includes(q) ||
      (v.vin || '').toLowerCase().includes(q) ||
      (v.make || '').toLowerCase().includes(q) ||
      (v.model || '').toLowerCase().includes(q) ||
      driver.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Quick stats */}
      <FleetQuickStats stats={stats} />

      {/* Sync bar */}
      <FleetSyncButtons
        liveData={liveData}
        vehicles={vehicles}
        onShowReport={() => setShowReport(true)}
      />

      {/* Search & filters */}
      <div className="insight-card rounded-2xl p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by reg, name, VIN or driver..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowNumbers(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition"><PhoneCall className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Numbers</span></button>
            <button onClick={() => navigate('/admin', { state: { section: 'settings', settingsTab: 'vehicles' } })} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs hover:border-[#2E5A1A] hover:text-[#2E5A1A] transition"><ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Settings</span></button>
          </div>
        </div>
        {/* Filter button groups — scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-shrink-0">
            {[
              { val: 'all', label: 'All' },
              { val: 'compliant', label: 'OK' },
              { val: 'warning', label: 'Attention' },
              { val: 'expired', label: 'Critical' },
              { val: 'unknown', label: 'Not Synced' },
            ].map(opt => (
              <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition whitespace-nowrap ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-shrink-0">
            {[
              { val: 'all', label: 'All Sources' },
              { val: 'geotab', label: 'Geotab' },
              { val: 'holman', label: 'Holman' },
              { val: 'both', label: 'Both' },
            ].map(opt => (
              <button key={opt.val} onClick={() => setSourceFilter(opt.val)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition whitespace-nowrap ${sourceFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 ml-1 flex-shrink-0 flex items-center">{filtered.length} of {vehicles.length}</span>
        </div>
      </div>

      {/* Fleet insights */}
      <FleetInsightsPanel
        liveData={liveData}
        onShowReport={() => setShowReport(true)}
        onSelectVehicle={(v) => setSelectedVehicle(v)}
      />

      {/* Fleet grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-10 text-center">
          <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">{vehicles.length === 0 ? 'No vehicles yet. Add them via Settings → Vehicles.' : 'No vehicles match your filters.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <FleetVehicleCard
              key={v.id}
              vehicle={v}
              liveLocation={latestByVehicle[v.id]}
              nextBooking={nextBookingByVehicle[v.id]}
              driverName={staffByVehicle[v.assigned_staff_id]?.name || ''}
              onSelect={setSelectedVehicle}
              onBookMaintenance={() => { setMaintModalVehicleId(v.id); setShowMaintModal(true); }}
            />
          ))}
        </div>
      )}

      <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)} />
      <VehicleDetailDrawer vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
      <MaintenanceBookingModal
        open={showMaintModal}
        onClose={() => { setShowMaintModal(false); setMaintModalVehicleId(null); }}
        preselectVehicleId={maintModalVehicleId}
      />
      {showReport && <GeotabReportModal onClose={() => setShowReport(false)} />}
    </>
  );
}