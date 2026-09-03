import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck, Search, LayoutGrid, List, Filter, Clock, PlayCircle, CheckCircle2, AlertTriangle, ArrowRightLeft, Package, Store, Boxes, Navigation } from 'lucide-react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import DeliveryBoard from '@/components/admin/DeliveryBoard';
import DeliveryTable from '@/components/admin/DeliveryTable';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import BulkDeliveryReconciliation from '@/components/delivery/BulkDeliveryReconciliation';
import GoodsInPanel from '@/components/logistics/GoodsInPanel';
import ConsumableInventoryManager from '@/components/settings/ConsumableInventoryManager';
import DeliveryDetailDrawer from '@/components/logistics/DeliveryDetailDrawer';
import DriverRunBoard from '@/components/admin/DriverRunBoard';
import DriverDayPlan from '@/components/admin/DriverDayPlan';
import SampleRunDrawer from '@/components/geotech/SampleRunDrawer';
import { Skeleton, EmptyState } from '@/components/StateViews';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import HubStatsBar from '@/components/dashboard/HubStatsBar';

const typeFilters = [
  { value: 'all', label: 'All Types', icon: Filter },
  { value: 'site_delivery', label: 'Deliveries', icon: Truck },
  { value: 'supplier_delivery', label: 'Goods In', icon: Store },
  { value: 'supplier_collection', label: 'Collections', icon: Package },
  { value: 'item_handover', label: 'Handovers', icon: ArrowRightLeft },
];

const dateFilters = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

