import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, PoundSterling, Wrench, Calendar, Loader2, Activity } from 'lucide-react';

/**
 * AssetFinancialLifecycle — shows the full financial ROI of a single
 * asset: total revenue earned (meterage/day-rate billing) vs total cost
 * (maintenance, repairs, depreciation). Gives a real-time profitability
 * view for every rig in the fleet.
 *
 * Embedded in the AssetPassportDrawer as a new "Financial Lifecycle" tab.
 */
export default function AssetFinancialLifecycle({ assetId }) {
  const { data: asset, isLoading: assetLoading } = useQuery({
    queryKey: ['asset-fin-lifecycle', assetId],
    queryFn: () => assetId ? base44.entities.SiteAsset.get(assetId) : null,
    enabled: !!assetId,
  });

  const { data: costItems = [], isLoading: costsLoading } = useQuery({
    queryKey: ['asset-fin-cost-items', assetId],
    queryFn: () => assetId ? base44.entities.JobCostItem.filter({ asset_id: assetId }) : [],
    enabled: !!assetId,
  });

  const { data: serviceRecords = [], isLoading: serviceLoading } = useQuery({
    queryKey: ['asset-fin-service', assetId],
    queryFn: () => assetId ? base44.entities.ServiceRecord.filter({ asset_id: assetId }) : [],
    enabled: !!assetId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['asset-fin-bookings', assetId],
    queryFn: () => assetId ? base44.entities.VehicleMaintenanceBooking.filter({ vehicle_id: assetId }) : [],
    enabled: !!assetId,
  });

  const financials = useMemo(() => {
    // Revenue: sum of cost items where this asset was the billable item
    const totalRevenue = costItems
      .filter(c => c.status === 'approved' || c.status === 'invoiced')
      .reduce((s, c) => s + (Number(c.total_cost) || Number(c.quantity) * Number(c.unit_price) || 0), 0);

    // Costs: maintenance bookings + service records + depreciation
    const maintenanceCost = bookings
      .filter(b => b.status === 'completed')
      .reduce((s, b) => s + (Number(b.cost) || 0), 0);

    const serviceCost = serviceRecords
      .reduce((s, r) => s + (Number(r.cost) || 0), 0);

    // Depreciation: straight-line from acquisition
    const acquisitionCost = Number(asset?.acquisition_cost) || 0;
    const depreciationYears = Number(asset?.depreciation_years) || 0;
    const acquisitionDate = asset?.acquisition_date ? new Date(asset.acquisition_date) : null;
    let depreciationToDate = 0;
    if (acquisitionDate && depreciationYears > 0 && acquisitionCost > 0) {
      const yearsElapsed = (Date.now() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      depreciationToDate = Math.min(acquisitionCost * (yearsElapsed / depreciationYears), acquisitionCost - (Number(asset?.salvage_value) || 0));
    }

    const totalCost = maintenanceCost + serviceCost + depreciationToDate;
    const netProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;
    const bookValue = (acquisitionCost - depreciationToDate) - (Number(asset?.salvage_value) || 0);

    return {
      totalRevenue, maintenanceCost, serviceCost, depreciationToDate, totalCost,
      netProfit, roi, bookValue: Math.max(bookValue, 0),
      revenueCount: costItems.length,
      serviceCount: serviceRecords.length,
    };
  }, [costItems, serviceRecords, bookings, asset]);

  const isLoading = assetLoading || costsLoading || serviceLoading;
  const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  const isProfitable = financials.netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* ROI Hero Card */}
      <div className={`hub-glass rounded-2xl p-4 ${isProfitable ? 'border-emerald-200' : 'border-rose-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isProfitable ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'}`}>
            {isProfitable ? <TrendingUp className="w-6 h-6 text-white" /> : <TrendingDown className="w-6 h-6 text-white" />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Return on Investment</p>
            <p className={`text-2xl font-bold tabular-nums ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>{financials.roi}%</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50">
            <p className="text-[11px] font-semibold text-emerald-600">Total Revenue</p>
            <p className="text-lg font-bold tabular-nums text-emerald-900">{gbp(financials.totalRevenue)}</p>
            <p className="text-[10px] text-emerald-500">{financials.revenueCount} billing records</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50">
            <p className="text-[11px] font-semibold text-rose-600">Total Cost</p>
            <p className="text-lg font-bold tabular-nums text-rose-900">{gbp(financials.totalCost)}</p>
            <p className="text-[10px] text-rose-500">{financials.serviceCount} service records</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Net Profit</span>
          <span className={`text-lg font-bold tabular-nums ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>{gbp(financials.netProfit)}</span>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="hub-glass rounded-2xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-500" /> Cost Breakdown
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="text-xs text-slate-600">Maintenance & Repairs</span>
            <span className="text-xs font-semibold tabular-nums text-slate-800">{gbp(financials.maintenanceCost)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="text-xs text-slate-600">Servicing</span>
            <span className="text-xs font-semibold tabular-nums text-slate-800">{gbp(financials.serviceCost)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
            <span className="text-xs text-slate-600">Depreciation to Date</span>
            <span className="text-xs font-semibold tabular-nums text-slate-800">{gbp(financials.depreciationToDate)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-bold text-slate-700">Current Book Value</span>
            <span className="text-sm font-bold tabular-nums text-slate-900">{gbp(financials.bookValue)}</span>
          </div>
        </div>
      </div>

      {/* Utilization indicator */}
      <div className="hub-glass rounded-2xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" /> Asset Utilisation
        </h4>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">Operating Hours</span>
              <span className="font-bold tabular-nums text-slate-800">{Number(asset?.operating_hours || 0).toFixed(0)}h</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                style={{ width: `${Math.min((Number(asset?.operating_hours || 0) / (Number(asset?.service_interval_hours) || 250)) * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{Number(asset?.hours_since_last_service || 0).toFixed(0)}h since last service</p>
          </div>
        </div>
      </div>
    </div>
  );
}