import React from 'react';
import { ExternalLink, Car, ShieldCheck, ClipboardCheck, FileText } from 'lucide-react';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';

/**
 * SafetyFormsList — renders the admin-configured safety/Mitti form URLs as
 * large tappable buttons at the matching Shift Wizard step.
 *
 * Props:
 *  - step: 'checks' | 'arrive' | 'briefing' — which wizard step we're on.
 *
 * Reads MittiConfig.safety_forms, filters by step, and renders each as a big
 * button that opens the form in a new tab. When the list is empty, renders
 * nothing (the fixed vehicle_check_url / powra_url / equipment_check_url
 * prompts elsewhere on the step still show).
 */
const CATEGORY_ICONS = {
  vehicle: Car,
  powra: ShieldCheck,
  equipment: ClipboardCheck,
  general: FileText,
};

const CATEGORY_ACCENTS = {
  vehicle: { bg: 'bg-indigo-50', border: 'border-indigo-200', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600', titleText: 'text-indigo-900', btn: 'bg-indigo-600 hover:bg-indigo-700' },
  powra: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', titleText: 'text-amber-900', btn: 'bg-amber-600 hover:bg-amber-700' },
  equipment: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', titleText: 'text-emerald-900', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  general: { bg: 'bg-slate-50', border: 'border-slate-200', iconBg: 'bg-slate-100', iconText: 'text-slate-600', titleText: 'text-slate-900', btn: 'bg-[#2E5A1A] hover:bg-[#1c4a12]' },
};

export default function SafetyFormsList({ step }) {
  const { safetyForms } = useMittiCheckLinks();

  const forms = (safetyForms || []).filter(f => f.step === step && f.url);
  if (forms.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {forms.map(form => {
        const Icon = CATEGORY_ICONS[form.category] || FileText;
        const c = CATEGORY_ACCENTS[form.category] || CATEGORY_ACCENTS.general;
        return (
          <a
            key={form.id}
            href={form.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 ${c.bg} ${c.border} border rounded-2xl px-4 py-4 min-h-[56px] active:scale-[0.98] transition`}
          >
            <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${c.iconText}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${c.titleText} leading-tight`}>{form.label}</p>
              {form.required && (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wide">Required</span>
              )}
            </div>
            <div className={`flex items-center gap-1.5 ${c.btn} text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0`}>
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </div>
          </a>
        );
      })}
    </div>
  );
}