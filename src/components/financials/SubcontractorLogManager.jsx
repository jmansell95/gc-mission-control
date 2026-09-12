import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  TrendingUp, Plus, X, Loader2, Trash2, CheckCircle2, ShieldCheck,
  ArrowRightLeft, Percent, PoundSterling, Calendar, HardHat, FileText,
  ChevronDown, ChevronRight, AlertTriangle, Building2, User, Clock, Lock,
  Mountain, Layers, Shovel, Truck, Boxes, Package, MapPin, Ruler,
} from 'lucide-react';
import { useBillingLock } from '@/hooks/useBillingLock';
import BillingLockBanner from '@/components/billing/BillingLockBanner';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDur = (hours) => {
  const h = Number(hours) || 0;
  if (h <= 0) return '—';
  const wholeH = Math.floor(h);
  const mins = Math.round((h - wholeH) * 60);
  if (wholeH && mins) return `${wholeH}h ${mins}m`;
  if (wholeH) return `${wholeH}h`;
  return `${mins}m`;
};
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm";

const WORK_TYPES = [
  { val: 'drilling', label: 'Drilling', icon: HardHat, color: 'bg-amber-100 text-amber-700' },
  { val: 'coring', label: 'Coring', icon: Mountain, color: 'bg-orange-100 text-orange-700' },
  { val: 'groundworks', label: 'Groundworks', icon: Layers, color: 'bg-emerald-100 text-emerald-700' },
  { val: 'trial_pit', label: 'Trial Pit', icon: Shovel, color: 'bg-blue-100 text-blue-700' },
  { val: 'enabling_works', label: 'Enabling', icon: Truck, color: 'bg-violet-100 text-violet-700' },
  { val: 'equipment_hire', label: 'Equipment Hire', icon: Boxes, color: 'bg-cyan-100 text-cyan-700' },
  { val: 'materials_supply', label: 'Materials', icon: Package, color: 'bg-slate-100 text-slate-700' },
  { val: 'transport', label: 'Transport', icon: Truck, color: 'bg-indigo-100 text-indigo-700' },
  { val: 'supervision', label: 'Supervision', icon: User, color: 'bg-purple-100 text-purple-700' },
  { val: 'other', label: 'Other', icon: FileText, color: 'bg-slate-100 text-slate-500' },
];

const RATE_BASIS = [
  { val: 'day_rate', label: 'Day Rate' },
  { val: 'hourly_rate', label: 'Hourly' },
  { val: 'per_metre', label: 'Per Metre' },
  { val: 'per_unit', label: 'Per Unit' },
  { val: 'flat_fee', label: 'Flat Fee' },
  { val: 'item_cost', label: 'Item Cost' },
];

const STATUS_META = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600', icon: Clock },
  verified: { label: 'Verified', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: X },
  invoiced: { label: 'Invoiced', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  synced: { label: 'Synced', color: 'bg-purple-100 text-purple-700', icon: CheckCircle2 },
};

const emptyForm = {
  subcontractor_id: '', date: new Date().toISOString().slice(0, 10),
  work_type: 'drilling', description: '', borehole_ref: '',
  purchase_rate_basis: 'day_rate', purchase_rate: '', hours_worked: '',
  metres_drilled: '', units_completed: '', units_label: '',
  markup_percentage: 15, po_number: '',
};

