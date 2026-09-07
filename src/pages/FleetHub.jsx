import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck, Satellite, Wrench } from 'lucide-react';
import HubShell from '@/components/HubShell';
import HubJobBreadcrumb from '@/components/hubs/HubJobBreadcrumb';
import RunReportButton from '@/components/reports/RunReportButton';
import FleetCommandHeader from '@/components/vehicles/FleetCommandHeader';
import LiveTrackingTab from '@/components/vehicles/LiveTrackingTab';
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
    { id: 'live', label: 'Live Tracking', icon: Satellite },
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
        title: 'Fleet Hub — how it works',
        topics: [
          { title: 'Live Tracking', summary: 'Where every vehicle and crew phone is right now.', body: 'Solid pins are vehicles from Geotab. Dashed blue pins are crew shown **via their vehicle** — the driver is the Geotab keeper, their rota vehicle, or their default vehicle. Phone GPS always takes priority when available.' },
          { title: 'Vehicles', summary: 'Specs, mileage, engine hours and keeper links.', body: 'Open a vehicle to see its Geotab keeper, MOT/service history and live status. Link a keeper so that driver appears on the live map automatically.' },
          { title: 'Maintenance', summary: 'Bookings, MOT and service planning.', body: 'Book maintenance with a provider, track the matrix of upcoming work, and receive alerts before anything falls due.' },
        ],
      }}
      onboarding={{
        title: 'Welcome to the Fleet Hub',
        description: 'One place for live tracking, vehicle records and maintenance.',
        steps: ['Sync Geotab in Settings → Integrations', 'Link a keeper to each vehicle', 'Watch crew appear on the live map'],
      }}
      actions={
        <div className="flex items-center gap-2">
          <RunReportButton hub="fleet" />
        </div>
      }
      kpiStrip={<FleetCommandHeader vehicles={vehicles} liveByVehicle={liveByVehicle} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <HubJobBreadcrumb />
      {activeTab === 'live' && <LiveTrackingTab initialVehicleId={liveVehicleId} />}
      {activeTab === 'fleet' && <Vehicles focusVehicleId={focusVehicleId} />}
      {activeTab === 'maintenance' && <VehicleMaintenanceManager />}
    </HubShell>
  );
}