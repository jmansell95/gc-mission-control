import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, Truck, MapPin, FileText, Loader2, Search, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

const LOCATION_LABELS = {
  yard: { label: 'At Depot', color: 'bg-slate-100 text-slate-600' },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
  site: { label: 'On Site', color: 'bg-emerald-100 text-emerald-700' },
  returned: { label: 'Returned', color: 'bg-slate-100 text-slate-500' },
};

/**
 * Purchased-for-Job tab — shows items purchased specifically for jobs with
 * delivery tracking (ordered → collected → delivered → on site) and PO
 * three-way matching status.
 */
export default function PurchasedForJobTab() {
  const [search, setSearch] = useState('');

  const { data: purchasedItems = [], isLoading } = useQuery({
    queryKey: ['purchased-equipment'],
    queryFn: () => base44.entities.JobCostItem.filter({ category: 'purchased_equipment' }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['purchased-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['purchased-suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['purchased-pos'],
    queryFn: () => base44.entities.PurchaseOrder.list(),
  });

  const enriched = useMemo(() => {
    return purchasedItems.map(item => {
      const job = jobs.find(j => j.id === item.job_id);
      const supplier = suppliers.find(s => s.id === item.supplier_id);
      const po = pos.find(p => p.po_number === item.po_number);
      return {
        ...item,
        job_name: job?.name || 'Unknown job',
        job_reference: job?.job_reference || '',
        supplier_name: supplier?.name || item.supplier_name || 'Unknown supplier',
        po_status: po?.status || 'unknown',
        po_match_status: po?.match_status || 'unmatched',
        total_cost: (Number(item.unit_cost) || 0) * (Number(item.quantity) || 1),
      };
    });
  }, [purchasedItems, jobs, suppliers, pos]);

  const filtered = useMemo(() => {
    if (!search) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(i =>
      (i.description || '').toLowerCase().includes(q) ||
      (i.job_name || '').toLowerCase().includes(q) ||
      (i.supplier_name || '').toLowerCase().includes(q) ||
      (i.po_number || '').toLowerCase().includes(q)
    );
  }, [enriched, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  const inTransit = enriched.filter(i => i.current_location === 'in_transit').length;
  const onSite = enriched.filter(i => i.current_location === 'site').length;
  const atDepot = enriched.filter(i => i.current_location === 'yard').length;
  const totalValue = enriched.reduce((sum, i) => sum + i.total_cost, 0);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Package} label="Total Items" value={enriched.length} gradient="stat-gradient-blue" />
        <KPICard icon={Truck} label="In Transit" value={inTransit} gradient="stat-gradient-amber" />
        <KPICard icon={CheckCircle2} label="On Site" value={onSite} gradient="stat-gradient-emerald" />
        <KPICard icon={FileText} label="Total Value" value={fmt(totalValue)} gradient="stat-gradient-violet" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items, jobs, suppliers, POs…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No purchased items</p>
          <p className="text-xs text-slate-400 mt-1">Items purchased for jobs will appear here once added.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hub-glass rounded-2xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80">
                  <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Job</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Supplier</th>
                    <th className="text-left px-3 py-2.5 font-semibold">PO</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Location</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(item => {
                    const loc = LOCATION_LABELS[item.current_location] || LOCATION_LABELS.yard;
                    return (
                      <tr key={item.id} className="hover:bg-emerald-50/30 transition">
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{item.description}</td>
                        <td className="px-3 py-2.5 text-slate-600">{item.job_name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{item.supplier_name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{item.po_number || '—'}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${loc.color}`}>{loc.label}</span>
                        </td>
                        <td className="text-right px-3 py-2.5 font-semibold text-slate-700 tabular-nums">{fmt(item.total_cost)}</td>
                        <td className="text-center px-3 py-2.5">
                          {item.po_match_status === 'matched' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : item.po_match_status === 'discrepancy' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                          ) : (
                            <Clock className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map(item => {
              const loc = LOCATION_LABELS[item.current_location] || LOCATION_LABELS.yard;
              return (
                <div key={item.id} className="hub-glass rounded-2xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{item.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.job_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${loc.color} flex-shrink-0`}>{loc.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{item.supplier_name}</span>
                    <span className="font-semibold text-slate-700 tabular-nums">{fmt(item.total_cost)}</span>
                  </div>
                  {item.po_number && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                      <FileText className="w-3 h-3" /> PO: {item.po_number}
                      {item.po_match_status === 'matched' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      {item.po_match_status === 'discrepancy' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, gradient }) {
  return (
    <div className="hub-glass rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-[0.08]`} />
      <div className={`relative w-9 h-9 rounded-lg ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="relative text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}