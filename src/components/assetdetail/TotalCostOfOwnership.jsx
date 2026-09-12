import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Wrench, TrendingDown, PoundSterling, Activity, Loader2, Calendar,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

/**
 * Total Cost of Ownership — combines maintenance, service, depreciation,
 * and fuel/running costs into a single TCO figure with a trend chart.
 */
export default function TotalCostOfOwnership({ asset }) {
  const { data: serviceRecords = [], isLoading: serviceLoading } = useQuery({
    queryKey: ['asset-tco-service', asset?.id],
    queryFn: () => asset?.id ? base44.entities.ServiceRecord.filter({ asset_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['asset-tco-bookings', asset?.id],
    queryFn: () => asset?.id ? base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ['asset-tco-cost-items', asset?.id],
    queryFn: () => asset?.id ? base44.entities.JobCostItem.filter({ asset_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const isLoading = serviceLoading || bookingsLoading;

  const tco = useMemo(() => {
    const maintenanceCost = bookings
      .filter(b => b.status === 'completed')
      .reduce((s, b) => s + (Number(b.cost) || 0), 0);

    const serviceCost = serviceRecords
      .reduce((s, r) => s + (Number(r.cost) || 0), 0);

    const depreciation = Number(asset?.accumulated_depreciation) || 0;

    // Fuel/running costs: sum of cost items categorised as fuel/running
    const runningCost = costItems
      .filter(c => {
        const cat = (c.category || c.description || '').toLowerCase();
        return cat.includes('fuel') || cat.includes('diesel') || cat.includes('running');
      })
      .reduce((s, c) => s + (Number(c.total_cost) || Number(c.quantity) * Number(c.unit_price) || 0), 0);

    const total = maintenanceCost + serviceCost + depreciation + runningCost;

    // Build a cumulative trend chart by year (from acquisition date)
    const acqDate = asset?.acquisition_date ? new Date(asset.acquisition_date) : new Date();
    const now = new Date();
    const years = [];
    for (let y = acqDate.getFullYear(); y <= now.getFullYear(); y++) {
      years.push(y);
    }

    // Distribute costs by year (approximate: depreciation by year, others by record date)
    const depPerYear = asset?.depreciation_years && asset?.acquisition_cost
      ? (asset.acquisition_cost - (asset.salvage_value || 0)) / asset.depreciation_years
      : 0;

    const chartData = years.map(year => {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59);
      const mCost = bookings.filter(b => b.status === 'completed' && b.booking_date && new Date(b.booking_date) >= yearStart && new Date(b.booking_date) <= yearEnd)
        .reduce((s, b) => s + (Number(b.cost) || 0), 0);
      const sCost = serviceRecords.filter(r => r.service_date && new Date(r.service_date) >= yearStart && new Date(r.service_date) <= yearEnd)
        .reduce((s, r) => s + (Number(r.cost) || 0), 0);
      const dep = year <= now.getFullYear() ? depPerYear : 0;
      return {
        year: String(year),
        maintenance: Math.round(mCost),
        service: Math.round(sCost),
        depreciation: Math.round(dep),
      };
    });

    return { maintenanceCost, serviceCost, depreciation, runningCost, total, chartData };
  }, [bookings, serviceRecords, costItems, asset]);

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  const hasData = tco.total > 0 || tco.chartData.length > 0;

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-extrabold text-slate-900">Total Cost of Ownership</h3>
      </div>

      {/* TCO hero figure */}
      <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 mb-3 text-white">
        <p className="text-[10px] uppercase tracking-wide text-white/60 font-medium">Lifetime Cost to Date</p>
        <p className="text-2xl font-extrabold tabular-nums mt-0.5">{gbp(tco.total)}</p>
        {asset?.acquisition_date && (
          <p className="text-[10px] text-white/50 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Since {new Date(asset.acquisition_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Cost breakdown */}
      <div className="space-y-1.5 mb-3">
        <CostRow icon={Wrench} label="Maintenance & Repairs" value={tco.maintenanceCost} />
        <CostRow icon={Wrench} label="Servicing" value={tco.serviceCost} />
        <CostRow icon={TrendingDown} label="Depreciation" value={tco.depreciation} />
        <CostRow icon={PoundSterling} label="Fuel / Running" value={tco.runningCost} />
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700">Total</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{gbp(tco.total)}</span>
        </div>
      </div>

      {/* Trend chart */}
      {hasData && tco.chartData.length > 1 ? (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Annual Cost Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={tco.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tcoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E5A1A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2E5A1A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => gbp(v)} />
              <Area type="monotone" dataKey="depreciation" stackId="1" stroke="#2E5A1A" fill="#2E5A1A" fillOpacity={0.3} />
              <Area type="monotone" dataKey="maintenance" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
              <Area type="monotone" dataKey="service" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">Not enough history for a trend chart yet.</p>
      )}
    </div>
  );
}

function CostRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-600 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" /> {label}
      </span>
      <span className="text-xs font-semibold tabular-nums text-slate-800">{gbp(value)}</span>
    </div>
  );
}