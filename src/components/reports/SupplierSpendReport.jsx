import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Truck, Download, Loader2, ChevronRight, ArrowLeft, FileText, Store, Briefcase, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { generateReportPdf, buildFilterSummary } from '@/utils/reportPdf';
import ReportChart from './ReportChart';
import DrillDownDrawer from './DrillDownDrawer';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => '£' + Math.round(Number(n || 0)).toLocaleString('en-GB');

const CATEGORY_LABELS = {
  hired_equipment: 'Hired Equipment',
  purchased_equipment: 'Purchased Equipment',
  internal_equipment: 'Internal Equipment',
  contractor_supplied: 'Contractor Supplied',
  client_supplied: 'Client Supplied',
  labour: 'Labour',
};

const CATEGORY_COLORS = {
  hired_equipment: 'bg-blue-100 text-blue-700',
  purchased_equipment: 'bg-amber-100 text-amber-700',
  internal_equipment: 'bg-emerald-100 text-emerald-700',
  contractor_supplied: 'bg-violet-100 text-violet-700',
  client_supplied: 'bg-slate-100 text-slate-600',
  labour: 'bg-rose-100 text-rose-700',
};

const billingTotal = (c) => {
  const qty = Number(c.quantity) || 1;
  const cost = Number(c.unit_cost) || 0;
  return qty * cost;
};

const SUPPLIER_CATEGORY_COLORS = {
  training: 'bg-blue-100 text-blue-700',
  materials: 'bg-amber-100 text-amber-700',
  plant: 'bg-emerald-100 text-emerald-700',
  ppe: 'bg-violet-100 text-violet-700',
  fuel: 'bg-rose-100 text-rose-700',
};

function supplierCategoryPill(cat) {
  if (!cat) return null;
  const cls = SUPPLIER_CATEGORY_COLORS[cat.toLowerCase()] || 'bg-slate-100 text-slate-600';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{cat}</span>;
}

/**
 * SupplierSpendReport — ranked supplier spend with custom date range,
 * monthly/weekly grouping, and two-level drill-down (supplier → job → category).
 */
