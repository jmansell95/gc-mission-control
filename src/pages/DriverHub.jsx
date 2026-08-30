import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Store, Package, FileText, CheckCircle2, Clock, PlayCircle,
  AlertTriangle, ArrowRightLeft, Boxes, LayoutGrid, List, Navigation, Search, FlaskConical,
  ClipboardList,
} from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import DeliveryBoard from '@/components/admin/DeliveryBoard';
import DeliveryTable from '@/components/admin/DeliveryTable';
import DriverDayPlan from '@/components/admin/DriverDayPlan';
import DriverRunBoard from '@/components/admin/DriverRunBoard';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import BulkDeliveryReconciliation from '@/components/delivery/BulkDeliveryReconciliation';
import GoodsInPanel from '@/components/logistics/GoodsInPanel';
import ConsumableInventoryManager from '@/components/settings/ConsumableInventoryManager';
import DeliveryDetailDrawer from '@/components/logistics/DeliveryDetailDrawer';
import HireManagementTab from '@/components/driverhub/HireManagementTab';
import PurchasedForJobTab from '@/components/driverhub/PurchasedForJobTab';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import { Skeleton, EmptyState } from '@/components/StateViews';

const typeFilters = [
  { value: 'all', label: 'All', icon: LayoutGrid },
  { value: 'site_delivery', label: 'Deliveries', icon: Truck },
  { value: 'supplier_delivery', label: 'Goods In', icon: Store },
  { value: 'supplier_collection', label: 'Collections', icon: Package },
  { value: 'item_handover', label: 'Handovers', icon: ArrowRightLeft },
  { value: 'sample_collection', label: 'Sample Collect', icon: FlaskConical },
  { value: 'sample_delivery', label: 'Sample to Lab', icon: FlaskConical },
];

const dateFilters = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Logistics Hub — comprehensive office-staff operations hub covering the full
 * lifecycle: today's runs, procurement, hire management, purchased-for-job
 * tracking, and reconciliation. Replaces the old AdminDeliveryHub.
 */
