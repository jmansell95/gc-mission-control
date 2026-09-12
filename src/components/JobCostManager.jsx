import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { PoundSterling, TrendingUp, TrendingDown, Edit2, Check, X, Calculator, RefreshCw, ChevronDown, ChevronUp, Ruler, AlertTriangle } from 'lucide-react';
import { useBillingLock } from '@/hooks/useBillingLock';
import BillingLockBanner from '@/components/billing/BillingLockBanner';
import CostForecastWidget from '@/components/financials/CostForecastWidget';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JobCostManager({ job, totalCost, staffCosts, isDrillingJob, totalMeterage }) {
  const queryClient = useQueryClient();
  const [editingBudget, setEditingBudget] = useState(false);
  const [editingActual, setEditingActual] = useState(false);
  const [budgetVal, setBudgetVal] = useState(job.budget_amount || '');
  const [actualVal, setActualVal] = useState(job.actual_cost ?? '');
  const [saving, setSaving] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [editingMeterage, setEditingMeterage] = useState(false);
  const [meterageVal, setMeterageVal] = useState(job.meterage || '');
  const { isLocked, effectiveLocked, lockedInvoices, lockReason, tempOpen, setTempOpen } = useBillingLock(job.id, job);

  const usingManual = job.actual_cost != null && job.actual_cost !== '';
  const usingJobMeterage = isDrillingJob && job.meterage != null && job.meterage !== '' && Number(job.meterage) > 0;
  const actualCost = usingManual ? Number(job.actual_cost) : totalCost;
  const budget = job.budget_amount || 0;
  const variance = budget - actualCost;
  const pct = budget > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0;
  const overBudget = actualCost > budget && budget > 0;
  const overrunPct = budget > 0 ? Math.round(((actualCost - budget) / budget) * 100) : 0;

  const saveBudget = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { budget_amount: budgetVal === '' ? '' : parseFloat(budgetVal) });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingBudget(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const saveActual = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { actual_cost: actualVal === '' ? '' : parseFloat(actualVal) });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingActual(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const clearActual = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { actual_cost: '' });
      setActualVal('');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingActual(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const saveMeterage = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { meterage: meterageVal === '' ? '' : parseFloat(meterageVal) });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingMeterage(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const clearMeterage = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, { meterage: '' });
      setMeterageVal('');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setEditingMeterage(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <PoundSterling className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Job Costing</h2>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${usingManual ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
          {usingManual ? 'Manual cost' : 'Auto-calculated'}
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {isLocked && <BillingLockBanner lockedInvoices={lockedInvoices} lockReason={lockReason} job={job} tempOpen={tempOpen} onTempOpen={setTempOpen} />}
        {/* Inline profitability alert — budget overrun */}
        {overBudget && !isLocked && (
          <div className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 border ${overrunPct >= 25 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${overrunPct >= 25 ? 'text-rose-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${overrunPct >= 25 ? 'text-rose-700' : 'text-amber-700'}`}>
                {overrunPct >= 25 ? 'Critical budget overrun' : 'Budget overrun detected'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Cost is {overrunPct}% over the agreed budget ({fmt(actualCost)} vs {fmt(budget)}).{' '}
                {overrunPct >= 25 ? 'Immediate management review recommended.' : 'Monitor closely to protect margin.'}
              </p>
            </div>
          </div>
        )}
        {/* Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Budget</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(budget)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Actual</p>
            <p className={`text-base font-bold truncate ${overBudget ? 'text-red-600' : 'text-slate-900'}`}>{fmt(actualCost)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Variance</p>
            <p className={`text-base font-bold truncate ${variance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{variance >= 0 ? '+' : '−'}{fmt(Math.abs(variance))}</p>
          </div>
        </div>

        {/* Progress bar */}
        {budget > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Spent vs budget</span>
              <span className={`text-xs font-bold ${overBudget ? 'text-red-600' : 'text-emerald-700'}`}>{pct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Budget edit */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Budget</span>
            {!editingBudget ? (
              <button onClick={() => { setBudgetVal(job.budget_amount || ''); setEditingBudget(true); }} disabled={effectiveLocked} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" step="0.01" value={budgetVal} onChange={(e) => setBudgetVal(e.target.value)} placeholder="0.00" className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                <button onClick={saveBudget} disabled={saving} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingBudget(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500">{fmt(budget)} agreed</p>
        </div>

        {/* Actual cost edit */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Actual Cost</span>
            {!editingActual ? (
              <button onClick={() => { setActualVal(job.actual_cost ?? ''); setEditingActual(true); }} disabled={effectiveLocked} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <input type="number" min="0" step="0.01" value={actualVal} onChange={(e) => setActualVal(e.target.value)} placeholder="Auto" className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                <button onClick={saveActual} disabled={saving} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"><Check className="w-4 h-4" /></button>
                {usingManual && <button onClick={clearActual} disabled={saving} title="Use calculated cost" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"><Calculator className="w-4 h-4" /></button>}
                <button onClick={() => setEditingActual(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {usingManual ? 'Manual entry applied' : <span className="inline-flex items-center gap-1"><Calculator className="w-3.5 h-3.5" /> Calculated from equipment & charges</span>}
          </p>
        </div>

        {/* Meterage entry (drilling jobs only) */}
        {isDrillingJob && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-slate-700 inline-flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-amber-600" /> Total Meterage
              </span>
              {!editingMeterage ? (
                <button onClick={() => { setMeterageVal(job.meterage || ''); setEditingMeterage(true); }} disabled={effectiveLocked} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <input type="number" min="0" step="0.1" value={meterageVal} onChange={(e) => setMeterageVal(e.target.value)} placeholder="0" className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  <span className="text-xs text-slate-400">m</span>
                  <button onClick={saveMeterage} disabled={saving} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"><Check className="w-4 h-4" /></button>
                  {usingJobMeterage && <button onClick={clearMeterage} disabled={saving} title="Use shift meterage" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"><Calculator className="w-4 h-4" /></button>}
                  <button onClick={() => setEditingMeterage(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {totalMeterage}m recorded
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${usingJobMeterage ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {usingJobMeterage ? 'Job entry' : 'From shifts'}
              </span>
            </p>
          </div>
        )}

        {/* Breakdown toggle */}
        {staffCosts.length > 0 && Number(totalCost) > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button onClick={() => setShowBreakdown(!showBreakdown)} className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-emerald-700 transition">
              <span className="inline-flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Calculated cost breakdown</span>
              {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showBreakdown && (
              <div className="mt-3 space-y-2">
                {staffCosts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900">{sc.name}</span>
                      {sc.costType === 'meterage'
                        ? <span className="text-xs text-slate-400 ml-2">{Number(sc.meterage || 0).toFixed(1)}m × £{Number(sc.meterageRate || 0).toFixed(2)}/m</span>
                        : sc.costType === 'timesheet'
                        ? <span className="text-xs text-slate-400 ml-2">{(sc.timesheetMinutes / 60).toFixed(1)}h logged × £{Number(sc.hourlyRate || 0).toFixed(2)}/h</span>
                        : <span className="text-xs text-slate-400 ml-2">{sc.shifts} shifts × £{Number(sc.dayRate || 0).toFixed(2)}</span>}
                    </div>
                    <span className="font-semibold text-slate-700 flex-shrink-0">{fmt(sc.cost)}</span>
                  </div>
                ))}
                {totalMeterage > 0 && (
                  <div className="flex items-center justify-between pt-2 text-sm border-t border-slate-100">
                    <span className="text-slate-500">Total Meterage</span>
                    <span className="font-semibold text-amber-700">{totalMeterage}m</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Calculated Total</span>
                  <span className="font-bold text-emerald-700">{fmt(totalCost)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Variance message */}
        {budget > 0 && (
          <div className={`flex items-center gap-2 text-sm border-t border-slate-100 pt-3 ${overBudget ? 'text-red-600' : variance < budget * 0.2 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {overBudget ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            <span className="font-medium">
              {overBudget ? `${fmt(Math.abs(variance))} over budget` : `${fmt(variance)} remaining`}
            </span>
          </div>
        )}

        {/* Cost forecast — projects final cost from daily burn rate */}
        {job.start_date && job.end_date && job.status !== 'completed' && job.status !== 'cancelled' && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-slate-700">Cost Forecast</p>
            </div>
            <CostForecastWidget job={job} />
          </div>
        )}
      </div>
    </div>
  );
}