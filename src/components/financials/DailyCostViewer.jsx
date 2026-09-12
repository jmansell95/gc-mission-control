import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Loader2, CheckCircle2, X, ShieldCheck, Clock,
  ChevronDown, ChevronRight, PoundSterling, Calendar, Camera,
  Check, Filter,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  fuel: { label: 'Fuel', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  subsistence: { label: 'Subsistence', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  materials: { label: 'Materials', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  equipment_hire: { label: 'Equipment Hire', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  misc: { label: 'Misc', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  tolls_parking: { label: 'Tolls & Parking', color: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  travel: { label: 'Travel', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
};

const STATUS_META = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-500', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: X },
  synced_to_concur: { label: 'Synced', color: 'bg-purple-100 text-purple-700', icon: ShieldCheck },
};

export default function DailyCostViewer({ job }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [expandedDate, setExpandedDate] = useState(null);

  const { data: costs = [], isLoading } = useQuery({
    queryKey: ['daily-costs', job.id],
    queryFn: () => base44.entities.DailyCost.filter({ job_id: job.id }, '-date', 200),
  });
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const canApprove = profile?.staff?.system_role === 'admin' || profile?.staff?.system_role === 'management' || profile?.staff?.system_role === 'super_admin';

  const handleApprove = async (costId) => {
    try {
      await base44.entities.DailyCost.update(costId, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_id: profile?.staff?.id || profile?.id || '',
        approved_by_name: profile?.staff?.name || profile?.full_name || '',
      });
      queryClient.invalidateQueries({ queryKey: ['daily-costs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
    } catch (e) { console.error(e); }
  };

  const handleReject = async (costId) => {
    try {
      await base44.entities.DailyCost.update(costId, { status: 'rejected' });
      queryClient.invalidateQueries({ queryKey: ['daily-costs', job.id] });
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return costs;
    return costs.filter(c => c.status === filter);
  }, [costs, filter]);

  // Group by date
  const byDate = useMemo(() => {
    const map = {};
    filtered.forEach(c => {
      const d = c.date || 'No date';
      if (!map[d]) map[d] = [];
      map[d].push(c);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totals = useMemo(() => {
    return costs.reduce((acc, c) => {
      acc.total += Number(c.amount_gross) || 0;
      if (c.status === 'submitted') acc.pending += Number(c.amount_gross) || 0;
      if (c.status === 'approved') acc.approved += Number(c.amount_gross) || 0;
      if (c.status === 'synced_to_concur') acc.synced += Number(c.amount_gross) || 0;
      return acc;
    }, { total: 0, pending: 0, approved: 0, synced: 0 });
  }, [costs]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
          <Receipt className="w-4 h-4 text-cyan-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Crew Expenses</h3>
          <p className="text-[11px] text-slate-400">Logged from the End-of-Shift wizard · manager approval & Concur sync</p>
        </div>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{costs.length} {costs.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {/* Summary */}
      {costs.length > 0 && (
        <div className="grid grid-cols-4 gap-px bg-slate-100 border-b border-slate-100">
          <div className="bg-white px-2 py-2 text-center">
            <p className="text-[10px] text-slate-400 uppercase font-medium">Total</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(totals.total)}</p>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <p className="text-[10px] text-blue-600 uppercase font-medium">Pending</p>
            <p className="text-sm font-bold text-blue-700 tabular-nums">{fmt(totals.pending)}</p>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <p className="text-[10px] text-emerald-600 uppercase font-medium">Approved</p>
            <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(totals.approved)}</p>
          </div>
          <div className="bg-white px-2 py-2 text-center">
            <p className="text-[10px] text-purple-600 uppercase font-medium">Synced</p>
            <p className="text-sm font-bold text-purple-700 tabular-nums">{fmt(totals.synced)}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {costs.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-50 bg-slate-50/50 overflow-x-auto no-scrollbar">
          <Filter className="w-3 h-3 text-slate-400 flex-shrink-0" />
          {[
            { val: 'all', label: 'All' },
            { val: 'submitted', label: 'Pending' },
            { val: 'approved', label: 'Approved' },
            { val: 'synced_to_concur', label: 'Synced' },
            { val: 'rejected', label: 'Rejected' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap ${filter === f.val ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/30'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : costs.length === 0 ? (
        <div className="text-center py-8 px-4">
          <Receipt className="w-7 h-7 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No crew expenses logged yet</p>
          <p className="text-xs text-slate-400 mt-1">Crew log costs via the End-of-Shift wizard on their phone.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {byDate.map(([date, items]) => {
            const dayTotal = items.reduce((s, c) => s + (Number(c.amount_gross) || 0), 0);
            const isExpanded = expandedDate === date || byDate.length === 1;
            return (
              <div key={date}>
                <button onClick={() => setExpandedDate(isExpanded ? null : date)} className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50/50 transition text-left">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">{date}</span>
                  <span className="text-[10px] text-slate-400">· {items.length} {items.length === 1 ? 'item' : 'items'}</span>
                  <span className="ml-auto text-xs font-bold text-slate-800 tabular-nums">{fmt(dayTotal)}</span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-2 space-y-1.5">
                    {items.map(c => {
                      const cat = CATEGORY_META[c.category] || CATEGORY_META.misc;
                      const st = STATUS_META[c.status] || STATUS_META.submitted;
                      const StIcon = st.icon;
                      return (
                        <div key={c.id} className="flex items-start gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                          <span className={`w-2 h-2 rounded-full ${cat.dot} flex-shrink-0 mt-1.5`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cat.color}`}>{cat.label}</span>
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${st.color}`}>
                                <StIcon className="w-2.5 h-2.5" />{st.label}
                              </span>
                              {c.gl_code && <span className="text-[9px] text-slate-400">GL: {c.gl_code}</span>}
                            </div>
                            <p className="text-xs text-slate-700 mt-0.5">{c.description || cat.label}</p>
                            <p className="text-[10px] text-slate-400">
                              {c.staff_name || 'Unknown crew'}
                              {c.supplier_name && ` · ${c.supplier_name}`}
                              {c.po_number && ` · PO: ${c.po_number}`}
                              {c.vat_rate > 0 && ` · VAT ${c.vat_rate}%`}
                            </p>
                            {c.receipt_url && (
                              <a href={c.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline mt-0.5">
                                <Camera className="w-2.5 h-2.5" /> Receipt
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(c.amount_gross)}</p>
                            <p className="text-[9px] text-slate-400 tabular-nums">net {fmt(c.amount_net)}</p>
                          </div>
                          {canApprove && c.status === 'submitted' && (
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button onClick={() => handleApprove(c.id)} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-medium hover:bg-emerald-100 transition flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" /> Approve
                              </button>
                              <button onClick={() => handleReject(c.id)} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-medium hover:bg-red-100 transition flex items-center gap-0.5">
                                <X className="w-2.5 h-2.5" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}