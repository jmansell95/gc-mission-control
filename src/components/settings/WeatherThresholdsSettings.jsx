import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Thermometer, Wind, Droplets, Zap, Save, Loader2, Check, RefreshCw,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = {
  temp_min: 2,
  temp_max: 30,
  wind_max_mph: 38,
  rain_max_mm: 10,
  lightning_block: true,
};

/**
 * WeatherThresholdsSettings — company-wide default "okay to work" thresholds.
 * Stored in the AppSetting entity under key 'weather_thresholds'. Every job
 * uses these unless a per-job override is set on the job itself.
 */
export default function WeatherThresholdsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  const { data: rec } = useQuery({
    queryKey: ['weather-thresholds'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'weather_thresholds' }, '-created_date', 1),
  });

  useEffect(() => {
    if (rec?.[0]?.value) setForm({ ...DEFAULTS, ...rec[0].value });
  }, [rec]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = rec?.[0];
      const value = {
        temp_min: form.temp_min !== '' ? Number(form.temp_min) : null,
        temp_max: form.temp_max !== '' ? Number(form.temp_max) : null,
        wind_max_mph: form.wind_max_mph !== '' ? Number(form.wind_max_mph) : null,
        rain_max_mm: form.rain_max_mm !== '' ? Number(form.rain_max_mm) : null,
        lightning_block: !!form.lightning_block,
      };
      if (existing) {
        await base44.entities.AppSetting.update(existing.id, { value });
      } else {
        await base44.entities.AppSetting.create({ key: 'weather_thresholds', label: 'Weather Work-Safe Thresholds', value });
      }
      queryClient.invalidateQueries({ queryKey: ['weather-thresholds'] });
      toast({ title: 'Thresholds saved', description: 'These defaults now apply to every job.', duration: 2000 });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive', duration: 3000 });
    }
    setSaving(false);
  };

  const num = (v) => v === '' || v == null ? '' : v;

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Thermometer}
        title="Work-Safe Weather Thresholds"
        description="Company-wide default limits. The job detail weather card shows 'Okay to work' when conditions are within these limits, and 'Do not work' when any is breached. Override per job on its detail page."
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        {/* Temperature */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ThresholdInput
            icon={Thermometer}
            label="Min temperature (°C)"
            description="Flag 'do not work' if the live temperature drops below this."
            value={num(form.temp_min)}
            onChange={(v) => setForm(p => ({ ...p, temp_min: v }))}
            suffix="°C"
          />
          <ThresholdInput
            icon={Thermometer}
            label="Max temperature (°C)"
            description="Flag 'do not work' if the live temperature exceeds this."
            value={num(form.temp_max)}
            onChange={(v) => setForm(p => ({ ...p, temp_max: v }))}
            suffix="°C"
          />
        </div>

        {/* Wind */}
        <ThresholdInput
          icon={Wind}
          label="Max wind gusts (mph)"
          description="Flag 'do not work' if wind gusts exceed this speed."
          value={num(form.wind_max_mph)}
          onChange={(v) => setForm(p => ({ ...p, wind_max_mph: v }))}
          suffix="mph"
        />

        {/* Rain */}
        <ThresholdInput
          icon={Droplets}
          label="Max rainfall (mm)"
          description="Flag 'do not work' if precipitation exceeds this."
          value={num(form.rain_max_mm)}
          onChange={(v) => setForm(p => ({ ...p, rain_max_mm: v }))}
          suffix="mm"
        />

        {/* Lightning */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">Block work in thunderstorms</p>
              <p className="text-xs text-slate-500">Flag 'do not work' when any thunderstorm is detected (lightning risk).</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, lightning_block: !p.lightning_block }))}
            className={`relative w-12 h-6 rounded-full transition flex-shrink-0 ${form.lightning_block ? 'bg-primary' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.lightning_block ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">Leave a field blank to skip that check. Overrides on individual jobs take precedence.</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function ThresholdInput({ icon: Icon, label, description, value, onChange, suffix }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-sm font-bold text-slate-800">{label}</p>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="—"
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold tabular-nums focus:outline-none focus:border-primary"
        />
        {suffix && <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}