import React, { useState, useEffect } from 'react';
import { useExpenseDefaults, useSaveExpenseDefaults } from '@/hooks/useExpenseDefaults';
import {
  Receipt, Fuel, Coffee, Package, Wrench, Car, Save, Loader2,
  CheckCircle2, PoundSterling, Info, AlertCircle,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const CATEGORIES = [
  { key: 'subsistence', label: 'Subsistence', icon: Coffee, unit: 'day', desc: 'Daily meal / subsistence allowance' },
  { key: 'fuel', label: 'Fuel / Mileage', icon: Fuel, unit: 'mile', desc: 'Per-mile fuel reimbursement rate' },
  { key: 'materials', label: 'Materials', icon: Package, unit: 'each', desc: 'Default material cost (if not itemised)' },
  { key: 'equipment_hire', label: 'Equipment Hire', icon: Wrench, unit: 'day', desc: 'Default daily hire rate' },
  { key: 'tolls_parking', label: 'Tolls & Parking', icon: Car, unit: 'each', desc: 'Default toll / parking cost' },
  { key: 'travel', label: 'Travel', icon: Car, unit: 'mile', desc: 'Per-mile travel reimbursement' },
  { key: 'misc', label: 'Other', icon: Receipt, unit: 'each', desc: 'Catch-all for miscellaneous expenses' },
];

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ExpenseDefaultsManager — admin settings page for global expense category
 * defaults. Sets company-wide default amounts and VAT rates per expense
 * category. These defaults pre-fill every staff expense entry across the app.
 */
export default function ExpenseDefaultsManager() {
  const { data: defaults = {}, isLoading } = useExpenseDefaults();
  const saveDefaults = useSaveExpenseDefaults();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const init = {};
      for (const cat of CATEGORIES) {
        const d = defaults[cat.key] || {};
        init[cat.key] = {
          default_amount: d.default_amount != null ? String(d.default_amount) : '',
          vat_rate: d.vat_rate != null ? String(d.vat_rate) : '20',
          unit: d.unit || cat.unit,
          description: d.description || '',
        };
      }
      setForm(init);
    }
  }, [defaults, isLoading]);

  const dirty = (() => {
    if (isLoading || !form[CATEGORIES[0].key]) return false;
    for (const cat of CATEGORIES) {
      const d = defaults[cat.key] || {};
      const f = form[cat.key];
      if ((f.default_amount || '') !== (d.default_amount != null ? String(d.default_amount) : '')) return true;
      if ((f.vat_rate || '') !== (d.vat_rate != null ? String(d.vat_rate) : '20')) return true;
      if ((f.description || '') !== (d.description || '')) return true;
    }
    return false;
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = {};
      for (const cat of CATEGORIES) {
        const f = form[cat.key];
        value[cat.key] = {
          default_amount: parseFloat(f.default_amount) || 0,
          vat_rate: parseFloat(f.vat_rate) || 0,
          unit: f.unit || cat.unit,
          description: f.description || '',
        };
      }
      await saveDefaults(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Save expense defaults failed:', e);
    }
    setSaving(false);
  };

  const updateField = (catKey, field, val) => {
    setForm(prev => ({
      ...prev,
      [catKey]: { ...prev[catKey], [field]: val },
    }));
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Receipt}
        title="Expense Category Defaults"
        description="Set company-wide default amounts and VAT rates for each expense category. These pre-fill every staff expense entry — staff only adjust when their actual spend differs."
      />

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-900">How defaults work</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            When a crew member logs an expense, the amount and VAT rate for the selected category come pre-filled from these defaults. A "Default applied" tag shows next to pre-filled values so staff know to check and override if their actual spend was different. Changes apply to new entries going forward.
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const f = form[cat.key] || { default_amount: '', vat_rate: '20', description: '' };
          return (
            <div key={cat.key} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{cat.label}</p>
                  <p className="text-xs text-slate-400 truncate">{cat.desc}</p>
                </div>
                <span className="ml-auto text-[10px] font-semibold text-slate-400 uppercase">per {f.unit || cat.unit}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1">
                    <PoundSterling className="w-3 h-3 text-emerald-600" /> Default amount
                  </label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={f.default_amount}
                      onChange={e => updateField(cat.key, 'default_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">VAT rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={f.vat_rate}
                    onChange={e => updateField(cat.key, 'vat_rate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <input
                type="text"
                value={f.description}
                onChange={e => updateField(cat.key, 'description', e.target.value)}
                placeholder="Optional description (shown to staff)"
                className="w-full mt-2.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:border-primary/40"
              />
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-lg px-4 py-3">
        <div className="flex-1 min-w-0">
          {saved ? (
            <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Defaults saved — new expense entries will use these values.
            </p>
          ) : dirty ? (
            <p className="text-sm text-amber-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> You have unsaved changes.
            </p>
          ) : (
            <p className="text-sm text-slate-400">Changes apply to new expense entries going forward.</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 active:scale-95 transition disabled:opacity-50 touch-manipulation"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}