export default function SubcontractorLogManager({ job }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { isLocked, effectiveLocked, lockedInvoices, lockReason, tempOpen, setTempOpen } = useBillingLock(job.id, job);

  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['subcon-logs', job.id],
    queryFn: () => base44.entities.SubcontractorLog.filter({ job_id: job.id }, '-date', 200),
  });
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const purchaseCost = useMemo(() => {
    const rate = parseFloat(form.purchase_rate) || 0;
    const basis = form.purchase_rate_basis;
    if (basis === 'flat_fee' || basis === 'item_cost') return rate;
    if (basis === 'day_rate') return rate * 1;
    if (basis === 'hourly_rate') return rate * (parseFloat(form.hours_worked) || 0);
    if (basis === 'per_metre') return rate * (parseFloat(form.metres_drilled) || 0);
    if (basis === 'per_unit') return rate * (parseFloat(form.units_completed) || 0);
    return rate;
  }, [form.purchase_rate, form.purchase_rate_basis, form.hours_worked, form.metres_drilled, form.units_completed]);

  const markup = parseFloat(form.markup_percentage) || 0;
  const clientCharge = purchaseCost * (1 + markup / 100);
  const marginNet = clientCharge - purchaseCost;
  const marginPct = clientCharge > 0 ? (marginNet / clientCharge) * 100 : 0;

  const handleSubmit = async () => {
    if (!form.subcontractor_id || !form.date || purchaseCost <= 0) return;
    setSaving(true);
    try {
      const sub = contractors.find(c => c.id === form.subcontractor_id);
      const vatRate = 20;
      const purchaseVat = purchaseCost * (vatRate / 100);
      const clientVat = clientCharge * (vatRate / 100);
      const weekStart = new Date(form.date);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      await base44.entities.SubcontractorLog.create({
        job_id: job.id,
        subcontractor_id: form.subcontractor_id,
        subcontractor_name: sub?.name || '',
        staff_id: profile?.staff?.id || profile?.id || '',
        date: form.date,
        week_start: weekStart.toISOString().slice(0, 10),
        work_type: form.work_type,
        description: form.description,
        borehole_ref: form.borehole_ref || undefined,
        depth_from: undefined,
        depth_to: form.metres_drilled ? parseFloat(form.metres_drilled) : undefined,
        metres_drilled: parseFloat(form.metres_drilled) || undefined,
        units_completed: parseFloat(form.units_completed) || undefined,
        units_label: form.units_label || undefined,
        hours_worked: parseFloat(form.hours_worked) || undefined,
        purchase_cost_net: Math.round(purchaseCost * 100) / 100,
        purchase_cost_vat: Math.round(purchaseVat * 100) / 100,
        purchase_cost_gross: Math.round((purchaseCost + purchaseVat) * 100) / 100,
        purchase_rate_basis: form.purchase_rate_basis,
        purchase_rate: parseFloat(form.purchase_rate) || 0,
        markup_percentage: markup,
        client_charge_net: Math.round(clientCharge * 100) / 100,
        client_charge_vat: Math.round(clientVat * 100) / 100,
        client_charge_gross: Math.round((clientCharge + clientVat) * 100) / 100,
        sell_rate_basis: 'markup_on_cost',
        margin_net: Math.round(marginNet * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        po_number: form.po_number || undefined,
        status: 'pending',
      });
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      setForm(emptyForm);
      setShowForm(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleStatusChange = async (logId, status) => {
    try {
      await base44.entities.SubcontractorLog.update(logId, { status, verified_at: status === 'verified' ? new Date().toISOString() : undefined });
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', job.id] });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (logId) => {
    try {
      await base44.entities.SubcontractorLog.delete(logId);
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
    } catch (e) { console.error(e); }
  };

  const handleMarkInvoiceReceived = async (logId) => {
    try {
      await base44.entities.SubcontractorLog.update(logId, {
        invoice_received: true,
        reconciliation_status: 'pending',
      });
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['subcon-recon-logs'] });
    } catch (e) { console.error(e); }
  };

  const totals = useMemo(() => {
    return logs.reduce((acc, l) => {
      acc.purchase += Number(l.purchase_cost_net) || 0;
      acc.client += Number(l.client_charge_net) || 0;
      acc.margin += Number(l.margin_net) || 0;
      acc.hours += Number(l.hours_worked) || 0;
      return acc;
    }, { purchase: 0, client: 0, margin: 0, hours: 0 });
  }, [logs]);
  const avgMarginPct = totals.client > 0 ? (totals.margin / totals.client) * 100 : 0;

  // Group logs by date for the timeline
  const byDate = useMemo(() => {
    const groups = {};
    logs.forEach(l => {
      const d = l.date || 'No date';
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return groups;
  }, [logs]);
  const sortedDates = Object.keys(byDate).sort().reverse();
  const loggedDays = sortedDates.filter(d => d !== 'No date').length;

  return (
    <div className="space-y-4">
      {/* Header + Add button */}
      <div className="hero-gradient rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Subcontractor Activity Logs</h3>
            <p className="text-[11px] text-white/60">Buy-side cost · sell-side margin · verification workflow</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} disabled={effectiveLocked} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 bg-white text-primary rounded-lg text-xs font-bold hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Log Work'}
          </button>
        </div>
        {logs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HeroStat icon={Calendar} label="Days Logged" value={loggedDays} sub={`${logs.length} entries`} />
            <HeroStat icon={Clock} label="Total Hours" value={fmtDur(totals.hours)} sub="time on site" />
            <HeroStat icon={PoundSterling} label="Buy (Cost)" value={fmt(totals.purchase)} sub="net" />
            <HeroStat icon={TrendingUp} label="Margin" value={fmt(totals.margin)} sub={`${avgMarginPct.toFixed(1)}% on sell`} />
          </div>
        )}
      </div>

      {isLocked && <BillingLockBanner lockedInvoices={lockedInvoices} lockReason={lockReason} job={job} tempOpen={tempOpen} onTempOpen={setTempOpen} />}

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subcontractor <span className="text-red-500">*</span></label>
              <select value={form.subcontractor_id} onChange={e => set('subcontractor_id', e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Work Type</label>
              <select value={form.work_type} onChange={e => set('work_type', e.target.value)} className={inputCls}>
                {WORK_TYPES.map(w => <option key={w.val} value={w.val}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rate Basis</label>
              <select value={form.purchase_rate_basis} onChange={e => set('purchase_rate_basis', e.target.value)} className={inputCls}>
                {RATE_BASIS.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rate (£) <span className="text-red-500">*</span></label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" min="0" step="0.01" value={form.purchase_rate} onChange={e => set('purchase_rate', e.target.value)} placeholder="0.00" className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Markup %</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" min="0" step="0.1" value={form.markup_percentage} onChange={e => set('markup_percentage', e.target.value)} className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">PO Number</label>
              <input type="text" value={form.po_number} onChange={e => set('po_number', e.target.value)} className={inputCls} />
            </div>
          </div>
          {(form.purchase_rate_basis === 'hourly_rate' || form.purchase_rate_basis === 'per_metre' || form.purchase_rate_basis === 'per_unit') && (
            <div className="grid grid-cols-3 gap-3">
              {form.purchase_rate_basis === 'hourly_rate' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hours</label>
                  <input type="number" min="0" step="0.5" value={form.hours_worked} onChange={e => set('hours_worked', e.target.value)} placeholder="0" className={inputCls} />
                </div>
              )}
              {form.purchase_rate_basis === 'per_metre' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Metres</label>
                  <input type="number" min="0" step="0.1" value={form.metres_drilled} onChange={e => set('metres_drilled', e.target.value)} placeholder="0" className={inputCls} />
                </div>
              )}
              {form.purchase_rate_basis === 'per_unit' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Units</label>
                    <input type="number" min="0" step="0.5" value={form.units_completed} onChange={e => set('units_completed', e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unit Label</label>
                    <input type="text" value={form.units_label} onChange={e => set('units_label', e.target.value)} placeholder="e.g. trial pits, core runs" className={inputCls} />
                  </div>
                </>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description / Borehole Ref</label>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" value={form.borehole_ref} onChange={e => set('borehole_ref', e.target.value)} placeholder="BH-01 (optional)" className={inputCls} />
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Work description…" className={`${inputCls} col-span-2`} />
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Buy</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(purchaseCost)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Sell ({markup}%)</p>
                <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(clientCharge)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Margin</p>
                <p className="text-sm font-bold text-primary tabular-nums">{fmt(marginNet)} <span className="text-[10px] font-normal">({marginPct.toFixed(1)}%)</span></p>
              </div>
            </div>
            {markup === 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Zero margin</span>
              </div>
            )}
          </div>
          <button onClick={handleSubmit} disabled={saving || !form.subcontractor_id || purchaseCost <= 0} className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Log Subcontractor Work'}
          </button>
        </div>
      )}

      {/* Log list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-center py-8 px-4">
          <Building2 className="w-7 h-7 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No subcontractor logs yet</p>
          <p className="text-xs text-slate-400 mt-1">Log sub-con work to track buy/sell margins.</p>
        </div>
      ) : (
        /* Vertical timeline grouped by date */
        <div className="relative pl-7">
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-400 via-slate-200 to-slate-100" />

          {sortedDates.map(date => {
            const dayLogs = byDate[date];
            const dayBuy = dayLogs.reduce((s, l) => s + (Number(l.purchase_cost_net) || 0), 0);
            const daySell = dayLogs.reduce((s, l) => s + (Number(l.client_charge_net) || 0), 0);
            const dayMargin = dayLogs.reduce((s, l) => s + (Number(l.margin_net) || 0), 0);
            const dayHours = dayLogs.reduce((s, l) => s + (Number(l.hours_worked) || 0), 0);
            const d = date !== 'No date' ? new Date(date + 'T00:00:00') : null;
            const hasPending = dayLogs.some(l => l.status === 'pending');

            return (
              <div key={date} className="relative mb-4">
                {/* Date node */}
                <div className={`absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 border-white shadow z-10 ${hasPending ? 'bg-amber-500' : 'bg-orange-500'}`} />

                {/* Day card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Day header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-3 flex-wrap">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-slate-800">{d ? format(d, 'EEEE, dd MMM yyyy') : 'No date'}</span>
                    <span className="text-xs text-slate-400">{dayLogs.length} {dayLogs.length === 1 ? 'entry' : 'entries'}</span>
                    {dayHours > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDur(dayHours)}</span>
                    )}
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <span className="text-slate-500">Buy: <strong className="text-slate-700 tabular-nums">{fmt(dayBuy)}</strong></span>
                      <span className="text-slate-500">Sell: <strong className="text-emerald-700 tabular-nums">{fmt(daySell)}</strong></span>
                      <span className="text-slate-500">Margin: <strong className="text-primary tabular-nums">{fmt(dayMargin)}</strong></span>
                    </div>
                  </div>

                  {/* Day's logs */}
                  <div className="relative px-4 py-3">
                    <div className="absolute left-[22px] top-3 bottom-3 w-0.5 bg-slate-100" />
                    <div className="space-y-2.5">
                      {dayLogs.map(l => {
                        const sub = contractors.find(c => c.id === l.subcontractor_id);
                        const wt = WORK_TYPES.find(w => w.val === l.work_type) || WORK_TYPES[0];
                        const WtIcon = wt.icon;
                        const st = STATUS_META[l.status] || STATUS_META.pending;
                        const StIcon = st.icon;
                        const isExpanded = expanded === l.id;

                        return (
                          <div key={l.id} className="relative pl-6">
                            {/* Log node */}
                            <div className={`absolute left-[2px] top-3.5 w-3 h-3 rounded-full border-2 border-white shadow z-10 ${st.label === 'Pending' ? 'bg-slate-400' : st.label === 'Approved' ? 'bg-emerald-500' : 'bg-blue-400'}`} />

                            {/* Log card */}
                            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                              {/* Top row */}
                              <div className="px-3 py-2.5 flex items-center gap-2">
                                <button onClick={() => setExpanded(isExpanded ? null : l.id)} className="flex-shrink-0">
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${wt.color}`}>
                                  <WtIcon className="w-3 h-3" /> {wt.label}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{l.subcontractor_name || sub?.name || 'Unknown'}</p>
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <User className="w-2.5 h-2.5" />
                                    {l.verified_by_name || 'Not verified yet'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-[9px] text-slate-400 uppercase">Margin</p>
                                    <p className={`text-xs font-bold tabular-nums ${l.margin_pct >= 0 ? 'text-primary' : 'text-red-600'}`}>{fmt(l.margin_net)}</p>
                                  </div>
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${st.color}`}>
                                    <StIcon className="w-2.5 h-2.5" />{st.label}
                                  </span>
                                </div>
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t border-slate-200">
                                  {/* Financial grid */}
                                  <div className="grid grid-cols-4 gap-2 text-xs bg-white rounded-lg p-2 mt-2 border border-slate-100">
                                    <div><p className="text-[9px] text-slate-400 uppercase">Buy</p><p className="font-semibold text-slate-700 tabular-nums">{fmt(l.purchase_cost_net)}</p></div>
                                    <div><p className="text-[9px] text-slate-400 uppercase">Sell</p><p className="font-semibold text-emerald-700 tabular-nums">{fmt(l.client_charge_net)}</p></div>
                                    <div><p className="text-[9px] text-slate-400 uppercase">Markup</p><p className="font-semibold text-slate-700">{l.markup_percentage}%</p></div>
                                    <div><p className="text-[9px] text-slate-400 uppercase">Margin %</p><p className="font-semibold text-slate-700">{l.margin_pct?.toFixed(1)}%</p></div>
                                  </div>

                                  {/* Description */}
                                  {l.description && (
                                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                                      <p className="text-[9px] text-slate-400 uppercase mb-0.5">Description</p>
                                      <p className="text-xs text-slate-600 leading-relaxed">{l.description}</p>
                                    </div>
                                  )}

                                  {/* Work details grid */}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white rounded-lg p-2 border border-slate-100">
                                    {l.borehole_ref && (
                                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /><span className="text-slate-500">BH:</span> <span className="font-medium text-slate-700">{l.borehole_ref}</span></div>
                                    )}
                                    {l.metres_drilled != null && l.metres_drilled > 0 && (
                                      <div className="flex items-center gap-1"><Ruler className="w-3 h-3 text-slate-400" /><span className="text-slate-500">Metres:</span> <span className="font-medium text-slate-700">{l.metres_drilled}m</span></div>
                                    )}
                                    {l.hours_worked != null && l.hours_worked > 0 && (
                                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /><span className="text-slate-500">Hours:</span> <span className="font-medium text-slate-700">{fmtDur(l.hours_worked)}</span></div>
                                    )}
                                    {l.units_completed != null && l.units_completed > 0 && (
                                      <div className="flex items-center gap-1"><Package className="w-3 h-3 text-slate-400" /><span className="text-slate-500">Units:</span> <span className="font-medium text-slate-700">{l.units_completed} {l.units_label || ''}</span></div>
                                    )}
                                    {l.po_number && (
                                      <div className="flex items-center gap-1"><FileText className="w-3 h-3 text-slate-400" /><span className="text-slate-500">PO:</span> <span className="font-medium text-slate-700">{l.po_number}</span></div>
                                    )}
                                    <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-slate-400" /><span className="text-slate-500">Rate:</span> <span className="font-medium text-slate-700">{fmt(l.purchase_rate)} / {l.purchase_rate_basis?.replace(/_/g, ' ')}</span></div>
                                  </div>

                                  {/* Reconciliation badge */}
                                  {l.invoice_received && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                        l.reconciliation_status === 'reconciled' ? 'bg-emerald-50 text-emerald-700' :
                                        l.reconciliation_status === 'mismatched' ? 'bg-red-50 text-red-700' :
                                        'bg-amber-50 text-amber-700'
                                      }`}>
                                        {l.reconciliation_status === 'reconciled' ? <Lock className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                        Invoice {(l.reconciliation_status || 'pending').charAt(0).toUpperCase() + (l.reconciliation_status || 'pending').slice(1)}
                                      </span>
                                      {l.invoice_net_amount != null && (
                                        <span className="text-[10px] text-slate-500">Invoice amount: {fmt(l.invoice_net_amount)}</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Status actions */}
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    {effectiveLocked ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-medium ml-auto"><Lock className="w-3 h-3" /> Locked</span>
                                    ) : (
                                      <>
                                        {l.status === 'pending' && (
                                          <button onClick={() => handleStatusChange(l.id, 'verified')} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-medium hover:bg-blue-100 transition"><CheckCircle2 className="w-3 h-3" /> Verify</button>
                                        )}
                                        {l.status === 'verified' && (
                                          <button onClick={() => handleStatusChange(l.id, 'approved')} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-medium hover:bg-emerald-100 transition"><ShieldCheck className="w-3 h-3" /> Approve</button>
                                        )}
                                        {(l.status === 'pending' || l.status === 'verified') && !l.invoice_received && (
                                          <button onClick={() => handleMarkInvoiceReceived(l.id)} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-medium hover:bg-indigo-100 transition"><FileText className="w-3 h-3" /> Invoice Received</button>
                                        )}
                                        {(l.status === 'pending' || l.status === 'verified') && (
                                          <button onClick={() => handleDelete(l.id)} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium hover:bg-red-100 transition ml-auto"><Trash2 className="w-3 h-3" /> Delete</button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <p className="text-[10px] uppercase font-medium text-white/70 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/50">{sub}</p>
    </div>
  );
}