import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Save, Loader2, Anchor, Wrench, Plug, CalendarClock } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = {
  default_loler_interval_months: 6,
  default_puwer_interval_months: 12,
  default_pat_interval_months: 12,
  expiring_warning_days: 30,
};

function RuleCard({ icon: Icon, iconBg, iconColor, title, description, value, onChange, suffix, hint }) {
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
        <input type="number" min={1} step={1} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-primary" />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">{hint}</p>
    </div>
  );
}

export default function ComplianceRulesSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery({
    queryKey: ['compliance-config'],
    queryFn: async () => {
      const list = await base44.entities.ComplianceConfig.filter({ key: 'global' });
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
        default_loler_interval_months: Number(config.default_loler_interval_months) || DEFAULTS.default_loler_interval_months,
        default_puwer_interval_months: Number(config.default_puwer_interval_months) || DEFAULTS.default_puwer_interval_months,
        default_pat_interval_months: Number(config.default_pat_interval_months) || DEFAULTS.default_pat_interval_months,
        expiring_warning_days: Number(config.expiring_warning_days) || DEFAULTS.expiring_warning_days,
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
        await base44.entities.ComplianceConfig.update(configId, payload);
      } else {
        const created = await base44.entities.ComplianceConfig.create(payload);
        setConfigId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ['compliance-config'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({ title: 'Compliance rules saved', description: 'Inspection intervals & expiry warnings updated.' });
    } catch (e) {
      toast({ title: 'Could not save', description: e.message || 'Please try again', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={ShieldCheck}
        title="Compliance Rules"
        description="Default inspection intervals & expiry warnings for LOLER, PUWER & PAT — drives the asset compliance engine"
        actions={
          <button onClick={handleSave} disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#245215] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save rules
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RuleCard icon={Anchor} iconBg="bg-teal-50" iconColor="text-teal-600"
          title="LOLER re-test interval"
          description="Default months between LOLER thorough examinations for lifting equipment & rigs."
          value={vals.default_loler_interval_months} onChange={set('default_loler_interval_months')}
          suffix="months"
          hint="UK statutory default 6 months for lifting equipment. The next LOLER due date auto-calculates from this when you log an inspection without a manual expiry." />

        <RuleCard icon={Wrench} iconBg="bg-purple-50" iconColor="text-purple-600"
          title="PUWER re-inspection interval"
          description="Default months between PUWER work-equipment inspections (machinery, trailers, vehicles)."
          value={vals.default_puwer_interval_months} onChange={set('default_puwer_interval_months')}
          suffix="months"
          hint="Typical 12 months. High-risk plant may need shorter — override per asset when logging." />

        <RuleCard icon={Plug} iconBg="bg-amber-50" iconColor="text-amber-600"
          title="PAT re-test interval"
          description="Default months between Portable Appliance Tests for portable electrical equipment (110V tools, transformers, leads)."
          value={vals.default_pat_interval_months} onChange={set('default_pat_interval_months')}
          suffix="months"
          hint="Construction sites often require 3 months; office equipment 12 months. Edit here for your default." />

        <RuleCard icon={CalendarClock} iconBg="bg-slate-100" iconColor="text-slate-600"
          title="Expiring warning window"
          description="Days before a compliance expiry date when an asset is flagged 'expiring soon'."
          value={vals.expiring_warning_days} onChange={set('expiring_warning_days')}
          suffix="days"
          hint="Default 30 days. Drives the amber 'expiring' tile and the compliance attention panel." />
      </div>

      <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-primary">How this works:</span> when you log a LOLER, PUWER or PAT inspection in an asset's Service History and don't enter a manual next-due date, the system auto-calculates the next expiry from these intervals. The warning window decides when assets turn amber before they go red. Change a value here and it applies immediately to every new record.
        </p>
      </div>
    </div>
  );
}