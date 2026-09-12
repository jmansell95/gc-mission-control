import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Drill, Truck, Receipt, AlertCircle, Calendar, Building2, Hash } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * AFPTab — displays all AFPs for a job. Shows contract details, drilling
 * breakdown (with week-by-week columns), plant hire, and rates reference.
 * Multiple AFPs per job (one per monthly period) shown in a period selector.
 */
export default function AFPTab({ job }) {
  const { data: afps = [], isLoading } = useQuery({
    queryKey: ['afp', job.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, '-period_date', 50),
  });

  const { data: allLineItems = [] } = useQuery({
    queryKey: ['afp-line-items', job.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ job_id: job.id }, 'sort_order', 500),
  });

  if (isLoading) {
    return <div className="hub-glass rounded-2xl p-8 text-center"><p className="text-sm text-slate-400">Loading AFPs…</p></div>;
  }

  if (afps.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">No AFPs yet</p>
        <p className="text-xs text-slate-400 mt-1">Upload an Application for Payment spreadsheet to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {afps.map(afp => {
        const lineItems = allLineItems.filter(li => li.afp_id === afp.id);
        const drillingItems = lineItems.filter(li => li.sheet_name === 'drilling');
        const plantHireItems = lineItems.filter(li => li.sheet_name === 'plant_hire');
        const rateItems = lineItems.filter(li => li.sheet_name === 'rates');

        return (
          <div key={afp.id} className="space-y-3">
            {/* Contract Details */}
            <div className="hub-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">AFP — {new Date(afp.period_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
                    <p className="text-[11px] text-slate-400">{afp.status} · {afp.source_file_name || 'Manual entry'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Claimed</p>
                  <p className="text-lg font-bold text-blue-700 tabular-nums">{fmt(afp.total_claimed)}</p>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DetailItem icon={Building2} label="Client" value={afp.client_name} />
                <DetailItem icon={Hash} label="Client PO" value={afp.client_po} />
                <DetailItem icon={Hash} label="GC Job No." value={afp.gc_job_number} />
                <DetailItem icon={Calendar} label="Payment Due" value={afp.payment_due_date || 'N/A'} />
              </div>
            </div>

            {/* Drilling Breakdown */}
            {drillingItems.length > 0 && (
              <div className="hub-glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Drill className="w-4 h-4 text-[#2E5A1A]" />
                  <h3 className="text-sm font-bold text-slate-900">Drilling Breakdown</h3>
                  <span className="text-[11px] text-slate-400">{drillingItems.length} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/80">
                      <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                        <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Unit</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Unit Price</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Rate</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {drillingItems.map((li, i) => (
                        <tr key={li.id || i} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-700 truncate max-w-[250px]">{li.item}</td>
                          <td className="text-right px-3 py-2 text-slate-500">{li.unit || '—'}</td>
                          <td className="text-right px-3 py-2 text-slate-600 tabular-nums">{fmt(li.unit_price)}</td>
                          <td className="text-right px-3 py-2 text-slate-600 tabular-nums">{li.qty || '—'}</td>
                          <td className="text-right px-3 py-2 text-slate-600 tabular-nums">{fmt(li.rate)}</td>
                          <td className="text-right px-3 py-2 text-slate-800 font-semibold tabular-nums">{fmt(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                      <tr className="font-bold text-slate-800">
                        <td className="px-3 py-2.5" colSpan={5}>Drilling Total</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{fmt(drillingItems.reduce((s, li) => s + (li.amount || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Plant Hire */}
            {plantHireItems.length > 0 && (
              <div className="hub-glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Plant Hire</h3>
                  <span className="text-[11px] text-slate-400">{plantHireItems.length} items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/80">
                      <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                        <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Unit</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Unit Price</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {plantHireItems.map((li, i) => (
                        <tr key={li.id || i} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-700 truncate max-w-[250px]">{li.item}</td>
                          <td className="text-right px-3 py-2 text-slate-500">{li.unit || '—'}</td>
                          <td className="text-right px-3 py-2 text-slate-600 tabular-nums">{fmt(li.unit_price)}</td>
                          <td className="text-right px-3 py-2 text-slate-600 tabular-nums">{li.qty || '—'}</td>
                          <td className="text-right px-3 py-2 text-slate-800 font-semibold tabular-nums">{fmt(li.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                      <tr className="font-bold text-slate-800">
                        <td className="px-3 py-2.5" colSpan={4}>Plant Hire Total</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{fmt(plantHireItems.reduce((s, li) => s + (li.amount || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Rates Reference */}
            {rateItems.length > 0 && (
              <div className="hub-glass rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-600" />
                  <h3 className="text-sm font-bold text-slate-900">Schedule of Rates</h3>
                  <span className="text-[11px] text-slate-400">{rateItems.length} rates</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/80">
                      <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                        <th className="text-left px-3 py-2.5 font-semibold">Item</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Price</th>
                        <th className="text-right px-3 py-2.5 font-semibold">Per</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rateItems.map((li, i) => (
                        <tr key={li.id || i} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-700 truncate max-w-[300px]">{li.item}</td>
                          <td className="text-right px-3 py-2 text-slate-800 font-semibold tabular-nums">{fmt(li.unit_price)}</td>
                          <td className="text-right px-3 py-2 text-slate-500">{li.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-800 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}