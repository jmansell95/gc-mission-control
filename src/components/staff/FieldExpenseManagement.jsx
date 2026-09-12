import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { format, startOfWeek } from 'date-fns';
import {
  Receipt, Fuel, Coffee, Package, Wrench, Car, PoundSterling, Loader2,
  CheckCircle2, X, ChevronRight, AlertCircle, Users, TrendingUp, Clock,
} from 'lucide-react';
import ConcurReminderBanner from './ConcurReminderBanner';

const CATEGORY_META = {
  fuel: { label: 'Fuel', icon: Fuel, bg: 'bg-amber-50', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' },
  subsistence: { label: 'Subsistence', icon: Coffee, bg: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
  materials: { label: 'Materials', icon: Package, bg: 'bg-blue-50', text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700' },
  equipment_hire: { label: 'Equipment Hire', icon: Wrench, bg: 'bg-violet-50', text: 'text-violet-700', chip: 'bg-violet-100 text-violet-700' },
  tolls_parking: { label: 'Tolls & Parking', icon: Car, bg: 'bg-rose-50', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-700' },
  travel: { label: 'Travel', icon: Car, bg: 'bg-cyan-50', text: 'text-cyan-700', chip: 'bg-cyan-100 text-cyan-700' },
  misc: { label: 'Other', icon: Receipt, bg: 'bg-slate-50', text: 'text-slate-700', chip: 'bg-slate-100 text-slate-700' },
};

const fmtMoney = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * FieldExpenseManagement — office-side management view of all field staff
 * expenses and receipts. Shows a portfolio summary, staff-by-staff breakdown,
 * and a drill-down drawer with approve/reject actions. Reminds managers that
 * the weekly SAP Concur submission is still required.
 */
export default function FieldExpenseManagement() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  const isAdmin = user?.role === 'admin' || user?.role === 'director';

  const { data: allCosts = [], isLoading } = useQuery({
    queryKey: ['field-expense-costs', weekStart],
    queryFn: () => base44.entities.DailyCost.list('-created_date', 500),
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff-for-expenses'],
    queryFn: () => base44.entities.Staff.list('-created_date', 500),
  });

  const { data: allTimesheets = [] } = useQuery({
    queryKey: ['timesheets-for-expenses', weekStart],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 500),
  });

  // Filter to current week + division
  const weekCosts = useMemo(() => {
    let result = allCosts.filter(c => c.week_start === weekStart);
    if (!isAdmin && activeDivision?.id) {
      const divisionStaffIds = new Set(allStaff.filter(s => s.division_id === activeDivision.id).map(s => s.id));
      result = result.filter(c => divisionStaffIds.has(c.staff_id));
    }
    return result;
  }, [allCosts, weekStart, isAdmin, activeDivision, allStaff]);

  // Group by staff
  const staffSummary = useMemo(() => {
    const map = {};
    weekCosts.forEach(c => {
      if (!map[c.staff_id]) {
        map[c.staff_id] = {
          staff_id: c.staff_id,
          staff_name: c.staff_name || allStaff.find(s => s.id === c.staff_id)?.name || 'Unknown',
          costs: [],
          total: 0,
          pendingCount: 0,
          receiptCount: 0,
        };
      }
      map[c.staff_id].costs.push(c);
      map[c.staff_id].total += Number(c.amount_gross) || 0;
      if (c.status === 'submitted') map[c.staff_id].pendingCount++;
      if (c.receipt_url) map[c.staff_id].receiptCount++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [weekCosts, allStaff]);

  // Portfolio totals
  const portfolio = useMemo(() => {
    const total = weekCosts.reduce((s, c) => s + (Number(c.amount_gross) || 0), 0);
    const pending = weekCosts.filter(c => c.status === 'submitted').length;
    const approved = weekCosts.filter(c => c.status === 'approved').length;
    const byCategory = {};
    weekCosts.forEach(c => {
      byCategory[c.category] = (byCategory[c.category] || 0) + (Number(c.amount_gross) || 0);
    });
    const staffWithPending = staffSummary.filter(s => s.pendingCount > 0).length;
    return { total, pending, approved, byCategory, staffWithPending };
  }, [weekCosts, staffSummary]);

  // Timesheet status per staff for the week
  const getTimesheetStatus = (staffId) => {
    const ts = allTimesheets.filter(t => t.staff_id === staffId && t.week_start === weekStart && t.is_summary);
    if (ts.some(t => t.status === 'approved')) return { label: 'Approved', color: 'text-emerald-600 bg-emerald-50' };
    if (ts.some(t => t.status === 'submitted')) return { label: 'Submitted', color: 'text-amber-600 bg-amber-50' };
    if (ts.length > 0) return { label: 'Draft', color: 'text-slate-500 bg-slate-50' };
    return { label: 'None', color: 'text-slate-400 bg-slate-50' };
  };

  const handleApprove = async (costId) => {
    try {
      await base44.entities.DailyCost.update(costId, {
        status: 'approved',
        approved_by_id: user?.id || '',
        approved_by_name: user?.full_name || 'Manager',
        approved_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['field-expense-costs'] });
    } catch (e) {
      console.error('Approve failed:', e);
    }
  };

  const handleReject = async (costId) => {
    try {
      await base44.entities.DailyCost.update(costId, {
        status: 'rejected',
        rejected_reason: 'Rejected by manager',
        approved_by_id: user?.id || '',
        approved_by_name: user?.full_name || 'Manager',
        approved_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['field-expense-costs'] });
    } catch (e) {
      console.error('Reject failed:', e);
    }
  };

  const selectedStaff = staffSummary.find(s => s.staff_id === selectedStaffId);

  const weekOptions = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      weeks.push(format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    }
    return weeks;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConcurReminderBanner />

      {/* Week selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {weekOptions.map(ws => (
          <button key={ws} onClick={() => setWeekStart(ws)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${ws === weekStart ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {format(new Date(ws + 'T00:00:00'), 'dd MMM')}
          </button>
        ))}
      </div>

      {/* Portfolio summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-primary" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total This Week</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{fmtMoney(portfolio.total)}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pending Approval</p>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{portfolio.pending}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Approved</p>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{portfolio.approved}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Staff with Receipts</p>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 tabular-nums">{staffSummary.length}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(portfolio.byCategory).length > 0 && (
        <div className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" /> By Category
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(portfolio.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
              const meta = CATEGORY_META[cat] || CATEGORY_META.misc;
              const Icon = meta.icon;
              return (
                <div key={cat} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${meta.bg}`}>
                  <Icon className={`w-4 h-4 ${meta.text}`} />
                  <span className="text-xs font-bold text-slate-700">{meta.label}</span>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">{fmtMoney(amt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Staff breakdown table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Staff Breakdown</h3>
        </div>
        {staffSummary.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">No expenses logged this week</p>
            <p className="text-xs text-slate-400 mt-1">Receipts captured by field staff will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {staffSummary.map(s => {
              const tsStatus = getTimesheetStatus(s.staff_id);
              return (
                <button key={s.staff_id} onClick={() => setSelectedStaffId(s.staff_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(s.staff_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{s.staff_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{s.costs.length} item{s.costs.length !== 1 ? 's' : ''}</span>
                      {s.receiptCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                          <Receipt className="w-3 h-3" /> {s.receiptCount}
                        </span>
                      )}
                      {s.pendingCount > 0 && (
                        <span className="text-xs text-amber-600 font-semibold">{s.pendingCount} pending</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtMoney(s.total)}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tsStatus.color}`}>{tsStatus.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff drill-down drawer */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedStaffId(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            onClick={e => e.stopPropagation()}
            className="relative bg-white w-full sm:max-w-md h-full overflow-y-auto animate-drawer-slide-in shadow-2xl"
          >
            {/* Drawer header */}
            <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center text-sm font-bold">
                    {(selectedStaff.staff_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">{selectedStaff.staff_name}</h2>
                    <p className="text-white/70 text-xs">{fmtMoney(selectedStaff.total)} · {selectedStaff.costs.length} item{selectedStaff.costs.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStaffId(null)} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {selectedStaff.costs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(c => {
                const meta = CATEGORY_META[c.category] || CATEGORY_META.misc;
                const Icon = meta.icon;
                return (
                  <div key={c.id} className={`rounded-2xl border border-slate-200 overflow-hidden ${c.status === 'approved' ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-3 p-3">
                      {/* Receipt thumbnail */}
                      {c.receipt_url ? (
                        <img src={c.receipt_url} alt="Receipt" className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>
                          {c.status === 'approved' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                            </span>
                          )}
                          {c.status === 'rejected' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Rejected</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{c.description}</p>
                        <p className="text-xs text-slate-400">{format(new Date(c.date + 'T00:00:00'), 'EEE dd MMM')}{c.supplier_name ? ` · ${c.supplier_name}` : ''}</p>
                        <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{fmtMoney(c.amount_gross)}</p>
                      </div>
                    </div>
                    {c.status === 'submitted' && (
                      <div className="flex gap-2 px-3 pb-3">
                        <button onClick={() => handleApprove(c.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 active:scale-95 transition">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleReject(c.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 active:scale-95 transition">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}