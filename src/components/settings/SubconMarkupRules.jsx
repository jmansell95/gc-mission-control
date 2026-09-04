import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, Save, Loader2, Check, AlertTriangle, Shield, Percent,
  HardHat, Wrench, Truck, Package, Users, Lock,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const WORK_TYPES = [
  { key: 'drilling', label: 'Drilling', icon: Wrench, desc: 'CP / rotary drilling subcontractors' },
  { key: 'coring', label: 'Coring', icon: Wrench, desc: 'Rotary core subcontractors' },
  { key: 'groundworks', label: 'Groundworks', icon: Truck, desc: 'Trial pits, excavation, enabling works' },
  { key: 'equipment_hire', label: 'Equipment Hire', icon: Package, desc: 'Hired plant & equipment' },
  { key: 'supervision', label: 'Supervision', icon: Users, desc: 'Sub-con supervision / management' },
  { key: 'other', label: 'All Other Work', icon: HardHat, desc: 'Default for any uncategorised sub-con work' },
];

const DEFAULT_RULES = {
  global_default_markup: 15,
  minimum_markup: 5,
  zero_margin_blocked: true,
  per_work_type: {
    drilling: 15, coring: 15, groundworks: 20, equipment_hire: 10, supervision: 25, other: 15,
  },
};

const SETTING_KEY = 'subcon_markup_rules';

/**
 * SubconMarkupRules — default markup % for subcontractor costs.
 * Sets guardrails: minimum markup to prevent zero-margin billing.
 * Per-contractor overrides are set on the Contractor entity; per-job
 * overrides are on the JobBillingContract. This is the system default.
 *
 * Admin-only: these financial guardrails are locked to admin role (enforced
 * by RLS on the AppSetting entity). A lock badge is shown so managers know
 * why non-admins can't see this page.
 */
export default function SubconMarkupRules() {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing rules from AppSetting on mount
  const { data: existing } = useQuery({
    queryKey: ['app-setting', SETTING_KEY],
    queryFn: async () => {
      const list = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
      return list[0] || null;
    },
  });

  useEffect(() => {
    if (existing?.value) {
      setRules({ ...DEFAULT_RULES, ...existing.value });
    }
  }, [existing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (existing?.id) {
        await base44.entities.AppSetting.update(existing.id, { value: rules });
      } else {
        await base44.entities.AppSetting.create({ key: SETTING_KEY, label: 'Subcon Markup Rules', value: rules });
      }
      queryClient.invalidateQueries({ queryKey: ['app-setting', SETTING_KEY] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save markup rules:', e);
      alert('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={TrendingUp}
        title="Subcontractor Markup Rules"
        description="Default markup percentages applied to subcontractor costs when billing clients. Guardrails prevent zero-margin billing — individual jobs and contractors can override these defaults."
        actions={<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide"><Lock className="w-3 h-3" /> Admin Only</span>}
      />

      {/* Global defaults */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Global Defaults</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Markup %</label>
            <input type="number" min="0" step="0.1" value={rules.global_default_markup}
              onChange={e => setRules({ ...rules, global_default_markup: parseFloat(e.target.value) || 0 })} className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">Applied when no per-work-type or per-contractor override exists</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Minimum Markup % (Guardrail)</label>
            <input type="number" min="0" step="0.1" value={rules.minimum_markup}
              onChange={e => setRules({ ...rules, minimum_markup: parseFloat(e.target.value) || 0 })} className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">System warns or blocks if a sub-con log is priced below this</p>
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
          <input type="checkbox" checked={rules.zero_margin_blocked} onChange={e => setRules({ ...rules, zero_margin_blocked: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Block zero-margin billing</p>
            <p className="text-[11px] text-slate-500">Prevents saving a subcontractor log with 0% markup — forces a positive margin</p>
          </div>
        </label>
      </div>

      {/* Per work-type overrides */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <HardHat className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Per Work-Type Overrides</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORK_TYPES.map(w => {
            const Icon = w.icon;
            return (
              <div key={w.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">{w.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{w.desc}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="number" min="0" step="0.5" value={rules.per_work_type[w.key] ?? rules.global_default_markup}
                    onChange={e => setRules({ ...rules, per_work_type: { ...rules.per_work_type, [w.key]: parseFloat(e.target.value) || 0 } })}
                    className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-center focus:outline-none focus:border-[#2E5A1A]" />
                  <span className="text-sm text-slate-400 font-medium">%</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <p className="text-[11px] text-blue-700">Priority: Per-job contract → Per-contractor override → Per-work-type (here) → Global default. The first match wins.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Rules
          </button>
          {saved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>
    </div>
  );
}