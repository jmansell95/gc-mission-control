import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Receipt, Plus, Trash2, Camera, Loader2, CheckCircle2, Fuel, Coffee,
  Package, Car, Wrench, PoundSterling, FileText, X, ChevronRight, AlertCircle, Sparkles,
} from 'lucide-react';
import { useExpenseDefaults } from '@/hooks/useExpenseDefaults';
import ConcurReminderBanner from './ConcurReminderBanner';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_META = {
  fuel: { label: 'Fuel', icon: Fuel, color: 'amber', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', chip: 'bg-amber-100 text-amber-700' },
  subsistence: { label: 'Subsistence', icon: Coffee, color: 'emerald', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
  materials: { label: 'Materials', icon: Package, color: 'blue', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700' },
  equipment_hire: { label: 'Equipment Hire', icon: Wrench, color: 'violet', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', chip: 'bg-violet-100 text-violet-700' },
  tolls_parking: { label: 'Tolls & Parking', icon: Car, color: 'rose', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-700' },
  travel: { label: 'Travel', icon: Car, color: 'cyan', bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', chip: 'bg-cyan-100 text-cyan-700' },
  misc: { label: 'Other', icon: Receipt, color: 'slate', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', chip: 'bg-slate-100 text-slate-700' },
};

const getIcon = (name) => {
  const map = { Fuel, Coffee, Package, Car, Wrench, Receipt, FileText, PoundSterling };
  return map[name] || Receipt;
};

/**
 * DailyExpenseStep — the mobile-first expense logging step.
 * Renders inside the EndOfShiftWizard between "Notes" and "Travel Home".
 * Crews tap quick-add presets or log a custom expense, capture a receipt
 * photo, and submit. Expenses are saved as DailyCost records.
 */
export default function DailyExpenseStep({ job, staffId, assignment, expenses, setExpenses }) {
  const queryClient = useQueryClient();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customForm, setCustomForm] = useState({
    category: 'misc',
    description: '',
    amount_net: '',
    vat_rate: 20,
    supplier_name: '',
  });

  // Load admin-configured quick-add presets
  const { data: presets = [] } = useQuery({
    queryKey: ['expense-presets', 'active'],
    queryFn: () => base44.entities.ExpensePreset.filter({ is_active: true }, 'sort_order', 50),
  });

  // Load global expense category defaults (pre-fill custom form)
  const { data: expenseDefaults = {} } = useExpenseDefaults();

  const totalNet = expenses.reduce((s, e) => s + (Number(e.amount_net) || 0), 0);
  const totalVat = expenses.reduce((s, e) => s + (Number(e.amount_vat) || 0), 0);
  const totalGross = totalNet + totalVat;

  const addPreset = (preset) => {
    const amount = Number(preset.default_amount) || 0;
    const vatRate = Number(preset.default_vat_rate) || 0;
    const vat = Math.round(amount * (vatRate / 100) * 100) / 100;
    setExpenses([...expenses, {
      _temp_id: Date.now() + Math.random(),
      category: preset.category,
      description: preset.description || preset.label,
      amount_net: amount,
      vat_rate: vatRate,
      amount_vat: vat,
      amount_gross: Math.round((amount + vat) * 100) / 100,
      preset_id: preset.id,
      gl_code: preset.gl_code || '',
      receipt_url: '',
      supplier_name: '',
    }]);
  };

  const removeExpense = (tempId) => {
    setExpenses(expenses.filter(e => e._temp_id !== tempId));
  };

  const handleReceiptUpload = async (tempId, file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setExpenses(expenses.map(e => e._temp_id === tempId ? { ...e, receipt_url: file_url } : e));
      queryClient.invalidateQueries({ queryKey: ['daily-costs'] });
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  const submitCustom = () => {
    if (!customForm.amount_net || parseFloat(customForm.amount_net) <= 0) return;
    const amount = parseFloat(customForm.amount_net);
    const vatRate = parseFloat(customForm.vat_rate) || 0;
    const vat = Math.round(amount * (vatRate / 100) * 100) / 100;
    setExpenses([...expenses, {
      _temp_id: Date.now() + Math.random(),
      category: customForm.category,
      description: customForm.description || CATEGORY_META[customForm.category]?.label || 'Expense',
      amount_net: Math.round(amount * 100) / 100,
      vat_rate: vatRate,
      amount_vat: vat,
      amount_gross: Math.round((amount + vat) * 100) / 100,
      receipt_url: '',
      supplier_name: customForm.supplier_name || '',
    }]);
    setCustomForm({ category: 'misc', description: '', amount_net: '', vat_rate: 20, supplier_name: '' });
    setShowCustomForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
        <Receipt className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-blue-900">Log any expenses from today</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">Fuel, subsistence, materials — tap a quick-add or enter a custom cost. Receipts can be photographed.</p>
        </div>
      </div>

      {/* SAP Concur reminder */}
      <ConcurReminderBanner compact />

      {/* Quick-add presets */}
      {presets.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Add</p>
          <div className="grid grid-cols-3 gap-2">
            {presets.map(p => {
              const Icon = getIcon(p.icon);
              const meta = CATEGORY_META[p.category] || CATEGORY_META.misc;
              return (
                <button key={p.id} type="button" onClick={() => addPreset(p)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition active:scale-95 ${meta.bg} hover:border-${meta.color}-400`}>
                  <Icon className={`w-5 h-5 ${meta.text}`} />
                  <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{p.label}</span>
                  {p.default_amount > 0 && <span className="text-[10px] text-slate-500 tabular-nums">{fmt(p.default_amount)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom expense form */}
      {showCustomForm ? (
        <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Custom Expense</p>
            <button type="button" onClick={() => setShowCustomForm(false)} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(CATEGORY_META).map(([key, m]) => {
                const dflt = expenseDefaults[key];
                const hasDefault = dflt && dflt.default_amount != null && dflt.default_amount > 0;
                return (
                  <button key={key} type="button"
                    onClick={() => {
                      const d = expenseDefaults[key];
                      setCustomForm({
                        ...customForm,
                        category: key,
                        amount_net: d && d.default_amount != null ? String(d.default_amount) : customForm.amount_net,
                        vat_rate: d && d.vat_rate != null ? String(d.vat_rate) : customForm.vat_rate,
                        description: d?.description || customForm.description || m.label,
                      });
                    }}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition relative ${customForm.category === key ? `${m.bg} border-2` : 'bg-white border-slate-200 text-slate-500'}`}>
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label.split(' ')[0]}
                    {hasDefault && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center" title="Has default value">
                        <Sparkles className="w-2 h-2 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input type="text" value={customForm.description} onChange={e => setCustomForm({ ...customForm, description: e.target.value })}
              placeholder="What was it for?" autoFocus
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                Amount (£)
                {(() => {
                  const d = expenseDefaults[customForm.category];
                  if (d && d.default_amount != null && d.default_amount > 0 && parseFloat(customForm.amount_net) === d.default_amount) {
                    return (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        <Sparkles className="w-2.5 h-2.5" /> Default applied
                      </span>
                    );
                  }
                  return null;
                })()}
              </label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" min="0" step="0.01" value={customForm.amount_net} onChange={e => setCustomForm({ ...customForm, amount_net: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VAT %</label>
              <input type="number" min="0" max="100" step="0.1" value={customForm.vat_rate} onChange={e => setCustomForm({ ...customForm, vat_rate: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supplier (optional)</label>
            <input type="text" value={customForm.supplier_name} onChange={e => setCustomForm({ ...customForm, supplier_name: e.target.value })}
              placeholder="Where you bought it"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </div>
          <button type="button" onClick={submitCustom} disabled={!customForm.amount_net || parseFloat(customForm.amount_net) <= 0}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowCustomForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition">
          <Plus className="w-4 h-4" /> Add Custom Expense
        </button>
      )}

      {/* Logged expenses list */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Logged Today ({expenses.length})</p>
          {expenses.map((e) => {
            const meta = CATEGORY_META[e.category] || CATEGORY_META.misc;
            const Icon = meta.icon;
            const updateAmount = (val) => {
              const amount = parseFloat(val) || 0;
              const vatRate = Number(e.vat_rate) || 0;
              const vat = Math.round(amount * (vatRate / 100) * 100) / 100;
              setExpenses(expenses.map(x => x._temp_id === e._temp_id ? {
                ...x, amount_net: Math.round(amount * 100) / 100, amount_vat: vat, amount_gross: Math.round((amount + vat) * 100) / 100,
              } : x));
            };
            return (
              <div key={e._temp_id} className={`rounded-xl border p-3 ${meta.bg}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${meta.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{e.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${meta.chip}`}>{meta.label}</span>
                      {e.supplier_name && <span className="text-[10px] text-slate-500 truncate">{e.supplier_name}</span>}
                      {e.vat_rate > 0 && <span className="text-[10px] text-slate-400">VAT {e.vat_rate}%</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="relative">
                      <PoundSterling className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <input type="number" min="0" step="0.01" value={e.amount_net || ''} onChange={ev => updateAmount(ev.target.value)}
                        placeholder="0.00"
                        className="w-24 pl-7 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                    </div>
                    <button type="button" onClick={() => removeExpense(e._temp_id)} className="p-1 text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Receipt photo */}
                <div className="mt-2 flex items-center gap-2">
                  {e.receipt_url ? (
                    <div className="flex items-center gap-1.5">
                      <img src={e.receipt_url} alt="Receipt" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-[11px] text-emerald-700 font-medium">Receipt captured</span>
                    </div>
                  ) : (
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 cursor-pointer hover:text-emerald-600 transition">
                      <Camera className="w-3.5 h-3.5" />
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add receipt photo'}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(ev) => { const f = ev.target.files?.[0]; if (f) handleReceiptUpload(e._temp_id, f); ev.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-3 mt-1">
            <div>
              <span className="text-sm font-medium text-slate-600">Total expenses</span>
              <p className="text-[10px] text-slate-400">{expenses.length} item{expenses.length !== 1 ? 's' : ''} · VAT {fmt(totalVat)}</p>
            </div>
            <span className="text-lg font-bold text-slate-800 tabular-nums">{fmt(totalGross)}</span>
          </div>
        </div>
      )}

      {expenses.length === 0 && !showCustomForm && (
        <div className="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          No expenses logged today — tap a quick-add button above if you spent anything.
        </div>
      )}
    </div>
  );
}