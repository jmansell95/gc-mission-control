import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Loader2, RefreshCw, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Holiday pay accrual manager — direct employees only.
// Shows a team summary dashboard band above a sortable per-person list.

const COLUMNS = [
  { key: 'staff_name', label: 'Name', align: 'left' },
  { key: 'total_entitlement_days', label: 'Entitlement', align: 'right' },
  { key: 'days_taken', label: 'Taken', align: 'right' },
  { key: 'days_accrued_to_date', label: 'Accrued', align: 'right' },
  { key: 'days_remaining', label: 'Remaining', align: 'right' },
];

const fmt1 = (n) => (Number(n) || 0).toFixed(1);

export default function HolidayAccrualManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [calculating, setCalculating] = useState(false);
  const [sortKey, setSortKey] = useState('days_remaining');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const { data: accruals = [], isLoading } = useQuery({
    queryKey: ['holiday-accruals'],
    queryFn: () => base44.entities.HolidayPayAccrual.list('-days_remaining'),
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  // Only direct employees appear in this tab.
  const directStaffIds = useMemo(
    () => new Set(allStaff.filter(s => s.worker_type === 'direct_employee').map(s => s.id)),
    [allStaff]
  );
  const rows = useMemo(() => accruals.filter(a => directStaffIds.has(a.staff_id)), [accruals, directStaffIds]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      let cmp;
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
      else cmp = (Number(av) || 0) - (Number(bv) || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t = rows.reduce((acc, a) => ({
      entitlement: acc.entitlement + (Number(a.total_entitlement_days) || 0),
      taken: acc.taken + (Number(a.days_taken) || 0),
      accrued: acc.accrued + (Number(a.days_accrued_to_date) || 0),
      remaining: acc.remaining + (Number(a.days_remaining) || 0),
    }), { entitlement: 0, taken: 0, accrued: 0, remaining: 0 });
    return { ...t, count: rows.length };
  }, [rows]);

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const res = await base44.functions.invoke('calculateHolidayAccruals', {});
      toast({
        title: '✓ Accruals recalculated',
        description: `Updated ${res?.data?.staff_count || 0} staff records.`,
      });
      queryClient.invalidateQueries({ queryKey: ['holiday-accruals'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'staff_name' ? 'asc' : 'desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />;
  };

  const summaryTiles = [
    { label: 'Entitlement', value: fmt1(totals.entitlement), sub: 'days', gradient: 'stat-gradient-blue' },
    { label: 'Taken', value: fmt1(totals.taken), sub: 'days', gradient: 'stat-gradient-amber' },
    { label: 'Remaining', value: fmt1(totals.remaining), sub: 'days', gradient: 'stat-gradient-emerald' },
    { label: 'Accrued', value: fmt1(totals.accrued), sub: 'days', gradient: 'stat-gradient-violet' },
  ];

  return (
    <div>
      <SettingsSectionHeader
        icon={Calendar}
        title="Absence Accrual"
        description="Track holiday entitlement, days taken, and accrued balances for direct employees."
        actions={
          <Button onClick={handleRecalculate} disabled={calculating} className="bg-primary hover:bg-primary/90 text-white">
            {calculating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Recalculate All
          </Button>
        }
      />

      {/* Summary dashboard band */}
      {!isLoading && rows.length > 0 && (
        <div className="hub-glass rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-slate-100">
            <div className="w-10 h-10 rounded-xl stat-gradient-brand flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{totals.count}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Direct staff</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            {summaryTiles.map(t => (
              <div key={t.label} className="relative rounded-xl p-3 overflow-hidden">
                <div className={`absolute inset-0 ${t.gradient} opacity-10`} />
                <div className="relative">
                  <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">{t.value}<span className="text-xs font-semibold text-slate-400 ml-1">{t.sub}</span></p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mt-1">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm font-medium text-slate-400">No accrual records yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Recalculate All" to generate accrual records for direct employees.</p>
        </div>
      ) : (
        <div className="hub-glass rounded-2xl overflow-hidden">
          {/* Sortable header row */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="md:col-span-4">
              <button onClick={() => toggleSort('staff_name')} className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-bold text-slate-500 hover:text-slate-700">
                Name <SortIcon col="staff_name" />
              </button>
            </div>
            {COLUMNS.slice(1).map(c => (
              <div key={c.key} className="md:col-span-2 text-right">
                <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-bold text-slate-500 hover:text-slate-700">
                  {c.label} <SortIcon col={c.key} />
                </button>
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {sorted.map((a) => {
              const pct = a.total_entitlement_days > 0 ? (a.days_remaining / a.total_entitlement_days) * 100 : 0;
              const overdrawn = a.days_taken > a.days_accrued_to_date;
              return (
                <div key={a.id} className="px-5 py-3.5 grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-2 items-center hover:bg-slate-50/40 transition">
                  <div className="md:col-span-4 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{a.staff_name || 'Unknown'}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {(a.holiday_year_start || '').slice(0, 7)} → {(a.holiday_year_end || '').slice(0, 7)}
                      {a.days_carried_over > 0 && <span className="ml-1.5 text-slate-500">· {fmt1(a.days_carried_over)} carried</span>}
                    </p>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <span className="md:hidden text-[10px] uppercase text-slate-400 font-semibold mr-1.5">Ent:</span>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{fmt1(a.total_entitlement_days)}</span>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <span className="md:hidden text-[10px] uppercase text-slate-400 font-semibold mr-1.5">Taken:</span>
                    <span className={`text-sm font-semibold tabular-nums ${overdrawn ? 'text-rose-600' : 'text-slate-700'}`}>{fmt1(a.days_taken)}</span>
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <span className="md:hidden text-[10px] uppercase text-slate-400 font-semibold mr-1.5">Accrued:</span>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{fmt1(a.days_accrued_to_date)}</span>
                  </div>
                  <div className="md:col-span-2 flex items-center md:justify-end gap-2">
                    <div className="flex-1 md:flex-none md:w-16">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${overdrawn ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt1(a.days_remaining)}</span>
                    {overdrawn && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                        <AlertCircle className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}