export default function AdminDeliveryHub() {
  const location = useLocation();
  const [group, setGroup] = useState('operations');
  const [sub, setSub] = useState('board');
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [sampleRunPrefill, setSampleRunPrefill] = useState(null);

  // Detect incoming sample-run prefill from the Geotech tab (router state).
  // Consumes it once on mount, then clears the location state so it doesn't
  // re-trigger on refresh.
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill) {
      setSampleRunPrefill(prefill);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: deliveries = [], isLoading } = useScopedEntity('DeliveryLog', { queryKey: ['admin-all-deliveries'], sort: '-scheduled_date', limit: 500 });
  const { data: jobs = [] } = useScopedEntity('Job', { queryKey: ['admin-delivery-jobs'], limit: 500 });
  const { data: staff = [] } = useScopedEntity('Staff', { queryKey: ['admin-delivery-staff'], filter: { is_active: true }, limit: 500 });

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
        (d.pickup_address || '').toLowerCase().includes(q) ||
        (d.driver_staff_name || '').toLowerCase().includes(q) ||
        (d.signed_by_name || '').toLowerCase().includes(q));
    }
    if (dateFilter === 'today') result = result.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    if (dateFilter === 'upcoming') result = result.filter(d => isFuture(new Date(d.scheduled_date + 'T00:00:00')) && d.status !== 'completed');
    if (dateFilter === 'overdue') result = result.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59')));
    if (dateFilter === 'completed') result = result.filter(d => d.status === 'completed');
    return result.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
  }, [deliveries, typeFilter, driverFilter, search, dateFilter]);

  const stats = useMemo(() => {
    const today = deliveries.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00')));
    return {
      total: deliveries.length,
      today: today.length,
      inTransit: deliveries.filter(d => d.status === 'in_progress').length,
      completed: deliveries.filter(d => d.status === 'completed').length,
      overdue: deliveries.filter(d => d.status === 'pending' && isPast(new Date(d.scheduled_date + 'T23:59:59'))).length,
      handovers: deliveries.filter(d => d.delivery_type === 'item_handover').length,
    };
  }, [deliveries]);

  return (
    <HubShell
      icon={Truck}
      title="Logistics Hub"
      subtitle="Delivery board, collections, route optimisation & driver handovers"
      tabs={[
        { id: 'operations', label: 'Operations', icon: LayoutGrid },
        { id: 'inventory', label: 'Inventory', icon: Boxes },
      ]}
      activeTab={group}
      onTabChange={(g) => { setGroup(g); setSub(g === 'operations' ? 'board' : 'goods-in'); }}
      kpiStrip={<HubStatsBar tiles={[
        { icon: Clock, label: 'Today', value: stats.today, color: 'amber' },
        { icon: PlayCircle, label: 'In Transit', value: stats.inTransit, color: 'blue' },
        { icon: CheckCircle2, label: 'Completed', value: stats.completed, color: 'emerald' },
        { icon: AlertTriangle, label: 'Overdue', value: stats.overdue, color: 'rose' },
        { icon: ArrowRightLeft, label: 'Handovers', value: stats.handovers, color: 'violet' },
      ]} />}
    >
      <SubPills active={sub} onChange={setSub} pills={
        group === 'operations'
          ? [{ id: 'board', label: 'Delivery Board', icon: LayoutGrid }, { id: 'day-plan', label: 'Day Plan', icon: Clock }, { id: 'reconcile', label: 'Reconcile', icon: CheckCircle2 }]
          : [{ id: 'goods-in', label: 'Goods In', icon: Store }, { id: 'stock', label: 'Consumable Stock', icon: Boxes }]
      } />

      {/* Driver Day-Plan tab — per-driver vertical timeline of today's stops */}
      {sub === 'day-plan' && (
        <DriverDayPlan deliveries={deliveries} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      )}

      {/* Reconciliation tab — bulk proof-of-delivery approval */}
      {sub === 'reconcile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
          <BulkDeliveryReconciliation />
        </div>
      )}

      {/* Goods In tab — gatekeeper verification of received stock */}
      {sub === 'goods-in' && <GoodsInPanel />}

      {/* Stock tab — consumable inventory catalog management */}
      {sub === 'stock' && <ConsumableInventoryManager />}

      {/* Board tab content */}
      {sub === 'board' && (
      <>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by job, items, address, driver or signatory…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('board')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'board' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              <LayoutGrid className="w-4 h-4" /> Board
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              <List className="w-4 h-4" /> List
            </button>
            <button onClick={() => setView('route')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === 'route' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              <Navigation className="w-4 h-4" /> Route
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {typeFilters.map(f => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${typeFilter === f.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <f.icon className="w-3.5 h-3.5" />{f.label}
            </button>
          ))}
          <span className="w-px bg-slate-200 my-1" />
          {dateFilters.map(f => (
            <button key={f.value} onClick={() => setDateFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${dateFilter === f.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
          {drivers.length > 0 && (
            <>
              <span className="w-px bg-slate-200 my-1" />
              <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border-0 focus:outline-none focus:ring-2 focus:ring-emerald-100">
                <option value="all">All Drivers</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Route optimiser — shows when a specific driver is selected */}
      {driverFilter !== 'all' && (() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const driverTodays = deliveries.filter(d =>
          d.driver_staff_id === driverFilter &&
          d.scheduled_date === todayStr &&
          (d.status === 'pending' || d.status === 'in_progress')
        );
        if (driverTodays.length < 2) return null;
        return (
          <RouteOptimizeBar driverStaffId={driverFilter} date={todayStr} count={driverTodays.length} />
        );
      })()}

      {/* Overdue & at-risk alert strip */}
      {(() => {
        const overdue = filtered.filter(d => d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') < new Date());
        const atRisk = filtered.filter(d => d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') >= new Date() && new Date(d.scheduled_date) < new Date(Date.now() + 24 * 60 * 60 * 1000));
        if (overdue.length === 0 && atRisk.length === 0) return null;
        return (
          <div className={`rounded-xl border px-4 py-2.5 flex items-center gap-3 ${overdue.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${overdue.length > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
            <p className="text-sm text-slate-700">
              {overdue.length > 0 && <span className="font-semibold text-rose-700">{overdue.length} overdue</span>}
              {overdue.length > 0 && atRisk.length > 0 && <span className="text-slate-400"> · </span>}
              {atRisk.length > 0 && <span className="font-semibold text-amber-700">{atRisk.length} at risk (next 24h)</span>}
            </p>
          </div>
        );
      })()}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={Truck} title="No deliveries found" message="Try adjusting your filters, or create delivery tasks from within a job." />
        </div>
      ) : view === 'board' ? (
        <DeliveryBoard deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      ) : view === 'route' ? (
        <DriverRunBoard deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      ) : (
        <DeliveryTable deliveries={filtered} jobs={jobs} drivers={staff} onSelectDelivery={setSelected} />
      )}
      </>
      )}

      {/* Detail drawer — integrated day planner + chain view */}
      {selected && (
        <DeliveryDetailDrawer delivery={selected} jobs={jobs} staff={staff} onClose={() => setSelected(null)} />
      )}

      {/* Sample run drawer — pre-loaded from the Geotech tab */}
      {sampleRunPrefill && (
        <SampleRunDrawer prefill={sampleRunPrefill} onClose={() => setSampleRunPrefill(null)} />
      )}
    </HubShell>
  );
}