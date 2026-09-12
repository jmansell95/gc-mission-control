import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Save, Loader2, RotateCcw, Palette, DollarSign, HardHat, Cloud,
  MapPin, LogIn, Settings as SettingsIcon, Check, AlertCircle,
} from 'lucide-react';
import { ENTERPRISE_SETTING_FIELDS, SETTING_CATEGORIES } from '@/lib/enterpriseSettingsConfig';

const CATEGORY_META = {
  'Branding': { icon: Palette, color: 'text-rose-600 bg-rose-50' },
  'Financial': { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  'Field Operations': { icon: HardHat, color: 'text-amber-600 bg-amber-50' },
  'Weather': { icon: Cloud, color: 'text-blue-600 bg-blue-50' },
  'Geofence': { icon: MapPin, color: 'text-violet-600 bg-violet-50' },
  'Login': { icon: LogIn, color: 'text-cyan-600 bg-cyan-50' },
  'System': { icon: SettingsIcon, color: 'text-slate-600 bg-slate-100' },
};

export default function GlobalSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load the EnterpriseSetting singleton
  const { data: settings, isLoading } = useQuery({
    queryKey: ['enterprise-settings-global'],
    queryFn: async () => {
      const list = await base44.entities.EnterpriseSetting.filter({ key: 'global' });
      if (list.length > 0) return list[0];
      // Create the singleton if it doesn't exist
      const created = await base44.entities.EnterpriseSetting.create({ key: 'global' });
      return created;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (settings) {
      setForm({ ...settings });
      setHasChanges(false);
    }
  }, [settings]);

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setHasChanges(true);
  };

  const save = async () => {
    if (!form?.id) return;
    setSaving(true);
    try {
      const updateData = { ...form };
      delete updateData.id;
      delete updateData.created_date;
      delete updateData.updated_date;
      delete updateData.created_by_id;
      await base44.entities.EnterpriseSetting.update(form.id, updateData);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['enterprise-settings-global'] });
      toast({ title: 'Enterprise settings saved', description: 'Defaults updated for all streams.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (settings) {
      setForm({ ...settings });
      setHasChanges(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const fieldsByCategory = SETTING_CATEGORIES.map(cat => ({
    category: cat,
    fields: ENTERPRISE_SETTING_FIELDS.filter(f => f.category === cat),
  })).filter(g => g.fields.length > 0);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="hub-glass rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Global Enterprise Settings</h3>
            <p className="text-xs text-slate-500">Defaults applied to every business unit and stream. Streams can override individual settings.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={reset} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !hasChanges}
            className="px-4 py-2 rounded-lg command-gradient text-white text-xs font-bold shadow-md disabled:opacity-50 transition flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Defaults
          </button>
        </div>
      </div>

      {/* Settings by category */}
      {fieldsByCategory.map(group => {
        const CatIcon = CATEGORY_META[group.category]?.icon || SettingsIcon;
        const catColor = CATEGORY_META[group.category]?.color || 'text-slate-600 bg-slate-100';
        return (
          <div key={group.category} className="hub-glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${catColor}`}>
                <CatIcon className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">{group.category}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.fields.map(field => (
                <SettingField key={field.key} field={field} value={form[field.key]} onChange={v => update(field.key, v)} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Info banner */}
      <div className="hub-glass rounded-xl p-3 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          These settings are the <span className="font-semibold text-slate-700">enterprise-wide defaults</span>. Every business stream inherits them
          automatically. Stream managers can override individual settings from their stream's Settings page — overridden values
          take precedence for that stream's users only.
        </p>
      </div>
    </div>
  );
}

function SettingField({ field, value, onChange }) {
  const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm';
  const labelCls = 'text-xs font-bold text-slate-500';

  return (
    <div>
      <label className={labelCls}>{field.label}</label>
      <p className="text-[10px] text-slate-400 mt-0.5">{field.description}</p>
      {field.type === 'boolean' ? (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="mt-1.5 flex items-center gap-2.5 w-full p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 transition text-left"
        >
          <span className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${value ? 'bg-primary' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition ${value ? 'translate-x-5' : ''}`} />
          </span>
          <span className="text-sm font-semibold text-slate-700">{value ? 'Enabled' : 'Disabled'}</span>
        </button>
      ) : field.type === 'color' ? (
        <div className="mt-1 flex items-center gap-2">
          <input type="color" value={value || '#2E5A1A'} onChange={e => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
          <input value={value || ''} onChange={e => onChange(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
        </div>
      ) : field.type === 'number' ? (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  );
}