export default function SupplierSpendReport({ filters }) {
  const { toast } = useToast();
  const [grouping, setGrouping] = useState('total'); // total | monthly | weekly
  const [drillSupplier, setDrillSupplier] = useState(null);
  const [drillJob, setDrillJob] = useState(null);
  const [exporting, setExporting] = useState(null);

  const { data: costItems = [], isLoading } = useQuery({
    queryKey: ['supplier-spend-items', filters.divisionId],
    queryFn: () => base44.entities.JobCostItem.filter(
      filters.divisionId ? { division_id: filters.divisionId } : {},
      '-created_date', 1000
    ),
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['report-suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['report-jobs-spend'], queryFn: () => base44.entities.Job.list('-created_date', 500) });

  const supplierMap = useMemo(() => { const m = {}; suppliers.forEach(s => m[s.id] = s); return m; }, [suppliers]);
  const jobMap = useMemo(() => { const m = {}; jobs.forEach(j => m[j.id] = j); return m; }, [jobs]);

  // Filter cost items by date range and that have a supplier
  const datedItems = useMemo(() => {
    return costItems.filter(c => {
      if (!c.supplier_id) return false;
      const d = c.start_date || c.created_date?.split('T')[0] || '';
      if (!d) return false;
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo && d > filters.dateTo) return false;
      return true;
    });
  }, [costItems, filters.dateFrom, filters.dateTo]);

  // Level 1: ranked suppliers
  const supplierRows = useMemo(() => {
    const m = {};
    for (const c of datedItems) {
      const sid = c.supplier_id;
      if (!m[sid]) m[sid] = { supplier_id: sid, total: 0, count: 0, items: [] };
      m[sid].total += billingTotal(c);
      m[sid].count += 1;
      m[sid].items.push(c);
    }
    const rows = Object.values(m).map(r => ({
      ...r,
      supplier: supplierMap[r.supplier_id],
      name: supplierMap[r.supplier_id]?.name || 'Unknown Supplier',
      category: supplierMap[r.supplier_id]?.category || '',
    }));
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [datedItems, supplierMap]);

  const grandTotal = supplierRows.reduce((s, r) => s + r.total, 0);
  const uniqueJobCount = useMemo(() => {
    const ids = new Set();
    for (const c of datedItems) {
      if (c.job_id) ids.add(c.job_id);
    }
    return ids.size;
  }, [datedItems]);

  // Time-series chart data for monthly/weekly grouping
  const chartData = useMemo(() => {
    if (grouping === 'total') {
      return supplierRows.slice(0, 10).map(r => ({ name: r.name.substring(0, 15), value: Math.round(r.total) }));
    }
    const buckets = {};
    for (const c of datedItems) {
      const d = c.start_date || c.created_date?.split('T')[0] || '';
      if (!d) continue;
      let key;
      if (grouping === 'monthly') {
        key = d.substring(0, 7); // YYYY-MM
      } else {
        // weekly — Monday of that week
        const date = new Date(d + 'T00:00:00');
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        key = date.toISOString().split('T')[0];
      }
      if (!buckets[key]) buckets[key] = 0;
      buckets[key] += billingTotal(c);
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({
      name: grouping === 'monthly' ? name : name.substring(5),
      value: Math.round(value),
    }));
  }, [datedItems, supplierRows, grouping]);

  // Level 2: by job for a selected supplier
  const jobBreakdown = useMemo(() => {
    if (!drillSupplier) return [];
    const items = datedItems.filter(c => c.supplier_id === drillSupplier.supplier_id);
    const m = {};
    for (const c of items) {
      const jid = c.job_id || 'unassigned';
      if (!m[jid]) m[jid] = { job_id: jid, total: 0, count: 0, items: [] };
      m[jid].total += billingTotal(c);
      m[jid].count += 1;
      m[jid].items.push(c);
    }
    return Object.values(m).map(r => ({
      ...r,
      job_name: jobMap[r.job_id]?.name || 'Unassigned',
    })).sort((a, b) => b.total - a.total);
  }, [drillSupplier, datedItems, jobMap]);

  // Level 3: by category for a selected supplier + job
  const categoryBreakdown = useMemo(() => {
    if (!drillSupplier || !drillJob) return [];
    const items = datedItems.filter(c => c.supplier_id === drillSupplier.supplier_id && (c.job_id || 'unassigned') === drillJob.job_id);
    const m = {};
    for (const c of items) {
      const cat = c.category || 'other';
      if (!m[cat]) m[cat] = { category: cat, total: 0, count: 0, items: [] };
      m[cat].total += billingTotal(c);
      m[cat].count += 1;
      m[cat].items.push(c);
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [drillSupplier, drillJob, datedItems]);

  const handleExportCsv = (rows, cols, filename) => {
    if (rows.length === 0) { toast({ title: 'No data to export', variant: 'destructive' }); return; }
    const dataRows = rows.map(r => { const o = {}; cols.forEach(c => o[c.key] = r[c.key] ?? ''); return o; });
    downloadStructuredCsv(filename, cols, dataRows);
    toast({ title: 'Exported', description: `${rows.length} records exported.` });
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const cols = [
        { label: 'Rank', align: 'center', width: 0.5 },
        { label: 'Supplier', align: 'left', width: 2.5 },
        { label: 'Items', align: 'center', width: 0.8 },
        { label: 'Spend', align: 'right', width: 1.2 },
        { label: '% of Total', align: 'right', width: 1 },
      ];
      const rows = supplierRows.map((r, i) => [
        String(i + 1), r.name, String(r.count), fmt0(r.total),
        grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) + '%' : '—',
      ]);
      const totals = ['Total', '', String(supplierRows.reduce((s, r) => s + r.count, 0)), fmt0(grandTotal), '100%'];
      await generateReportPdf({
        title: 'Supplier Spend Report',
        subtitle: 'GC Mission Control',
        filterSummary: buildFilterSummary(filters, null, null, null),
        sections: [{ title: 'Supplier Spend', columns: cols, rows, totals }],
      });
      toast({ title: 'PDF exported', description: `${supplierRows.length} suppliers.` });
    } catch (e) { toast({ title: 'PDF export failed', variant: 'destructive' }); }
    setExporting(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin" />
      </div>
    );
  }

  // ── Drill-down: by category (deepest level) ──
  if (drillSupplier && drillJob) {
    return (
      <DrillDownDrawer
        title={`${drillSupplier.name} → ${drillJob.job_name}`}
        breadcrumb={['Suppliers', drillSupplier.name, `Job: ${drillJob.job_name}`, 'By Category']}
        records={categoryBreakdown.flatMap(cat => cat.items)}
        columns={[
          { key: 'description', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'quantity', label: 'Qty' },
          { key: 'unit_cost', label: 'Unit Cost' },
          { key: 'start_date', label: 'Date' },
        ]}
        onClose={() => setDrillJob(null)}
      />
    );
  }

  // ── Drill-down: by job ──
  if (drillSupplier) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrillSupplier(null)} className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{drillSupplier.name} — Spend by Job</h3>
            <p className="text-xs text-slate-500">{jobBreakdown.length} jobs · {fmt0(drillSupplier.total)} total</p>
          </div>
          <button onClick={() => handleExportCsv(jobBreakdown, [
            { key: 'job_name', label: 'Job' }, { key: 'count', label: 'Items' }, { key: 'total', label: 'Spend' },
          ], `${drillSupplier.name}_by_job.csv`)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-[#2E5A1A] text-xs font-semibold hover:bg-emerald-100 transition">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        <div className="space-y-2">
          {jobBreakdown.map((j, i) => (
            <motion.button
              key={j.job_id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setDrillJob(j)}
              className="w-full hub-glass rounded-2xl p-4 flex items-center gap-4 text-left hover:shadow-md transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{j.job_name}</p>
                <p className="text-xs text-slate-500">{j.count} item{j.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-extrabold text-slate-900">{fmt0(j.total)}</p>
                <p className="text-[10px] text-slate-400">{drillSupplier.total > 0 ? Math.round((j.total / drillSupplier.total) * 100) : 0}% of supplier</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] transition" />
            </motion.button>
          ))}
          {jobBreakdown.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No jobs found for this supplier in the selected range.</div>
          )}
        </div>
      </div>
    );
  }

  // ── Main: ranked supplier list ──
  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#2E5A1A] flex items-center justify-center"><Truck className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Spend</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{fmt0(grandTotal)}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Store className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Suppliers</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{supplierRows.length}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center"><Briefcase className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Jobs</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{uniqueJobCount}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><TrendingUp className="w-4 h-4" /></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg / Supplier</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{fmt0(supplierRows.length > 0 ? grandTotal / supplierRows.length : 0)}</p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <button onClick={() => handleExportCsv(supplierRows, [
          { key: 'name', label: 'Supplier' }, { key: 'count', label: 'Items' }, { key: 'total', label: 'Spend' },
        ], 'supplier_spend.csv')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button onClick={handleExportPdf} disabled={exporting === 'pdf'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E5A1A] hover:bg-[#244715] text-white text-sm font-semibold transition disabled:opacity-50 shadow-sm">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Export PDF
        </button>
      </div>

      {/* Grouping toggle */}
      <div className="hub-glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Supplier Spend</p>
            <p className="text-sm font-extrabold text-slate-900">{fmt0(grandTotal)} across {supplierRows.length} suppliers</p>
          </div>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-0.5 flex-shrink-0 sm:ml-auto">
          {[{ id: 'total', label: 'Total' }, { id: 'monthly', label: 'Monthly' }, { id: 'weekly', label: 'Weekly' }].map(g => (
            <button key={g.id} onClick={() => setGrouping(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${grouping === g.id ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="hub-glass rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            {grouping === 'total' ? 'Top 10 Suppliers by Spend' : `Spend Over Time (${grouping})`}
          </h3>
          <ReportChart data={chartData} type={grouping === 'total' ? 'bar' : 'area'} height={240} />
        </div>
      )}

      {/* Per-Supplier Summary table */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Per-Supplier Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Rank</th>
                <th className="text-left px-3 py-2.5">Supplier</th>
                <th className="text-left px-3 py-2.5">Category</th>
                <th className="text-right px-3 py-2.5">Items</th>
                <th className="text-right px-3 py-2.5">Spend</th>
                <th className="text-right px-3 py-2.5">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {supplierRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No supplier spend found in the selected date range.
                  </td>
                </tr>
              ) : (
                supplierRows.map((r, i) => (
                  <tr key={r.supplier_id} onClick={() => setDrillSupplier(r)}
                    className="border-t border-slate-100 hover:bg-slate-50/50 cursor-pointer transition">
                    <td className="px-4 py-2.5 font-bold text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-3 py-2.5">{supplierCategoryPill(r.category) || <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.count}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2E5A1A]">{fmt0(r.total)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0}%</td>
                  </tr>
                ))
              )}
            </tbody>
            {supplierRows.length > 0 && (
              <tfoot>
                <tr className="bg-[#8DC63F]/20 border-t-2 border-[#8DC63F]">
                  <td className="px-4 py-2.5 font-bold text-[#2E5A1A]">TOTAL</td>
                  <td></td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{supplierRows.reduce((s, r) => s + r.count, 0)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">{fmt0(grandTotal)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#2E5A1A]">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}