import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck, Satellite, Wrench } from 'lucide-react';
import HubShell from '@/components/HubShell';
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
    { id: 'fleet', label: 'Fleet', icon: Truck },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <HubShell
      icon={Truck}
      title="Fleet Hub"
      subtitle="Drilling group vehicles — live GPS tracking, full specs, engine hours & mileage"
      actions={<RunReportButton hub="fleet" />}
      kpiStrip={<FleetCommandHeader vehicles={vehicles} liveByVehicle={liveByVehicle} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'live' && <LiveTrackingTab initialVehicleId={liveVehicleId} />}
      {activeTab === 'fleet' && <Vehicles focusVehicleId={focusVehicleId} />}
      {activeTab === 'maintenance' && <VehicleMaintenanceManager />}
    </HubShell>
  );
}