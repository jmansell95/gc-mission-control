import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck, Satellite, Wrench, Users } from 'lucide-react';
import HubShell from '@/components/HubShell';
import HubJobBreadcrumb from '@/components/hubs/HubJobBreadcrumb';
import RunReportButton from '@/components/reports/RunReportButton';
import LiveTrackingTab from '@/components/vehicles/LiveTrackingTab';
import LiveCrewTab from '@/components/vehicles/LiveCrewTab';
import Vehicles from '@/pages/Vehicles';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';

/**
 * Fleet Hub — dedicated hub for all vehicles, live GPS tracking,
 * MOT/service schedules, and fleet maintenance.
 *
 * Three top-level tabs: Live Tracking (default) · Fleet · Maintenance
 */
export default function FleetHub() {
  const [searchParams] = useSearchParams();
  const focusVehicleId = searchParams.get('vehicle');
  const liveVehicleId = searchParams.get('liveVehicle');
  const [activeTab, setActiveTab] = useState(focusVehicleId ? 'fleet' : 'live');

  const { data: vehicles = [] } = useScopedEntity('Vehicle', { queryKey: ['vehicles-fleet-hub'], sort: '-created_date', limit: 500 });

  // Live Geotab data — fresh driving/ignition overlay (mode 'live_fast' for speed)
  const { data: liveData } = useQuery({
    queryKey: ['fleet-hub-live-driving'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const liveLocations = liveData?.vehicles || [];

  const liveByVehicle = useMemo(() => {
    const map = {};
    liveLocations.forEach(loc => { if (loc.vehicle_id) map[loc.vehicle_id] = loc; });
    return map;
  }, [liveLocations]);

  const tabs = [
    { id: 'live', label: 'Live Vehicle Map', icon: Satellite },
    { id: 'crew', label: 'Live Crew Map', icon: Users },
    { id: 'fleet', label: 'Vehicles', icon: Truck },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <HubShell
      hubKey="fleet"
      icon={Truck}
      eyebrow="Tracking Hub"
      title="Tracking Hub"
      subtitle="Live GPS tracking — vehicles & crew phones, full fleet specs, engine hours & mileage"
      breadcrumbs={[{ label: 'Tracking Hub' }]}
      help={{
        title: 'Tracking Hub — how it works',
        topics: [
          { title: 'Live Vehicle Map', summary: 'Where every vehicle is right now.', body: 'Solid pins are vehicles from Geotab — green with arrow when engine on, grey when off. Click a vehicle for live status, or open route history for trip playback, safety events, and route comparison.' },
          { title: 'Live Crew Map', summary: 'Real-time crew phone GPS with status colours and gap detection.', body: 'Green = live fix under 2 min, amber = stale (2-15 min), red = gone dark (over 15 min), grey = off shift. Tap a crew member to see their day trail (dashed segments show GPS gaps), active job, and tracking health. The engine flushes every 30s while moving and logs coverage gaps so managers can see exactly where signal was lost.' },
          { title: 'Vehicles', summary: 'Specs, mileage, engine hours and keeper links.', body: 'Open a vehicle to see its Geotab keeper, MOT/service history and live status. Link a keeper so that driver appears on the live map automatically.' },
          { title: 'Maintenance', summary: 'Bookings, MOT and service planning.', body: 'Book maintenance with a provider, track the matrix of upcoming work, and receive alerts before anything falls due.' },
        ],
      }}
      onboarding={{
        title: 'Welcome to the Tracking Hub',
        description: 'One place for live tracking, vehicle records and maintenance.',
        steps: ['Sync Geotab in Settings → Integrations', 'Link a keeper to each vehicle', 'Watch crew appear on the live map'],
      }}
      actions={
        <div className="flex items-center gap-2">
          <RunReportButton hub="fleet" />
        </div>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <HubJobBreadcrumb />
      {activeTab === 'live' && <LiveTrackingTab initialVehicleId={liveVehicleId} />}
      {activeTab === 'crew' && <LiveCrewTab />}
      {activeTab === 'fleet' && <Vehicles focusVehicleId={focusVehicleId} />}
      {activeTab === 'maintenance' && <VehicleMaintenanceManager />}
    </HubShell>
  );
}