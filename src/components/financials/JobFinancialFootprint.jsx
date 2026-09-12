import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, TrendingUp, TrendingDown, Scale, FileText, Truck, Mountain,
  Clock, ArrowRightLeft, AlertTriangle, Receipt, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * JobFinancialFootprint — consolidated project ledger that pulls every
 * financial touchpoint for a job into one view: investigation logs,
 * subcontractor costs, chargeable timesheets, chargeable deliveries and
 * raised invoices. Shows cost vs revenue vs margin with a timeline chart.
 */
export default function JobFinancialFootprint({ job }) {
  const { data: invLogs = [], isLoading: invLoading } = useQuery({
    queryKey: ['footprint-inv', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }, '-date', 500),
  });
  const { data: subconLogs = [], isLoading: subconLoading } = useQuery({
    queryKey: ['footprint-subcon', job.id],
    queryFn: () => base44.entities.SubcontractorLog.filter({ job_id: job.id }, '-date', 500),
  });
  const { data: timesheets = [], isLoading: tsLoading } = useQuery({
    queryKey: ['footprint-ts', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id, chargeable: true }, '-date', 500),
  });
  const { data: deliveries = [], isLoading: delLoading } = useQuery({
    queryKey: ['footprint-del', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id, chargeable: true }, '-date', 500),
  });
  const { data: invoices = [], isLoading: invRecLoading } = useQuery({
    queryKey: ['footprint-inv-rec', job.id],
    queryFn: () => base44.entities.Invoice.filter({ job_id: job.id }, '-issue_date', 200),
  });
  const { data: costItems = [], isLoading: costLoading } = useQuery({
    queryKey: ['footprint-cost', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }, '-created_date', 500),
  });

  const anyLoading = invLoading || subconLoading || tsLoading || delLoading || invRecLoading || costLoading;

  // Build unified ledger entries
  const ledger = useMemo(() => {
    const entries = [];

    invLogs.forEach((l) => {
      if (l.charge_amount || l.custom_fee) {
        entries.push({
          date: l.date, type: 'Investigation', desc: l.description || l.log_type || 'Site activity',
          ref: l.borehole_ref, cost: 0, revenue: l.charge_amount || l.custom_fee || 0,
          status: l.manager_review_status, source: 'inv',
        });
      }
    });
    subconLogs.forEach((l) => {
      entries.push({
        date: l.date, type: 'Subcontractor', desc: l.description || l.work_type || 'Subcon work',
        ref: l.subcontractor_name, cost: l.purchase_cost_net || 0, revenue: l.client_charge_net || 0,
        status: l.status, source: 'subcon',
      });
    });
    timesheets.forEach((t) => {
      entries.push({
        date: t.date, type: 'Timesheet', desc: t.task_description || 'Chargeable time',
        ref: '', cost: 0, revenue: t.charge_amount || 0,
        status: t.status, source: 'ts',
      });
    });
    deliveries.forEach((d) => {
      entries.push({
        date: d.scheduled_date, type: 'Delivery', desc: d.items || d.delivery_type || 'Delivery',
        ref: d.delivery_type, cost: 0, revenue: d.charge_amount || 0,
        status: d.status, source: 'del',
      });
    });
    costItems.forEach((c) => {
      entries.push({
        date: c.created_date?.slice(0, 10), type: 'Cost Item', desc: c.description || c.category || 'Cost item',
        ref: c.supplier_name, cost: c.unit_cost * (c.quantity || 1), revenue: 0,
        status: c.status, source: 'cost',
      });
    });

    return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [invLogs, subconLogs, timesheets, deliveries, costItems]);

  const totalCost = ledger.reduce((s, e) => s + (e.cost || 0), 0);
  const totalRevenue = ledger.reduce((s, e) => s + (e.revenue || 0), 0);
  const margin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : 0;

  const invoicedNet = invoices.reduce((s, i) => s + (i.net_total || 0), 0);
  const paidNet = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.net_total || 0), 0);
  const outstandingNet = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + (i.net_total || 0), 0);

  // Monthly timeline for chart
  const monthlyData = useMemo(() => {
    const months = {};
    ledger.forEach((e) => {
      if (!e.date) return;
      const m = e.date.slice(0, 7);
      if (!months[m]) months[m] = { month: m, cost: 0, revenue: 0 };
      months[m].cost += e.cost || 0;
      months[m].revenue += e.revenue || 0;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map((d) => ({
      ...d,
      label: format(new Date(d.month + '-01'), 'MMM yy'),
    }));
  }, [ledger]);

  const TYPE_ICON = {
    Investigation: Mountain, 'Subcontractor': ArrowRightLeft, Timesheet: Clock,
    Delivery: Truck, 'Cost Item': Receipt,
  };
  const TYPE_COLOR = {
    Investigation: 'text-blue-600 bg-blue-50', 'Subcontractor': 'text-orange-600 bg-orange-50',
    Timesheet: 'text-violet-600 bg-violet-50', Delivery: 'text-emerald-600 bg-emerald-50',
    'Cost Item': 'text-slate-600 bg-slate-50',
  };

  if (anyLoading) {
    return (
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile icon={TrendingUp} label="Total Revenue" value={fmt(totalRevenue)} tone="emerald" />
        <SummaryTile icon={TrendingDown} label="Total Cost" value={fmt(totalCost)} tone="rose" />
        <SummaryTile icon={Scale} label="Net Margin" value={fmt(margin)} sub={`${marginPct}%`} tone={margin >= 0 ? 'emerald' : 'rose'} />
        <SummaryTile icon={Receipt} label="Invoiced / Outstanding" value={fmt(invoicedNet)} sub={outstandingNet > 0 ? `${fmt(outstandingNet)} unpaid` : `${fmt(paidNet)} paid`} tone={outstandingNet > 0 ? 'amber' : 'blue'} />
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <PoundSterling className="w-4 h-4 text-primary" /> Cost vs Revenue Timeline
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cost" name="Cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Invoice snapshot */}
      {invoices.length > 0 && (
        <div className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Invoices ({invoices.length})
          </h3>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{inv.invoice_number}</p>
                  <p className="text-[11px] text-slate-500">{inv.issue_date ? format(new Date(inv.issue_date), 'dd MMM yyyy') : '—'}{inv.due_date ? ` · Due ${format(new Date(inv.due_date), 'dd MMM')}` : ''}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  inv.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                  inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  inv.status === 'void' ? 'bg-slate-100 text-slate-500' :
                  'bg-amber-100 text-amber-700'
                }`}>{inv.status}</span>
                <p className="text-sm font-bold text-slate-800 tabular-nums w-20 text-right">{fmt(inv.gross_total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unified ledger */}
      <div className="hub-glass rounded-2xl p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Project Ledger
          <span className="text-xs text-slate-400 font-normal ml-1">{ledger.length} entries</span>
        </h3>
        {ledger.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
            <AlertTriangle className="w-4 h-4" /> No financial entries recorded for this job yet.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-[11px] font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left py-2 px-2 text-[11px] font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-left py-2 px-2 text-[11px] font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-right py-2 px-2 text-[11px] font-semibold text-slate-500 uppercase">Cost</th>
                  <th className="text-right py-2 px-2 text-[11px] font-semibold text-slate-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledger.slice(0, 100).map((e, i) => {
                  const Icon = TYPE_ICON[e.type] || FileText;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2 text-slate-500 whitespace-nowrap text-xs">{e.date ? format(new Date(e.date), 'dd MMM') : '—'}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${TYPE_COLOR[e.type] || 'text-slate-600 bg-slate-50'}`}>
                          <Icon className="w-3 h-3" /> {e.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-700 min-w-0">
                        <p className="truncate max-w-[200px] sm:max-w-xs">{e.desc}</p>
                        {e.ref && <p className="text-[10px] text-slate-400 truncate">{e.ref}</p>}
                      </td>
                      <td className="py-2 px-2 text-right text-rose-600 tabular-nums whitespace-nowrap">{e.cost > 0 ? fmt(e.cost) : '—'}</td>
                      <td className="py-2 px-2 text-right text-emerald-600 tabular-nums whitespace-nowrap">{e.revenue > 0 ? fmt(e.revenue) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td colSpan={3} className="py-2.5 px-2 text-xs font-bold text-slate-600 uppercase">Totals</td>
                  <td className="py-2.5 px-2 text-right font-bold text-rose-600 tabular-nums">{fmt(totalCost)}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-emerald-600 tabular-nums">{fmt(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
            {ledger.length > 100 && <p className="text-[11px] text-slate-400 mt-2 text-center">Showing 100 of {ledger.length} entries</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
  };
  return (
    <div className="hub-glass rounded-xl p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone] || tones.blue}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 tabular-nums">{sub}</p>}
    </div>
  );
}