export default function DriverHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('runs');
  const [sub, setSub] = useState('board');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: deliveries = [], isLoading } = useScopedEntity('DeliveryLog', { queryKey: ['driver-hub-deliveries'], sort: '-scheduled_date', limit: 500 });
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['driver-hub-jobs'], limit: 500 });
  const { data: staff = [] } = useScopedEntity('Staff', { queryKey: ['driver-hub-staff'], filter: { is_active: true }, limit: 500 });

  const drivers = useMemo(() => {
    const ids = new Set(deliveries.map(d => d.driver_staff_id).filter(Boolean));
    return staff.filter(s => ids.has(s.id));
  }, [deliveries, staff]);

  const filtered = useMemo(() => {
    let result = [...deliveries];
    if (typeFilter !== 'all') result = result.filter(d => d.delivery_type === typeFilter);
    if (driverFilter !== 'all') result = result.filter(d => d.driver_staff_id === driverFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.items || '').toLowerCase().includes(q) ||
        (d.job_name || '').toLowerCase().includes(q) ||
        (d.delivery_address || '').toLowerCase().includes(q) ||
        (d.driver_staff_name || '').toLowerCase().includes(q));
    }
    if (dateFilter === 'today') result = result.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    if (dateFilter === 'upcoming') result = result.filter(d => isFuture(new Date(d.scheduled_date + 'T00:00:00')) && d.status !== 'completed');
    if (dateFilter === 'overdue') result = result.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59')));
    if (dateFilter === 'completed') result = result.filter(d => d.status === 'completed');
    return result.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
  }, [deliveries, typeFilter, driverFilter, search, dateFilter]);

  const stats = useMemo(() => {
    const todayList = deliveries.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    return {
      today: todayList.length,
      inTransit: deliveries.filter(d => d.status === 'in_progress').length,
      completed: deliveries.filter(d => d.status === 'completed').length,
      overdue: deliveries.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59'))).length,
    };
  }, [deliveries]);

  return (
    <HubShell
      icon={Truck}
      title="Logistics Hub"
      subtitle="Full lifecycle: runs, procurement, hire management, purchased-for-job & reconciliation"
      tabs={[
        { id: 'runs', label: 'Today\u2019s Runs', icon: Truck },
        { id: 'procurement', label: 'Procurement', icon: Store },
        { id: 'hire', label: 'Hire Management', icon: Package },
        { id: 'purchased', label: 'Purchased-for-Job', icon: FileText },
        { id: 'reconcile', label: 'Reconciliation', icon: CheckCircle2 },
        { id: 'pick-lists', label: 'Pick Lists', icon: ClipboardList },
      ]}
      activeTab={tab}
      onTabChange={(t) => {
        if (t === 'pick-lists') { navigate('/depot-pick-lists'); return; }
        setTab(t); setSub(t === 'procurement' ? 'goods-in' : 'board');
      }}
      kpiStrip={
        <HubStatsBar tiles={[
          { icon: Clock, label: 'Today', value: stats.today, color: 'amber' },
          { icon: PlayCircle, label: 'In Transit', value: stats.inTransit, color: 'blue' },
          { icon: CheckCircle2, label: 'Completed', value: stats.completed, color: 'emerald' },
          { icon: AlertTriangle, label: 'Overdue', value: stats.overdue, color: 'rose' },
        ]} />}
    >
      {/* === Today's Runs tab === */}
      {tab === 'runs' && (
        <>
          <SubPills active={sub} onChange={setSub} pills={[
            { id: 'board', label: 'Board', icon: LayoutGrid },
            { id: 'list', label: 'List', icon: List },
            { id: 'day-plan', label: 'Day Plan', icon: Clock },
            { id: 'route', label: 'Route View', icon: Navigation },
          ]} />

          {sub === 'day-plan' && (
            <DriverDayPlan deliveries={deliveries} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
          )}

          {sub !== 'day-plan' && (
            <>
              {/* Filter bar */}
              <div className="bg-white rounded-hub border border-slate-200 p-hub-card-pad-sm md:p-hub-card-pad space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by job, items, address, driver…"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-hub-body focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {typeFilters.map(f => (
                    <button key={f.value} onClick={() => setTypeFilter(f.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-hub-caption font-medium transition ${typeFilter === f.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <f.icon className="w-3.5 h-3.5" />{f.label}
                    </button>
                  ))}
                  <span className="w-px bg-slate-200 my-1" />
                  {dateFilters.map(f => (
                    <button key={f.value} onClick={() => setDateFilter(f.value)}
                      className={`px-3 py-1.5 rounded-lg text-hub-caption font-medium transition ${dateFilter === f.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {f.label}
                    </button>
                  ))}
                  {drivers.length > 0 && (
                    <>
                      <span className="w-px bg-slate-200 my-1" />
                      <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-hub-caption font-medium bg-slate-100 text-slate-600 border-0 focus:outline-none">
                        <option value="all">All Drivers</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Route optimiser */}
              {driverFilter !== 'all' && (() => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const driverTodays = deliveries.filter(d =>
                  d.driver_staff_id === driverFilter && d.scheduled_date === todayStr &&
                  (d.status === 'pending' || d.status === 'in_progress'));
                if (driverTodays.length < 2) return null;
                return <RouteOptimizeBar driverStaffId={driverFilter} date={todayStr} count={driverTodays.length} />;
              })()}

              {/* Content */}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-hub border border-slate-200">
                  <EmptyState icon={Truck} title="No runs found" message="Try adjusting your filters." />
                </div>
              ) : sub === 'route' ? (
                <DriverRunBoard deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
              ) : sub === 'list' ? (
                <DeliveryTable deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
              ) : (
                <DeliveryBoard deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
              )}
            </>
          )}
        </>
      )}

      {/* === Procurement tab === */}
      {tab === 'procurement' && (
        <>
          <SubPills active={sub} onChange={setSub} pills={[
            { id: 'goods-in', label: 'Goods In', icon: Store },
            { id: 'stock', label: 'Consumable Stock', icon: Boxes },
          ]} />
          {sub === 'goods-in' && <GoodsInPanel />}
          {sub === 'stock' && <ConsumableInventoryManager />}
        </>
      )}

      {/* === Hire Management tab === */}
      {tab === 'hire' && <HireManagementTab />}

      {/* === Purchased-for-Job tab === */}
      {tab === 'purchased' && <PurchasedForJobTab />}

      {/* === Reconciliation tab === */}
      {tab === 'reconcile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          <BulkDeliveryReconciliation />
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <DeliveryDetailDrawer delivery={selected} jobs={jobs} staff={staff} onClose={() => setSelected(null)} />
      )}
    </HubShell>
  );
}