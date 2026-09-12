import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Receipt, Plus, Trash2, Loader2, Save, Edit3, X, Check, AlertTriangle,
  Fuel, Coffee, Package, Car, Wrench, PoundSterling, FileText,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
  { key: 'fuel', label: 'Fuel', icon: Fuel, color: 'amber' },
  { key: 'subsistence', label: 'Subsistence', icon: Coffee, color: 'emerald' },
  { key: 'materials', label: 'Materials', icon: Package, color: 'blue' },
  { key: 'equipment_hire', label: 'Equipment Hire', icon: Wrench, color: 'violet' },
  { key: 'tolls_parking', label: 'Tolls & Parking', icon: Car, color: 'rose' },
  { key: 'travel', label: 'Travel', icon: Car, color: 'cyan' },
  { key: 'misc', label: 'Other', icon: Receipt, color: 'slate' },
];

const ICON_OPTIONS = ['Fuel', 'Coffee', 'Package', 'Car', 'Wrench', 'Receipt', 'FileText', 'PoundSterling'];
const COLOR_OPTIONS = ['amber', 'emerald', 'blue', 'violet', 'rose', 'cyan', 'slate'];

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

/**
 * ExpensePresetManager — admin CRUD for mobile quick-add expense presets.
 * Lives in Settings → Financial Control Hub. Lets admins define the quick-add
 * buttons crews see on the EndOfShift expense step (label, category, default
 * amount, VAT rate, GL code, icon, color).
 */
export default function ExpensePresetManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['expense-presets', 'all'],
    queryFn: () => base44.entities.ExpensePreset.list('sort_order', 100),
  });

  const startNew = () => {
    setEditing({
      label: '', category: 'misc', default_amount: 0, default_vat_rate: 20,
      description: '', icon: 'Receipt', color: 'slate', gl_code: '', sort_order: 0, is_active: true,
    });
    setShowForm(true);
  };

  const startEdit = (p) => { setEditing({ ...p }); setShowForm(true); };

  const save = async () => {
    if (!editing.label?.trim()) return;
    try {
      if (editing.id) {
        await base44.entities.ExpensePreset.update(editing.id, editing);
      } else {
        await base44.entities.ExpensePreset.create(editing);
      }
      queryClient.invalidateQueries({ queryKey: ['expense-presets'] });
      setShowForm(false);
      setEditing(null);
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this preset? It will no longer appear on the mobile expense step.')) return;
    try {
      await base44.entities.ExpensePreset.delete(id);
      queryClient.invalidateQueries({ queryKey: ['expense-presets'] });
    } catch (e) { console.error(e); }
  };

  const toggleActive = async (p) => {
    try {
      await base44.entities.ExpensePreset.update(p.id, { is_active: !p.is_active });
      queryClient.invalidateQueries({ queryKey: ['expense-presets'] });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Receipt}
        title="Expense Presets"
        description="Quick-add buttons shown to crews on the End-of-Shift expense step. Define the label, category, default amount, VAT rate and SAP Concur GL code for each preset."
        actions={<button onClick={startNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"><Plus className="w-4 h-4" /> Add Preset</button>}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : presets.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No expense presets yet</p>
          <p className="text-xs text-slate-400 mt-1">Add quick-add buttons so crews can log fuel, subsistence and materials in one tap.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map(p => {
            const cat = CATEGORIES.find(c => c.key === p.category) || CATEGORIES.find(c => c.key === 'misc');
            const Icon = cat.icon;
            return (
              <div key={p.id} className={`bg-white border rounded-xl p-3.5 ${p.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${cat.color}-100 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 text-${cat.color}-600`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{p.label}</p>
                      {!p.is_active && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-semibold">Hidden</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{p.description || cat.label}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.default_amount > 0 && <span className="text-[11px] font-semibold text-slate-700 tabular-nums">{fmt(p.default_amount)}</span>}
                      <span className="text-[10px] text-slate-400">{p.default_vat_rate || 0}% VAT</span>
                      {p.gl_code && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">GL: {p.gl_code}</span>}
                      <span className="text-[10px] text-slate-400">Order {p.sort_order || 0}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(p)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title={p.is_active ? 'Hide' : 'Show'}>
                      {p.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => remove(p.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / create form modal */}
      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-slate-900">{editing.id ? 'Edit Preset' : 'New Expense Preset'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Button Label *</label>
                <input type="text" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Fuel, Subsistence" className={inputCls} autoFocus />
                <p className="text-[11px] text-slate-400 mt-1">Shown on the quick-add button crews tap.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category *</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    return (
                      <button key={c.key} type="button" onClick={() => setEditing({ ...editing, category: c.key })}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${editing.category === c.key ? `bg-${c.color}-50 border-${c.color}-400` : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <Icon className={`w-4 h-4 ${editing.category === c.key ? `text-${c.color}-600` : 'text-slate-400'}`} />
                        <span className="text-[10px] font-medium text-slate-600 text-center">{c.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description (default text)</label>
                <input type="text" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="Auto-filled when crew taps this preset" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default Amount (£)</label>
                  <input type="number" min="0" step="0.01" value={editing.default_amount || ''} onChange={e => setEditing({ ...editing, default_amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" className={inputCls} />
                  <p className="text-[11px] text-slate-400 mt-1">0 = crew enters manually</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Default VAT %</label>
                  <input type="number" min="0" max="100" step="0.1" value={editing.default_vat_rate} onChange={e => setEditing({ ...editing, default_vat_rate: parseFloat(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SAP Concur GL Code</label>
                <input type="text" value={editing.gl_code || ''} onChange={e => setEditing({ ...editing, gl_code: e.target.value })} placeholder="e.g. 4000-FUEL" className={`${inputCls} font-mono`} />
                <p className="text-[11px] text-slate-400 mt-1">Auto-assigned to costs logged from this preset for SAP sync.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ICON_OPTIONS.map(name => {
                      const map = { Fuel, Coffee, Package, Car, Wrench, Receipt, FileText, PoundSterling };
                      const Icon = map[name];
                      return (
                        <button key={name} type="button" onClick={() => setEditing({ ...editing, icon: name })}
                          className={`p-2 rounded-lg border flex items-center justify-center transition ${editing.icon === name ? 'bg-primary/10 border-primary' : 'bg-white border-slate-200'}`}>
                          <Icon className={`w-4 h-4 ${editing.icon === name ? 'text-primary' : 'text-slate-400'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Color</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })}
                        className={`p-2 rounded-lg border-2 transition ${editing.color === c ? `bg-${c}-100 border-${c}-400` : 'bg-white border-slate-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-${c}-500`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                  <input type="number" min="0" value={editing.sort_order || 0} onChange={e => setEditing({ ...editing, sort_order: parseFloat(e.target.value) || 0 })} className={inputCls} />
                  <p className="text-[11px] text-slate-400 mt-1">Lower = first in the grid</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Active</label>
                  <button type="button" onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition ${editing.is_active ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {editing.is_active ? 'Visible to crews' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium">Cancel</button>
              <button onClick={save} disabled={!editing.label?.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
                <Save className="w-4 h-4" /> {editing.id ? 'Update' : 'Create'} Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}