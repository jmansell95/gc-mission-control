import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scale, Save, Loader2, Clock, Route, Percent, Coffee, Hourglass } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = {
  required_daily_on_site_minutes: 540,
  travel_deductible_minutes: 90,
  default_vat_rate: 20,
  default_break_minutes: 60,
  post_leave_site_window_hours: 5,
};

const fmtHM = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
};

function RuleCard({ icon: Icon, iconBg, iconColor, title, description, value, onChange, suffix, display, hint }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input type="number" min={0} step={1} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-primary" />
        <span className="text-sm text-slate-500">{suffix}</span>
        <span className="ml-auto text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">{display}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">{hint}</p>
    </div>
  );
}

export default function BusinessConfigManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery({
    queryKey: ['business-config'],
    queryFn: async () => {
      const list = await base44.entities.BusinessConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  const [vals, setVals] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);

  useEffect(() => {
    if (config) {
      setConfigId(config.id || null);
      setVals({
        required_daily_on_site_minutes: Number(config.required_daily_on_site_minutes) || DEFAULTS.required_daily_on_site_minutes,
        travel_deductible_minutes: Number(config.travel_deductible_minutes) || DEFAULTS.travel_deductible_minutes,
        default_vat_rate: Number(config.default_vat_rate) || DEFAULTS.default_vat_rate,
        default_break_minutes: Number(config.default_break_minutes) || DEFAULTS.default_break_minutes,
        post_leave_site_window_hours: Number(config.post_leave_site_window_hours) || DEFAULTS.post_leave_site_window_hours,
      });
    }
  }, [config]);

  const set = (key) => (v) => setVals((p) => ({ ...p, [key]: v }));

  const dirty = Object.keys(DEFAULTS).some(
    (k) => Number(vals[k]) !== (Number(config?.[k]) || DEFAULTS[k])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'global', ...vals };
      if (configId) {
        await base44.entities.BusinessConfig.update(configId, payload);
      } else {
        const created = await base44.entities.BusinessConfig.create(payload);
        setConfigId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ['business-config'] });
      toast({ title: 'Business rules saved', description: 'The timesheet engine & invoices will use the new values.' });
    } catch (e) {
      toast({ title: 'Could not save', description: e.message || 'Please try again', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Scale}
        title="Business Rules"
        description="Core working rules that drive the timesheet, payroll & invoicing engine"
        actions={
          <button onClick={handleSave} disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#245215] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save rules
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuleCard icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-600"
          title="Required daily on-site hours"
          description="Crew must log this much on-site work before an early-leave reason is required."
          value={vals.required_daily_on_site_minutes} onChange={set('required_daily_on_site_minutes')}
          suffix="minutes" display={fmtHM(vals.required_daily_on_site_minutes)}
          hint="Default 540 min (9h). Under this with no early-leave reason, submission is blocked." />

        <RuleCard icon={Route} iconBg="bg-violet-50" iconColor="text-violet-600"
          title="Travel deductible per leg"
          description="Travel time deducted from each leg (to-site & from-site) before it becomes payable."
          value={vals.travel_deductible_minutes} onChange={set('travel_deductible_minutes')}
          suffix="minutes" display={fmtHM(vals.travel_deductible_minutes)}
          hint="Default 90 min (1.5h) per leg. Depot teams are exempt — they get full travel paid." />

        <RuleCard icon={Percent} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          title="Default VAT rate"
          description="VAT % used when a job has no explicit rate set. Applied to invoice generation."
          value={vals.default_vat_rate} onChange={set('default_vat_rate')}
          suffix="%" display={`${vals.default_vat_rate}%`}
          hint="Default 20% (UK standard). Each job can still override this individually." />

        <RuleCard icon={Coffee} iconBg="bg-amber-50" iconColor="text-amber-600"
          title="Daily break minutes"
          description="Lunch break duration required for a day to be 'complete' in the crew task log."
          value={vals.default_break_minutes} onChange={set('default_break_minutes')}
          suffix="minutes" display={fmtHM(vals.default_break_minutes)}
          hint="Default 60 min (1h). The day-completion check requires exactly this much break." />

        <RuleCard icon={Hourglass} iconBg="bg-slate-100" iconColor="text-slate-600"
          title="Post-leave-site window"
          description="Hours a job stays open after a crew member leaves site, so they can submit from home."
          value={vals.post_leave_site_window_hours} onChange={set('post_leave_site_window_hours')}
          suffix="hours" display={`${vals.post_leave_site_window_hours}h`}
          hint="Default 5 hours. Crew get this long to enter travel-home time & submit their timesheet." />
      </div>

      <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-primary">How this works:</span> these rules are read live by the timesheet engine every time a crew member submits their daily summary, and by the invoice generator when raising invoices. Change a value here and it applies immediately — no code changes needed. Existing approved/merged timesheets are not recalculated.
        </p>
      </div>
    </div>
  );
}