import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Clock, Truck, AlertTriangle, Loader2, Search, Calendar, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * Hire Management tab — shows all active hired equipment on jobs with hire
 * period countdown, off-hire scheduling, and return-to-supplier run creation.
 */
export default function HireManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [offHiring, setOffHiring] = useState(null);

  const { data: hiredItems = [], isLoading } = useQuery({
    queryKey: ['hired-equipment-active'],
    queryFn: () => base44.entities.JobCostItem.filter({ category: 'hired_equipment', hire_status: 'active' }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['hire-mgmt-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['hire-mgmt-suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const enriched = useMemo(() => {
    return hiredItems.map(item => {
      const job = jobs.find(j => j.id === item.job_id);
      const supplier = suppliers.find(s => s.id === item.supplier_id);
      const today = new Date();
      const endDate = item.end_date ? new Date(item.end_date + 'T00:00:00') : null;
      const daysRemaining = endDate ? differenceInDays(endDate, today) : null;
      const isOverdue = endDate && isPast(endDate);
      return {
        ...item,
        job_name: job?.name || 'Unknown job',
        job_reference: job?.job_reference || '',
        supplier_name: supplier?.name || item.supplier_name || 'Unknown supplier',
        days_remaining: daysRemaining,
        is_overdue: isOverdue,
        total_cost: (Number(item.unit_cost) || 0) * (Number(item.quantity) || 1),
      };
    });
  }, [hiredItems, jobs, suppliers]);

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

  const handleOffHire = async (item) => {
    setOffHiring(item.id);
    try {
      await base44.entities.JobCostItem.update(item.id, {
        hire_status: 'off_hired',
        off_hire_date: format(new Date(), 'yyyy-MM-dd'),
        current_location: 'returned',
        location_updated_at: new Date().toISOString(),
      });
      toast({ title: 'Off-hired', description: `${item.description} returned to ${item.supplier_name}` });
      queryClient.invalidateQueries({ queryKey: ['hired-equipment-active'] });
    } catch (e) {
      toast({ title: 'Could not off-hire', description: e.message, variant: 'destructive' });
    }
    setOffHiring(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  const overdueCount = enriched.filter(i => i.is_overdue).length;
  const expiringCount = enriched.filter(i => i.days_remaining !== null && i.days_remaining >= 0 && i.days_remaining <= 3).length;
  const totalHireCost = enriched.reduce((sum, i) => sum + i.total_cost, 0);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Package} label="Active Hires" value={enriched.length} gradient="stat-gradient-blue" />
        <KPICard icon={AlertTriangle} label="Overdue" value={overdueCount} gradient="stat-gradient-rose" />
        <KPICard icon={Clock} label="Expiring ≤3d" value={expiringCount} gradient="stat-gradient-amber" />
        <KPICard icon={Truck} label="Hire Cost/Day" value={fmt(totalHireCost)} gradient="stat-gradient-violet" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search hires, jobs, suppliers…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No active hires</p>
          <p className="text-xs text-slate-400 mt-1">Hired equipment will appear here once added to jobs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(item => (
            <div key={item.id} className="hub-glass rounded-2xl p-4 relative overflow-hidden">
              {/* Status stripe */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${item.is_overdue ? 'bg-rose-500' : item.days_remaining !== null && item.days_remaining <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{item.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.job_name}{item.job_reference ? ` (${item.job_reference})` : ''}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(item.total_cost)}</p>
                  <p className="text-[10px] text-slate-400">{item.quantity}× {item.unit_label} @ {fmt(item.unit_cost)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                  <Truck className="w-3 h-3" /> {item.supplier_name}
                </span>
                {item.po_number && (
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600">PO: {item.po_number}</span>
                )}
              </div>

              {/* Hire period bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {item.start_date ? format(new Date(item.start_date), 'dd MMM') : '—'}
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  {item.end_date ? format(new Date(item.end_date), 'dd MMM') : 'Open'}
                </div>
                {item.days_remaining !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.is_overdue ? 'bg-rose-100 text-rose-700' :
                    item.days_remaining <= 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.is_overdue ? `${Math.abs(item.days_remaining)}d overdue` : `${item.days_remaining}d left`}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOffHire(item)}
                  disabled={offHiring === item.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 disabled:opacity-50"
                >
                  {offHiring === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Off-Hire
                </button>
              </div>
            </div>
          ))}
        </div>
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