import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileSpreadsheet, Plus, Trash2, Save, Loader2, Edit3, X, Check,
  Fuel, Coffee, Package, Car, Wrench, Receipt,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const CATEGORIES = [
  { key: 'fuel', label: 'Fuel', icon: Fuel, color: 'amber' },
  { key: 'subsistence', label: 'Subsistence', icon: Coffee, color: 'emerald' },
  { key: 'materials', label: 'Materials', icon: Package, color: 'blue' },
  { key: 'equipment_hire', label: 'Equipment Hire', icon: Wrench, color: 'violet' },
  { key: 'tolls_parking', label: 'Tolls & Parking', icon: Car, color: 'rose' },
  { key: 'travel', label: 'Travel', icon: Car, color: 'cyan' },
  { key: 'misc', label: 'Other', icon: Receipt, color: 'slate' },
];

/**
 * GLCodeMapping — maps internal expense categories to SAP Concur GL codes.
 * Stored in AppSetting under key 'gl_code_mapping'. Used by the Concur
 * sync export to assign the correct GL code per cost record.
 */
export default function GLCodeMapping() {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing mappings from AppSetting
  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['app-settings', 'gl_code_mapping'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'gl_code_mapping' }),
  });

  React.useEffect(() => {
    if (existing.length > 0 && existing[0].value) {
      try { setMappings(typeof existing[0].value === 'string' ? JSON.parse(existing[0].value) : existing[0].value); } catch (_) {}
    }
  }, [existing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, { value: mappings });
      } else {
        await base44.entities.AppSetting.create({ key: 'gl_code_mapping', value: mappings, label: 'SAP Concur GL Code Mapping' });
      }
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'gl_code_mapping'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const setGLCode = (cat, code) => setMappings({ ...mappings, [cat]: code });

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={FileSpreadsheet}
        title="GL Code Mapping"
        description="Map each internal expense category to a SAP Concur General Ledger code. These codes are auto-assigned to cost records during the Concur batch export."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <div className="col-span-5">Category</div>
            <div className="col-span-5">SAP Concur GL Code</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            const code = mappings[c.key] || '';
            return (
              <div key={c.key} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-50 items-center">
                <div className="col-span-5 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg bg-${c.color}-100 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 text-${c.color}-600`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{c.label}</p>
                    <p className="text-[11px] text-slate-400">Internal category</p>
                  </div>
                </div>
                <div className="col-span-5">
                  <input type="text" value={code} onChange={e => setGLCode(c.key, e.target.value)}
                    placeholder="e.g. 4000-FUEL"
                    className={`${inputCls} font-mono`} />
                </div>
                <div className="col-span-2 text-right">
                  {code ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> Mapped</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><X className="w-3.5 h-3.5" /> Unmapped</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Mapping
        </button>
        {saved && <span className="text-sm text-primary font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  );
}