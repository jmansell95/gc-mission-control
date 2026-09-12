import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, PoundSterling, Clock, Loader2, Activity,
} from 'lucide-react';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';

/**
 * Cost-per-Hour Profitability — revenue earned vs cost per operating hour,
 * break-even utilization threshold, and profitability verdict at current rates.
 */
export default function CostPerHourProfitability({ asset }) {
  const { data: costItems = [], isLoading: costsLoading } = useQuery({
    queryKey: ['asset-cph-cost-items', asset?.id],
    queryFn: () => asset?.id ? base44.entities.JobCostItem.filter({ asset_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['asset-cph-bookings', asset?.id],
    queryFn: () => asset?.id ? base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ['asset-cph-service', asset?.id],
    queryFn: () => asset?.id ? base44.entities.ServiceRecord.filter({ asset_id: asset.id }) : [],
    enabled: !!asset?.id,
  });

  const isLoading = costsLoading;

  const analysis = useMemo(() => {
    // Revenue: sum of approved/invoiced cost items for this asset
    const totalRevenue = costItems
      .filter(c => c.status === 'approved' || c.status === 'invoiced')
      .reduce((s, c) => s + (Number(c.total_cost) || Number(c.quantity) * Number(c.unit_price) || 0), 0);

    // Costs: maintenance + service + annual depreciation
    const maintenanceCost = bookings
      .filter(b => b.status === 'completed')
      .reduce((s, b) => s + (Number(b.cost) || 0), 0);
    const serviceCost = serviceRecords
      .reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const depreciation = Number(asset?.accumulated_depreciation) || 0;

    const totalCost = maintenanceCost + serviceCost + depreciation;

    const operatingHours = Number(asset?.operating_hours) || 0;
    const hoursUsed = Number(asset?.hours_used) || operatingHours;

    // Cost per hour = total cost / operating hours
    const costPerHour = operatingHours > 0 ? totalCost / operatingHours : 0;
    // Revenue per hour = total revenue / operating hours
    const revenuePerHour = operatingHours > 0 ? totalRevenue / operatingHours : 0;
    // Net per hour
    const netPerHour = revenuePerHour - costPerHour;
    // Break-even hours = total annual cost / revenue per hour (how many hours to cover costs)
    const annualCost = (Number(asset?.annual_depreciation) || 0) + maintenanceCost + serviceCost;
    const breakEvenHours = revenuePerHour > 0 ? Math.ceil(annualCost / revenuePerHour) : 0;

    const isProfitable = netPerHour >= 0;
    const profitabilityPct = costPerHour > 0 ? Math.round((netPerHour / costPerHour) * 100) : (revenuePerHour > 0 ? 100 : 0);

    return {
      totalRevenue, totalCost, costPerHour, revenuePerHour, netPerHour,
      operatingHours, breakEvenHours, annualCost, isProfitable, profitabilityPct,
    };
  }, [costItems, bookings, serviceRecords, asset]);

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  const hasHours = analysis.operatingHours > 0;
  const hasRevenue = analysis.totalRevenue > 0;

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-extrabold text-slate-900">Cost-per-Hour Profitability</h3>
      </div>

      {/* Verdict banner */}
      <div className={`rounded-xl p-3 mb-3 ${analysis.isProfitable ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${analysis.isProfitable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {analysis.isProfitable ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {analysis.isProfitable ? 'Profitable' : 'Running at a loss'}
            </p>
            <p className="text-[11px] text-slate-600">
              {hasHours && hasRevenue
                ? `${analysis.profitabilityPct > 0 ? '+' : ''}${analysis.profitabilityPct}% margin at ${analysis.operatingHours}h usage`
                : 'Needs usage + billing data to assess'}
            </p>
          </div>
        </div>
      </div>

      {/* Per-hour metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <PerHourTile icon={PoundSterling} label="Revenue/hr" value={gbp(analysis.revenuePerHour)} tone="text-emerald-700" />
        <PerHourTile icon={Clock} label="Cost/hr" value={gbp(analysis.costPerHour)} tone="text-rose-600" />
        <PerHourTile icon={Activity} label="Net/hr" value={gbp(analysis.netPerHour)} tone={analysis.isProfitable ? 'text-emerald-700' : 'text-rose-600'} />
      </div>

      {/* Break-even */}
      {hasRevenue && analysis.breakEvenHours > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600">Break-even Utilisation</span>
            <span className="text-xs font-bold text-slate-800">{analysis.breakEvenHours}h / year</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${analysis.operatingHours >= analysis.breakEvenHours ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min((analysis.operatingHours / analysis.breakEvenHours) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {analysis.operatingHours >= analysis.breakEvenHours
              ? `✓ Exceeding break-even by ${Math.round(analysis.operatingHours - analysis.breakEvenHours)}h`
              : `${Math.round(analysis.breakEvenHours - analysis.operatingHours)}h short of break-even`}
          </p>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-xl bg-emerald-50 p-2.5">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase">Total Revenue</p>
          <p className="text-sm font-bold tabular-nums text-emerald-900">{gbp(analysis.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-2.5">
          <p className="text-[10px] font-semibold text-rose-600 uppercase">Total Cost</p>
          <p className="text-sm font-bold tabular-nums text-rose-900">{gbp(analysis.totalCost)}</p>
        </div>
      </div>
    </div>
  );
}

function PerHourTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-100 p-2.5 text-center">
      <Icon className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
      <p className="text-[9px] text-slate-500 uppercase font-medium">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}